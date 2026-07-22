import type { DriverJobStatus } from "@prisma/client";

/** See /docs/07-driver-allocation.md "Trip statuses". */
export const ALLOWED_DRIVER_JOB_TRANSITIONS: Record<DriverJobStatus, DriverJobStatus[]> = {
  UNASSIGNED: ["OFFERED", "CANCELLED"],
  OFFERED: ["ACCEPTED", "DECLINED", "CANCELLED"],
  ACCEPTED: ["EN_ROUTE_TO_WORKER", "CANCELLED"],
  DECLINED: ["OFFERED", "UNASSIGNED", "CANCELLED"],
  EN_ROUTE_TO_WORKER: ["WORKER_COLLECTED", "CANCELLED"],
  WORKER_COLLECTED: ["ARRIVED_AT_DESTINATION", "CANCELLED"],
  ARRIVED_AT_DESTINATION: ["WAITING", "RETURN_TRIP_STARTED", "COMPLETED", "CANCELLED"],
  WAITING: ["RETURN_TRIP_STARTED", "COMPLETED", "CANCELLED"],
  RETURN_TRIP_STARTED: ["WORKER_RETURNED", "CANCELLED"],
  WORKER_RETURNED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export class IllegalDriverJobTransitionError extends Error {
  constructor(
    public readonly from: DriverJobStatus,
    public readonly to: DriverJobStatus,
  ) {
    super(`Illegal driver job transition: ${from} -> ${to}`);
    this.name = "IllegalDriverJobTransitionError";
  }
}

export function canTransitionDriverJob(from: DriverJobStatus, to: DriverJobStatus): boolean {
  return ALLOWED_DRIVER_JOB_TRANSITIONS[from].includes(to);
}

export function assertDriverJobTransition(from: DriverJobStatus, to: DriverJobStatus): void {
  if (!canTransitionDriverJob(from, to)) {
    throw new IllegalDriverJobTransitionError(from, to);
  }
}
