import { composeIntroMessage } from "@/domain/messaging/assistant";
import type { AiProvider, AiReply, AiReplyContext } from "./AiProvider";

/**
 * DEV adapter: a deterministic, template-based responder used when INTEGRATION_MODE=dev or no
 * AI_API_KEY is configured. It never invents availability/pricing — it just always defers to
 * `systemBrief` (built from real service-layer data) and always discloses it is an assistant.
 * This keeps the app fully runnable/demoable/testable without any LLM credentials.
 */
export class DevAiProvider implements AiProvider {
  readonly providerName = "DEV_TEMPLATE";

  async generateReply(context: AiReplyContext): Promise<AiReply> {
    if (context.history.length === 0) {
      return {
        text: `${composeIntroMessage(context.workerDisplayName, context.toneStyle, context.customToneDescription)}\n\n${context.systemBrief}`,
        confidence: 0.95,
      };
    }

    return {
      text: `Thanks for that. ${context.systemBrief}`,
      confidence: 0.8,
    };
  }
}
