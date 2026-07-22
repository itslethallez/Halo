/**
 * Calendar integration interface. Ship Google Calendar first; adding another provider means
 * implementing this interface in a new subfolder and registering it in `getCalendarProvider`.
 * See /docs/01-architecture.md and /docs/09-folder-structure.md.
 */

export interface CalendarBusyBlock {
  start: Date;
  end: Date;
  title?: string;
}

export interface CalendarAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface CalendarProvider {
  readonly providerName: "GOOGLE" | "DEV_MOCK";
  /** Builds the OAuth consent URL the worker is redirected to. */
  getAuthUrl(state: string): string;
  /** Exchanges an OAuth callback code for tokens. */
  exchangeCodeForTokens(code: string): Promise<CalendarAuthTokens>;
  /** Lists busy blocks in a date range for conflict-checking against the booking engine. */
  listBusyBlocks(tokens: CalendarAuthTokens, calendarId: string, from: Date, to: Date): Promise<CalendarBusyBlock[]>;
  /** Creates a calendar event for a confirmed booking (so the worker's calendar reflects it). */
  createEvent(tokens: CalendarAuthTokens, calendarId: string, event: { title: string; start: Date; end: Date; location?: string }): Promise<string>;
}
