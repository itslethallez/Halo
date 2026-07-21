/**
 * Realistic demonstration data: one business, three workers, two drivers, six clients with a
 * spread of safety statuses, a service catalogue, and bookings spanning most of the booking
 * lifecycle (including completed bookings with both surveys, one in safety review, one
 * awaiting driver assignment). Run with `npm run prisma:seed`.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/crypto/password";
import { encryptField } from "../src/lib/crypto/field";

const prisma = new PrismaClient();

function daysFromNow(days: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding TrueReach demo data...");

  const devPasswordHash = await hashPassword("DemoPass123!");

  const business = await prisma.business.create({
    data: {
      name: "Serenity Mobile Massage",
      timezone: "Australia/Sydney",
      workerEarningsModel: "COMMISSION",
      autoOfferTopDriver: false,
      shareSafetyStatusAcrossWorkers: true,
      dataRetentionPolicy: { bookingRecordsYears: 7, safetyIncidentRecordsYears: 7 },
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      businessId: business.id,
      email: "admin@serenitymobile.example",
      passwordHash: devPasswordHash,
      name: "Priya Nandan",
      phone: "+61400000001",
      role: "ADMIN",
      totpEnabled: false,
    },
  });

  // ---- Services -----------------------------------------------------------
  const [serviceRelax, serviceDeepTissue, serviceCouples] = await Promise.all([
    prisma.service.create({
      data: { businessId: business.id, name: "60 Min Relaxation Massage", baseDurationMinutes: 60, basePriceCents: 15000, requiresDriverDefault: false },
    }),
    prisma.service.create({
      data: { businessId: business.id, name: "90 Min Deep Tissue Massage", baseDurationMinutes: 90, basePriceCents: 21000, requiresDriverDefault: false },
    }),
    prisma.service.create({
      data: { businessId: business.id, name: "Couples Massage (60 Min each)", baseDurationMinutes: 75, basePriceCents: 32000, requiresDriverDefault: true },
    }),
  ]);

  // ---- Workers --------------------------------------------------------------
  async function createWorker(opts: {
    email: string;
    name: string;
    tone: "WARM_FRIENDLY" | "PROFESSIONAL" | "CASUAL";
    suburbs: string[];
  }) {
    const user = await prisma.user.create({
      data: {
        businessId: business.id,
        email: opts.email,
        passwordHash: devPasswordHash,
        name: opts.name,
        phone: "+61400000100",
        role: "WORKER",
      },
    });
    const worker = await prisma.worker.create({
      data: {
        userId: user.id,
        businessId: business.id,
        displayName: opts.name.split(" ")[0]!,
        bio: `Fully qualified massage therapist serving ${opts.suburbs.join(", ")}.`,
        toneStyle: opts.tone,
        homeAddressEncrypted: encryptField("12 Wattle Street, Marrickville NSW 2204"),
        distressPhraseEncrypted: encryptField("the blue umbrella"),
        trustedContactName: "Jordan (sister)",
        trustedContactPhone: "+61400009999",
        commissionRate: 0.7,
        minimumNoticeHours: 12,
        maximumAdvanceDays: 45,
        maxJobsPerDay: 5,
        maxWorkingHoursPerDay: 9,
        defaultSetupMinutes: 15,
        defaultPackDownMinutes: 15,
        minTravelBufferMinutes: 15,
        maxTravelDistanceKm: 25,
        approvedSuburbs: opts.suburbs,
        autoApproveBookings: true,
        active: true,
      },
    });
    for (const service of [serviceRelax, serviceDeepTissue, serviceCouples]) {
      await prisma.workerService.create({ data: { workerId: worker.id, serviceId: service.id } });
    }
    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
      await prisma.workerAvailability.create({
        data: { workerId: worker.id, dayOfWeek, startMinute: 9 * 60, endMinute: 17 * 60, breakStartMinute: 12 * 60 + 30, breakEndMinute: 13 * 60 },
      });
    }
    return worker;
  }

  const workerSarah = await createWorker({ email: "sarah@serenitymobile.example", name: "Sarah Kelly", tone: "WARM_FRIENDLY", suburbs: ["Bondi", "Bondi Beach", "Bronte"] });
  const workerMax = await createWorker({ email: "max@serenitymobile.example", name: "Max Turner", tone: "PROFESSIONAL", suburbs: ["Manly", "Fairlight"] });
  const workerLena = await createWorker({ email: "lena@serenitymobile.example", name: "Lena Ostrowski", tone: "CASUAL", suburbs: ["Bondi", "Coogee"] });

  await prisma.calendarConnection.create({
    data: {
      workerId: workerSarah.id,
      provider: "GOOGLE",
      accessTokenEncrypted: encryptField("dev-mock-access-token"),
      refreshTokenEncrypted: encryptField("dev-mock-refresh-token"),
      calendarId: "primary",
    },
  });

  // ---- Drivers ----------------------------------------------------------
  async function createDriver(opts: { email: string; name: string; suburbs: string[]; rating: number }) {
    const user = await prisma.user.create({
      data: {
        businessId: business.id,
        email: opts.email,
        passwordHash: devPasswordHash,
        name: opts.name,
        phone: "+61400000200",
        role: "DRIVER",
      },
    });
    return prisma.driver.create({
      data: {
        userId: user.id,
        businessId: business.id,
        vehicleDescription: "Silver Toyota Camry",
        serviceAreas: opts.suburbs,
        ratingAverage: opts.rating,
        ratingCount: 24,
        canRemainNearby: true,
        active: true,
      },
    });
  }

  const driverOmar = await createDriver({ email: "omar@serenitymobile.example", name: "Omar Farouk", suburbs: ["Bondi", "Bondi Beach", "Bronte", "Coogee"], rating: 4.8 });
  await createDriver({ email: "hana@serenitymobile.example", name: "Hana Ito", suburbs: ["Manly", "Fairlight"], rating: 4.6 });

  await prisma.workerDriverPreference.create({ data: { workerId: workerSarah.id, driverId: driverOmar.id, preference: "PREFERRED" } });

  // ---- Clients ------------------------------------------------------------
  async function createClient(opts: { name: string; phone: string; email: string; suburb: string; safetyStatus: "TRUSTED" | "STANDARD" | "MONITOR" | "RESTRICTED" }) {
    const user = await prisma.user.create({
      data: {
        businessId: business.id,
        email: opts.email,
        passwordHash: devPasswordHash,
        name: opts.name,
        phone: opts.phone,
        role: "CLIENT",
      },
    });
    const client = await prisma.client.create({
      data: {
        businessId: business.id,
        userId: user.id,
        fullName: opts.name,
        phone: opts.phone,
        email: opts.email,
        verifiedContact: true,
        safetyStatus: opts.safetyStatus,
      },
    });
    const address = await prisma.clientAddress.create({
      data: { clientId: client.id, line1: "8 Ocean View Rd", suburb: opts.suburb, state: "NSW", postcode: "2026", isPrimary: true },
    });
    if (opts.safetyStatus !== "STANDARD") {
      await prisma.clientSafetyStatusHistory.create({
        data: { clientId: client.id, fromStatus: "STANDARD", toStatus: opts.safetyStatus, reason: "Seed demo data", changedByUserId: adminUser.id },
      });
    }
    return { client, address };
  }

  const clientAlice = await createClient({ name: "Alice Nguyen", phone: "+61411111111", email: "alice.client@example.com", suburb: "Bondi", safetyStatus: "TRUSTED" });
  const clientBen = await createClient({ name: "Ben Wilson", phone: "+61411111112", email: "ben.client@example.com", suburb: "Bronte", safetyStatus: "STANDARD" });
  const clientCara = await createClient({ name: "Cara Douglas", phone: "+61411111113", email: "cara.client@example.com", suburb: "Bondi Beach", safetyStatus: "MONITOR" });
  const clientDavid = await createClient({ name: "David Osei", phone: "+61411111114", email: "david.client@example.com", suburb: "Manly", safetyStatus: "STANDARD" });
  await createClient({ name: "Erin Walsh", phone: "+61411111115", email: "erin.client@example.com", suburb: "Coogee", safetyStatus: "RESTRICTED" });
  await createClient({ name: "Farid Haidari", phone: "+61411111116", email: "farid.client@example.com", suburb: "Fairlight", safetyStatus: "STANDARD" });

  // ---- Bookings across the lifecycle --------------------------------------

  // 1. A fully completed booking with both surveys (positive outcome).
  const completedBooking = await prisma.booking.create({
    data: {
      businessId: business.id,
      clientId: clientAlice.client.id,
      workerId: workerSarah.id,
      serviceId: serviceRelax.id,
      addressId: clientAlice.address.id,
      status: "FULLY_COMPLETED",
      requestedStart: daysFromNow(-5, 10),
      confirmedStart: daysFromNow(-5, 10),
      confirmedEnd: daysFromNow(-5, 11),
      setupMinutes: 15,
      packDownMinutes: 15,
      travelMinutes: 20,
      requiresDriver: false,
      workerSurveyDone: true,
      clientSurveyDone: true,
      depositRequiredCents: 5000,
    },
  });
  await prisma.bookingStatusHistory.createMany({
    data: [
      { bookingId: completedBooking.id, toStatus: "NEW_ENQUIRY", createdAt: daysFromNow(-7) },
      { bookingId: completedBooking.id, fromStatus: "NEW_ENQUIRY", toStatus: "CONFIRMED", createdAt: daysFromNow(-6) },
      { bookingId: completedBooking.id, fromStatus: "CONFIRMED", toStatus: "SERVICE_COMPLETED", createdAt: daysFromNow(-5, 11) },
      { bookingId: completedBooking.id, fromStatus: "SERVICE_COMPLETED", toStatus: "FULLY_COMPLETED", createdAt: daysFromNow(-5, 12) },
    ],
  });
  await prisma.workerSafetySurvey.create({
    data: {
      bookingId: completedBooking.id,
      workerId: workerSarah.id,
      q1SafeAndComfortable: "YES_COMPLETELY",
      q2RespectedBoundaries: "YES_COMPLETELY",
      q3BookingAccurate: "ACCURATE",
      q4IssueSeverity: "NO_ISSUES",
      q5FutureBookings: "YES",
      additionalConditions: [],
    },
  });
  await prisma.clientSatisfactionSurvey.create({
    data: {
      bookingId: completedBooking.id,
      clientId: clientAlice.client.id,
      q1Satisfaction: "VERY_SATISFIED",
      q2Punctuality: "ON_TIME",
      q3Professionalism: "YES_COMPLETELY",
      q4MatchedExpectations: "YES_COMPLETELY",
      q5WouldReturn: "DEFINITELY",
      contactMeBack: false,
    },
  });
  const depositPayment = await prisma.payment.create({
    data: { businessId: business.id, bookingId: completedBooking.id, type: "DEPOSIT", amountCents: 5000, feeCents: 150, status: "SUCCEEDED", providerReferenceId: "dev-pi-seed-1" },
  });
  await prisma.payment.create({
    data: { businessId: business.id, bookingId: completedBooking.id, type: "BALANCE", amountCents: 10000, feeCents: 300, status: "SUCCEEDED", providerReferenceId: "dev-pi-seed-2" },
  });
  void depositPayment;

  // 2. A confirmed upcoming booking.
  await prisma.booking.create({
    data: {
      businessId: business.id,
      clientId: clientBen.client.id,
      workerId: workerSarah.id,
      serviceId: serviceDeepTissue.id,
      addressId: clientBen.address.id,
      status: "CONFIRMED",
      requestedStart: daysFromNow(2, 14),
      confirmedStart: daysFromNow(2, 14),
      confirmedEnd: daysFromNow(2, 15, 30),
      setupMinutes: 15,
      packDownMinutes: 15,
      travelMinutes: 15,
      requiresDriver: false,
      depositRequiredCents: 5000,
    },
  });

  // 3. Awaiting worker approval (manual review — new client-ish scenario).
  await prisma.booking.create({
    data: {
      businessId: business.id,
      clientId: clientDavid.client.id,
      workerId: workerMax.id,
      serviceId: serviceRelax.id,
      status: "AWAITING_WORKER_APPROVAL",
      requestedStart: daysFromNow(3, 16),
      depositRequiredCents: 5000,
    },
  });

  // 4. Driver-required booking with an assigned driver.
  const driverBooking = await prisma.booking.create({
    data: {
      businessId: business.id,
      clientId: clientCara.client.id,
      workerId: workerLena.id,
      serviceId: serviceCouples.id,
      status: "DRIVER_ASSIGNED",
      requestedStart: daysFromNow(1, 18),
      confirmedStart: daysFromNow(1, 18),
      confirmedEnd: daysFromNow(1, 19, 15),
      setupMinutes: 20,
      packDownMinutes: 20,
      travelMinutes: 25,
      requiresDriver: true,
      depositRequiredCents: 8000,
    },
  });
  await prisma.driverJob.create({
    data: {
      businessId: business.id,
      bookingId: driverBooking.id,
      workerId: workerLena.id,
      driverId: driverOmar.id,
      pickupAddress: "12 Wattle Street, Marrickville NSW 2204",
      destinationAddress: "8 Ocean View Rd, Bondi Beach NSW 2026",
      scheduledStart: daysFromNow(1, 17, 30),
      estimatedTravelMinutes: 25,
      returnTripRequired: true,
      driverPaymentCents: 4000,
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });
  await prisma.expense.create({
    data: { businessId: business.id, bookingId: driverBooking.id, category: "DRIVER_PAYMENT", amountCents: 4000, description: "Omar — return trip" },
  });

  // 5. A booking in safety review (a prior serious survey outcome).
  const safetyReviewBooking = await prisma.booking.create({
    data: {
      businessId: business.id,
      clientId: clientCara.client.id,
      workerId: workerSarah.id,
      serviceId: serviceRelax.id,
      addressId: undefined,
      status: "SAFETY_REVIEW",
      requestedStart: daysFromNow(-1, 13),
      confirmedStart: daysFromNow(-1, 13),
      confirmedEnd: daysFromNow(-1, 14),
      setupMinutes: 15,
      packDownMinutes: 15,
      requiresDriver: false,
    },
  });
  await prisma.workerSafetySurvey.create({
    data: {
      bookingId: safetyReviewBooking.id,
      workerId: workerSarah.id,
      q1SafeAndComfortable: "MOSTLY",
      q2RespectedBoundaries: "MINOR_CONCERNS",
      q3BookingAccurate: "MOSTLY_ACCURATE",
      q4IssueSeverity: "MINOR_ISSUE",
      q5FutureBookings: "MANUAL_APPROVAL_REQUIRED",
      additionalConditions: ["DRIVER_MUST_REMAIN_NEARBY", "DEPOSIT_REQUIRED"],
      privateNotesEncrypted: encryptField("Client was polite but pushed back on the massage plan a couple of times; recommend a driver stays nearby for future visits."),
    },
  });
  await prisma.clientRestriction.createMany({
    data: [
      { clientId: clientCara.client.id, type: "DRIVER_MUST_REMAIN_NEARBY", createdByUserId: workerSarah.userId },
      { clientId: clientCara.client.id, type: "DEPOSIT_REQUIRED", createdByUserId: workerSarah.userId },
    ],
  });
  await prisma.safetyIncident.create({
    data: {
      businessId: business.id,
      clientId: clientCara.client.id,
      workerId: workerSarah.id,
      bookingId: safetyReviewBooking.id,
      source: "WORKER_SURVEY",
      severity: "MEDIUM",
      description: "Significant discrepancy / manual approval requested by worker survey.",
    },
  });

  // ---- Notifications & audit sample ---------------------------------------
  await prisma.notification.create({
    data: {
      businessId: business.id,
      userId: workerSarah.userId,
      type: "SURVEY_REMINDER",
      channel: "IN_APP",
      payload: { title: "Safety survey outstanding", body: "Please complete your post-service safety survey." },
      status: "SENT",
      sentAt: new Date(),
    },
  });
  await prisma.auditLog.create({
    data: { businessId: business.id, actorUserId: adminUser.id, action: "SEED_DATA_CREATED", entityType: "Business", entityId: business.id },
  });

  console.log("Seed complete.");
  console.log("Demo login (all users): password 'DemoPass123!'");
  console.log(`  Admin:  ${adminUser.email}`);
  console.log(`  Worker: sarah@serenitymobile.example / max@serenitymobile.example / lena@serenitymobile.example`);
  console.log(`  Driver: omar@serenitymobile.example / hana@serenitymobile.example`);
  console.log(`  Client: alice.client@example.com / ben.client@example.com / cara.client@example.com / david.client@example.com`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
