"use server";

import { prisma } from "@/lib/prisma";
import { searchAvailableSlots, createBookingRequest } from "@/services/bookingService";
import { getAiProvider } from "@/integrations/ai";
import { composeIntroMessage, detectEscalation } from "@/domain/messaging/assistant";
import { hashPassword } from "@/lib/crypto/password";

export interface SlotOption {
  startIso: string;
  endIso: string;
}

export async function searchSlotsAction(workerId: string, serviceId: string): Promise<SlotOption[]> {
  const now = new Date();
  const from = new Date(now.getTime() + 60 * 60 * 1000);
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const slots = await searchAvailableSlots({
    workerId,
    serviceId,
    searchFrom: from,
    searchTo: to,
    travelMinutesBefore: 20,
    travelMinutesAfter: 20,
  });

  return slots.slice(0, 8).map((s) => ({ startIso: s.start.toISOString(), endIso: s.end.toISOString() }));
}

export interface CreateEnquiryResult {
  bookingId: string;
  status: string;
}

export async function submitBookingRequestAction(formData: FormData): Promise<CreateEnquiryResult> {
  const workerId = String(formData.get("workerId"));
  const serviceId = String(formData.get("serviceId"));
  const startIso = String(formData.get("startIso"));
  const endIso = String(formData.get("endIso"));
  const fullName = String(formData.get("fullName"));
  const phone = String(formData.get("phone"));
  const email = String(formData.get("email"));
  const suburb = String(formData.get("suburb"));

  const worker = await prisma.worker.findUniqueOrThrow({ where: { id: workerId } });
  const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });

  let client = await prisma.client.findFirst({ where: { businessId: worker.businessId, phone } });
  if (!client) {
    const passwordHash = await hashPassword(crypto.randomUUID());
    const user = await prisma.user.create({
      data: { businessId: worker.businessId, email: email || `${crypto.randomUUID()}@guest.truereach.example`, passwordHash, name: fullName, phone, role: "CLIENT" },
    });
    client = await prisma.client.create({
      data: { businessId: worker.businessId, userId: user.id, fullName, phone, email, verifiedContact: false },
    });
  }

  const address = await prisma.clientAddress.create({
    data: { clientId: client.id, line1: "Provided at booking", suburb, state: "NSW", postcode: "0000", isPrimary: false },
  });

  const booking = await createBookingRequest({
    businessId: worker.businessId,
    clientId: client.id,
    workerId: worker.id,
    serviceId: service.id,
    addressId: address.id,
    slotStart: new Date(startIso),
    slotEnd: new Date(endIso),
    setupMinutes: worker.defaultSetupMinutes,
    packDownMinutes: worker.defaultPackDownMinutes,
    travelMinutesBefore: 20,
    travelMinutesAfter: 20,
    requiresDriver: service.requiresDriverDefault,
    depositRequiredCents: 5000,
  });

  return { bookingId: booking.id, status: booking.status };
}

export interface AssistantReplyResult {
  reply: string;
  needsHuman: boolean;
}

/** Demonstrates the AI assistant's identity rule + escalation detection using real service data. */
export async function askAssistantAction(workerId: string, message: string): Promise<AssistantReplyResult> {
  const worker = await prisma.worker.findUniqueOrThrow({ where: { id: workerId } });
  const services = await prisma.workerService.findMany({ where: { workerId }, include: { service: true } });

  const escalation = detectEscalation({
    messageText: message,
    clientSafetyStatus: "STANDARD",
    identityOrAddressChangeCountThisConversation: 0,
    paymentDisputeMentioned: /refund|dispute|chargeback/i.test(message),
    requestedServiceIsInCatalogue: true,
    workerManualReviewKeywords: [],
    assistantConfidence: 0.9,
  });

  if (escalation.needsHuman) {
    return { reply: escalation.holdingMessage ?? "I've flagged this for the team.", needsHuman: true };
  }

  const provider = getAiProvider();
  const systemBrief = `Services available: ${services.map((s) => `${s.service.name} ($${(s.priceCentsOverride ?? s.service.basePriceCents) / 100})`).join(", ")}.`;

  const reply = await provider.generateReply({
    workerDisplayName: worker.displayName,
    toneStyle: worker.toneStyle,
    customToneDescription: worker.customToneDescription ?? undefined,
    systemBrief,
    history: [],
    latestClientMessage: message,
  });

  return { reply: reply.text, needsHuman: false };
}

export async function getIntroMessage(workerId: string): Promise<string> {
  const worker = await prisma.worker.findUniqueOrThrow({ where: { id: workerId } });
  return composeIntroMessage(worker.displayName, worker.toneStyle, worker.customToneDescription ?? undefined);
}
