import { describe, it, expect } from "vitest";
import { findMissedCheckIns, findOverdueWorkerSurveys, sendNotification } from "../notificationService";
import { createTestBusiness, createTestClient, createTestService, createTestWorker, createTestBooking } from "./testHelpers";

describe("missed safety check-in detection", () => {
  it("flags a booking stuck 'in flight' past the grace period", async () => {
    const business = await createTestBusiness();
    const { worker } = await createTestWorker(business.id);
    const { client } = await createTestClient(business.id);
    const service = await createTestService(business.id);

    const staleBooking = await createTestBooking({
      businessId: business.id,
      clientId: client.id,
      workerId: worker.id,
      serviceId: service.id,
      status: "WORKER_ARRIVED",
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    });

    const freshBooking = await createTestBooking({
      businessId: business.id,
      clientId: client.id,
      workerId: worker.id,
      serviceId: service.id,
      status: "WORKER_ARRIVED",
    });

    const missed = await findMissedCheckIns(business.id, 60);
    const missedIds = missed.map((b) => b.id);
    expect(missedIds).toContain(staleBooking.id);
    expect(missedIds).not.toContain(freshBooking.id);
  });

  it("does not flag a booking that is not in an in-flight status", async () => {
    const business = await createTestBusiness();
    const { worker } = await createTestWorker(business.id);
    const { client } = await createTestClient(business.id);
    const service = await createTestService(business.id);

    await createTestBooking({
      businessId: business.id,
      clientId: client.id,
      workerId: worker.id,
      serviceId: service.id,
      status: "CONFIRMED",
      updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    });

    const missed = await findMissedCheckIns(business.id, 60);
    expect(missed).toHaveLength(0);
  });
});

describe("overdue worker safety survey reminders", () => {
  it("flags a completed service whose worker survey is still outstanding past the window", async () => {
    const business = await createTestBusiness();
    const { worker } = await createTestWorker(business.id);
    const { client } = await createTestClient(business.id);
    const service = await createTestService(business.id);

    const overdue = await createTestBooking({
      businessId: business.id,
      clientId: client.id,
      workerId: worker.id,
      serviceId: service.id,
      status: "AWAITING_WORKER_SURVEY",
      confirmedEnd: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });

    const results = await findOverdueWorkerSurveys(business.id, 24);
    expect(results.map((b) => b.id)).toContain(overdue.id);
  });
});

describe("sendNotification", () => {
  it("records a notification row and marks it SENT via the dev channel adapters", async () => {
    const business = await createTestBusiness();
    const { user } = await createTestWorker(business.id);

    const notification = await sendNotification({
      businessId: business.id,
      userId: user.id,
      type: "SURVEY_REMINDER",
      channel: "IN_APP",
      payload: { title: "Reminder", body: "Please complete your safety survey." },
    });

    expect(notification.status).toBe("SENT");
  });
});
