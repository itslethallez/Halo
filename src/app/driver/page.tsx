import { prisma } from "@/lib/prisma";
import { getCurrentAuthzUser } from "@/lib/auth/currentUser";
import { formatCents } from "@/lib/currency";
import { DashboardHeader } from "@/components/DashboardHeader";
import { toDriverJobView } from "@/services/driverService";
import { advanceTripStatusAction, respondToOfferAction } from "./actions";
import type { DriverJobStatus } from "@prisma/client";

const NEXT_STATUS: Partial<Record<DriverJobStatus, { label: string; next: DriverJobStatus }>> = {
  ACCEPTED: { label: "Start driving to worker", next: "EN_ROUTE_TO_WORKER" },
  EN_ROUTE_TO_WORKER: { label: "Confirm worker collected", next: "WORKER_COLLECTED" },
  WORKER_COLLECTED: { label: "Confirm arrived at destination", next: "ARRIVED_AT_DESTINATION" },
  ARRIVED_AT_DESTINATION: { label: "Complete job", next: "COMPLETED" },
  WAITING: { label: "Start return trip", next: "RETURN_TRIP_STARTED" },
  RETURN_TRIP_STARTED: { label: "Confirm worker returned", next: "WORKER_RETURNED" },
  WORKER_RETURNED: { label: "Complete job", next: "COMPLETED" },
};

export default async function DriverDashboardPage() {
  const authzUser = await getCurrentAuthzUser();
  if (!authzUser) return null;

  const driver = await prisma.driver.findUniqueOrThrow({ where: { userId: authzUser.id } });
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [todaysJobs, offeredJobs, completedThisWeek] = await Promise.all([
    prisma.driverJob.findMany({
      where: { driverId: driver.id, scheduledStart: { gte: startOfDay, lte: endOfDay }, status: { notIn: ["CANCELLED"] } },
      orderBy: { scheduledStart: "asc" },
    }),
    prisma.driverJob.findMany({ where: { driverId: driver.id, status: "OFFERED" } }),
    prisma.driverJob.findMany({ where: { driverId: driver.id, status: "COMPLETED", updatedAt: { gte: weekAgo } } }),
  ]);

  const weeklyEarningsCents = completedThisWeek.reduce((sum, j) => sum + j.driverPaymentCents, 0);
  const nextJob = todaysJobs.find((j) => !["COMPLETED", "CANCELLED", "DECLINED"].includes(j.status));

  return (
    <div className="min-h-screen bg-sand-50">
      <DashboardHeader title="Driver dashboard" subtitle="Your transport jobs for today" />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Weekly earnings" value={formatCents(weeklyEarningsCents)} />
          <StatCard label="Completed this week" value={String(completedThisWeek.length)} />
          <StatCard label="New offers" value={String(offeredJobs.length)} alert={offeredJobs.length > 0} />
        </section>

        {nextJob && (
          <div className="card border-brand-200 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Next pickup</p>
            <JobCard job={toDriverJobView(nextJob)} />
          </div>
        )}

        <Panel title={`Available offers (${offeredJobs.length})`} alert={offeredJobs.length > 0}>
          {offeredJobs.length === 0 && <Empty text="No new job offers." />}
          {offeredJobs.map((job) => (
            <div key={job.id} className="px-4 py-4">
              <JobCard job={toDriverJobView(job)} />
              <div className="mt-3 flex gap-2">
                <form action={respondToOfferAction.bind(null, job.id, true)}>
                  <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">Accept</button>
                </form>
                <form action={respondToOfferAction.bind(null, job.id, false)}>
                  <button className="rounded-lg border border-black/10 px-4 py-2 text-sm text-ink-700 hover:bg-sand-100">Decline</button>
                </form>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title={`Today's transport jobs (${todaysJobs.length})`}>
          {todaysJobs.length === 0 && <Empty text="No jobs scheduled today." />}
          {todaysJobs.map((job) => (
            <div key={job.id} className="px-4 py-4">
              <JobCard job={toDriverJobView(job)} />
              {NEXT_STATUS[job.status] && (
                <form action={advanceTripStatusAction.bind(null, job.id, NEXT_STATUS[job.status]!.next)} className="mt-3">
                  <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
                    {NEXT_STATUS[job.status]!.label}
                  </button>
                </form>
              )}
            </div>
          ))}
        </Panel>
      </main>
    </div>
  );
}

function JobCard({ job }: { job: ReturnType<typeof toDriverJobView> }) {
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.destinationAddress)}`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-medium text-ink-900">{job.pickupAddress} → {job.destinationAddress}</p>
        <p className="text-xs text-ink-600">
          {job.scheduledStart.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })} · ~{job.estimatedTravelMinutes} min
          {job.returnTripRequired ? " · return trip required" : ""}
        </p>
        {job.specialInstructions && <p className="mt-1 text-xs text-ink-500">Note: {job.specialInstructions}</p>}
        <p className="mt-1 text-sm font-medium text-brand-700">{formatCents(job.driverPaymentCents)}</p>
      </div>
      <a href={mapsUrl} target="_blank" rel="noreferrer" className="whitespace-nowrap rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-sand-100">
        Navigate
      </a>
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`card p-4 ${alert ? "ring-1 ring-alert-500/40" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function Panel({ title, alert, children }: { title: string; alert?: boolean; children: React.ReactNode }) {
  return (
    <div className={`card ${alert ? "ring-1 ring-alert-500/40" : ""}`}>
      <div className="border-b border-black/5 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      </div>
      <div className="divide-y divide-black/5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-4 text-sm text-ink-500">{text}</p>;
}
