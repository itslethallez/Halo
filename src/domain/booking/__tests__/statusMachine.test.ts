import { describe, it, expect } from "vitest";
import {
  assertBookingTransition,
  canTransitionBooking,
  IllegalBookingTransitionError,
} from "../statusMachine";

describe("booking status machine", () => {
  it("allows the happy path from enquiry through to fully completed", () => {
    const happyPath: [string, string][] = [
      ["NEW_ENQUIRY", "AVAILABILITY_OFFERED"],
      ["AVAILABILITY_OFFERED", "AWAITING_CLIENT_RESPONSE"],
      ["AWAITING_CLIENT_RESPONSE", "AWAITING_DEPOSIT"],
      ["AWAITING_DEPOSIT", "CONFIRMED"],
      ["CONFIRMED", "WORKER_EN_ROUTE"],
      ["WORKER_EN_ROUTE", "WORKER_ARRIVED"],
      ["WORKER_ARRIVED", "SERVICE_IN_PROGRESS"],
      ["SERVICE_IN_PROGRESS", "SERVICE_COMPLETED"],
      ["SERVICE_COMPLETED", "AWAITING_WORKER_SURVEY"],
      ["AWAITING_WORKER_SURVEY", "AWAITING_CLIENT_SURVEY"],
      ["AWAITING_CLIENT_SURVEY", "FULLY_COMPLETED"],
    ];
    for (const [from, to] of happyPath) {
      expect(canTransitionBooking(from as never, to as never)).toBe(true);
    }
  });

  it("rejects skipping straight from a new enquiry to confirmed", () => {
    expect(canTransitionBooking("NEW_ENQUIRY" as never, "CONFIRMED" as never)).toBe(false);
    expect(() => assertBookingTransition("NEW_ENQUIRY" as never, "CONFIRMED" as never)).toThrow(
      IllegalBookingTransitionError,
    );
  });

  it("rejects any transition out of a terminal state", () => {
    expect(canTransitionBooking("FULLY_COMPLETED" as never, "CONFIRMED" as never)).toBe(false);
    expect(canTransitionBooking("CANCELLED" as never, "CONFIRMED" as never)).toBe(false);
    expect(canTransitionBooking("NO_SHOW" as never, "CONFIRMED" as never)).toBe(false);
  });

  it("allows safety review to resolve back to confirmed, cancelled, or blocked only", () => {
    expect(canTransitionBooking("SAFETY_REVIEW" as never, "CONFIRMED" as never)).toBe(true);
    expect(canTransitionBooking("SAFETY_REVIEW" as never, "CANCELLED" as never)).toBe(true);
    expect(canTransitionBooking("SAFETY_REVIEW" as never, "BLOCKED" as never)).toBe(true);
    expect(canTransitionBooking("SAFETY_REVIEW" as never, "SERVICE_IN_PROGRESS" as never)).toBe(false);
  });

  it("allows any active in-progress state to escalate to safety review", () => {
    for (const from of ["CONFIRMED", "WORKER_EN_ROUTE", "WORKER_ARRIVED", "SERVICE_IN_PROGRESS"]) {
      expect(canTransitionBooking(from as never, "SAFETY_REVIEW" as never)).toBe(true);
    }
  });
});
