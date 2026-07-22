import { prisma } from "@/lib/prisma";
import { encryptField } from "@/lib/crypto/field";
import { assertCan, isOwner, type AuthzUser } from "@/lib/authz";
import { assertBookingTransition } from "@/domain/booking/statusMachine";
import { processWorkerSurveyRisk } from "./clientSafetyService";
import { recordAudit } from "./auditService";
import type {
  RestrictionType,
  WorkerSafetyQ1,
  WorkerSafetyQ2,
  WorkerSafetyQ3,
  WorkerSafetyQ4,
  WorkerSafetyQ5,
  ClientSatisfactionQ1,
  ClientSatisfactionQ2,
  ClientSatisfactionQ3,
  ClientSatisfactionQ4,
  ClientSatisfactionQ5,
} from "@prisma/client";

export interface SubmitWorkerSafetySurveyInput {
  actingWorker: AuthzUser;
  bookingId: string;
  workerId: string;
  q1SafeAndComfortable: WorkerSafetyQ1;
  q2RespectedBoundaries: WorkerSafetyQ2;
  q3BookingAccurate: WorkerSafetyQ3;
  q4IssueSeverity: WorkerSafetyQ4;
  q5FutureBookings: WorkerSafetyQ5;
  additionalConditions: RestrictionType[];
  customConditionText?: string;
  privateNotes?: string;
}

/** Submits the private, worker-only post-service safety survey. Never visible to the client. */
export async function submitWorkerSafetySurvey(input: SubmitWorkerSafetySurveyInput) {
  assertCan(input.actingWorker, "submit_worker_survey");

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: input.bookingId },
    include: { worker: true, client: true },
  });

  if (!isOwner(input.actingWorker, booking.worker.userId)) {
    throw new Error("A worker may only submit a safety survey for their own appointment");
  }
  if (booking.workerSurveyDone) {
    throw new Error("A safety survey has already been submitted for this booking");
  }

  const existingStatus = booking.status;

  await prisma.$transaction(async (tx) => {
    await tx.workerSafetySurvey.create({
      data: {
        bookingId: input.bookingId,
        workerId: input.workerId,
        q1SafeAndComfortable: input.q1SafeAndComfortable,
        q2RespectedBoundaries: input.q2RespectedBoundaries,
        q3BookingAccurate: input.q3BookingAccurate,
        q4IssueSeverity: input.q4IssueSeverity,
        q5FutureBookings: input.q5FutureBookings,
        additionalConditions: input.additionalConditions,
        customConditionText: input.customConditionText,
        privateNotesEncrypted: input.privateNotes ? encryptField(input.privateNotes) : null,
      },
    });

    for (const conditionType of input.additionalConditions) {
      await tx.clientRestriction.create({
        data: {
          clientId: booking.clientId,
          type: conditionType,
          customText: conditionType === "CUSTOM" ? input.customConditionText : undefined,
          createdByUserId: input.actingWorker.id,
        },
      });
    }

    const nextStatus = booking.clientSurveyDone ? "FULLY_COMPLETED" : "AWAITING_CLIENT_SURVEY";
    assertBookingTransition(existingStatus, nextStatus);

    await tx.booking.update({
      where: { id: input.bookingId },
      data: { workerSurveyDone: true, status: nextStatus },
    });
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: input.bookingId,
        fromStatus: existingStatus,
        toStatus: nextStatus,
        changedByUserId: input.actingWorker.id,
        reason: "Worker safety survey submitted",
      },
    });
  });

  const riskResult = await processWorkerSurveyRisk({
    clientId: booking.clientId,
    survey: {
      q1SafeAndComfortable: input.q1SafeAndComfortable,
      q2RespectedBoundaries: input.q2RespectedBoundaries,
      q3BookingAccurate: input.q3BookingAccurate,
      q4IssueSeverity: input.q4IssueSeverity,
      q5FutureBookings: input.q5FutureBookings,
    },
  });

  if (!riskResult.recommendation.appliesAutomatically) {
    await prisma.safetyIncident.create({
      data: {
        businessId: booking.businessId,
        clientId: booking.clientId,
        workerId: input.workerId,
        bookingId: input.bookingId,
        source: "WORKER_SURVEY",
        severity: riskResult.recommendation.tier === "SERIOUS" ? "CRITICAL" : riskResult.recommendation.tier === "RESTRICT" ? "HIGH" : "MEDIUM",
        description: riskResult.recommendation.reason,
      },
    });
  }

  await recordAudit({
    businessId: booking.businessId,
    actorUserId: input.actingWorker.id,
    action: "WORKER_SAFETY_SURVEY_SUBMITTED",
    entityType: "Booking",
    entityId: input.bookingId,
  });

  return riskResult;
}

export interface SubmitClientSatisfactionSurveyInput {
  actingClient: AuthzUser;
  bookingId: string;
  clientId: string;
  q1Satisfaction: ClientSatisfactionQ1;
  q2Punctuality: ClientSatisfactionQ2;
  q3Professionalism: ClientSatisfactionQ3;
  q4MatchedExpectations: ClientSatisfactionQ4;
  q5WouldReturn: ClientSatisfactionQ5;
  comments?: string;
  contactMeBack: boolean;
}

const NEGATIVE_ANSWERS = new Set([
  "DISSATISFIED",
  "VERY_DISSATISFIED",
  "SIGNIFICANTLY_OFF",
  "DID_NOT_PROCEED",
  "NEEDS_IMPROVEMENT",
  "NO",
  "NOT_ENTIRELY",
  "PROBABLY_NOT",
  "DEFINITELY_NOT",
]);

/**
 * Submits the client-facing satisfaction survey. Negative answers create an admin review task
 * (a SafetyIncident with source=CLIENT_FEEDBACK) but NEVER automatically penalise the worker —
 * see /docs/06-safety-risk-rules.md "Client-satisfaction survey -> review tasks".
 */
export async function submitClientSatisfactionSurvey(input: SubmitClientSatisfactionSurveyInput) {
  assertCan(input.actingClient, "submit_client_survey");

  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: input.bookingId }, include: { client: true } });

  if (!isOwner(input.actingClient, booking.client.userId ?? "")) {
    throw new Error("A client may only submit a satisfaction survey for their own appointment");
  }
  if (booking.clientSurveyDone) {
    throw new Error("A satisfaction survey has already been submitted for this booking");
  }

  const answers = [
    input.q1Satisfaction,
    input.q2Punctuality,
    input.q3Professionalism,
    input.q4MatchedExpectations,
    input.q5WouldReturn,
  ];
  const hasNegativeAnswer = answers.some((a) => NEGATIVE_ANSWERS.has(a));

  const existingStatus = booking.status;
  const nextStatus = booking.workerSurveyDone ? "FULLY_COMPLETED" : "AWAITING_WORKER_SURVEY";

  await prisma.$transaction(async (tx) => {
    await tx.clientSatisfactionSurvey.create({
      data: {
        bookingId: input.bookingId,
        clientId: input.clientId,
        q1Satisfaction: input.q1Satisfaction,
        q2Punctuality: input.q2Punctuality,
        q3Professionalism: input.q3Professionalism,
        q4MatchedExpectations: input.q4MatchedExpectations,
        q5WouldReturn: input.q5WouldReturn,
        comments: input.comments,
        contactMeBack: input.contactMeBack,
      },
    });

    assertBookingTransition(existingStatus, nextStatus);

    await tx.booking.update({ where: { id: input.bookingId }, data: { clientSurveyDone: true, status: nextStatus } });
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: input.bookingId,
        fromStatus: existingStatus,
        toStatus: nextStatus,
        changedByUserId: input.actingClient.id,
        reason: "Client satisfaction survey submitted",
      },
    });

    if (hasNegativeAnswer) {
      await tx.safetyIncident.create({
        data: {
          businessId: booking.businessId,
          clientId: booking.clientId,
          bookingId: input.bookingId,
          source: "CLIENT_FEEDBACK",
          severity: "LOW",
          description: "Negative client satisfaction survey answer — admin review requested (no automatic worker action taken).",
        },
      });
    }
  });

  return { hasNegativeAnswer };
}
