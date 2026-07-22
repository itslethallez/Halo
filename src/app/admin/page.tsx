import { prisma } from "@/lib/prisma";
import { getCurrentAuthzUser } from "@/lib/auth/currentUser";
import { getBusinessFinancialReport } from "@/services/reportingService";
import { formatCents } from "@/lib/currency";
import { DashboardShell } from "@/components/DashboardShell";
import { StatusPill } from "@/components/StatusPill";

export default async function AdminDashboardPage() {
  const authzUser = await getCurrentAuthzUser();
  if (!authzUser) return null;

  const businessId = authzUser.businessId;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [todaysBookings, upcomingBookings, unassignedJobs, awaitingApproval, safetyReviews, missedCheckIns, unpaidBookings, workers, drivers, recentIncidents] =
    await Promise.all([
      prisma.booking.findMany({
        where: { businessId, confirmedStart: { gte: startOfDay, lte: endOfDay } },
        include: { client: true, worker: true, service: true },
        orderBy: { confirmedStart: "asc" },
      }),
      prisma.booking.findMany({
        where: { businessId, confirmedStart: { gt: endOfDay }, status: { notIn: ["CANCELLED", "NO_SHOW", "FULLY_COMPLETED", "BLOCKED"] } },
        include: { client: true, worker: true, service: true },
        orderBy: { confirmedStart: "asc" },
        take: 10,
      }),
      prisma.driverJob.findMany({ where: { businessId, status: "UNASSIGNED" }, include: { worker: true, booking: true } }),
      prisma.booking.findMany({ where: { businessId, status: "AWAITING_WORKER_APPROVAL" }, include: { client: true, worker: true } }),
      prisma.safetyIncident.findMany({ where: { businessId, resolved: false }, include: { client: true, worker: true }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.booking.findMany({
        where: { businessId, status: { in: ["WORKER_EN_ROUTE", "WORKER_ARRIVED", "SERVICE_IN_PROGRESS"] }, updatedAt: { lte: new Date(Date.now() - 60 * 60 * 1000) } },
        include: { worker: true, client: true },
      }),
      prisma.booking.findMany({ where: { businessId, status: "FULLY_COMPLETED" }, include: { payments: true, service: true, client: true }, take: 50 }),
      prisma.worker.findMany({ where: { businessId }, select: { id: true, displayName: true, active: true } }),
      prisma.driver.findMany({ where: { businessId }, select: { id: true, active: true, user: { select: { name: true } } } }),
      prisma.safetyIncident.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 5, include: { client: true } }),
    ]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [dailyReport, monthlyReport] = await Promise.all([
    getBusinessFinancialReport(authzUser, { from: startOfDay, to: endOfDay }),
    getBusinessFinancialReport(authzUser, { from: monthStart, to: endOfDay }),
  ]);

  const unpaidWithBalance = unpaidBookings
    .map((b) => {
      const paid = b.payments.filter((p) => p.status === "SUCCEEDED").reduce((sum, p) => sum + p.amountCents, 0);
      const owed = b.service.basePriceCents - paid;
      return { ...b, owed };
    })
    .filter((b) => b.owed > 0);

  return (
    <DashboardShell role="ADMIN" title="Admin dashboard" subtitle="Full business overview">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Today's revenue" value={formatCents(dailyReport.grossRevenueCents)} />
        <StatCard label="Today's profit" value={formatCents(dailyReport.netProfitCents)} />
        <StatCard label="This month's revenue" value={formatCents(monthlyReport.grossRevenueCents)} />
        <StatCard label="This month's profit" value={formatCents(monthlyReport.netProfitCents)} />
      </section>

      <section id="bookings" className="scroll-mt-8 space-y-4">
        <SectionHeading title="Bookings" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title={`Today's bookings (${todaysBookings.length})`}>
            {todaysBookings.length === 0 && <Empty text="No bookings scheduled for today." />}
            {todaysBookings.map((b) => (
              <Row key={b.id}>
                <div>
                  <p className="font-medium text-text">{b.client.fullName} · {b.service.name}</p>
                  <p className="text-xs text-text-muted">{b.worker.displayName} · {b.confirmedStart?.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <StatusPill status={b.status} />
              </Row>
            ))}
          </Panel>

          <Panel title={`Upcoming bookings (${upcomingBookings.length})`}>
            {upcomingBookings.length === 0 && <Empty text="Nothing else on the horizon yet." />}
            {upcomingBookings.map((b) => (
              <Row key={b.id}>
                <div>
                  <p className="font-medium text-text">{b.client.fullName} · {b.service.name}</p>
                  <p className="text-xs text-text-muted">{b.worker.displayName} · {b.confirmedStart?.toLocaleDateString("en-AU")}</p>
                </div>
                <StatusPill status={b.status} />
              </Row>
            ))}
          </Panel>

          <Panel title={`Bookings awaiting approval (${awaitingApproval.length})`}>
            {awaitingApproval.length === 0 && <Empty text="Nothing waiting on you." />}
            {awaitingApproval.map((b) => (
              <Row key={b.id}>
                <div>
                  <p className="font-medium text-text">{b.client.fullName}</p>
                  <p className="text-xs text-text-muted">{b.worker.displayName} · requested {b.requestedStart?.toLocaleString("en-AU")}</p>
                </div>
              </Row>
            ))}
          </Panel>

          <Panel title={`Unassigned driver jobs (${unassignedJobs.length})`}>
            {unassignedJobs.length === 0 && <Empty text="No transport jobs waiting for a driver." />}
            {unassignedJobs.map((j) => (
              <Row key={j.id}>
                <div>
                  <p className="font-medium text-text">{j.worker.displayName}</p>
                  <p className="text-xs text-text-muted">{j.pickupAddress} → {j.destinationAddress}</p>
                </div>
              </Row>
            ))}
          </Panel>
        </div>
      </section>

      <section id="safety" className="scroll-mt-8 space-y-4">
        <SectionHeading title="Safety" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title={`Safety reviews (${safetyReviews.length})`} alert={safetyReviews.length > 0}>
            {safetyReviews.length === 0 && <Empty text="No open safety reviews." />}
            {safetyReviews.map((incident) => (
              <Row key={incident.id}>
                <div>
                  <p className="font-medium text-text">{incident.client?.fullName ?? "Unknown client"}</p>
                  <p className="text-xs text-text-muted">{incident.description}</p>
                </div>
                <span className="status-pill border border-border bg-surface-raised font-semibold text-text">{incident.severity}</span>
              </Row>
            ))}
          </Panel>

          <Panel title={`Missed safety check-ins (${missedCheckIns.length})`} alert={missedCheckIns.length > 0}>
            {missedCheckIns.length === 0 && <Empty text="No overdue check-ins." />}
            {missedCheckIns.map((b) => (
              <Row key={b.id}>
                <div>
                  <p className="font-medium text-text">{b.worker.displayName}</p>
                  <p className="text-xs text-text-muted">Stuck at {b.status.replaceAll("_", " ")} since {b.updatedAt.toLocaleTimeString("en-AU")}</p>
                </div>
              </Row>
            ))}
          </Panel>

          <Panel title="Recent incidents">
            {recentIncidents.length === 0 && <Empty text="No incidents on file." />}
            {recentIncidents.map((incident) => (
              <Row key={incident.id}>
                <div>
                  <p className="font-medium text-text">{incident.client?.fullName ?? "Unknown"}</p>
                  <p className="text-xs text-text-muted">{incident.description}</p>
                </div>
                <span className="text-xs text-text-muted">{incident.createdAt.toLocaleDateString("en-AU")}</span>
              </Row>
            ))}
          </Panel>
        </div>
      </section>

      <section id="drivers" className="scroll-mt-8 space-y-4">
        <SectionHeading title="Drivers" />
        <Panel title="Worker & driver availability">
          <div className="grid grid-cols-2 gap-4 p-4 text-sm">
            <div>
              <p className="font-medium text-text">Workers</p>
              {workers.map((w) => (
                <p key={w.id} className="text-text-muted">{w.displayName} — {w.active ? "active" : "inactive"}</p>
              ))}
            </div>
            <div>
              <p className="font-medium text-text">Drivers</p>
              {drivers.map((d) => (
                <p key={d.id} className="text-text-muted">{d.user.name} — {d.active ? "active" : "inactive"}</p>
              ))}
            </div>
          </div>
        </Panel>
      </section>

      <section id="reports" className="scroll-mt-8 space-y-4">
        <SectionHeading title="Reports" />
        <Panel title={`Unpaid balances (${unpaidWithBalance.length})`}>
          {unpaidWithBalance.length === 0 && <Empty text="Everyone is paid up." />}
          {unpaidWithBalance.map((b) => (
            <Row key={b.id}>
              <div>
                <p className="font-medium text-text">{b.client.fullName}</p>
                <p className="text-xs text-text-muted">{b.service.name}</p>
              </div>
              <span className="text-sm font-semibold text-text">{formatCents(b.owed)}</span>
            </Row>
          ))}
        </Panel>
      </section>
    </DashboardShell>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="font-display text-xl font-semibold text-text">{title}</h2>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
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
