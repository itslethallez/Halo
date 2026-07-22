"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAuthzUser } from "@/lib/auth/currentUser";
import { prisma } from "@/lib/prisma";
import { driverRespondToOffer } from "@/services/driverService";
import { assertDriverJobTransition } from "@/domain/driver/statusMachine";
import type { DriverJobStatus } from "@prisma/client";

async function requireDriver() {
  const authzUser = await getCurrentAuthzUser();
  if (!authzUser || authzUser.role !== "DRIVER") throw new Error("Not authenticated as a driver");
  return authzUser;
}

export async function respondToOfferAction(driverJobId: string, accept: boolean) {
  const driver = await requireDriver();
  await driverRespondToOffer({ driver, driverJobId, accept });
  revalidatePath("/driver");
}

export async function advanceTripStatusAction(driverJobId: string, toStatus: DriverJobStatus) {
  const driver = await requireDriver();
  const job = await prisma.driverJob.findUniqueOrThrow({ where: { id: driverJobId } });
  assertDriverJobTransition(job.status, toStatus);
  await prisma.$transaction([
    prisma.driverJob.update({ where: { id: driverJobId }, data: { status: toStatus } }),
    prisma.driverStatusHistory.create({ data: { driverJobId, fromStatus: job.status, toStatus, changedByUserId: driver.id } }),
  ]);
  revalidatePath("/driver");
}
