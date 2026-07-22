import Link from "next/link";
import { Home, CalendarClock, ShieldCheck, Car, LineChart, MessageSquare } from "lucide-react";
import { HaloLogo } from "./HaloLogo";
import { logoutAction } from "@/app/(auth)/login/actions";
import type { Role } from "@prisma/client";

const NAV_ITEMS: Record<Role, { label: string; href: string; icon: typeof Home }[]> = {
  ADMIN: [
    { label: "Overview", href: "/admin", icon: Home },
    { label: "Bookings", href: "/admin#bookings", icon: CalendarClock },
    { label: "Safety", href: "/admin#safety", icon: ShieldCheck },
    { label: "Drivers", href: "/admin#drivers", icon: Car },
    { label: "Reports", href: "/admin#reports", icon: LineChart },
  ],
  WORKER: [
    { label: "Overview", href: "/worker", icon: Home },
    { label: "Schedule", href: "/worker#schedule", icon: CalendarClock },
    { label: "Safety", href: "/worker#safety", icon: ShieldCheck },
    { label: "Messages", href: "/worker#messages", icon: MessageSquare },
  ],
  DRIVER: [
    { label: "Overview", href: "/driver", icon: Home },
    { label: "Jobs", href: "/driver#jobs", icon: Car },
  ],
  CLIENT: [
    { label: "Overview", href: "/client", icon: Home },
    { label: "Bookings", href: "/client#bookings", icon: CalendarClock },
  ],
};

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-border-muted bg-surface px-4 py-6">
      <div>
        <Link href="/" className="flex items-center gap-2 px-2">
          <HaloLogo size={28} />
          <span className="font-display text-lg tracking-[0.15em] text-text">HALO</span>
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS[role].map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <form action={logoutAction}>
        <button type="submit" className="btn-secondary w-full text-sm">
          Sign out
        </button>
      </form>
    </aside>
  );
}
