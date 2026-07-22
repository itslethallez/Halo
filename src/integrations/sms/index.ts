import type { SmsProvider } from "./SmsProvider";
import { DevSmsProvider } from "./DevSmsProvider";
import { TwilioSmsProvider } from "./TwilioSmsProvider";

export * from "./SmsProvider";

export function getSmsProvider(): SmsProvider {
  const mode = process.env.INTEGRATION_MODE ?? "dev";
  return mode === "live" ? new TwilioSmsProvider() : new DevSmsProvider();
}
