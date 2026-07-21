/**
 * Pure, framework-free booking/availability engine.
 * See /docs/05-booking-state-machine.md ("Double-booking prevention") for the rules this implements.
 *
 * This module never touches Prisma or the network. The service layer is responsible for
 * loading a worker's rules/existing bookings/calendar busy blocks and turning them into the
 * plain data shapes below (BusyInterval[], WorkerAvailabilityRule[], etc).
 */

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface WorkerAvailabilityRule {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startMinute: number; // minutes from local midnight
  endMinute: number;
  breakStartMinute?: number;
  breakEndMinute?: number;
}

/**
 * A window of time a worker is unavailable for a NEW booking. Callers must pre-compute this
 * to already include that existing commitment's own setup/pack-down/travel buffers — this
 * module treats every busy interval the same whether it comes from an existing Booking, a
 * connected external calendar, or a BlockedTime row.
 */
export interface BusyInterval extends TimeRange {
  label?: string;
  sourceBookingId?: string;
}

export interface CandidateSlotInput {
  /** Start of the service itself (excludes setup/travel buffers). */
  slotStart: Date;
  /** End of the service itself. */
  slotEnd: Date;
  setupMinutes: number;
  packDownMinutes: number;
  /** Travel time required to reach this appointment's location beforehand. */
  travelMinutesBefore: number;
  /** Travel time required after this appointment (to the next job, or home/return). */
  travelMinutesAfter: number;
}

export class BookingConflictError extends Error {
  constructor(public readonly conflictingWith?: BusyInterval) {
    super(
      conflictingWith
        ? `Candidate slot conflicts with an existing commitment (${conflictingWith.label ?? conflictingWith.sourceBookingId ?? "unlabelled"})`
        : "Candidate slot conflicts with an existing commitment",
    );
    this.name = "BookingConflictError";
  }
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * The full window of time a candidate slot actually occupies once setup, pack-down and
 * travel-in/out are accounted for. This is what must NOT overlap any existing busy interval.
 */
export function computeOccupiedWindow(candidate: CandidateSlotInput): TimeRange {
  return {
    start: addMinutes(candidate.slotStart, -(candidate.setupMinutes + candidate.travelMinutesBefore)),
    end: addMinutes(candidate.slotEnd, candidate.packDownMinutes + candidate.travelMinutesAfter),
  };
}

export function findConflict(
  candidate: CandidateSlotInput,
  busyIntervals: BusyInterval[],
): BusyInterval | undefined {
  const window = computeOccupiedWindow(candidate);
  return busyIntervals.find((busy) => overlaps(window, busy));
}

export function hasConflict(candidate: CandidateSlotInput, busyIntervals: BusyInterval[]): boolean {
  return findConflict(candidate, busyIntervals) !== undefined;
}

/** Throws BookingConflictError if the candidate slot would double-book the worker. Call this
 * before persisting ANY confirmed/pending booking — it is the single choke point. */
export function assertNoConflict(candidate: CandidateSlotInput, busyIntervals: BusyInterval[]): void {
  const conflict = findConflict(candidate, busyIntervals);
  if (conflict) {
    throw new BookingConflictError(conflict);
  }
}

export function isWithinAvailability(
  candidate: CandidateSlotInput,
  rules: WorkerAvailabilityRule[],
): boolean {
  const dayOfWeek = candidate.slotStart.getDay();
  const startMinute = candidate.slotStart.getHours() * 60 + candidate.slotStart.getMinutes();
  const endMinute = candidate.slotEnd.getHours() * 60 + candidate.slotEnd.getMinutes();

  // Appointments that cross midnight are not supported by a simple minute-of-day model; reject.
  if (candidate.slotEnd.getDate() !== candidate.slotStart.getDate()) {
    return false;
  }

  return rules
    .filter((r) => r.dayOfWeek === dayOfWeek)
    .some((rule) => {
      const withinShift = startMinute >= rule.startMinute && endMinute <= rule.endMinute;
      if (!withinShift) return false;
      if (rule.breakStartMinute !== undefined && rule.breakEndMinute !== undefined) {
        const clearsBreak = endMinute <= rule.breakStartMinute || startMinute >= rule.breakEndMinute;
        if (!clearsBreak) return false;
      }
      return true;
    });
}

export function isBlocked(candidate: CandidateSlotInput, blockedTimes: TimeRange[]): boolean {
  const window = computeOccupiedWindow(candidate);
  return blockedTimes.some((b) => overlaps(window, b));
}

export function respectsNoticeAndAdvanceWindow(
  slotStart: Date,
  now: Date,
  minimumNoticeHours: number,
  maximumAdvanceDays: number,
): boolean {
  const minStart = addMinutes(now, minimumNoticeHours * 60);
  const maxStart = addMinutes(now, maximumAdvanceDays * 24 * 60);
  return slotStart >= minStart && slotStart <= maxStart;
}

export interface DailyLoad {
  bookingCount: number;
  totalMinutesCommitted: number;
}

export function respectsDailyCaps(
  candidate: CandidateSlotInput,
  existingLoadOnDay: DailyLoad,
  maxJobsPerDay: number,
  maxWorkingHoursPerDay: number,
): boolean {
  const window = computeOccupiedWindow(candidate);
  const candidateMinutes = (window.end.getTime() - window.start.getTime()) / 60_000;
  const wouldBeCount = existingLoadOnDay.bookingCount + 1;
  const wouldBeMinutes = existingLoadOnDay.totalMinutesCommitted + candidateMinutes;
  return wouldBeCount <= maxJobsPerDay && wouldBeMinutes <= maxWorkingHoursPerDay * 60;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface SlotSearchParams {
  now: Date;
  searchFrom: Date;
  searchTo: Date;
  serviceDurationMinutes: number;
  setupMinutes: number;
  packDownMinutes: number;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
  minimumNoticeHours: number;
  maximumAdvanceDays: number;
  maxJobsPerDay: number;
  maxWorkingHoursPerDay: number;
  availability: WorkerAvailabilityRule[];
  blockedTimes: TimeRange[];
  busyIntervals: BusyInterval[];
  dailyLoadByDate: Map<string, DailyLoad>;
  /** Granularity for candidate start times, in minutes. Defaults to 30. */
  slotGranularityMinutes?: number;
  /** Cap on number of results returned. Defaults to 10. */
  maxResults?: number;
}

/**
 * Walks the search window at `slotGranularityMinutes` increments and returns every candidate
 * slot that is genuinely available — i.e. it independently passes every one of: working hours,
 * blocked time, notice/advance window, daily caps, and conflict-with-existing-commitments.
 * This is what the spec calls "offer only genuinely available appointment options".
 */
export function findAvailableSlots(params: SlotSearchParams): TimeRange[] {
  const granularity = params.slotGranularityMinutes ?? 30;
  const maxResults = params.maxResults ?? 10;
  const results: TimeRange[] = [];

  for (
    let cursor = new Date(params.searchFrom);
    cursor <= params.searchTo && results.length < maxResults;
    cursor = addMinutes(cursor, granularity)
  ) {
    const slotStart = new Date(cursor);
    const slotEnd = addMinutes(slotStart, params.serviceDurationMinutes);

    const candidate: CandidateSlotInput = {
      slotStart,
      slotEnd,
      setupMinutes: params.setupMinutes,
      packDownMinutes: params.packDownMinutes,
      travelMinutesBefore: params.travelMinutesBefore,
      travelMinutesAfter: params.travelMinutesAfter,
    };

    if (!respectsNoticeAndAdvanceWindow(slotStart, params.now, params.minimumNoticeHours, params.maximumAdvanceDays)) {
      continue;
    }
    if (!isWithinAvailability(candidate, params.availability)) continue;
    if (isBlocked(candidate, params.blockedTimes)) continue;

    const load = params.dailyLoadByDate.get(dateKey(slotStart)) ?? { bookingCount: 0, totalMinutesCommitted: 0 };
    if (!respectsDailyCaps(candidate, load, params.maxJobsPerDay, params.maxWorkingHoursPerDay)) continue;

    if (hasConflict(candidate, params.busyIntervals)) continue;

    results.push({ start: slotStart, end: slotEnd });
  }

  return results;
}
