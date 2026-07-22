import { prisma } from "@/lib/prisma";
import { assertCan, type AuthzUser } from "@/lib/authz";
import {
  assertNoConflict,
  computeOccupiedWindow,
  findAvailableSlots,
  type BusyInterval,
  type CandidateSlotInput,
  type DailyLoad,
  type SlotSearchParams,
  type WorkerAvailabilityRule,
} from "@/domain/booking/availability";
import { assertBookingTransition } from "@/domain/booking/statusMachine";
import { getCalendarProvider } from "@/integrations/calendar";
import { recordAudit } from "./auditService";
import type { BookingStatus } from "@prisma/client";

async function loadWorkerAvailabilityRules(workerId: string): Promise<WorkerAvailabilityRule[]> {
  const rows = await prisma.workerAvailability.findMany({ where: { workerId } });
  return rows.map((r) => ({
    dayOfWeek: r.dayOfWeek,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    breakStartMinute: r.breakStartMinute ?? undefined,
    breakEndMinute: r.breakEndMinute ?? undefined,
  }));
}

async function loadBlockedTimes(workerId: string, from: Date, to: Date) {
  const rows = await prisma.blockedTime.findMany({
    where: { workerId, startAt: { lte: to }, endAt: { gte: from } },
  });
  return rows.map((r) => ({ start: r.startAt, end: r.endAt }));
}

/** Builds already-buffered busy intervals from existing non-terminal bookings, so the domain
 * layer never has to know about setup/pack-down/travel — it just sees "busy". */
async function loadBusyIntervals(workerId: string, from: Date, to: Date): Promise<BusyInterval[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      workerId,
      confirmedStart: { not: null },
      confirmedEnd: { not: null },
      status: { notIn: ["CANCELLED", "NO_SHOW", "BLOCKED"] },
    },
  });

  const bookingIntervals: BusyInterval[] = bookings.map((b) => {
    const candidate: CandidateSlotInput = {
      slotStart: b.confirmedStart!,
      slotEnd: b.confirmedEnd!,
      setupMinutes: b.setupMinutes ?? 0,
      packDownMinutes: b.packDownMinutes ?? 0,
      travelMinutesBefore: b.travelMinutes ?? 0,
      travelMinutesAfter: b.travelMinutes ?? 0,
    };
    const window = computeOccupiedWindow(candidate);
    return { ...window, sourceBookingId: b.id, label: "Existing booking" };
  });

  const connection = await prisma.calendarConnection.findFirst({ where: { workerId } });
  let calendarIntervals: BusyInterval[] = [];
  if (connection) {
    const provider = getCalendarProvider();
    const busy = await provider.listBusyBlocks(
      { accessToken: connection.accessTokenEncrypted, refreshToken: connection.refreshTokenEncrypted ?? undefined },
      connection.calendarId ?? "primary",
      from,
      to,
    );
    calendarIntervals = busy.map((b) => ({ start: b.start, end: b.end, label: b.title ?? "Connected calendar" }));
  }

  return [...bookingIntervals, ...calendarIntervals];
}

async function loadDailyLoad(workerId: string, from: Date, to: Date): Promise<Map<string, DailyLoad>> {
  const bookings = await prisma.booking.findMany({
    where: {
      workerId,
      confirmedStart: { not: null, gte: from, lte: to },
      status: { notIn: ["CANCELLED", "NO_SHOW", "BLOCKED"] },
    },
  });
  const map = new Map<string, DailyLoad>();
  for (const b of bookings) {
    const key = b.confirmedStart!.toISOString().slice(0, 10);
    const minutes = b.confirmedEnd ? (b.confirmedEnd.getTime() - b.confirmedStart!.getTime()) / 60_000 : 0;
    const existing = map.get(key) ?? { bookingCount: 0, totalMinutesCommitted: 0 };
    map.set(key, { bookingCount: existing.bookingCount + 1, totalMinutesCommitted: existing.totalMinutesCommitted + minutes });
  }
  return map;
}

export interface SearchSlotsInput {
  workerId: string;
  serviceId: string;
  searchFrom: Date;
  searchTo: Date;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
}

/** Offers only genuinely available slots — the single entry point the AI assistant and the
 * client booking UI both call, so neither can ever offer a slot the engine would reject. */
export async function searchAvailableSlots(input: SearchSlotsInput) {
  const worker = await prisma.worker.findUniqueOrThrow({ where: { id: input.workerId } });
  const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });
  const workerService = await prisma.workerService.findUnique({
    where: { workerId_serviceId: { workerId: input.workerId, serviceId: input.serviceId } },
  });

  const params: SlotSearchParams = {
    now: new Date(),
    searchFrom: input.searchFrom,
    searchTo: input.searchTo,
    serviceDurationMinutes: workerService?.durationMinutesOverride ?? service.baseDurationMinutes,
    setupMinutes: worker.defaultSetupMinutes,
    packDownMinutes: worker.defaultPackDownMinutes,
    travelMinutesBefore: input.travelMinutesBefore,
    travelMinutesAfter: input.travelMinutesAfter,
    minimumNoticeHours: worker.minimumNoticeHours,
    maximumAdvanceDays: worker.maximumAdvanceDays,
    maxJobsPerDay: worker.maxJobsPerDay,
    maxWorkingHoursPerDay: worker.maxWorkingHoursPerDay,
    availability: await loadWorkerAvailabilityRules(input.workerId),
    blockedTimes: await loadBlockedTimes(input.workerId, input.searchFrom, input.searchTo),
    busyIntervals: await loadBusyIntervals(input.workerId, input.searchFrom, input.searchTo),
    dailyLoadByDate: await loadDailyLoad(input.workerId, input.searchFrom, input.searchTo),
  };

  return findAvailableSlots(params);
}

export interface CreateBookingRequestInput {
  businessId: string;
  clientId: string;
  workerId: string;
  serviceId: string;
  addressId?: string;
  slotStart: Date;
  slotEnd: Date;
  setupMinutes: number;
  packDownMinutes: number;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
  requiresDriver: boolean;
  depositRequiredCents: number;
}

/** Creates a booking, re-validating (never trusting a previously-offered slot is still free)
 * against the same conflict check used to generate offers in the first place. */
export async function createBookingRequest(input: CreateBookingRequestInput) {
  const busyIntervals = await loadBusyIntervals(input.workerId, input.slotStart, input.slotEnd);
  const candidate: CandidateSlotInput = {
    slotStart: input.slotStart,
    slotEnd: input.slotEnd,
    setupMinutes: input.setupMinutes,
    packDownMinutes: input.packDownMinutes,
    travelMinutesBefore: input.travelMinutesBefore,
    travelMinutesAfter: input.travelMinutesAfter,
  };
  assertNoConflict(candidate, busyIntervals);

  const worker = await prisma.worker.findUniqueOrThrow({ where: { id: input.workerId } });
  const initialStatus: BookingStatus = input.depositRequiredCents > 0 ? "AWAITING_DEPOSIT" : "AWAITING_WORKER_APPROVAL";

  const booking = await prisma.booking.create({
    data: {
      businessId: input.businessId,
      clientId: input.clientId,
      workerId: input.workerId,
      serviceId: input.serviceId,
      addressId: input.addressId,
      status: "NEW_ENQUIRY",
      requestedStart: input.slotStart,
      confirmedStart: input.slotStart,
      confirmedEnd: input.slotEnd,
      setupMinutes: input.setupMinutes,
      packDownMinutes: input.packDownMinutes,
      travelMinutes: input.travelMinutesBefore,
      requiresDriver: input.requiresDriver,
      depositRequiredCents: input.depositRequiredCents,
    },
  });

  const nextStatus = worker.autoApproveBookings && input.depositRequiredCents === 0 ? "CONFIRMED" : initialStatus;

  // The client has already been shown a genuinely-available slot and chosen it in one step, so
  // we walk the state machine through the intermediate offer/response/deposit states it
  // actually passed through (each hop is still recorded in BookingStatusHistory) rather than
  // jumping straight to the final status. AWAITING_DEPOSIT is a real waypoint even when no
  // deposit is required — it is simply satisfied instantly in that case.
  const path: BookingStatus[] = ["AVAILABILITY_OFFERED", "AWAITING_CLIENT_RESPONSE", "AWAITING_DEPOSIT"];
  if (nextStatus !== "AWAITING_DEPOSIT") {
    path.push(nextStatus);
  }
  for (const status of path) {
    await transitionBooking(booking.id, status, null, "Booking created");
  }

  return prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
}

/** The single choke point for advancing a booking's status. Enforces the state machine and
 * always writes a BookingStatusHistory row. */
export async function transitionBooking(
  bookingId: string,
  toStatus: BookingStatus,
  changedByUserId: string | null,
  reason?: string,
) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  assertBookingTransition(booking.status, toStatus);

  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: toStatus } }),
    prisma.bookingStatusHistory.create({
      data: { bookingId, fromStatus: booking.status, toStatus, changedByUserId, reason },
    }),
  ]);
}

export interface ApproveBookingInput {
  admin: AuthzUser;
  bookingId: string;
}

export async function approveManualReviewBooking(input: ApproveBookingInput) {
  assertCan(input.admin, "approve_manual_review_booking");
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: input.bookingId } });
  const nextStatus: BookingStatus = booking.requiresDriver ? "DRIVER_REQUIRED" : "CONFIRMED";
  await transitionBooking(input.bookingId, nextStatus, input.admin.id, "Approved by admin/worker");
  await recordAudit({
    businessId: input.admin.businessId,
    actorUserId: input.admin.id,
    action: "BOOKING_APPROVED",
    entityType: "Booking",
    entityId: input.bookingId,
  });
}

/** Worker safety check-in — one of Start-trip / Arrival / Start-service / End-service. */
export async function recordSafetyCheckIn(
  bookingId: string,
  checkIn: "EN_ROUTE" | "ARRIVED" | "SERVICE_STARTED" | "SERVICE_ENDED",
  actingUserId: string,
) {
  const statusMap: Record<typeof checkIn, BookingStatus> = {
    EN_ROUTE: "WORKER_EN_ROUTE",
    ARRIVED: "WORKER_ARRIVED",
    SERVICE_STARTED: "SERVICE_IN_PROGRESS",
    SERVICE_ENDED: "SERVICE_COMPLETED",
  };
  await transitionBooking(bookingId, statusMap[checkIn], actingUserId, `Safety check-in: ${checkIn}`);
}

/** Immediately escalates a booking to safety review — used by the emergency button and by
 * any manual safety escalation trigger. */
export async function escalateToSafetyReview(bookingId: string, actingUserId: string, reason: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  await transitionBooking(bookingId, "SAFETY_REVIEW", actingUserId, reason);
  await prisma.safetyIncident.create({
    data: {
      businessId: booking.businessId,
      clientId: booking.clientId,
      workerId: booking.workerId,
      bookingId,
      source: "MANUAL_REPORT",
      severity: "HIGH",
      description: reason,
      reportedByUserId: actingUserId,
    },
  });
}
