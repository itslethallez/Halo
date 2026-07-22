import { Home, CalendarClock, ShieldCheck, Car, LineChart, MessageSquare } from "lucide-react";
import type { Role } from "@prisma/client";

export const NAV_ITEMS: Record<Role, { label: string; href: string; icon: typeof Home }[]> = {
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
