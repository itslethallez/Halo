import { describe, it, expect } from "vitest";
import { rankCandidateDrivers, topCandidate, type DriverCandidate, type DriverJobInput } from "../allocation";

function job(overrides: Partial<DriverJobInput> = {}): DriverJobInput {
  return {
    scheduledStart: new Date("2026-07-15T10:00:00Z"),
    scheduledEnd: new Date("2026-07-15T11:00:00Z"),
    pickupSuburb: "Bondi",
    destinationSuburb: "Bondi",
    mustRemainNearby: false,
    typicalCostBandCents: { min: 2000, max: 6000 },
    ...overrides,
  };
}

function driver(overrides: Partial<DriverCandidate> = {}): DriverCandidate {
  return {
    driverId: "driver-1",
    isAvailableForWindow: true,
    serviceAreas: ["Bondi"],
    distanceKmFromPickup: 5,
    ratingAverage: 4.5,
    canRemainNearby: true,
    expectedCostCents: 3000,
    currentAssignedJobsInWindow: 0,
    ...overrides,
  };
}

describe("driver allocation — hard filters", () => {
  it("excludes an unavailable driver", () => {
    const ranked = rankCandidateDrivers(job(), [driver({ driverId: "d1", isAvailableForWindow: false })]);
    expect(ranked[0]).toMatchObject({ driverId: "d1", excluded: true });
    expect(topCandidate(ranked)).toBeUndefined();
  });

  it("excludes a driver outside the service area", () => {
    const ranked = rankCandidateDrivers(job({ pickupSuburb: "Manly" }), [driver({ driverId: "d1", serviceAreas: ["Bondi"] })]);
    expect(ranked[0]).toMatchObject({ driverId: "d1", excluded: true });
  });

  it("excludes a driver who cannot remain nearby when the job requires it", () => {
    const ranked = rankCandidateDrivers(job({ mustRemainNearby: true }), [
      driver({ driverId: "d1", canRemainNearby: false }),
    ]);
    expect(ranked[0]).toMatchObject({ driverId: "d1", excluded: true });
  });
});

describe("driver allocation — scoring", () => {
  it("ranks a closer, higher-rated, preferred, cheaper driver above a distant, lower-rated one", () => {
    const good = driver({ driverId: "good", distanceKmFromPickup: 2, ratingAverage: 5, workerPreference: "PREFERRED", expectedCostCents: 2000 });
    const poor = driver({ driverId: "poor", distanceKmFromPickup: 40, ratingAverage: 3, workerPreference: "NOT_PREFERRED", expectedCostCents: 5800 });

    const ranked = rankCandidateDrivers(job(), [poor, good]);
    const [first, second] = ranked;
    expect(first).toMatchObject({ driverId: "good", excluded: false });
    expect(second).toMatchObject({ driverId: "poor", excluded: false });
    expect((first as { score: number }).score).toBeGreaterThan((second as { score: number }).score);
  });

  it("is deterministic: ties break by driverId", () => {
    const a = driver({ driverId: "aaa" });
    const b = driver({ driverId: "bbb" });
    const ranked1 = rankCandidateDrivers(job(), [b, a]);
    const ranked2 = rankCandidateDrivers(job(), [a, b]);
    expect(ranked1.map((r) => r.driverId)).toEqual(["aaa", "bbb"]);
    expect(ranked2.map((r) => r.driverId)).toEqual(["aaa", "bbb"]);
  });

  it("penalises a driver already loaded with other jobs in the same window", () => {
    const idle = driver({ driverId: "idle", currentAssignedJobsInWindow: 0 });
    const busy = driver({ driverId: "busy", currentAssignedJobsInWindow: 3 });
    const ranked = rankCandidateDrivers(job(), [busy, idle]);
    expect(topCandidate(ranked)?.driverId).toBe("idle");
  });

  it("returns excluded candidates after ranked ones, never mixed in", () => {
    const ranked = rankCandidateDrivers(job(), [
      driver({ driverId: "ok" }),
      driver({ driverId: "unavailable", isAvailableForWindow: false }),
    ]);
    expect(ranked[0]?.excluded).toBe(false);
    expect(ranked[1]?.excluded).toBe(true);
  });
});
