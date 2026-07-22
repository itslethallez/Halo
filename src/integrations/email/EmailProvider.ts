export interface EmailProvider {
  readonly providerName: string;
  sendEmail(to: string, subject: string, body: string): Promise<{ id: string }>;
}
