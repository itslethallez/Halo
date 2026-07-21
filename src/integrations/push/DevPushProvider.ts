import type { PushProvider, PushSubscription } from "./PushProvider";

/** DEV adapter: logs to console instead of sending a real push notification. */
export class DevPushProvider implements PushProvider {
  readonly providerName = "DEV_MOCK";

  async sendPush(subscription: PushSubscription, title: string, body: string): Promise<{ id: string }> {
    console.log(`[dev-push] endpoint=${subscription.endpoint} title=${JSON.stringify(title)} body=${JSON.stringify(body)}`);
    return { id: `dev-push-${Date.now()}` };
  }
}
