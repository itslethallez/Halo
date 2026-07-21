/**
 * Google Calendar adapter. Requires GOOGLE_CALENDAR_CLIENT_ID / _SECRET / _REDIRECT_URI
 * (see .env.example). This is a real-shaped adapter (correct request shapes against the
 * documented Google Calendar v3 API) but is only exercised when INTEGRATION_MODE=live and
 * credentials are present — it deliberately throws a clear error otherwise rather than
 * silently behaving like a mock.
 */
import type { CalendarAuthTokens, CalendarBusyBlock, CalendarProvider } from "../CalendarProvider";

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Google Calendar integration requires this (see .env.example). ` +
        `Set INTEGRATION_MODE=dev to use the mock calendar adapter instead.`,
    );
  }
  return value;
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly providerName = "GOOGLE" as const;

  getAuthUrl(state: string): string {
    const clientId = requireEnv("GOOGLE_CALENDAR_CLIENT_ID");
    const redirectUri = requireEnv("GOOGLE_CALENDAR_REDIRECT_URI");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: CALENDAR_SCOPE,
      state,
    });
    return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<CalendarAuthTokens> {
    const clientId = requireEnv("GOOGLE_CALENDAR_CLIENT_ID");
    const clientSecret = requireEnv("GOOGLE_CALENDAR_CLIENT_SECRET");
    const redirectUri = requireEnv("GOOGLE_CALENDAR_REDIRECT_URI");

    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) {
      throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async listBusyBlocks(
    tokens: CalendarAuthTokens,
    calendarId: string,
    from: Date,
    to: Date,
  ): Promise<CalendarBusyBlock[]> {
    const url = `${GOOGLE_CALENDAR_API_BASE}/freeBusy`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [{ id: calendarId }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Google freeBusy query failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {
      calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
    };
    const busy = data.calendars[calendarId]?.busy ?? [];
    return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  }

  async createEvent(
    tokens: CalendarAuthTokens,
    calendarId: string,
    event: { title: string; start: Date; end: Date; location?: string },
  ): Promise<string> {
    const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.title,
        location: event.location,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
      }),
    });
    if (!response.ok) {
      throw new Error(`Google event creation failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { id: string };
    return data.id;
  }
}
