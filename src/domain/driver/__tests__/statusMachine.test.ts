import { describe, it, expect } from "vitest";
import { assertDriverJobTransition, canTransitionDriverJob, IllegalDriverJobTransitionError } from "../statusMachine";

describe("driver job status machine", () => {
  it("allows the full outbound + return happy path", () => {
    const path: [string, string][] = [
      ["UNASSIGNED", "OFFERED"],
      ["OFFERED", "ACCEPTED"],
      ["ACCEPTED", "EN_ROUTE_TO_WORKER"],
      ["EN_ROUTE_TO_WORKER", "WORKER_COLLECTED"],
      ["WORKER_COLLECTED", "ARRIVED_AT_DESTINATION"],
      ["ARRIVED_AT_DESTINATION", "WAITING"],
      ["WAITING", "RETURN_TRIP_STARTED"],
      ["RETURN_TRIP_STARTED", "WORKER_RETURNED"],
      ["WORKER_RETURNED", "COMPLETED"],
    ];
    for (const [from, to] of path) {
      expect(canTransitionDriverJob(from as never, to as never)).toBe(true);
    }
  });

  it("allows a decline to re-offer to another driver", () => {
    expect(canTransitionDriverJob("OFFERED" as never, "DECLINED" as never)).toBe(true);
    expect(canTransitionDriverJob("DECLINED" as never, "OFFERED" as never)).toBe(true);
  });

  it("rejects skipping from offered straight to arrived", () => {
    expect(canTransitionDriverJob("OFFERED" as never, "ARRIVED_AT_DESTINATION" as never)).toBe(false);
    expect(() => assertDriverJobTransition("OFFERED" as never, "ARRIVED_AT_DESTINATION" as never)).toThrow(
      IllegalDriverJobTransitionError,
    );
  });

  it("rejects any transition out of a terminal state", () => {
    expect(canTransitionDriverJob("COMPLETED" as never, "OFFERED" as never)).toBe(false);
    expect(canTransitionDriverJob("CANCELLED" as never, "OFFERED" as never)).toBe(false);
  });
});
