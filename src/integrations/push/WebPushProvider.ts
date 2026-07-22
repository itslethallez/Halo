import webpush from "web-push";
import type { PushProvider, PushSubscription } from "./PushProvider";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Live push requires this (see .env.example). Set INTEGRATION_MODE=dev to use the mock adapter instead.`);
  }
  return value;
}

/** Live adapter using the standard Web Push protocol (VAPID). Requires WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY. */
export class WebPushProvider implements PushProvider {
  readonly providerName = "WEB_PUSH";

  private configure(): void {
    const publicKey = requireEnv("WEB_PUSH_PUBLIC_KEY");
    const privateKey = requireEnv("WEB_PUSH_PRIVATE_KEY");
    webpush.setVapidDetails("mailto:support@halo.example", publicKey, privateKey);
  }

  async sendPush(subscription: PushSubscription, title: string, body: string): Promise<{ id: string }> {
    this.configure();
    const result = await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
    return { id: `${result.statusCode}-${Date.now()}` };
  }
}
