import { describe, it, expect } from "vitest";
import {
  applyRecommendation,
  recommendClientStatus,
  worseOf,
  type RiskEngineInput,
  type WorkerSafetySurveyAnswers,
} from "../riskEngine";

function survey(overrides: Partial<WorkerSafetySurveyAnswers> = {}): WorkerSafetySurveyAnswers {
  return {
    q1SafeAndComfortable: "YES_COMPLETELY",
    q2RespectedBoundaries: "YES_COMPLETELY",
    q3BookingAccurate: "ACCURATE",
    q4IssueSeverity: "NO_ISSUES",
    q5FutureBookings: "YES",
    ...overrides,
  };
}

function input(overrides: Partial<RiskEngineInput> = {}): RiskEngineInput {
  return {
    survey: survey(),
    currentEffectiveStatus: "STANDARD",
    priorMinorConcernCountLast12Months: 0,
    completedBookingCount: 0,
    ...overrides,
  };
}

describe("risk engine — rule application", () => {
  it("keeps a fully positive survey as STANDARD for a first-time client", () => {
    const rec = recommendClientStatus(input());
    expect(rec.recommendedStatus).toBe("STANDARD");
    expect(rec.appliesAutomatically).toBe(true);
  });

  it("promotes to TRUSTED after multiple positive completed bookings", () => {
    const rec = recommendClientStatus(input({ completedBookingCount: 3 }));
    expect(rec.recommendedStatus).toBe("TRUSTED");
  });

  it("moves a client to MONITOR on a first minor concern, applied automatically", () => {
    const rec = recommendClientStatus(input({ survey: survey({ q4IssueSeverity: "MINOR_ISSUE" }) }));
    expect(rec.recommendedStatus).toBe("MONITOR");
    expect(rec.appliesAutomatically).toBe(true);
  });

  it("escalates repeated minor concerns to MANUAL_REVIEW_REQUIRED", () => {
    const rec = recommendClientStatus(
      input({ survey: survey({ q4IssueSeverity: "MINOR_ISSUE" }), priorMinorConcernCountLast12Months: 1 }),
    );
    expect(rec.recommendedStatus).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("requires manual review for significant concerns and does not apply automatically", () => {
    const rec = recommendClientStatus(input({ survey: survey({ q4IssueSeverity: "SIGNIFICANT_ISSUE" }) }));
    expect(rec.recommendedStatus).toBe("MANUAL_REVIEW_REQUIRED");
    expect(rec.appliesAutomatically).toBe(false);
    expect(rec.blocksNewBookingsImmediately).toBe(false);
  });

  it("places a client into safety review (RESTRICTED) when the worker declines future bookings", () => {
    const rec = recommendClientStatus(input({ survey: survey({ q5FutureBookings: "NO_DO_NOT_ACCEPT" }) }));
    expect(rec.recommendedStatus).toBe("RESTRICTED");
    expect(rec.blocksNewBookingsImmediately).toBe(true);
    expect(rec.appliesAutomatically).toBe(false);
  });

  it("blocks pending investigation for a serious incident and prevents ALL automatic bookings", () => {
    const rec = recommendClientStatus(input({ survey: survey({ q4IssueSeverity: "SERIOUS_INCIDENT" }) }));
    expect(rec.recommendedStatus).toBe("BLOCKED_PENDING_INVESTIGATION");
    expect(rec.blocksNewBookingsImmediately).toBe(true);
    expect(rec.appliesAutomatically).toBe(false);
  });

  it("blocks pending investigation when booking information was misleading", () => {
    const rec = recommendClientStatus(input({ survey: survey({ q3BookingAccurate: "MISLEADING" }) }));
    expect(rec.recommendedStatus).toBe("BLOCKED_PENDING_INVESTIGATION");
  });

  it("never uses protected characteristics — the input type has no such field (compile-time guarantee)", () => {
    // This test exists to document the guarantee: RiskEngineInput only accepts survey answers,
    // status history counters. Attempting to add e.g. `input.survey.clientGender` would fail to
    // typecheck, which is the actual enforcement mechanism.
    const rec = recommendClientStatus(input());
    expect(Object.keys(rec)).toEqual(["recommendedStatus", "tier", "appliesAutomatically", "blocksNewBookingsImmediately", "reason"]);
  });
});

describe("risk engine — status monotonicity", () => {
  it("worseOf never moves a status to something less severe", () => {
    expect(worseOf("RESTRICTED", "STANDARD")).toBe("RESTRICTED");
    expect(worseOf("STANDARD", "RESTRICTED")).toBe("RESTRICTED");
    expect(worseOf("BLOCKED_PENDING_INVESTIGATION", "TRUSTED")).toBe("BLOCKED_PENDING_INVESTIGATION");
  });

  it("a later positive survey does not automatically clear a prior serious/restricted finding", () => {
    const positiveRec = recommendClientStatus(input({ currentEffectiveStatus: "RESTRICTED", completedBookingCount: 5 }));
    const nextStatus = applyRecommendation("RESTRICTED", positiveRec);
    expect(nextStatus).toBe("RESTRICTED");
  });

  it("a later positive survey does not clear BLOCKED_PENDING_INVESTIGATION either", () => {
    const positiveRec = recommendClientStatus(input({ currentEffectiveStatus: "BLOCKED_PENDING_INVESTIGATION" }));
    const nextStatus = applyRecommendation("BLOCKED_PENDING_INVESTIGATION", positiveRec);
    expect(nextStatus).toBe("BLOCKED_PENDING_INVESTIGATION");
  });

  it("normal (non-restricted) statuses update freely based on the new recommendation", () => {
    const minorRec = recommendClientStatus(input({ survey: survey({ q4IssueSeverity: "MINOR_ISSUE" }) }));
    const nextStatus = applyRecommendation("STANDARD", minorRec);
    expect(nextStatus).toBe("MONITOR");
  });
});
