import type { SmsProvider } from "./SmsProvider";

/** DEV adapter: logs to console instead of sending a real SMS. No credentials required. */
export class DevSmsProvider implements SmsProvider {
  readonly providerName = "DEV_MOCK";

  async sendSms(to: string, body: string): Promise<{ id: string }> {
    console.log(`[dev-sms] to=${to} body=${JSON.stringify(body)}`);
    return { id: `dev-sms-${Date.now()}` };
  }
}
