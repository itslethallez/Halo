import Link from "next/link";
import { ShieldCheck, CalendarClock, Car, LineChart } from "lucide-react";
import { HaloLogo } from "@/components/HaloLogo";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <HaloLogo variant="full" size={340} tagline />
        <h1 className="mt-10 text-4xl font-semibold text-text sm:text-5xl">
          Booking, safety and business management for mobile massage.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-text-muted">
          A calm, discreet platform that handles enquiries, scheduling, driver dispatch, private
          safety check-ins and business reporting — so you can focus on your clients.
        </p>

        <div className="mt-8 flex gap-3">
          <Link href="/login" className="btn-primary text-sm">
            Sign in
          </Link>
          <Link href="/book" className="btn-secondary text-sm">
            Book an appointment
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Feature icon={<CalendarClock className="h-5 w-5" />} color="hue-bookings" title="Never double-booked" text="Real availability, travel time and setup/pack-down are checked before any slot is offered." />
          <Feature icon={<ShieldCheck className="h-5 w-5" />} color="hue-safety" title="Built-in worker safety" text="Check-ins, an emergency button and a private post-service survey after every job." />
          <Feature icon={<Car className="h-5 w-5" />} color="hue-drivers" title="Smart driver dispatch" text="Drivers are matched by availability, area, rating and cost — assign manually any time." />
          <Feature icon={<LineChart className="h-5 w-5" />} color="hue-reports" title="Clear business numbers" text="Revenue, worker and driver earnings, and profit — reported honestly, exportable to CSV." />
        </div>
      </div>
    </main>
  );
}

const FEATURE_COLOR_CLASSES = {
  "hue-bookings": { text: "text-hue-bookings", bg: "bg-hue-bookings/15" },
  "hue-safety": { text: "text-hue-safety", bg: "bg-hue-safety/15" },
  "hue-drivers": { text: "text-hue-drivers", bg: "bg-hue-drivers/15" },
  "hue-reports": { text: "text-hue-reports", bg: "bg-hue-reports/15" },
} as const;

function Feature({
  icon,
  color,
  title,
  text,
}: {
  icon: React.ReactNode;
  color: keyof typeof FEATURE_COLOR_CLASSES;
  title: string;
  text: string;
}) {
  const classes = FEATURE_COLOR_CLASSES[color];
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${classes.bg} ${classes.text}`}>{icon}</span>
        <h3 className="font-medium text-text">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-text-muted">{text}</p>
    </div>
  );
}
