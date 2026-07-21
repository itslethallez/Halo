import type { SmsProvider } from "./SmsProvider";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Twilio SMS requires this (see .env.example). Set INTEGRATION_MODE=dev to use the mock adapter instead.`);
  }
  return value;
}

/** Live adapter for Twilio. Requires TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER. */
export class TwilioSmsProvider implements SmsProvider {
  readonly providerName = "TWILIO";

  async sendSms(to: string, body: string): Promise<{ id: string }> {
    const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
    const authToken = requireEnv("TWILIO_AUTH_TOKEN");
    const from = requireEnv("TWILIO_FROM_NUMBER");

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!response.ok) {
      throw new Error(`Twilio send failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { sid: string };
    return { id: data.sid };
  }
}
