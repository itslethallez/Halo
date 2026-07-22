import type { AiProvider } from "./AiProvider";
import { DevAiProvider } from "./DevAiProvider";
import { AnthropicAiProvider } from "./AnthropicAiProvider";

export * from "./AiProvider";

export function getAiProvider(): AiProvider {
  const mode = process.env.INTEGRATION_MODE ?? "dev";
  return mode === "live" ? new AnthropicAiProvider() : new DevAiProvider();
}
