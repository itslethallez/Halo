/**
 * DEV/MOCK calendar adapter. Requires no Google credentials — used whenever
 * INTEGRATION_MODE=dev (the default). Stores nothing externally; busy blocks are empty by
 * default so the booking engine's own availability rules are what's under test.
 */
import type { CalendarAuthTokens, CalendarBusyBlock, CalendarProvider } from "../CalendarProvider";

export class DevCalendarProvider implements CalendarProvider {
  readonly providerName = "DEV_MOCK" as const;

  getAuthUrl(state: string): string {
    return `/dev/calendar/mock-consent?state=${encodeURIComponent(state)}`;
  }

  async exchangeCodeForTokens(_code: string): Promise<CalendarAuthTokens> {
    return { accessToken: "dev-mock-access-token", refreshToken: "dev-mock-refresh-token" };
  }

  async listBusyBlocks(): Promise<CalendarBusyBlock[]> {
    return [];
  }

  async createEvent(): Promise<string> {
    return `dev-mock-event-${Date.now()}`;
  }
}
