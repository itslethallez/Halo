"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAuthzUser } from "@/lib/auth/currentUser";
import { prisma } from "@/lib/prisma";
import { recordSafetyCheckIn, escalateToSafetyReview } from "@/services/bookingService";
import { submitWorkerSafetySurvey } from "@/services/surveyService";
import type { RestrictionType, WorkerSafetyQ1, WorkerSafetyQ2, WorkerSafetyQ3, WorkerSafetyQ4, WorkerSafetyQ5 } from "@prisma/client";

async function requireWorker() {
  const authzUser = await getCurrentAuthzUser();
  if (!authzUser || authzUser.role !== "WORKER") throw new Error("Not authenticated as a worker");
  const worker = await prisma.worker.findUniqueOrThrow({ where: { userId: authzUser.id } });
  return { authzUser, worker };
}

export async function checkInAction(bookingId: string, checkIn: "EN_ROUTE" | "ARRIVED" | "SERVICE_STARTED" | "SERVICE_ENDED") {
  const { authzUser } = await requireWorker();
  await recordSafetyCheckIn(bookingId, checkIn, authzUser.id);
  revalidatePath("/worker");
}

export async function emergencyEscalationAction(bookingId: string) {
  const { authzUser } = await requireWorker();
  await escalateToSafetyReview(bookingId, authzUser.id, "Emergency button pressed by worker");
  revalidatePath("/worker");
}

export async function submitSafetySurveyAction(formData: FormData) {
  const { authzUser, worker } = await requireWorker();
  const bookingId = String(formData.get("bookingId"));
  const additionalConditions = formData.getAll("additionalConditions") as RestrictionType[];

  await submitWorkerSafetySurvey({
    actingWorker: authzUser,
    bookingId,
    workerId: worker.id,
    q1SafeAndComfortable: String(formData.get("q1")) as WorkerSafetyQ1,
    q2RespectedBoundaries: String(formData.get("q2")) as WorkerSafetyQ2,
    q3BookingAccurate: String(formData.get("q3")) as WorkerSafetyQ3,
    q4IssueSeverity: String(formData.get("q4")) as WorkerSafetyQ4,
    q5FutureBookings: String(formData.get("q5")) as WorkerSafetyQ5,
    additionalConditions,
    customConditionText: String(formData.get("customConditionText") ?? "") || undefined,
    privateNotes: String(formData.get("privateNotes") ?? "") || undefined,
  });

  revalidatePath("/worker");
}
