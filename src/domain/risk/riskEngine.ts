/**
 * Pure, framework-free client-risk recommendation engine.
 * See /docs/06-safety-risk-rules.md for the rule narrative this file implements.
 *
 * IMPORTANT: this module's input type intentionally contains ONLY behavioural, safety,
 * payment and booking-accuracy signals. There is no field here for protected personal
 * characteristics, and there must never be — that is a hard architectural guarantee, not
 * just a policy statement.
 */

export type ClientSafetyStatus =
  | "TRUSTED"
  | "STANDARD"
  | "MONITOR"
  | "MANUAL_REVIEW_REQUIRED"
  | "RESTRICTED"
  | "DO_NOT_BOOK"
  | "BLOCKED_PENDING_INVESTIGATION";

export type WorkerSafetyQ1 = "YES_COMPLETELY" | "MOSTLY" | "SLIGHTLY_UNCOMFORTABLE" | "FELT_UNSAFE";
export type WorkerSafetyQ2 = "YES_COMPLETELY" | "MOSTLY" | "MINOR_CONCERNS" | "INAPPROPRIATE_BEHAVIOUR";
export type WorkerSafetyQ3 = "ACCURATE" | "MOSTLY_ACCURATE" | "SOME_DETAILS_DIFFERENT" | "MISLEADING";
export type WorkerSafetyQ4 = "NO_ISSUES" | "MINOR_ISSUE" | "SIGNIFICANT_ISSUE" | "SERIOUS_INCIDENT";
export type WorkerSafetyQ5 = "YES" | "YES_WITH_CONDITIONS" | "MANUAL_APPROVAL_REQUIRED" | "NO_DO_NOT_ACCEPT";

export interface WorkerSafetySurveyAnswers {
  q1SafeAndComfortable: WorkerSafetyQ1;
  q2RespectedBoundaries: WorkerSafetyQ2;
  q3BookingAccurate: WorkerSafetyQ3;
  q4IssueSeverity: WorkerSafetyQ4;
  q5FutureBookings: WorkerSafetyQ5;
}

export interface RiskEngineInput {
  survey: WorkerSafetySurveyAnswers;
  currentEffectiveStatus: ClientSafetyStatus;
  /** Number of prior surveys for this client (any worker) in the last 12 months that landed in the "minor" tier. */
  priorMinorConcernCountLast12Months: number;
  /** Total completed bookings for this client, used to distinguish a brand-new trusted client from an established one. */
  completedBookingCount: number;
}

export type RiskSeverityTier = "POSITIVE" | "MINOR" | "SIGNIFICANT" | "RESTRICT" | "SERIOUS";

export interface RiskRecommendation {
  recommendedStatus: ClientSafetyStatus;
  tier: RiskSeverityTier;
  /** true if this recommendation should apply automatically (per the severity->automation matrix). */
  appliesAutomatically: boolean;
  /** true if this recommendation must block new automatic bookings immediately, pending admin review. */
  blocksNewBookingsImmediately: boolean;
  reason: string;
}

const STATUS_SEVERITY_ORDER: ClientSafetyStatus[] = [
  "TRUSTED",
  "STANDARD",
  "MONITOR",
  "MANUAL_REVIEW_REQUIRED",
  "RESTRICTED",
  "DO_NOT_BOOK",
  "BLOCKED_PENDING_INVESTIGATION",
];

function severityRank(status: ClientSafetyStatus): number {
  return STATUS_SEVERITY_ORDER.indexOf(status);
}

/** A later positive survey must never silently overwrite a serious prior finding. */
export function worseOf(a: ClientSafetyStatus, b: ClientSafetyStatus): ClientSafetyStatus {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function isFullyPositive(s: WorkerSafetySurveyAnswers): boolean {
  return (
    s.q1SafeAndComfortable === "YES_COMPLETELY" &&
    s.q2RespectedBoundaries === "YES_COMPLETELY" &&
    s.q3BookingAccurate === "ACCURATE" &&
    s.q4IssueSeverity === "NO_ISSUES" &&
    s.q5FutureBookings === "YES"
  );
}

function isMinorTier(s: WorkerSafetySurveyAnswers): boolean {
  return (
    s.q1SafeAndComfortable === "MOSTLY" ||
    s.q2RespectedBoundaries === "MOSTLY" ||
    s.q2RespectedBoundaries === "MINOR_CONCERNS" ||
    s.q3BookingAccurate === "MOSTLY_ACCURATE" ||
    s.q4IssueSeverity === "MINOR_ISSUE"
  );
}

function isSignificantTier(s: WorkerSafetySurveyAnswers): boolean {
  return (
    s.q3BookingAccurate === "SOME_DETAILS_DIFFERENT" ||
    s.q4IssueSeverity === "SIGNIFICANT_ISSUE" ||
    s.q5FutureBookings === "MANUAL_APPROVAL_REQUIRED"
  );
}

function isSeriousTier(s: WorkerSafetySurveyAnswers): boolean {
  return s.q4IssueSeverity === "SERIOUS_INCIDENT" || s.q3BookingAccurate === "MISLEADING";
}

function isRestrictTier(s: WorkerSafetySurveyAnswers): boolean {
  return s.q5FutureBookings === "NO_DO_NOT_ACCEPT" || s.q1SafeAndComfortable === "FELT_UNSAFE" ||
    s.q2RespectedBoundaries === "INAPPROPRIATE_BEHAVIOUR";
}

/**
 * Computes a recommended client status from a single worker safety survey. Rule precedence is
 * serious > restrict > significant > minor > positive (worst-signal-wins within one survey);
 * `worseOf` is then applied by the caller against the client's current status so history is
 * never silently improved by a single good survey.
 */
export function recommendClientStatus(input: RiskEngineInput): RiskRecommendation {
  const { survey } = input;

  if (isSeriousTier(survey)) {
    return {
      recommendedStatus: "BLOCKED_PENDING_INVESTIGATION",
      tier: "SERIOUS",
      appliesAutomatically: false,
      blocksNewBookingsImmediately: true,
      reason: "Serious incident or misleading booking information reported by worker survey.",
    };
  }

  if (isRestrictTier(survey)) {
    return {
      recommendedStatus: "RESTRICTED",
      tier: "RESTRICT",
      appliesAutomatically: false,
      blocksNewBookingsImmediately: true,
      reason: "Worker indicated they would not accept future bookings from this client, or felt unsafe / experienced inappropriate behaviour.",
    };
  }

  if (isSignificantTier(survey)) {
    return {
      recommendedStatus: "MANUAL_REVIEW_REQUIRED",
      tier: "SIGNIFICANT",
      appliesAutomatically: false,
      blocksNewBookingsImmediately: false,
      reason: "Significant discrepancy or issue reported; requires admin review before further automatic bookings.",
    };
  }

  if (isMinorTier(survey)) {
    const isRepeated = input.priorMinorConcernCountLast12Months >= 1;
    return {
      recommendedStatus: isRepeated ? "MANUAL_REVIEW_REQUIRED" : "MONITOR",
      tier: "MINOR",
      appliesAutomatically: true,
      blocksNewBookingsImmediately: false,
      reason: isRepeated
        ? "Repeated minor concerns across appointments — escalated to manual review."
        : "Minor concern noted; client moved to monitor status for future bookings.",
    };
  }

  if (isFullyPositive(survey)) {
    const trusted = input.completedBookingCount >= 2;
    return {
      recommendedStatus: trusted ? "TRUSTED" : "STANDARD",
      tier: "POSITIVE",
      appliesAutomatically: true,
      blocksNewBookingsImmediately: false,
      reason: trusted
        ? "Consistently positive survey history."
        : "Positive survey; client remains in standard good standing.",
    };
  }

  // Fallback (mixed answers that don't cleanly hit a bucket above): treat conservatively.
  return {
    recommendedStatus: "MONITOR",
    tier: "MINOR",
    appliesAutomatically: true,
    blocksNewBookingsImmediately: false,
    reason: "Mixed survey answers; monitoring recommended pending further appointments.",
  };
}

/**
 * Applies a new recommendation against a client's current effective status, guaranteeing a
 * serious prior finding at RESTRICTED-or-worse is never silently improved by a single new
 * survey. Explicitly clearing a restriction is a separate, distinct admin action
 * (`services/clientSafetyService.reviewAndClear`), not something this function ever does.
 */
export function applyRecommendation(
  currentStatus: ClientSafetyStatus,
  recommendation: RiskRecommendation,
): ClientSafetyStatus {
  if (severityRank(currentStatus) >= severityRank("RESTRICTED")) {
    return worseOf(currentStatus, recommendation.recommendedStatus);
  }
  return recommendation.recommendedStatus;
}
