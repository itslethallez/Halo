import { prisma } from "@/lib/prisma";
import { BookingFlow } from "./BookingFlow";

export default async function BookPage() {
  const workers = await prisma.worker.findMany({
    where: { active: true },
    include: { workerServices: { include: { service: true } } },
  });

  const data = workers.map((w) => ({
    id: w.id,
    displayName: w.displayName,
    bio: w.bio,
    services: w.workerServices
      .filter((ws) => ws.active)
      .map((ws) => ({
        id: ws.service.id,
        name: ws.service.name,
        durationMinutes: ws.durationMinutesOverride ?? ws.service.baseDurationMinutes,
        priceCents: ws.priceCentsOverride ?? ws.service.basePriceCents,
      })),
  }));

  return (
    <main className="min-h-screen bg-sand-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-700">Book an appointment</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">Serenity Mobile Massage</h1>
        <p className="mt-2 text-sm text-ink-600">
          Choose a therapist and service below. Availability shown is checked live against real
          working hours, travel time and existing bookings — nothing offered here can double-book.
        </p>
        <BookingFlow workers={data} />
      </div>
    </main>
  );
}
