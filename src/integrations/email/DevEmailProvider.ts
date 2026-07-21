import type { EmailProvider } from "./EmailProvider";

/** DEV adapter: logs to console instead of sending a real email. No credentials required. */
export class DevEmailProvider implements EmailProvider {
  readonly providerName = "DEV_MOCK";

  async sendEmail(to: string, subject: string, body: string): Promise<{ id: string }> {
    console.log(`[dev-email] to=${to} subject=${JSON.stringify(subject)} body=${JSON.stringify(body)}`);
    return { id: `dev-email-${Date.now()}` };
  }
}
