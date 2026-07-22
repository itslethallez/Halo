import type { AiProvider, AiReply, AiReplyContext } from "./AiProvider";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Live AI requires this (see .env.example). Set INTEGRATION_MODE=dev to use the template adapter instead.`);
  }
  return value;
}

function toneInstruction(context: AiReplyContext): string {
  switch (context.toneStyle) {
    case "WARM_FRIENDLY":
      return "Warm, friendly and personable, like a helpful friend.";
    case "PROFESSIONAL":
      return "Polished and professional.";
    case "CASUAL":
      return "Relaxed and casual.";
    case "BRIEF_DIRECT":
      return "Brief and direct — short sentences, no filler.";
    case "CUSTOM":
      return context.customToneDescription ?? "Match the worker's usual style.";
  }
}

/**
 * Live adapter calling the Anthropic Messages API. Requires AI_API_KEY (and optionally
 * AI_MODEL, defaulting to a current Claude model). The system prompt hard-constrains the
 * model to the booking assistant's identity rule and to the factual `systemBrief` the caller
 * supplies (real availability/pricing from the booking engine) — the model is not permitted to
 * invent scheduling or pricing facts of its own.
 */
export class AnthropicAiProvider implements AiProvider {
  readonly providerName = "ANTHROPIC";

  async generateReply(context: AiReplyContext): Promise<AiReply> {
    const apiKey = requireEnv("AI_API_KEY");
    const model = process.env.AI_MODEL || "claude-sonnet-5";

    const systemPrompt = [
      `You are ${context.workerDisplayName}'s booking assistant for a mobile massage business.`,
      `You must ALWAYS identify yourself as an assistant, never as ${context.workerDisplayName} personally.`,
      `Tone: ${toneInstruction(context)}`,
      `Only state availability, prices and policies given in the following brief — never invent them:`,
      context.systemBrief,
    ].join("\n");

    const messages = [
      ...context.history.map((turn) => ({
        role: turn.role === "client" ? ("user" as const) : ("assistant" as const),
        content: turn.text,
      })),
      { role: "user" as const, content: context.latestClientMessage },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { content: Array<{ type: string; text?: string }> };
    const text = data.content.find((block) => block.type === "text")?.text ?? "";

    return { text, confidence: 0.85 };
  }
}
