export interface WhatsappProvider {
  readonly providerName: string;
  sendMessage(toPhoneE164: string, body: string): Promise<{ id: string }>;
}
