import type { EmailProvider } from "./EmailProvider";
import { DevEmailProvider } from "./DevEmailProvider";
import { ResendEmailProvider } from "./ResendEmailProvider";

export * from "./EmailProvider";

export function getEmailProvider(): EmailProvider {
  const mode = process.env.INTEGRATION_MODE ?? "dev";
  return mode === "live" ? new ResendEmailProvider() : new DevEmailProvider();
}
