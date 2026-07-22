/**
 * Pure, framework-free driver allocation/scoring engine.
 * See /docs/07-driver-allocation.md for the rule narrative this file implements.
 */

export interface DriverJobInput {
  scheduledStart: Date;
  scheduledEnd: Date; // includes estimated waiting + return trip if applicable
  pickupSuburb: string;
  destinationSuburb: string;
  mustRemainNearby: boolean;
  typicalCostBandCents: { min: number; max: number };
}

export interface DriverCandidate {
  driverId: string;
  isAvailableForWindow: boolean;
  serviceAreas: string[];
  distanceKmFromPickup: number;
  ratingAverage: number; // 0-5
  canRemainNearby: boolean;
  workerPreference?: "PREFERRED" | "NOT_PREFERRED";
  expectedCostCents: number;
  currentAssignedJobsInWindow: number;
}

export interface DriverScoringWeights {
  distance: number;
  duration: number;
  rating: number;
  preference: number;
  cost: number;
  remainNearby: number;
  load: number;
}

export const DEFAULT_DRIVER_SCORING_WEIGHTS: DriverScoringWeights = {
  distance: 0.25,
  duration: 0.1,
  rating: 0.2,
  preference: 0.2,
  cost: 0.15,
  remainNearby: 0.05,
  load: 0.05,
};

export interface RankedDriver {
  driverId: string;
  score: number;
  excluded: false;
}

export interface ExcludedDriver {
  driverId: string;
  excluded: true;
  exclusionReason: string;
}

export type RankedOrExcludedDriver = RankedDriver | ExcludedDriver;

const MAX_PLAUSIBLE_DISTANCE_KM = 60;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeDistance(km: number): number {
  return clamp01(1 - km / MAX_PLAUSIBLE_DISTANCE_KM);
}

function normalizeRating(rating: number): number {
  return clamp01(rating / 5);
}

function normalizeCost(costCents: number, band: { min: number; max: number }): number {
  if (band.max <= band.min) return 1;
  return clamp01(1 - (costCents - band.min) / (band.max - band.min));
}

function normalizeDuration(job: DriverJobInput): number {
  const totalMinutes = (job.scheduledEnd.getTime() - job.scheduledStart.getTime()) / 60_000;
  // Favour shorter total commitments; 4 hours (240 min) treated as the practical ceiling.
  return clamp01(1 - totalMinutes / 240);
}

/**
 * Ranks candidate drivers for a job. Hard filters (availability, service area, remain-nearby
 * if required) are applied first; survivors are scored and sorted descending. Ties break on
 * rating, then driverId, for deterministic output.
 */
export function rankCandidateDrivers(
  job: DriverJobInput,
  candidates: DriverCandidate[],
  weights: DriverScoringWeights = DEFAULT_DRIVER_SCORING_WEIGHTS,
): RankedOrExcludedDriver[] {
  const results: RankedOrExcludedDriver[] = [];

  for (const candidate of candidates) {
    if (!candidate.isAvailableForWindow) {
      results.push({ driverId: candidate.driverId, excluded: true, exclusionReason: "Not available for job window" });
      continue;
    }
    const servesArea =
      candidate.serviceAreas.includes(job.pickupSuburb) && candidate.serviceAreas.includes(job.destinationSuburb);
    if (!servesArea) {
      results.push({ driverId: candidate.driverId, excluded: true, exclusionReason: "Outside driver's service area" });
      continue;
    }
    if (job.mustRemainNearby && !candidate.canRemainNearby) {
      results.push({
        driverId: candidate.driverId,
        excluded: true,
        exclusionReason: "Job requires the driver to remain nearby, which this driver cannot do",
      });
      continue;
    }

    const preferenceScore = candidate.workerPreference === "PREFERRED" ? 1 : candidate.workerPreference === "NOT_PREFERRED" ? 0 : 0.5;
    const loadScore = clamp01(1 - candidate.currentAssignedJobsInWindow / 4);
    const remainNearbyScore = job.mustRemainNearby ? (candidate.canRemainNearby ? 1 : 0) : 0.5;

    const score =
      weights.distance * normalizeDistance(candidate.distanceKmFromPickup) +
      weights.duration * normalizeDuration(job) +
      weights.rating * normalizeRating(candidate.ratingAverage) +
      weights.preference * preferenceScore +
      weights.cost * normalizeCost(candidate.expectedCostCents, job.typicalCostBandCents) +
      weights.remainNearby * remainNearbyScore +
      weights.load * loadScore;

    results.push({ driverId: candidate.driverId, excluded: false, score });
  }

  const ranked = results.filter((r): r is RankedDriver => !r.excluded);
  const excluded = results.filter((r): r is ExcludedDriver => r.excluded);

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.driverId.localeCompare(b.driverId);
  });

  return [...ranked, ...excluded];
}

export function topCandidate(ranked: RankedOrExcludedDriver[]): RankedDriver | undefined {
  const first = ranked[0];
  return first && !first.excluded ? first : undefined;
}
