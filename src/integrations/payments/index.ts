import type { PaymentsProvider } from "./PaymentsProvider";
import { DevPaymentsProvider } from "./DevPaymentsProvider";
import { StripePaymentsProvider } from "./StripePaymentsProvider";

export * from "./PaymentsProvider";

export function getPaymentsProvider(): PaymentsProvider {
  const mode = process.env.INTEGRATION_MODE ?? "dev";
  return mode === "live" ? new StripePaymentsProvider() : new DevPaymentsProvider();
}
