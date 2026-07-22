import { prisma } from "@/lib/prisma";
import { assertCan, type AuthzUser } from "@/lib/authz";
import {
  applyRecommendation,
  recommendClientStatus,
  type ClientSafetyStatus,
  type RiskEngineInput,
  type WorkerSafetySurveyAnswers,
} from "@/domain/risk/riskEngine";
import { recordAudit } from "./auditService";

async function countPriorMinorConcerns(clientId: string): Promise<number> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  return prisma.clientSafetyStatusHistory.count({
    where: {
      clientId,
      createdAt: { gte: twelveMonthsAgo },
      reason: { contains: "Minor concern" },
    },
  });
}

export interface ProcessWorkerSurveyInput {
  clientId: string;
  survey: WorkerSafetySurveyAnswers;
}

/**
 * Runs the risk engine against a freshly submitted worker safety survey and applies its
 * recommendation according to the severity->automation matrix (see
 * /docs/06-safety-risk-rules.md). Significant/serious/restrict-tier outcomes are written as a
 * pending state (client's automatic-booking eligibility is affected immediately where the
 * rules require it) but the *status itself* only becomes final admin-confirmed history once an
 * admin acts — this function still writes the ClientSafetyStatusHistory row for every change so
 * the "who/when/why" trail is unbroken even for auto-applied changes.
 */
export async function processWorkerSurveyRisk(input: ProcessWorkerSurveyInput) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: input.clientId } });
  const completedBookingCount = await prisma.booking.count({
    where: { clientId: input.clientId, status: "FULLY_COMPLETED" },
  });
  const priorMinorConcernCount = await countPriorMinorConcerns(input.clientId);

  const engineInput: RiskEngineInput = {
    survey: input.survey,
    currentEffectiveStatus: client.safetyStatus as ClientSafetyStatus,
    priorMinorConcernCountLast12Months: priorMinorConcernCount,
    completedBookingCount,
  };

  const recommendation = recommendClientStatus(engineInput);
  const nextStatus = applyRecommendation(client.safetyStatus as ClientSafetyStatus, recommendation);

  if (nextStatus !== client.safetyStatus) {
    await prisma.$transaction([
      prisma.client.update({ where: { id: input.clientId }, data: { safetyStatus: nextStatus } }),
      prisma.clientSafetyStatusHistory.create({
        data: {
          clientId: input.clientId,
          fromStatus: client.safetyStatus,
          toStatus: nextStatus,
          reason: recommendation.reason,
          changedByUserId: null, // system-applied
        },
      }),
    ]);
  }

  return { recommendation, appliedStatus: nextStatus };
}

export interface AdminReviewAndSetStatusInput {
  admin: AuthzUser;
  clientId: string;
  newStatus: ClientSafetyStatus;
  reason: string;
}

/**
 * The distinct, explicit admin action required to finalize (or clear) a serious safety
 * recommendation. Never invoked automatically. See /docs/06-safety-risk-rules.md rule 8.
 */
export async function adminReviewAndSetStatus(input: AdminReviewAndSetStatusInput) {
  assertCan(input.admin, "change_client_safety_status");

  const client = await prisma.client.findUniqueOrThrow({ where: { id: input.clientId } });

  await prisma.$transaction([
    prisma.client.update({ where: { id: input.clientId }, data: { safetyStatus: input.newStatus } }),
    prisma.clientSafetyStatusHistory.create({
      data: {
        clientId: input.clientId,
        fromStatus: client.safetyStatus,
        toStatus: input.newStatus,
        reason: input.reason,
        changedByUserId: input.admin.id,
      },
    }),
  ]);

  await recordAudit({
    businessId: input.admin.businessId,
    actorUserId: input.admin.id,
    action: "CLIENT_SAFETY_STATUS_CHANGED",
    entityType: "Client",
    entityId: input.clientId,
    metadata: { fromStatus: client.safetyStatus, toStatus: input.newStatus, reason: input.reason },
  });
}

/**
 * Enforces that a worker only ever sees THEIR OWN private survey notes about a client, never
 * another worker's free-text notes — unless the business has explicitly turned on
 * cross-worker safety-status sharing (which shares status, not notes; see
 * /docs/03-permissions.md "Worker isolation"). Returns only the safety status + active
 * restrictions for cross-worker visibility, and the worker's own past surveys where owned.
 */
export async function getClientSafetyViewForWorker(workerId: string, clientId: string) {
  const worker = await prisma.worker.findUniqueOrThrow({ where: { id: workerId }, include: { business: true } });
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  const ownSurveys = await prisma.workerSafetySurvey.findMany({
    where: { workerId, booking: { clientId } },
    orderBy: { createdAt: "desc" },
  });

  const activeRestrictions = await prisma.clientRestriction.findMany({
    where: { clientId, active: true },
  });

  return {
    safetyStatus: client.safetyStatus,
    activeRestrictions,
    ownPastSurveys: ownSurveys,
    // Explicitly never returned: other workers' WorkerSafetySurvey.privateNotesEncrypted rows.
    crossWorkerNotesVisible: worker.business.shareSafetyStatusAcrossWorkers,
  };
}
