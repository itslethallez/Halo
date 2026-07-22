export interface SmsProvider {
  readonly providerName: string;
  sendSms(to: string, body: string): Promise<{ id: string }>;
}
