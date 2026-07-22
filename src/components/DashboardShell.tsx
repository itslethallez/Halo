import { Sidebar } from "./Sidebar";
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
    <div className="flex min-h-screen bg-bg">
      <Sidebar role={role} />
      <div className="flex-1">
        <header className="border-b border-border-muted bg-surface px-8 py-6">
          <h1 className="font-display text-2xl font-semibold text-text">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </header>
        <main className="mx-auto max-w-6xl space-y-8 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
