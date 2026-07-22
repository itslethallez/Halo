import { Home, CalendarClock, ShieldCheck, Car, LineChart, MessageSquare } from "lucide-react";
import type { Role } from "@prisma/client";

// `color` is a Tailwind class suffix (text-{color}, bg-{color}/NN) used to give each
// nav destination its own wayfinding hue — decorative/identity only, distinct from
// --accent (gold, primary actions) and --status-safe (teal, safe/active status).
export type NavColor = "accent" | "hue-bookings" | "hue-safety" | "hue-drivers" | "hue-reports" | "hue-messages";

// Tailwind's content scanner needs literal class strings somewhere in source — building
// them with template interpolation (`text-${color}`) would not get picked up. This lookup
// keeps every combination as a literal so it's always in the generated CSS.
export const NAV_COLOR_CLASSES: Record<NavColor, { text: string; bg: string; border: string; solid: string }> = {
  accent: { text: "text-accent", bg: "bg-accent/15", border: "border-accent", solid: "bg-accent" },
  "hue-bookings": { text: "text-hue-bookings", bg: "bg-hue-bookings/15", border: "border-hue-bookings", solid: "bg-hue-bookings" },
  "hue-safety": { text: "text-hue-safety", bg: "bg-hue-safety/15", border: "border-hue-safety", solid: "bg-hue-safety" },
  "hue-drivers": { text: "text-hue-drivers", bg: "bg-hue-drivers/15", border: "border-hue-drivers", solid: "bg-hue-drivers" },
  "hue-reports": { text: "text-hue-reports", bg: "bg-hue-reports/15", border: "border-hue-reports", solid: "bg-hue-reports" },
  "hue-messages": { text: "text-hue-messages", bg: "bg-hue-messages/15", border: "border-hue-messages", solid: "bg-hue-messages" },
};

export const NAV_ITEMS: Record<Role, { label: string; href: string; icon: typeof Home; color: NavColor }[]> = {
  ADMIN: [
    { label: "Overview", href: "/admin", icon: Home, color: "accent" },
    { label: "Bookings", href: "/admin#bookings", icon: CalendarClock, color: "hue-bookings" },
    { label: "Safety", href: "/admin#safety", icon: ShieldCheck, color: "hue-safety" },
    { label: "Drivers", href: "/admin#drivers", icon: Car, color: "hue-drivers" },
    { label: "Reports", href: "/admin#reports", icon: LineChart, color: "hue-reports" },
  ],
  WORKER: [
    { label: "Overview", href: "/worker", icon: Home, color: "accent" },
    { label: "Schedule", href: "/worker#schedule", icon: CalendarClock, color: "hue-bookings" },
    { label: "Safety", href: "/worker#safety", icon: ShieldCheck, color: "hue-safety" },
    { label: "Messages", href: "/worker#messages", icon: MessageSquare, color: "hue-messages" },
  ],
  DRIVER: [
    { label: "Overview", href: "/driver", icon: Home, color: "accent" },
    { label: "Jobs", href: "/driver#jobs", icon: Car, color: "hue-drivers" },
  ],
  CLIENT: [
    { label: "Overview", href: "/client", icon: Home, color: "accent" },
    { label: "Bookings", href: "/client#bookings", icon: CalendarClock, color: "hue-bookings" },
  ],
};
