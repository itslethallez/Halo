export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushProvider {
  readonly providerName: string;
  sendPush(subscription: PushSubscription, title: string, body: string): Promise<{ id: string }>;
}
