import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/integrations/sms";
import { getEmailProvider } from "@/integrations/email";
import type { NotificationChannel, NotificationType } from "@prisma/client";

export interface SendNotificationInput {
  businessId: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  payload: { title: string; body: string; [key: string]: unknown };
}

export async function sendNotification(input: SendNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      type: input.type,
      channel: input.channel,
      payload: input.payload as object as never,
      status: "PENDING",
    },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });

  try {
    if (input.channel === "SMS" && user.phone) {
      await getSmsProvider().sendSms(user.phone, input.payload.body);
    } else if (input.channel === "EMAIL") {
      await getEmailProvider().sendEmail(user.email, input.payload.title, input.payload.body);
    }
    return await prisma.notification.update({ where: { id: notification.id }, data: { status: "SENT", sentAt: new Date() } });
  } catch (error) {
    await prisma.notification.update({ where: { id: notification.id }, data: { status: "FAILED" } });
    throw error;
  }
}

/** Background-job-friendly check: workers who completed a service but haven't filed the
 * private safety survey within the reminder window. See /docs/04-user-flows.md §5 and
 * /docs/09-folder-structure.md jobs/surveyNudges.ts. */
export async function findOverdueWorkerSurveys(businessId: string, reminderWindowHours: number) {
  const cutoff = new Date(Date.now() - reminderWindowHours * 60 * 60 * 1000);
  return prisma.booking.findMany({
    where: {
      businessId,
      workerSurveyDone: false,
      status: { in: ["AWAITING_WORKER_SURVEY", "SERVICE_COMPLETED"] },
      confirmedEnd: { lte: cutoff },
    },
    include: { worker: true },
  });
}

/** Missed check-in detection: a booking is "in flight" (en route/arrived/in progress) with no
 * matching status update past its expected time. Feeds the missed-check-in alert notification. */
export async function findMissedCheckIns(businessId: string, graceMinutes: number) {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  return prisma.booking.findMany({
    where: {
      businessId,
      status: { in: ["WORKER_EN_ROUTE", "WORKER_ARRIVED", "SERVICE_IN_PROGRESS"] },
      updatedAt: { lte: cutoff },
    },
    include: { worker: true },
  });
}
