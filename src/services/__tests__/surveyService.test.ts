import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/crypto/field";
import { submitWorkerSafetySurvey, submitClientSatisfactionSurvey } from "../surveyService";
import {
  createTestBusiness,
  createTestWorker,
  createTestClient,
  createTestService,
  createTestBooking,
} from "./testHelpers";

describe("submitWorkerSafetySurvey", () => {
  it("stores the survey, encrypts private notes, and advances the booking status", async () => {
    const business = await createTestBusiness();
    const { worker, authzUser } = await createTestWorker(business.id);
    const { client } = await createTestClient(business.id);
    const service = await createTestService(business.id);
    const booking = await createTestBooking({
      businessId: business.id,
      clientId: client.id,
      workerId: worker.id,
      serviceId: service.id,
      status: "SERVICE_COMPLETED",
    });

    await submitWorkerSafetySurvey({
      actingWorker: authzUser,
      bookingId: booking.id,
      workerId: worker.id,
      q1SafeAndComfortable: "YES_COMPLETELY",
      q2RespectedBoundaries: "YES_COMPLETELY",
      q3BookingAccurate: "ACCURATE",
      q4IssueSeverity: "NO_ISSUES",
      q5FutureBookings: "YES",
      additionalConditions: [],
      privateNotes: "Everything went smoothly.",
    });

    const survey = await prisma.workerSafetySurvey.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(survey.privateNotesEncrypted).not.toContain("smoothly");
    expect(decryptField(survey.privateNotesEncrypted!)).toBe("Everything went smoothly.");

    const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updated.workerSurveyDone).toBe(true);
    expect(updated.status).toBe("AWAITING_CLIENT_SURVEY");
  });

  it("rejects submitting a survey for a booking that already has one", async () => {
    const business = await createTestBusiness();
    const { worker, authzUser } = await createTestWorker(business.id);
    const { client } = await createTestClient(business.id);
    const service = await createTestService(business.id);
    const booking = await createTestBooking({
      businessId: business.id,
      clientId: client.id,
      workerId: worker.id,
      serviceId: service.id,
      status: "SERVICE_COMPLETED",
    });

    const payload = {
      actingWorker: authzUser,
      bookingId: booking.id,
      workerId: worker.id,
      q1SafeAndComfortable: "YES_COMPLETELY" as const,
      q2RespectedBoundaries: "YES_COMPLETELY" as const,
      q3BookingAccurate: "ACCURATE" as const,
      q4IssueSeverity: "NO_ISSUES" as const,
      q5FutureBookings: "YES" as const,
      additionalConditions: [],
    };

    await submitWorkerSafetySurvey(payload);
    await expect(submitWorkerSafetySurvey(payload)).rejects.toThrow();
  });

  it("rejects a worker submitting a survey for someone else's booking", async () => {
    const business = await createTestBusiness();
    const { worker } = await createTestWorker(business.id);
    const { authzUser: otherWorkerAuthzUser } = await createTestWorker(business.id);
    const { client } = await createTestClient(business.id);
    const service = await createTestService(business.id);
    const booking = await createTestBooking({
      businessId: business.id,
      clientId: client.id,
      workerId: worker.id,
      serviceId: service.id,
      status: "SERVICE_COMPLETED",
    });

    await expect(
      submitWorkerSafetySurvey({
        actingWorker: otherWorkerAuthzUser,
        bookingId: booking.id,
        workerId: worker.id,
        q1SafeAndComfortable: "YES_COMPLETELY",
        q2RespectedBoundaries: "YES_COMPLETELY",
        q3BookingAccurate: "ACCURATE",
        q4IssueSeverity: "NO_ISSUES",
        q5FutureBookings: "YES",
        additionalConditions: [],
      }),
    ).rejects.toThrow();
  });

  it("creates client restrictions from additional conditions selected on the survey", async () => {
    const business = await createTestBusiness();
    const { worker, authzUser } = await createTestWorker(business.id);
    const { client } = await createTestClient(business.id);
    const service = await createTestService(business.id);
    const booking = await createTestBooking({
      businessId: business.id,
      clientId: client.id,
      workerId: worker.id,
      serviceId: service.id,
      status: "SERVICE_COMPLETED",
    });

    await submitWorkerSafetySurvey({
      actingWorker: authzUser,
      bookingId: booking.id,
      workerId: worker.id,
      q1SafeAndComfortable: "MOSTLY",
      q2RespectedBoundaries: "MINOR_CONCERNS",
      q3BookingAccurate: "MOSTLY_ACCURATE",
      q4IssueSeverity: "MINOR_ISSUE",
      q5FutureBookings: "YES_WITH_CONDITIONS",
      additionalConditions: ["DRIVER_MUST_REMAIN_NEARBY", "DEPOSIT_REQUIRED"],
    });

    const restrictions = await prisma.clientRestriction.findMany({ where: { clientId: client.id } });
    expect(restrictions.map((r) => r.type).sort()).toEqual(["DEPOSIT_REQUIRED", "DRIVER_MUST_REMAIN_NEARBY"]);
  });
});

describe("submitClientSatisfactionSurvey", () => {
  it("stores the survey and creates a review task (SafetyIncident) on negative feedback without touching the worker", async () => {
    const business = await createTestBusiness();
    const { worker } = await createTestWorker(business.id);
    const { client, authzUser } = await createTestClient(business.id);
    const service = await createTestService(business.id);
    const booking = await createTestBooking({
      businessId: business.id,
      clientId: client.id,
      workerId: worker.id,
      serviceId: service.id,
      status: "SERVICE_COMPLETED",
    });

    const result = await submitClientSatisfactionSurvey({
      actingClient: authzUser,
      bookingId: booking.id,
      clientId: client.id,
      q1Satisfaction: "DISSATISFIED",
      q2Punctuality: "SIGNIFICANTLY_OFF",
      q3Professionalism: "NEEDS_IMPROVEMENT",
      q4MatchedExpectations: "NOT_ENTIRELY",
      q5WouldReturn: "PROBABLY_NOT",
      contactMeBack: true,
    });

    expect(result.hasNegativeAnswer).toBe(true);

    const incident = await prisma.safetyIncident.findFirst({ where: { bookingId: booking.id, source: "CLIENT_FEEDBACK" } });
    expect(incident).not.toBeNull();
    expect(incident?.resolved).toBe(false);

    // Worker record itself is untouched — no automatic penalty.
    const workerAfter = await prisma.worker.findUniqueOrThrow({ where: { id: worker.id } });
    expect(workerAfter.active).toBe(true);
  });

  it("does not create a review task for entirely positive feedback", async () => {
    const business = await createTestBusiness();
    const { worker } = await createTestWorker(business.id);
    const { client, authzUser } = await createTestClient(business.id);
    const service = await createTestService(business.id);
    const booking = await createTestBooking({
      businessId: business.id,
      clientId: client.id,
      workerId: worker.id,
      serviceId: service.id,
      status: "SERVICE_COMPLETED",
    });

    await submitClientSatisfactionSurvey({
      actingClient: authzUser,
      bookingId: booking.id,
      clientId: client.id,
      q1Satisfaction: "VERY_SATISFIED",
      q2Punctuality: "ON_TIME",
      q3Professionalism: "YES_COMPLETELY",
      q4MatchedExpectations: "YES_COMPLETELY",
      q5WouldReturn: "DEFINITELY",
      contactMeBack: false,
    });

    const incident = await prisma.safetyIncident.findFirst({ where: { bookingId: booking.id, source: "CLIENT_FEEDBACK" } });
    expect(incident).toBeNull();
  });
});
