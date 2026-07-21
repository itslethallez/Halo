import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthzUser } from "@/lib/auth/currentUser";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatusPill } from "@/components/StatusPill";
import { ACTIVE_BOOKING_STATUSES } from "@/domain/booking/statusMachine";
import { submitSatisfactionSurveyAction } from "./actions";

export default async function ClientDashboardPage() {
  const authzUser = await getCurrentAuthzUser();
  if (!authzUser) return null;

  const client = await prisma.client.findUniqueOrThrow({ where: { userId: authzUser.id } });

  const [upcoming, awaitingSurvey, past] = await Promise.all([
    prisma.booking.findMany({
      where: { clientId: client.id, status: { in: ACTIVE_BOOKING_STATUSES } },
      include: { worker: true, service: true },
      orderBy: { confirmedStart: "asc" },
    }),
    prisma.booking.findMany({
      where: { clientId: client.id, clientSurveyDone: false, status: { in: ["SERVICE_COMPLETED", "AWAITING_CLIENT_SURVEY"] } },
      include: { worker: true, service: true },
    }),
    prisma.booking.findMany({
      where: { clientId: client.id, status: { in: ["FULLY_COMPLETED", "CANCELLED", "NO_SHOW"] } },
      include: { worker: true, service: true },
      orderBy: { confirmedStart: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="min-h-screen bg-sand-50">
      <DashboardHeader title={`Welcome back, ${client.fullName.split(" ")[0]}`} subtitle="Your appointments" />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
        <div>
          <Link href="/book" className="inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
            Request a new appointment
          </Link>
        </div>

        <Panel title={`Upcoming appointments (${upcoming.length})`}>
          {upcoming.length === 0 && <Empty text="You have no upcoming appointments." />}
          {upcoming.map((b) => (
            <Row key={b.id}>
              <div>
                <p className="font-medium text-ink-900">{b.service.name} with {b.worker.displayName}</p>
                <p className="text-xs text-ink-600">{b.confirmedStart?.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) ?? "Awaiting confirmation"}</p>
              </div>
              <StatusPill status={b.status} />
            </Row>
          ))}
        </Panel>

        {awaitingSurvey.length > 0 && (
          <Panel title="How was your appointment?" alert>
            {awaitingSurvey.map((b) => (
              <SurveyForm key={b.id} bookingId={b.id} workerName={b.worker.displayName} />
            ))}
          </Panel>
        )}

        <Panel title="Previous appointments">
          {past.length === 0 && <Empty text="No previous appointments yet." />}
          {past.map((b) => (
            <Row key={b.id}>
              <div>
                <p className="font-medium text-ink-900">{b.service.name} with {b.worker.displayName}</p>
                <p className="text-xs text-ink-600">{b.confirmedStart?.toLocaleDateString("en-AU") ?? ""}</p>
              </div>
              <StatusPill status={b.status} />
            </Row>
          ))}
        </Panel>
      </main>
    </div>
  );
}

function SurveyForm({ bookingId, workerName }: { bookingId: string; workerName: string }) {
  return (
    <form action={submitSatisfactionSurveyAction} className="space-y-3 px-4 py-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-sm text-ink-600">
        Thank you for your booking with {workerName}. Your feedback helps us provide a better, safer and more reliable service.
      </p>

      <SurveyQuestion name="q1" label="How satisfied were you with the overall service?" options={[
        ["VERY_SATISFIED", "Very satisfied"], ["SATISFIED", "Satisfied"], ["NEUTRAL", "Neutral"], ["DISSATISFIED", "Dissatisfied"], ["VERY_DISSATISFIED", "Very dissatisfied"],
      ]} />
      <SurveyQuestion name="q2" label="Did the massage worker arrive within the expected window?" options={[
        ["ON_TIME", "Yes"], ["SLIGHTLY_OFF", "Slightly early or late"], ["SIGNIFICANTLY_OFF", "Significantly early or late"], ["DID_NOT_PROCEED", "The appointment did not proceed"],
      ]} />
      <SurveyQuestion name="q3" label="Did the massage worker communicate clearly and behave professionally?" options={[
        ["YES_COMPLETELY", "Yes, completely"], ["MOSTLY", "Mostly"], ["NEEDS_IMPROVEMENT", "Some improvement is needed"], ["NO", "No"],
      ]} />
      <SurveyQuestion name="q4" label="Did the service match what you booked and expected?" options={[
        ["YES_COMPLETELY", "Yes, completely"], ["MOSTLY", "Mostly"], ["NOT_ENTIRELY", "Not entirely"], ["NO", "No"],
      ]} />
      <SurveyQuestion name="q5" label="Would you book this service again or recommend it?" options={[
        ["DEFINITELY", "Definitely"], ["PROBABLY", "Probably"], ["UNSURE", "Unsure"], ["PROBABLY_NOT", "Probably not"], ["DEFINITELY_NOT", "Definitely not"],
      ]} />

      <div>
        <label className="text-xs font-medium text-ink-700">Comments (optional)</label>
        <textarea name="comments" rows={2} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="contactMeBack" /> Would you like us to contact you regarding your feedback?
      </label>

      <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">Submit feedback</button>
    </form>
  );
}

function SurveyQuestion({ name, label, options }: { name: string; label: string; options: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-700">{label}</p>
      <div className="mt-1 flex flex-col gap-1">
        {options.map(([value, text]) => (
          <label key={value} className="flex items-center gap-2 text-sm text-ink-700">
            <input type="radio" name={name} value={value} required />
            {text}
          </label>
        ))}
      </div>
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

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 px-4 py-3">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-4 text-sm text-ink-500">{text}</p>;
}
