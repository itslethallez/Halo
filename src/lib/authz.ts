/**
 * Central RBAC enforcement point. Every server action / route handler must call `can()`
 * before doing anything to a protected resource — never rely on the UI hiding a button.
 * See /docs/03-permissions.md for the full narrative permission table this encodes.
 */
import type { Role } from "@prisma/client";

export type Action =
  | "manage_workers"
  | "manage_drivers"
  | "manage_services"
  | "view_all_bookings"
  | "view_own_bookings"
  | "approve_manual_review_booking"
  | "set_own_availability"
  | "message_clients"
  | "view_client_contact"
  | "view_client_safety_notes"
  | "submit_worker_survey"
  | "view_worker_survey"
  | "submit_client_survey"
  | "view_client_survey"
  | "change_client_safety_status"
  | "approve_or_block_client"
  | "create_allocate_driver_job"
  | "accept_decline_own_driver_job"
  | "view_driver_job_financials"
  | "view_business_financials"
  | "view_own_earnings"
  | "configure_ai_tone"
  | "configure_booking_safety_rules"
  | "access_audit_logs"
  | "manage_permissions"
  | "emergency_escalation"
  | "book_reschedule_cancel"
  | "view_worker_private_info"
  | "view_driver_job_as_driver";

const ROLE_PERMISSIONS: Record<Role, Set<Action>> = {
  ADMIN: new Set<Action>([
    "manage_workers",
    "manage_drivers",
    "manage_services",
    "view_all_bookings",
    "approve_manual_review_booking",
    "message_clients",
    "view_client_contact",
    "view_client_safety_notes",
    "view_worker_survey",
    "view_client_survey",
    "change_client_safety_status",
    "approve_or_block_client",
    "create_allocate_driver_job",
    "view_driver_job_financials",
    "view_business_financials",
    "configure_ai_tone",
    "configure_booking_safety_rules",
    "access_audit_logs",
    "manage_permissions",
    "emergency_escalation",
    "book_reschedule_cancel",
    "view_worker_private_info",
  ]),
  WORKER: new Set<Action>([
    "view_own_bookings",
    "set_own_availability",
    "message_clients",
    "view_client_contact",
    "submit_worker_survey",
    "view_worker_survey",
    "create_allocate_driver_job",
    "view_own_earnings",
    "configure_ai_tone",
    "emergency_escalation",
    "book_reschedule_cancel",
    "view_worker_private_info",
  ]),
  DRIVER: new Set<Action>(["accept_decline_own_driver_job", "view_own_earnings", "view_driver_job_as_driver"]),
  CLIENT: new Set<Action>(["view_own_bookings", "submit_client_survey", "book_reschedule_cancel"]),
};

export interface AuthzUser {
  id: string;
  businessId: string;
  role: Role;
}

export function can(user: AuthzUser, action: Action): boolean {
  return ROLE_PERMISSIONS[user.role].has(action);
}

export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`User is not permitted to perform action: ${action}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(user: AuthzUser, action: Action): void {
  if (!can(user, action)) {
    throw new ForbiddenError(action);
  }
}

/** A worker may only act on their own bookings/clients — ownership is a data check, not a role check. */
export function isOwner(user: AuthzUser, ownerId: string): boolean {
  return user.id === ownerId;
}

/**
 * Serious client-safety decisions (RESTRICTED and above) must always be a distinct, authorised
 * admin action — never a side effect of a worker survey being processed automatically.
 * See /docs/06-safety-risk-rules.md.
 */
export function requiresAdminConfirmation(status: string): boolean {
  return ["RESTRICTED", "DO_NOT_BOOK", "BLOCKED_PENDING_INVESTIGATION"].includes(status);
}
