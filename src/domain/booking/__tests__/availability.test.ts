import { describe, it, expect } from "vitest";
import {
  assertNoConflict,
  BookingConflictError,
  computeOccupiedWindow,
  findAvailableSlots,
  hasConflict,
  isWithinAvailability,
  respectsDailyCaps,
  respectsNoticeAndAdvanceWindow,
  type BusyInterval,
  type CandidateSlotInput,
  type WorkerAvailabilityRule,
} from "../availability";

function at(hour: number, minute = 0, day = 15): Date {
  // Wednesday 2026-07-15 (fixed, deterministic weekday for tests)
  return new Date(Date.UTC(2026, 6, day, hour, minute, 0));
}

describe("double-booking prevention", () => {
  it("flags a direct overlap between a new candidate and an existing booking", () => {
    const candidate: CandidateSlotInput = {
      slotStart: at(10),
      slotEnd: at(11),
      setupMinutes: 0,
      packDownMinutes: 0,
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    };
    const busy: BusyInterval[] = [{ start: at(10, 30), end: at(11, 30), sourceBookingId: "existing-1" }];

    expect(hasConflict(candidate, busy)).toBe(true);
    expect(() => assertNoConflict(candidate, busy)).toThrow(BookingConflictError);
  });

  it("allows a candidate that fits exactly between two existing bookings with buffers respected", () => {
    // Existing booking 9:00-10:00 already includes its own pack-down/travel buffer up to 10:30.
    // Existing booking 12:00-13:00 already includes its own setup/travel buffer starting at 11:30.
    const busy: BusyInterval[] = [
      { start: at(9), end: at(10, 30), sourceBookingId: "morning-job" },
      { start: at(11, 30), end: at(13), sourceBookingId: "afternoon-job" },
    ];

    const candidate: CandidateSlotInput = {
      slotStart: at(10, 45),
      slotEnd: at(11, 15),
      setupMinutes: 0,
      packDownMinutes: 0,
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    };

    expect(hasConflict(candidate, busy)).toBe(false);
  });

  it("rejects a candidate that technically starts after the previous booking ends but has no time to travel/pack down", () => {
    const busy: BusyInterval[] = [{ start: at(9), end: at(10), sourceBookingId: "morning-job" }];

    // New job needs 20 min pack-down from the *previous* job baked into the busy interval by the
    // caller — here we simulate that the caller correctly extended the busy interval to 10:20,
    // and confirm a slot starting at 10:15 (which naively looks free right after 10:00) is rejected.
    const extendedBusy: BusyInterval[] = [{ start: at(9), end: at(10, 20), sourceBookingId: "morning-job" }];
    const candidate: CandidateSlotInput = {
      slotStart: at(10, 15),
      slotEnd: at(11, 15),
      setupMinutes: 15,
      packDownMinutes: 15,
      travelMinutesBefore: 20,
      travelMinutesAfter: 0,
    };

    expect(hasConflict(candidate, extendedBusy)).toBe(true);
  });

  it("accounts for setup + travel-before when computing the occupied window", () => {
    const candidate: CandidateSlotInput = {
      slotStart: at(10),
      slotEnd: at(11),
      setupMinutes: 15,
      packDownMinutes: 10,
      travelMinutesBefore: 30,
      travelMinutesAfter: 20,
    };
    const window = computeOccupiedWindow(candidate);
    expect(window.start).toEqual(at(9, 15)); // 10:00 - 15 - 30 = 9:15
    expect(window.end).toEqual(at(11, 30)); // 11:00 + 10 + 20 = 11:30
  });

  it("treats an external calendar busy block the same as an existing internal booking", () => {
    const candidate: CandidateSlotInput = {
      slotStart: at(14),
      slotEnd: at(15),
      setupMinutes: 0,
      packDownMinutes: 0,
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    };
    const calendarBusy: BusyInterval[] = [{ start: at(14, 30), end: at(16), label: "Google Calendar: dentist" }];
    expect(hasConflict(candidate, calendarBusy)).toBe(true);
  });
});

describe("working hours / notice / daily caps", () => {
  const rules: WorkerAvailabilityRule[] = [
    { dayOfWeek: at(9).getDay(), startMinute: 9 * 60, endMinute: 17 * 60, breakStartMinute: 12 * 60, breakEndMinute: 12 * 60 + 30 },
  ];

  it("rejects a slot outside working hours", () => {
    const candidate: CandidateSlotInput = {
      slotStart: at(7),
      slotEnd: at(8),
      setupMinutes: 0,
      packDownMinutes: 0,
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    };
    expect(isWithinAvailability(candidate, rules)).toBe(false);
  });

  it("rejects a slot that overlaps the lunch break", () => {
    const candidate: CandidateSlotInput = {
      slotStart: at(11, 45),
      slotEnd: at(12, 45),
      setupMinutes: 0,
      packDownMinutes: 0,
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    };
    expect(isWithinAvailability(candidate, rules)).toBe(false);
  });

  it("accepts a slot fully within working hours and clear of the break", () => {
    const candidate: CandidateSlotInput = {
      slotStart: at(13),
      slotEnd: at(14),
      setupMinutes: 0,
      packDownMinutes: 0,
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    };
    expect(isWithinAvailability(candidate, rules)).toBe(true);
  });

  it("rejects a slot that violates minimum notice", () => {
    const now = at(9);
    const slotStart = at(10); // only 1 hour's notice
    expect(respectsNoticeAndAdvanceWindow(slotStart, now, 24, 60)).toBe(false);
  });

  it("rejects a slot beyond the maximum advance window", () => {
    const now = at(1, 0, 1);
    const slotStart = at(1, 0, 200); // way beyond 60 days
    expect(respectsNoticeAndAdvanceWindow(slotStart, now, 0, 60)).toBe(false);
  });

  it("rejects a candidate that would exceed max jobs per day", () => {
    const candidate: CandidateSlotInput = {
      slotStart: at(13),
      slotEnd: at(14),
      setupMinutes: 0,
      packDownMinutes: 0,
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    };
    expect(respectsDailyCaps(candidate, { bookingCount: 6, totalMinutesCommitted: 300 }, 6, 10)).toBe(false);
  });

  it("rejects a candidate that would exceed max working hours per day", () => {
    const candidate: CandidateSlotInput = {
      slotStart: at(13),
      slotEnd: at(16), // 3 hours
      setupMinutes: 0,
      packDownMinutes: 0,
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
    };
    expect(respectsDailyCaps(candidate, { bookingCount: 2, totalMinutesCommitted: 8 * 60 }, 6, 10)).toBe(false);
  });
});

describe("findAvailableSlots", () => {
  it("never returns a slot that conflicts with an existing busy interval", () => {
    const rules: WorkerAvailabilityRule[] = [
      { dayOfWeek: at(9).getDay(), startMinute: 9 * 60, endMinute: 17 * 60 },
    ];
    const busy: BusyInterval[] = [{ start: at(10), end: at(12) }];

    const slots = findAvailableSlots({
      now: at(0),
      searchFrom: at(9),
      searchTo: at(17),
      serviceDurationMinutes: 60,
      setupMinutes: 0,
      packDownMinutes: 0,
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
      minimumNoticeHours: 0,
      maximumAdvanceDays: 365,
      maxJobsPerDay: 10,
      maxWorkingHoursPerDay: 24,
      availability: rules,
      blockedTimes: [],
      busyIntervals: busy,
      dailyLoadByDate: new Map(),
      slotGranularityMinutes: 30,
    });

    for (const slot of slots) {
      expect(hasConflict({ slotStart: slot.start, slotEnd: slot.end, setupMinutes: 0, packDownMinutes: 0, travelMinutesBefore: 0, travelMinutesAfter: 0 }, busy)).toBe(false);
    }
    // sanity: there should be some slots before 10am and after 12pm
    expect(slots.some((s) => s.start < at(10))).toBe(true);
    expect(slots.some((s) => s.start >= at(12))).toBe(true);
  });

  it("returns no slots when the whole day is blocked out", () => {
    const rules: WorkerAvailabilityRule[] = [
      { dayOfWeek: at(9).getDay(), startMinute: 9 * 60, endMinute: 17 * 60 },
    ];
    const slots = findAvailableSlots({
      now: at(0),
      searchFrom: at(9),
      searchTo: at(17),
      serviceDurationMinutes: 60,
      setupMinutes: 0,
      packDownMinutes: 0,
      travelMinutesBefore: 0,
      travelMinutesAfter: 0,
      minimumNoticeHours: 0,
      maximumAdvanceDays: 365,
      maxJobsPerDay: 10,
      maxWorkingHoursPerDay: 24,
      availability: rules,
      blockedTimes: [{ start: at(0), end: at(23, 59) }],
      busyIntervals: [],
      dailyLoadByDate: new Map(),
    });
    expect(slots).toHaveLength(0);
  });
});
