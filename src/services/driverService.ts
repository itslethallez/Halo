import { prisma } from "@/lib/prisma";
import { assertCan, isOwner, type AuthzUser } from "@/lib/authz";
import { getMapsProvider } from "@/integrations/maps";
import {
  DEFAULT_DRIVER_SCORING_WEIGHTS,
  rankCandidateDrivers,
  topCandidate,
  type DriverCandidate,
  type DriverJobInput,
} from "@/domain/driver/allocation";
import { assertDriverJobTransition } from "@/domain/driver/statusMachine";
import { recordAudit } from "./auditService";
import type { DriverJobStatus, RestrictionType } from "@prisma/client";

export interface CreateDriverJobInput {
  businessId: string;
  bookingId: string;
  workerId: string;
  pickupAddress: string;
  destinationAddress: string;
  destinationSuburb: string;
  pickupSuburb: string;
  scheduledStart: Date;
  returnTripRequired: boolean;
  specialInstructions?: string;
  safetyRequirements: RestrictionType[];
  typicalCostBandCents: { min: number; max: number };
}

export async function createDriverJobAndRank(input: CreateDriverJobInput) {
  const maps = getMapsProvider();
  const travel = await maps.estimateTravelTime(input.pickupAddress, input.destinationAddress);

  const job = await prisma.driverJob.create({
    data: {
      businessId: input.businessId,
      bookingId: input.bookingId,
      workerId: input.workerId,
      pickupAddress: input.pickupAddress,
      destinationAddress: input.destinationAddress,
      scheduledStart: input.scheduledStart,
      estimatedTravelMinutes: travel.travelMinutes,
      returnTripRequired: input.returnTripRequired,
      specialInstructions: input.specialInstructions,
      safetyRequirements: input.safetyRequirements,
      status: "UNASSIGNED",
    },
  });

  const candidates = await prisma.driver.findMany({ where: { businessId: input.businessId, active: true } });
  const preferences = await prisma.workerDriverPreference.findMany({ where: { workerId: input.workerId } });
  const scheduledEnd = new Date(input.scheduledStart.getTime() + (travel.travelMinutes + 60) * 60_000);

  const jobInput: DriverJobInput = {
    scheduledStart: input.scheduledStart,
    scheduledEnd,
    pickupSuburb: input.pickupSuburb,
    destinationSuburb: input.destinationSuburb,
    mustRemainNearby: input.safetyRequirements.includes("DRIVER_MUST_REMAIN_NEARBY"),
    typicalCostBandCents: input.typicalCostBandCents,
  };

  const driverCandidates: DriverCandidate[] = await Promise.all(
    candidates.map(async (d) => {
      const overlappingJobs = await prisma.driverJob.count({
        where: {
          driverId: d.id,
          status: { in: ["OFFERED", "ACCEPTED", "EN_ROUTE_TO_WORKER", "WORKER_COLLECTED", "ARRIVED_AT_DESTINATION", "WAITING"] },
        },
      });
      const pref = preferences.find((p) => p.driverId === d.id);
      return {
        driverId: d.id,
        isAvailableForWindow: true, // MVP: availability windows checked at accept-time; see docs for future enhancement
        serviceAreas: d.serviceAreas,
        distanceKmFromPickup: travel.distanceKm,
        ratingAverage: d.ratingAverage,
        canRemainNearby: d.canRemainNearby,
        workerPreference: pref?.preference,
        expectedCostCents: Math.round((input.typicalCostBandCents.min + input.typicalCostBandCents.max) / 2),
        currentAssignedJobsInWindow: overlappingJobs,
      };
    }),
  );

  const ranked = rankCandidateDrivers(jobInput, driverCandidates, DEFAULT_DRIVER_SCORING_WEIGHTS);

  const business = await prisma.business.findUniqueOrThrow({ where: { id: input.businessId } });
  if (business.autoOfferTopDriver) {
    const top = topCandidate(ranked);
    if (top) {
      await offerDriverJob(job.id, top.driverId);
    }
  }

  return { job, ranked };
}

export async function offerDriverJob(driverJobId: string, driverId: string) {
  const job = await prisma.driverJob.findUniqueOrThrow({ where: { id: driverJobId } });
  assertDriverJobTransition(job.status, "OFFERED");
  await prisma.$transaction([
    prisma.driverJob.update({ where: { id: driverJobId }, data: { status: "OFFERED", driverId, offeredAt: new Date() } }),
    prisma.driverStatusHistory.create({ data: { driverJobId, fromStatus: job.status, toStatus: "OFFERED" } }),
  ]);
}

export interface AssignManuallyInput {
  actingUser: AuthzUser;
  driverJobId: string;
  driverId: string;
}

export async function assignDriverManually(input: AssignManuallyInput) {
  assertCan(input.actingUser, "create_allocate_driver_job");
  await offerDriverJob(input.driverJobId, input.driverId);
  await recordAudit({
    businessId: input.actingUser.businessId,
    actorUserId: input.actingUser.id,
    action: "DRIVER_JOB_ASSIGNED_MANUALLY",
    entityType: "DriverJob",
    entityId: input.driverJobId,
  });
}

export interface DriverRespondInput {
  driver: AuthzUser;
  driverJobId: string;
  accept: boolean;
}

/** A driver accepts or declines their own offered job — never someone else's. */
export async function driverRespondToOffer(input: DriverRespondInput) {
  assertCan(input.driver, "accept_decline_own_driver_job");

  const job = await prisma.driverJob.findUniqueOrThrow({ where: { id: input.driverJobId }, include: { driver: true } });
  if (!job.driver || !isOwner(input.driver, job.driver.userId)) {
    throw new Error("A driver may only respond to their own offered job");
  }

  const nextStatus: DriverJobStatus = input.accept ? "ACCEPTED" : "DECLINED";
  assertDriverJobTransition(job.status, nextStatus);

  await prisma.$transaction([
    prisma.driverJob.update({
      where: { id: input.driverJobId },
      data: { status: nextStatus, acceptedAt: input.accept ? new Date() : null },
    }),
    prisma.driverStatusHistory.create({ data: { driverJobId: input.driverJobId, fromStatus: job.status, toStatus: nextStatus, changedByUserId: input.driver.id } }),
  ]);

  if (nextStatus === "ACCEPTED") {
    await import("./bookingService").then(({ transitionBooking }) =>
      transitionBooking(job.bookingId, "DRIVER_ASSIGNED", input.driver.id, "Driver accepted the transport job"),
    );
  }

  return nextStatus;
}

/** Strips a DriverJob down to exactly what a driver needs — see /docs/07-driver-allocation.md
 * "Data minimisation for drivers". Never includes client profile, survey, or payment-beyond-own data. */
export interface DriverJobView {
  id: string;
  pickupAddress: string;
  destinationAddress: string;
  scheduledStart: Date;
  estimatedTravelMinutes: number;
  estimatedWaitingMinutes: number | null;
  returnTripRequired: boolean;
  specialInstructions: string | null;
  status: DriverJobStatus;
  driverPaymentCents: number;
}

export function toDriverJobView(job: {
  id: string;
  pickupAddress: string;
  destinationAddress: string;
  scheduledStart: Date;
  estimatedTravelMinutes: number;
  estimatedWaitingMinutes: number | null;
  returnTripRequired: boolean;
  specialInstructions: string | null;
  status: DriverJobStatus;
  driverPaymentCents: number;
}): DriverJobView {
  return {
    id: job.id,
    pickupAddress: job.pickupAddress,
    destinationAddress: job.destinationAddress,
    scheduledStart: job.scheduledStart,
    estimatedTravelMinutes: job.estimatedTravelMinutes,
    estimatedWaitingMinutes: job.estimatedWaitingMinutes,
    returnTripRequired: job.returnTripRequired,
    specialInstructions: job.specialInstructions,
    status: job.status,
    driverPaymentCents: job.driverPaymentCents,
  };
}
