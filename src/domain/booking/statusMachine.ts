import type { BookingStatus } from "@prisma/client";

/**
 * Explicit allow-list of legal transitions. See /docs/05-booking-state-machine.md.
 * Anything not listed here is illegal and `assertTransition` throws.
 */
export const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  NEW_ENQUIRY: ["AVAILABILITY_OFFERED", "CANCELLED"],
  AVAILABILITY_OFFERED: ["AWAITING_CLIENT_RESPONSE", "CANCELLED"],
  AWAITING_CLIENT_RESPONSE: ["AWAITING_DEPOSIT", "AVAILABILITY_OFFERED", "CANCELLED"],
  AWAITING_DEPOSIT: ["AWAITING_WORKER_APPROVAL", "CONFIRMED", "CANCELLED"],
  AWAITING_WORKER_APPROVAL: ["CONFIRMED", "DRIVER_REQUIRED", "CANCELLED", "SAFETY_REVIEW"],
  CONFIRMED: ["DRIVER_REQUIRED", "WORKER_EN_ROUTE", "CANCELLED", "NO_SHOW", "SAFETY_REVIEW"],
  DRIVER_REQUIRED: ["DRIVER_ASSIGNED", "CANCELLED", "SAFETY_REVIEW"],
  DRIVER_ASSIGNED: ["WORKER_EN_ROUTE", "CANCELLED"],
  WORKER_EN_ROUTE: ["WORKER_ARRIVED", "CANCELLED", "SAFETY_REVIEW"],
  WORKER_ARRIVED: ["SERVICE_IN_PROGRESS", "SAFETY_REVIEW", "NO_SHOW"],
  SERVICE_IN_PROGRESS: ["SERVICE_COMPLETED", "SAFETY_REVIEW"],
  SERVICE_COMPLETED: ["AWAITING_WORKER_SURVEY", "AWAITING_CLIENT_SURVEY", "FULLY_COMPLETED"],
  AWAITING_WORKER_SURVEY: ["AWAITING_CLIENT_SURVEY", "FULLY_COMPLETED", "SAFETY_REVIEW"],
  AWAITING_CLIENT_SURVEY: ["AWAITING_WORKER_SURVEY", "FULLY_COMPLETED"],
  FULLY_COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  SAFETY_REVIEW: ["CONFIRMED", "CANCELLED", "BLOCKED"],
  BLOCKED: ["CANCELLED"],
};

export class IllegalBookingTransitionError extends Error {
  constructor(
    public readonly from: BookingStatus,
    public readonly to: BookingStatus,
  ) {
    super(`Illegal booking transition: ${from} -> ${to}`);
    this.name = "IllegalBookingTransitionError";
  }
}

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_BOOKING_TRANSITIONS[from].includes(to);
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransitionBooking(from, to)) {
    throw new IllegalBookingTransitionError(from, to);
  }
}

/** Statuses that represent a client-visible "still active" appointment (used by client-facing views). */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "AVAILABILITY_OFFERED",
  "AWAITING_CLIENT_RESPONSE",
  "AWAITING_DEPOSIT",
  "AWAITING_WORKER_APPROVAL",
  "CONFIRMED",
  "DRIVER_REQUIRED",
  "DRIVER_ASSIGNED",
  "WORKER_EN_ROUTE",
  "WORKER_ARRIVED",
  "SERVICE_IN_PROGRESS",
];

export const TERMINAL_BOOKING_STATUSES: BookingStatus[] = [
  "FULLY_COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "BLOCKED",
];
