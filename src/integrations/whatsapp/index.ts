import type { WhatsappProvider } from "./WhatsappProvider";
import { DevWhatsappProvider } from "./DevWhatsappProvider";
import { WhatsappBusinessProvider } from "./WhatsappBusinessProvider";

export * from "./WhatsappProvider";

export function getWhatsappProvider(): WhatsappProvider {
  const mode = process.env.INTEGRATION_MODE ?? "dev";
  return mode === "live" ? new WhatsappBusinessProvider() : new DevWhatsappProvider();
}
