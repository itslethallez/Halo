import type { PushProvider } from "./PushProvider";
import { DevPushProvider } from "./DevPushProvider";
import { WebPushProvider } from "./WebPushProvider";

export * from "./PushProvider";

export function getPushProvider(): PushProvider {
  const mode = process.env.INTEGRATION_MODE ?? "dev";
  return mode === "live" ? new WebPushProvider() : new DevPushProvider();
}
