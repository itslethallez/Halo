import { describe, it, expect } from "vitest";
import { assertCan, can, ForbiddenError, isOwner, requiresAdminConfirmation, type AuthzUser } from "../authz";

function user(role: AuthzUser["role"]): AuthzUser {
  return { id: "u1", businessId: "biz1", role };
}

describe("role-based access control", () => {
  it("allows an admin to manage workers and drivers", () => {
    expect(can(user("ADMIN"), "manage_workers")).toBe(true);
    expect(can(user("ADMIN"), "manage_drivers")).toBe(true);
  });

  it("does not allow a worker to manage other workers or drivers", () => {
    expect(can(user("WORKER"), "manage_workers")).toBe(false);
    expect(can(user("WORKER"), "manage_drivers")).toBe(false);
  });

  it("does not allow a driver to view business financials or manage services", () => {
    expect(can(user("DRIVER"), "view_business_financials")).toBe(false);
    expect(can(user("DRIVER"), "manage_services")).toBe(false);
  });

  it("allows a driver only to accept/decline their own jobs and view their own earnings", () => {
    expect(can(user("DRIVER"), "accept_decline_own_driver_job")).toBe(true);
    expect(can(user("DRIVER"), "view_own_earnings")).toBe(true);
    expect(can(user("DRIVER"), "create_allocate_driver_job")).toBe(false);
  });

  it("does not allow a client to view other clients' safety notes or business financials", () => {
    expect(can(user("CLIENT"), "view_client_safety_notes")).toBe(false);
    expect(can(user("CLIENT"), "view_business_financials")).toBe(false);
  });

  it("does not allow a worker to change a client's safety status directly", () => {
    expect(can(user("WORKER"), "change_client_safety_status")).toBe(false);
  });

  it("only allows admin to access audit logs and manage permissions", () => {
    for (const role of ["WORKER", "DRIVER", "CLIENT"] as const) {
      expect(can(user(role), "access_audit_logs")).toBe(false);
      expect(can(user(role), "manage_permissions")).toBe(false);
    }
    expect(can(user("ADMIN"), "access_audit_logs")).toBe(true);
  });

  it("assertCan throws ForbiddenError for a disallowed action", () => {
    expect(() => assertCan(user("CLIENT"), "manage_workers")).toThrow(ForbiddenError);
  });

  it("isOwner correctly identifies matching user ids", () => {
    expect(isOwner(user("WORKER"), "u1")).toBe(true);
    expect(isOwner(user("WORKER"), "someone-else")).toBe(false);
  });

  it("flags RESTRICTED-and-above statuses as requiring admin confirmation", () => {
    expect(requiresAdminConfirmation("RESTRICTED")).toBe(true);
    expect(requiresAdminConfirmation("DO_NOT_BOOK")).toBe(true);
    expect(requiresAdminConfirmation("BLOCKED_PENDING_INVESTIGATION")).toBe(true);
    expect(requiresAdminConfirmation("MONITOR")).toBe(false);
    expect(requiresAdminConfirmation("STANDARD")).toBe(false);
  });
});
