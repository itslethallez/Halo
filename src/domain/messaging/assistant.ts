/**
 * Pure, framework-free assistant escalation and identity rules.
 * See /docs/01-architecture.md §7 and /docs/04-user-flows.md §2.
 *
 * This module does NOT call an LLM — it decides *whether* the assistant should keep talking
 * or hand off to a human, and how the assistant must identify itself. The actual reply text
 * generation is delegated to a pluggable AiProvider (integrations/ai), which this module's
 * output constrains (e.g. by injecting the mandatory identity disclosure).
 */

export type EscalationReason =
  | "ABUSIVE_OR_THREATENING"
  | "OUT_OF_SCOPE_REQUEST"
  | "INAPPROPRIATE_LANGUAGE"
  | "PAYMENT_DISPUTE"
  | "EXISTING_SAFETY_FLAG"
  | "REPEATED_IDENTITY_OR_ADDRESS_CHANGES"
  | "ASSISTANT_UNCERTAIN"
  | "WORKER_CONFIGURED_MANUAL_REVIEW";

export interface EscalationCheckInput {
  messageText: string;
  clientSafetyStatus:
    | "TRUSTED"
    | "STANDARD"
    | "MONITOR"
    | "MANUAL_REVIEW_REQUIRED"
    | "RESTRICTED"
    | "DO_NOT_BOOK"
    | "BLOCKED_PENDING_INVESTIGATION";
  identityOrAddressChangeCountThisConversation: number;
  paymentDisputeMentioned: boolean;
  requestedServiceIsInCatalogue: boolean;
  workerManualReviewKeywords: string[];
  assistantConfidence: number; // 0..1, produced by the AI provider for its own proposed reply
  assistantConfidenceThreshold?: number;
}

export interface EscalationResult {
  needsHuman: boolean;
  reason?: EscalationReason;
  holdingMessage?: string;
}

const ABUSIVE_PATTERNS = [
  /\bfuck(ing)?\s+you\b/i,
  /\bkill you\b/i,
  /\bi('| a)?ll hurt you\b/i,
  /\bthreaten/i,
];

const INAPPROPRIATE_PATTERNS = [/\bsex(ual)?\s+favour/i, /\bhappy ending\b/i, /\bexplicit\b/i];

export function detectEscalation(input: EscalationCheckInput): EscalationResult {
  const text = input.messageText;

  if (ABUSIVE_PATTERNS.some((p) => p.test(text))) {
    return holding("ABUSIVE_OR_THREATENING");
  }

  if (INAPPROPRIATE_PATTERNS.some((p) => p.test(text))) {
    return holding("INAPPROPRIATE_LANGUAGE");
  }

  if (input.paymentDisputeMentioned) {
    return holding("PAYMENT_DISPUTE");
  }

  if (
    input.clientSafetyStatus === "RESTRICTED" ||
    input.clientSafetyStatus === "DO_NOT_BOOK" ||
    input.clientSafetyStatus === "BLOCKED_PENDING_INVESTIGATION" ||
    input.clientSafetyStatus === "MANUAL_REVIEW_REQUIRED"
  ) {
    return holding("EXISTING_SAFETY_FLAG");
  }

  if (!input.requestedServiceIsInCatalogue) {
    return holding("OUT_OF_SCOPE_REQUEST");
  }

  if (input.identityOrAddressChangeCountThisConversation >= 2) {
    return holding("REPEATED_IDENTITY_OR_ADDRESS_CHANGES");
  }

  if (input.workerManualReviewKeywords.some((kw) => text.toLowerCase().includes(kw.toLowerCase()))) {
    return holding("WORKER_CONFIGURED_MANUAL_REVIEW");
  }

  const threshold = input.assistantConfidenceThreshold ?? 0.5;
  if (input.assistantConfidence < threshold) {
    return holding("ASSISTANT_UNCERTAIN");
  }

  return { needsHuman: false };
}

const HOLDING_MESSAGES: Record<EscalationReason, string> = {
  ABUSIVE_OR_THREATENING: "I've paused this conversation and flagged it for a team member to review.",
  OUT_OF_SCOPE_REQUEST: "That's outside what I can arrange automatically — I've flagged this for the team to reply personally.",
  INAPPROPRIATE_LANGUAGE: "I'm not able to continue this conversation. I've flagged it for the team to review.",
  PAYMENT_DISPUTE: "I've passed this payment question to the team so they can look into it properly.",
  EXISTING_SAFETY_FLAG: "I've flagged this booking request for the team to review before anything is confirmed.",
  REPEATED_IDENTITY_OR_ADDRESS_CHANGES: "I've flagged this conversation for the team to confirm a few details personally.",
  ASSISTANT_UNCERTAIN: "I want to make sure this is handled properly — I've flagged it for the team to reply personally.",
  WORKER_CONFIGURED_MANUAL_REVIEW: "I've flagged this for the team to reply personally, as requested.",
};

function holding(reason: EscalationReason): EscalationResult {
  return { needsHuman: true, reason, holdingMessage: HOLDING_MESSAGES[reason] };
}

export type ToneStyle = "WARM_FRIENDLY" | "PROFESSIONAL" | "CASUAL" | "BRIEF_DIRECT" | "CUSTOM";

/**
 * The assistant must always disclose that it is an assistant, never claim to be the worker
 * personally. This is the one non-negotiable line of every introduction, regardless of tone.
 */
export function composeIntroMessage(workerDisplayName: string, tone: ToneStyle, customToneDescription?: string): string {
  const base = `Hi, I'm ${workerDisplayName}'s booking assistant. I can help with availability, pricing and organising your appointment.`;
  switch (tone) {
    case "WARM_FRIENDLY":
      return `Hi there! ${base} Let me know what you're after and I'll sort it out for you. 😊`.replace(
        `Hi there! Hi, I'm`,
        `Hi there — I'm`,
      );
    case "PROFESSIONAL":
      return `Good day. ${base}`;
    case "CASUAL":
      return `Hey! ${base}`;
    case "BRIEF_DIRECT":
      return `Hi — I'm ${workerDisplayName}'s booking assistant. Service, date, and suburb?`;
    case "CUSTOM":
      return customToneDescription ? `${base} (${customToneDescription})` : base;
    default:
      return base;
  }
}

export function assertNeverImpersonatesWorker(message: string, workerDisplayName: string): boolean {
  const impersonationPatterns = [
    new RegExp(`\\bI am ${workerDisplayName}\\b`, "i"),
    new RegExp(`\\bI'?m ${workerDisplayName}, and I'?ll be`, "i"),
    /\bthis is\s+\w+\s+personally\b/i,
  ];
  return !impersonationPatterns.some((p) => p.test(message));
}
