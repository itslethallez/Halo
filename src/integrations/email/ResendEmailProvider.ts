import type { EmailProvider } from "./EmailProvider";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Live email requires this (see .env.example). Set INTEGRATION_MODE=dev to use the mock adapter instead.`);
  }
  return value;
}

/** Live adapter for Resend. Requires EMAIL_API_KEY / EMAIL_FROM_ADDRESS. */
export class ResendEmailProvider implements EmailProvider {
  readonly providerName = "RESEND";

  async sendEmail(to: string, subject: string, body: string): Promise<{ id: string }> {
    const apiKey = requireEnv("EMAIL_API_KEY");
    const from = requireEnv("EMAIL_FROM_ADDRESS");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html: body }),
    });
    if (!response.ok) {
      throw new Error(`Resend send failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { id: string };
    return { id: data.id };
  }
}
