import { prisma } from "@/lib/prisma";
import { getCurrentAuthzUser } from "@/lib/auth/currentUser";
import { formatCents } from "@/lib/currency";
import { DashboardShell } from "@/components/DashboardShell";
import { StatusPill } from "@/components/StatusPill";
import { checkInAction, emergencyEscalationAction, submitSafetySurveyAction } from "./actions";

const NEXT_CHECK_IN: Partial<Record<string, { label: string; action: "EN_ROUTE" | "ARRIVED" | "SERVICE_STARTED" | "SERVICE_ENDED" }>> = {
  CONFIRMED: { label: "Start trip", action: "EN_ROUTE" },
  DRIVER_ASSIGNED: { label: "Start trip", action: "EN_ROUTE" },
  WORKER_EN_ROUTE: { label: "Arrived", action: "ARRIVED" },
  WORKER_ARRIVED: { label: "Start service", action: "SERVICE_STARTED" },
  SERVICE_IN_PROGRESS: { label: "End service", action: "SERVICE_ENDED" },
};

export default async function WorkerDashboardPage() {
  const authzUser = await getCurrentAuthzUser();
  if (!authzUser) return null;

  const worker = await prisma.worker.findUniqueOrThrow({ where: { userId: authzUser.id } });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [todaysSchedule, outstandingSurveys, completedThisWeek, conversationsNeedingReply] = await Promise.all([
    prisma.booking.findMany({
      where: { workerId: worker.id, confirmedStart: { gte: startOfDay, lte: endOfDay } },
      include: { client: true, service: true, address: true, driverJobs: { include: { driver: { include: { user: true } } } } },
      orderBy: { confirmedStart: "asc" },
    }),
    prisma.booking.findMany({
      where: { workerId: worker.id, workerSurveyDone: false, status: { in: ["SERVICE_COMPLETED", "AWAITING_WORKER_SURVEY"] } },
      include: { client: true, service: true },
    }),
    prisma.booking.findMany({
      where: { workerId: worker.id, status: "FULLY_COMPLETED", confirmedEnd: { gte: weekAgo } },
      include: { service: true },
    }),
    prisma.conversation.findMany({ where: { workerId: worker.id, needsHuman: true }, include: { client: true }, take: 10 }),
  ]);

  const weeklyEarningsCents = completedThisWeek.reduce((sum, b) => sum + Math.round(b.service.basePriceCents * (worker.commissionRate ?? 0.7)), 0);
  const nextBooking = todaysSchedule.find((b) => !["FULLY_COMPLETED", "CANCELLED", "NO_SHOW"].includes(b.status));

  return (
    <DashboardShell role="WORKER" title={`Hi ${worker.displayName}`} subtitle="Your schedule, clients and safety tools">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Weekly earnings" value={formatCents(weeklyEarningsCents)} />
          <StatCard label="Completed this week" value={String(completedThisWeek.length)} />
          <StatCard label="Outstanding surveys" value={String(outstandingSurveys.length)} alert={outstandingSurveys.length > 0} />
        </section>

        {nextBooking && (
          <div className="card border-border p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-accent">Next client</p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-text">{nextBooking.client.fullName}</p>
                <p className="text-sm text-text-muted">{nextBooking.service.name} · {nextBooking.confirmedStart?.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</p>
                {nextBooking.address && <p className="text-sm text-text-muted">{nextBooking.address.suburb}, {nextBooking.address.state}</p>}
                {nextBooking.driverJobs[0] && (
                  <p className="text-sm text-text-muted">Driver: {nextBooking.driverJobs[0].driver?.user.name ?? "Not yet assigned"}</p>
                )}
              </div>
              <StatusPill status={nextBooking.status} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {NEXT_CHECK_IN[nextBooking.status] && (
                <form action={checkInAction.bind(null, nextBooking.id, NEXT_CHECK_IN[nextBooking.status]!.action)}>
                  <button className="btn-primary text-sm">
                    {NEXT_CHECK_IN[nextBooking.status]!.label}
                  </button>
                </form>
              )}
              <form action={emergencyEscalationAction.bind(null, nextBooking.id)}>
                <button className="rounded-lg border-2 border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-text hover:border-accent">
                  ⚠ Emergency / safety escalation
                </button>
              </form>
            </div>
          </div>
        )}

        <section id="schedule" className="scroll-mt-8">
          <Panel title={`Today's schedule (${todaysSchedule.length})`}>
            {todaysSchedule.length === 0 && <Empty text="Nothing scheduled today." />}
            {todaysSchedule.map((b) => (
              <Row key={b.id}>
                <div>
                  <p className="font-medium text-text">{b.client.fullName} · {b.service.name}</p>
                  <p className="text-xs text-text-muted">{b.confirmedStart?.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <StatusPill status={b.status} />
              </Row>
            ))}
          </Panel>
        </section>

        <section id="safety" className="scroll-mt-8">
          <Panel title={`Outstanding safety surveys (${outstandingSurveys.length})`} alert={outstandingSurveys.length > 0}>
            {outstandingSurveys.length === 0 && <Empty text="You're all caught up." />}
            {outstandingSurveys.map((b) => (
              <SurveyForm key={b.id} bookingId={b.id} clientName={b.client.fullName} />
            ))}
          </Panel>
        </section>

        <section id="messages" className="scroll-mt-8">
          <Panel title={`Messages requiring your personal reply (${conversationsNeedingReply.length})`}>
            {conversationsNeedingReply.length === 0 && <Empty text="No conversations need you right now — the assistant has it covered." />}
            {conversationsNeedingReply.map((c) => (
              <Row key={c.id}>
                <div>
                  <p className="font-medium text-text">{c.client.fullName}</p>
                  <p className="text-xs text-text-muted">{c.escalationReason?.replaceAll("_", " ")}</p>
                </div>
              </Row>
            ))}
          </Panel>
        </section>
    </DashboardShell>
  );
}

function SurveyForm({ bookingId, clientName }: { bookingId: string; clientName: string }) {
  return (
    <form action={submitSafetySurveyAction} className="space-y-3 px-4 py-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="font-medium text-text">Private safety survey — {clientName}</p>
      <p className="text-xs text-text-muted">This survey is private and is never shown to the client.</p>

      <SurveyQuestion name="q1" label="Did you feel safe and comfortable throughout this appointment?" options={[
        ["YES_COMPLETELY", "Yes, completely"], ["MOSTLY", "Mostly"], ["SLIGHTLY_UNCOMFORTABLE", "I felt slightly uncomfortable"], ["FELT_UNSAFE", "No, I felt unsafe"],
      ]} />
      <SurveyQuestion name="q2" label="Did the client respect your professional boundaries and instructions?" options={[
        ["YES_COMPLETELY", "Yes, completely"], ["MOSTLY", "Mostly"], ["MINOR_CONCERNS", "There were minor concerns"], ["INAPPROPRIATE_BEHAVIOUR", "No, there was inappropriate behaviour"],
      ]} />
      <SurveyQuestion name="q3" label="Were the client, location and circumstances consistent with the booking information?" options={[
        ["ACCURATE", "Yes, everything was accurate"], ["MOSTLY_ACCURATE", "Mostly accurate"], ["SOME_DETAILS_DIFFERENT", "Some important details were different"], ["MISLEADING", "No, the booking information was misleading"],
      ]} />
      <SurveyQuestion name="q4" label="Were there any safety, access, payment or behavioural issues?" options={[
        ["NO_ISSUES", "No issues"], ["MINOR_ISSUE", "Minor issue"], ["SIGNIFICANT_ISSUE", "Significant issue — review future bookings"], ["SERIOUS_INCIDENT", "Serious incident — do not book again"],
      ]} />
      <SurveyQuestion name="q5" label="Would you accept another appointment from this client?" options={[
        ["YES", "Yes"], ["YES_WITH_CONDITIONS", "Yes, with conditions"], ["MANUAL_APPROVAL_REQUIRED", "Manual approval required"], ["NO_DO_NOT_ACCEPT", "No, do not accept future bookings"],
      ]} />

      <div>
        <label className="text-xs font-medium text-text-muted">Private notes (optional)</label>
        <textarea name="privateNotes" rows={2} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" />
      </div>

      <button className="btn-primary text-sm">Submit private survey</button>
    </form>
  );
}

function SurveyQuestion({ name, label, options }: { name: string; label: string; options: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <div className="mt-1 flex flex-col gap-1">
        {options.map(([value, text]) => (
          <label key={value} className="flex items-center gap-2 text-sm text-text">
            <input type="radio" name={name} value={value} required />
            {text}
          </label>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`card p-4 ${alert ? "ring-1 ring-border" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
    </div>
  );
}

function Panel({ title, alert, children }: { title: string; alert?: boolean; children: React.ReactNode }) {
  return (
    <div className={`card ${alert ? "ring-1 ring-border" : ""}`}>
      <div className="border-b border-border-muted px-4 py-3">
        <h2 className="text-sm font-semibold text-text">{alert ? `⚠ ${title}` : title}</h2>
      </div>
      <div className="divide-y divide-border-muted">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 px-4 py-3">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-4 text-sm text-text-muted">{text}</p>;
}
