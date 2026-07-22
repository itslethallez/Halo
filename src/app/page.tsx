import Link from "next/link";
import { ShieldCheck, CalendarClock, Car, LineChart } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-sand-50">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-700">Halo</p>
        <h1 className="mt-3 text-4xl font-semibold text-ink-900 sm:text-5xl">
          Booking, safety and business management for mobile massage.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-700">
          A calm, discreet platform that handles enquiries, scheduling, driver dispatch, private
          safety check-ins and business reporting — so you can focus on your clients.
        </p>

        <div className="mt-8 flex gap-3">
          <Link href="/login" className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-800">
            Sign in
          </Link>
          <Link href="/book" className="rounded-lg border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-ink-800 hover:bg-sand-100">
            Book an appointment
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Feature icon={<CalendarClock className="h-5 w-5" />} title="Never double-booked" text="Real availability, travel time and setup/pack-down are checked before any slot is offered." />
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Built-in worker safety" text="Check-ins, an emergency button and a private post-service survey after every job." />
          <Feature icon={<Car className="h-5 w-5" />} title="Smart driver dispatch" text="Drivers are matched by availability, area, rating and cost — assign manually any time." />
          <Feature icon={<LineChart className="h-5 w-5" />} title="Clear business numbers" text="Revenue, worker and driver earnings, and profit — reported honestly, exportable to CSV." />
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-brand-700">
        {icon}
        <h3 className="font-medium text-ink-900">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-ink-600">{text}</p>
    </div>
  );
}
