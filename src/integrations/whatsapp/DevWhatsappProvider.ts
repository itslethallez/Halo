import type { WhatsappProvider } from "./WhatsappProvider";

/** DEV adapter: logs to console. No credentials required. */
export class DevWhatsappProvider implements WhatsappProvider {
  readonly providerName = "DEV_MOCK";

  async sendMessage(toPhoneE164: string, body: string): Promise<{ id: string }> {
    console.log(`[dev-whatsapp] to=${toPhoneE164} body=${JSON.stringify(body)}`);
    return { id: `dev-whatsapp-${Date.now()}` };
  }
}
