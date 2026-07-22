import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { encryptField } from "@/lib/crypto/field";
import {
  adminReviewAndSetStatus,
  getClientSafetyViewForWorker,
  processWorkerSurveyRisk,
} from "../clientSafetyService";
import { createTestAdmin, createTestBusiness, createTestClient, createTestWorker } from "./testHelpers";

describe("processWorkerSurveyRisk — safety-status updates", () => {
  it("keeps a first-time client STANDARD on a fully positive survey and records history", async () => {
    const business = await createTestBusiness();
    const { client } = await createTestClient(business.id);

    const result = await processWorkerSurveyRisk({
      clientId: client.id,
      survey: {
        q1SafeAndComfortable: "YES_COMPLETELY",
        q2RespectedBoundaries: "YES_COMPLETELY",
        q3BookingAccurate: "ACCURATE",
        q4IssueSeverity: "NO_ISSUES",
        q5FutureBookings: "YES",
      },
    });

    expect(result.appliedStatus).toBe("STANDARD");
    const updatedClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(updatedClient.safetyStatus).toBe("STANDARD");
  });

  it("applies MONITOR automatically for a minor concern and writes a status history row", async () => {
    const business = await createTestBusiness();
    const { client } = await createTestClient(business.id);

    await processWorkerSurveyRisk({
      clientId: client.id,
      survey: {
        q1SafeAndComfortable: "MOSTLY",
        q2RespectedBoundaries: "YES_COMPLETELY",
        q3BookingAccurate: "ACCURATE",
        q4IssueSeverity: "MINOR_ISSUE",
        q5FutureBookings: "YES",
      },
    });

    const updatedClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(updatedClient.safetyStatus).toBe("MONITOR");

    const history = await prisma.clientSafetyStatusHistory.findMany({ where: { clientId: client.id } });
    expect(history).toHaveLength(1);
    expect(history[0]?.toStatus).toBe("MONITOR");
    expect(history[0]?.changedByUserId).toBeNull(); // system-applied, not an admin action
  });

  it("manual-review rule: a significant concern recommends MANUAL_REVIEW_REQUIRED and applies it (auditable), pending admin awareness", async () => {
    const business = await createTestBusiness();
    const { client } = await createTestClient(business.id);

    const result = await processWorkerSurveyRisk({
      clientId: client.id,
      survey: {
        q1SafeAndComfortable: "YES_COMPLETELY",
        q2RespectedBoundaries: "YES_COMPLETELY",
        q3BookingAccurate: "SOME_DETAILS_DIFFERENT",
        q4IssueSeverity: "NO_ISSUES",
        q5FutureBookings: "YES",
      },
    });

    expect(result.recommendation.recommendedStatus).toBe("MANUAL_REVIEW_REQUIRED");
    expect(result.recommendation.appliesAutomatically).toBe(false);
  });

  it("does not let a later positive survey silently clear a RESTRICTED client", async () => {
    const business = await createTestBusiness();
    const { client } = await createTestClient(business.id);
    await prisma.client.update({ where: { id: client.id }, data: { safetyStatus: "RESTRICTED" } });

    const result = await processWorkerSurveyRisk({
      clientId: client.id,
      survey: {
        q1SafeAndComfortable: "YES_COMPLETELY",
        q2RespectedBoundaries: "YES_COMPLETELY",
        q3BookingAccurate: "ACCURATE",
        q4IssueSeverity: "NO_ISSUES",
        q5FutureBookings: "YES",
      },
    });

    expect(result.appliedStatus).toBe("RESTRICTED");
    const updatedClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(updatedClient.safetyStatus).toBe("RESTRICTED");
  });
});

describe("adminReviewAndSetStatus — the distinct human-confirmation action", () => {
  it("allows an admin to finalize a status change and records who/when/why", async () => {
    const business = await createTestBusiness();
    const { client } = await createTestClient(business.id);
    const { authzUser: admin } = await createTestAdmin(business.id);

    await adminReviewAndSetStatus({
      admin,
      clientId: client.id,
      newStatus: "RESTRICTED",
      reason: "Confirmed after reviewing worker survey and speaking with the client.",
    });

    const updatedClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(updatedClient.safetyStatus).toBe("RESTRICTED");

    const history = await prisma.clientSafetyStatusHistory.findFirst({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
    });
    expect(history?.changedByUserId).toBe(admin.id);
    expect(history?.toStatus).toBe("RESTRICTED");
  });

  it("rejects a non-admin (e.g. worker) attempting to change a client's safety status", async () => {
    const business = await createTestBusiness();
    const { client } = await createTestClient(business.id);
    const { authzUser: workerAuthzUser } = await createTestWorker(business.id);

    await expect(
      adminReviewAndSetStatus({ admin: workerAuthzUser, clientId: client.id, newStatus: "RESTRICTED", reason: "test" }),
    ).rejects.toThrow();
  });
});

describe("getClientSafetyViewForWorker — private notes access control", () => {
  it("does not expose another worker's private survey notes about the same client", async () => {
    const business = await createTestBusiness();
    const { client } = await createTestClient(business.id);
    const { worker: workerA } = await createTestWorker(business.id);
    const { worker: workerB } = await createTestWorker(business.id);
    const service = await prisma.service.create({ data: { businessId: business.id, name: "Test Service", baseDurationMinutes: 60, basePriceCents: 15000 } });

    const bookingWithA = await prisma.booking.create({
      data: { businessId: business.id, clientId: client.id, workerId: workerA.id, serviceId: service.id, status: "FULLY_COMPLETED" },
    });
    await prisma.workerSafetySurvey.create({
      data: {
        bookingId: bookingWithA.id,
        workerId: workerA.id,
        q1SafeAndComfortable: "YES_COMPLETELY",
        q2RespectedBoundaries: "YES_COMPLETELY",
        q3BookingAccurate: "ACCURATE",
        q4IssueSeverity: "NO_ISSUES",
        q5FutureBookings: "YES",
        additionalConditions: [],
        privateNotesEncrypted: encryptField("Worker A's private note: client mentioned a health condition."),
      },
    });

    const viewForWorkerB = await getClientSafetyViewForWorker(workerB.id, client.id);
    expect(viewForWorkerB.ownPastSurveys).toHaveLength(0);

    const viewForWorkerA = await getClientSafetyViewForWorker(workerA.id, client.id);
    expect(viewForWorkerA.ownPastSurveys).toHaveLength(1);
  });

  it("shares the client's safety STATUS across workers when the business enables it, without sharing notes", async () => {
    const business = await createTestBusiness();
    await prisma.business.update({ where: { id: business.id }, data: { shareSafetyStatusAcrossWorkers: true } });
    const { client } = await createTestClient(business.id);
    await prisma.client.update({ where: { id: client.id }, data: { safetyStatus: "MONITOR" } });
    const { worker: workerB } = await createTestWorker(business.id);

    const view = await getClientSafetyViewForWorker(workerB.id, client.id);
    expect(view.safetyStatus).toBe("MONITOR");
    expect(view.crossWorkerNotesVisible).toBe(true);
    expect(view.ownPastSurveys).toHaveLength(0); // status shared, but no notes leaked
  });
});
