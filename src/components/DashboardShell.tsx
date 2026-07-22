import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import type { Role } from "@prisma/client";

export function DashboardShell({
  role,
  title,
  subtitle,
  children,
}: {
  role: Role;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-bg lg:flex-row">
      <Sidebar role={role} />
      <div className="min-w-0 flex-1">
        <MobileNav role={role} />
        <header className="border-b border-border-muted bg-surface px-4 py-5 sm:px-8 sm:py-6">
          <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </header>
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
