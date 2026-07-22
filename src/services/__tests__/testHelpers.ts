import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/crypto/password";
import type { AuthzUser } from "@/lib/authz";

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createTestBusiness() {
  return prisma.business.create({ data: { name: unique("Test Business") } });
}

export async function createTestWorker(businessId: string) {
  const passwordHash = await hashPassword("TestPass123!");
  const email = `${unique("worker")}@example.com`;
  const user = await prisma.user.create({
    data: { businessId, email, passwordHash, name: "Test Worker", role: "WORKER" },
  });
  const worker = await prisma.worker.create({
    data: { userId: user.id, businessId, displayName: "Test Worker", autoApproveBookings: true },
  });
  const authzUser: AuthzUser = { id: user.id, businessId, role: "WORKER" };
  return { user, worker, authzUser };
}

export async function createTestAdmin(businessId: string) {
  const passwordHash = await hashPassword("TestPass123!");
  const email = `${unique("admin")}@example.com`;
  const user = await prisma.user.create({
    data: { businessId, email, passwordHash, name: "Test Admin", role: "ADMIN" },
  });
  const authzUser: AuthzUser = { id: user.id, businessId, role: "ADMIN" };
  return { user, authzUser };
}

export async function createTestDriver(businessId: string) {
  const passwordHash = await hashPassword("TestPass123!");
  const email = `${unique("driver")}@example.com`;
  const user = await prisma.user.create({
    data: { businessId, email, passwordHash, name: "Test Driver", role: "DRIVER" },
  });
  const driver = await prisma.driver.create({
    data: { userId: user.id, businessId, serviceAreas: ["Bondi"], active: true },
  });
  const authzUser: AuthzUser = { id: user.id, businessId, role: "DRIVER" };
  return { user, driver, authzUser };
}

export async function createTestClient(businessId: string) {
  const passwordHash = await hashPassword("TestPass123!");
  const email = `${unique("client")}@example.com`;
  const user = await prisma.user.create({
    data: { businessId, email, passwordHash, name: "Test Client", role: "CLIENT" },
  });
  const client = await prisma.client.create({
    data: { businessId, userId: user.id, fullName: "Test Client", phone: "+61400000000", email },
  });
  const authzUser: AuthzUser = { id: user.id, businessId, role: "CLIENT" };
  return { user, client, authzUser };
}

export async function createTestService(businessId: string) {
  return prisma.service.create({
    data: { businessId, name: unique("Service"), baseDurationMinutes: 60, basePriceCents: 15000 },
  });
}

export async function createTestBooking(opts: {
  businessId: string;
  clientId: string;
  workerId: string;
  serviceId: string;
  status?:
    | "NEW_ENQUIRY"
    | "CONFIRMED"
    | "SERVICE_COMPLETED"
    | "AWAITING_WORKER_SURVEY"
    | "AWAITING_CLIENT_SURVEY"
    | "WORKER_EN_ROUTE"
    | "WORKER_ARRIVED"
    | "SERVICE_IN_PROGRESS";
  confirmedStart?: Date;
  confirmedEnd?: Date;
  updatedAt?: Date;
}) {
  const booking = await prisma.booking.create({
    data: {
      businessId: opts.businessId,
      clientId: opts.clientId,
      workerId: opts.workerId,
      serviceId: opts.serviceId,
      status: opts.status ?? "NEW_ENQUIRY",
      confirmedStart: opts.confirmedStart,
      confirmedEnd: opts.confirmedEnd,
    },
  });
  if (opts.updatedAt) {
    // Bypass Prisma's @updatedAt auto-management for deterministic "stale" fixtures.
    await prisma.$executeRawUnsafe(`UPDATE "Booking" SET "updatedAt" = $1 WHERE id = $2`, opts.updatedAt, booking.id);
  }
  return prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
}
