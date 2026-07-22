import { describe, it, expect } from "vitest";
import {
  assertNeverImpersonatesWorker,
  composeIntroMessage,
  detectEscalation,
  type EscalationCheckInput,
} from "../assistant";

function baseInput(overrides: Partial<EscalationCheckInput> = {}): EscalationCheckInput {
  return {
    messageText: "Hi, I'd like to book a 60 minute relaxation massage please",
    clientSafetyStatus: "STANDARD",
    identityOrAddressChangeCountThisConversation: 0,
    paymentDisputeMentioned: false,
    requestedServiceIsInCatalogue: true,
    workerManualReviewKeywords: [],
    assistantConfidence: 0.9,
    ...overrides,
  };
}

describe("assistant escalation rules", () => {
  it("does not escalate a normal booking request", () => {
    expect(detectEscalation(baseInput()).needsHuman).toBe(false);
  });

  it("escalates abusive or threatening language", () => {
    const result = detectEscalation(baseInput({ messageText: "fuck you, reschedule now" }));
    expect(result.needsHuman).toBe(true);
    expect(result.reason).toBe("ABUSIVE_OR_THREATENING");
  });

  it("escalates inappropriate/sexualised requests as out of scope for the service", () => {
    const result = detectEscalation(baseInput({ messageText: "can you offer a happy ending" }));
    expect(result.needsHuman).toBe(true);
    expect(result.reason).toBe("INAPPROPRIATE_LANGUAGE");
  });

  it("escalates a payment dispute", () => {
    const result = detectEscalation(baseInput({ paymentDisputeMentioned: true }));
    expect(result.reason).toBe("PAYMENT_DISPUTE");
  });

  it("escalates when the client already has a safety flag", () => {
    const result = detectEscalation(baseInput({ clientSafetyStatus: "MANUAL_REVIEW_REQUIRED" }));
    expect(result.reason).toBe("EXISTING_SAFETY_FLAG");
  });

  it("escalates a restricted or blocked client even more directly", () => {
    expect(detectEscalation(baseInput({ clientSafetyStatus: "RESTRICTED" })).reason).toBe("EXISTING_SAFETY_FLAG");
    expect(detectEscalation(baseInput({ clientSafetyStatus: "BLOCKED_PENDING_INVESTIGATION" })).reason).toBe(
      "EXISTING_SAFETY_FLAG",
    );
  });

  it("escalates a request for a service outside the catalogue", () => {
    const result = detectEscalation(baseInput({ requestedServiceIsInCatalogue: false }));
    expect(result.reason).toBe("OUT_OF_SCOPE_REQUEST");
  });

  it("escalates repeated identity/address changes", () => {
    const result = detectEscalation(baseInput({ identityOrAddressChangeCountThisConversation: 2 }));
    expect(result.reason).toBe("REPEATED_IDENTITY_OR_ADDRESS_CHANGES");
  });

  it("escalates when a worker-configured manual-review keyword is present", () => {
    const result = detectEscalation(
      baseInput({ messageText: "I'd like a couples massage please", workerManualReviewKeywords: ["couples"] }),
    );
    expect(result.reason).toBe("WORKER_CONFIGURED_MANUAL_REVIEW");
  });

  it("escalates when the assistant's own confidence is below threshold", () => {
    const result = detectEscalation(baseInput({ assistantConfidence: 0.2 }));
    expect(result.reason).toBe("ASSISTANT_UNCERTAIN");
  });

  it("every escalation includes a holding message", () => {
    const result = detectEscalation(baseInput({ paymentDisputeMentioned: true }));
    expect(result.holdingMessage).toBeTruthy();
  });
});

describe("assistant identity rules", () => {
  it("every tone's intro message discloses that it is an assistant, not the worker", () => {
    const tones = ["WARM_FRIENDLY", "PROFESSIONAL", "CASUAL", "BRIEF_DIRECT"] as const;
    for (const tone of tones) {
      const message = composeIntroMessage("Sarah", tone);
      expect(message).toMatch(/assistant/i);
      expect(assertNeverImpersonatesWorker(message, "Sarah")).toBe(true);
    }
  });

  it("flags a message that would impersonate the worker personally", () => {
    const impersonating = "Hi, this is Sarah personally, I'll be right over";
    expect(assertNeverImpersonatesWorker(impersonating, "Sarah")).toBe(false);
  });

  it("supports a custom tone with an appended description", () => {
    const message = composeIntroMessage("Sarah", "CUSTOM", "always mention our 10% loyalty discount");
    expect(message).toMatch(/assistant/i);
    expect(message).toMatch(/loyalty discount/);
  });
});
