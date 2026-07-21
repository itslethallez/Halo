import type { WhatsappProvider } from "./WhatsappProvider";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. WhatsApp Business requires this (see .env.example). Set INTEGRATION_MODE=dev to use the mock adapter instead.`);
  }
  return value;
}

/** Live adapter for the WhatsApp Business Cloud API. Requires WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN. */
export class WhatsappBusinessProvider implements WhatsappProvider {
  readonly providerName = "WHATSAPP_BUSINESS";

  async sendMessage(toPhoneE164: string, body: string): Promise<{ id: string }> {
    const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN");

    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhoneE164,
        type: "text",
        text: { body },
      }),
    });
    if (!response.ok) {
      throw new Error(`WhatsApp send failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { messages: Array<{ id: string }> };
    return { id: data.messages[0]?.id ?? `whatsapp-${Date.now()}` };
  }
}
