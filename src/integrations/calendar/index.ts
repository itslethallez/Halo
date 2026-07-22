import type { CalendarProvider } from "./CalendarProvider";
import { DevCalendarProvider } from "./dev/DevCalendarProvider";
import { GoogleCalendarProvider } from "./google/GoogleCalendarProvider";

export * from "./CalendarProvider";

export function getCalendarProvider(): CalendarProvider {
  const mode = process.env.INTEGRATION_MODE ?? "dev";
  return mode === "live" ? new GoogleCalendarProvider() : new DevCalendarProvider();
}
