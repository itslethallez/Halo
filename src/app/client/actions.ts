"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAuthzUser } from "@/lib/auth/currentUser";
import { prisma } from "@/lib/prisma";
import { submitClientSatisfactionSurvey } from "@/services/surveyService";
import type {
  ClientSatisfactionQ1,
  ClientSatisfactionQ2,
  ClientSatisfactionQ3,
  ClientSatisfactionQ4,
  ClientSatisfactionQ5,
} from "@prisma/client";

export async function submitSatisfactionSurveyAction(formData: FormData) {
  const authzUser = await getCurrentAuthzUser();
  if (!authzUser || authzUser.role !== "CLIENT") throw new Error("Not authenticated as a client");

  const client = await prisma.client.findUniqueOrThrow({ where: { userId: authzUser.id } });
  const bookingId = String(formData.get("bookingId"));

  await submitClientSatisfactionSurvey({
    actingClient: authzUser,
    bookingId,
    clientId: client.id,
    q1Satisfaction: String(formData.get("q1")) as ClientSatisfactionQ1,
    q2Punctuality: String(formData.get("q2")) as ClientSatisfactionQ2,
    q3Professionalism: String(formData.get("q3")) as ClientSatisfactionQ3,
    q4MatchedExpectations: String(formData.get("q4")) as ClientSatisfactionQ4,
    q5WouldReturn: String(formData.get("q5")) as ClientSatisfactionQ5,
    comments: String(formData.get("comments") ?? "") || undefined,
    contactMeBack: formData.get("contactMeBack") === "on",
  });

  revalidatePath("/client");
}
