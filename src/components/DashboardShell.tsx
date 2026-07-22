import Link from "next/link";
import { HaloLogo } from "./HaloLogo";
import { BottomNav } from "./BottomNav";
import { logoutAction } from "@/app/(auth)/login/actions";
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
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border-muted bg-surface px-4 pb-3 pt-[calc(env(safe-area-inset-top)_+_0.75rem)] sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <HaloLogo size={24} />
          <span className="font-display text-base tracking-[0.15em] text-text">HALO</span>
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="btn-secondary py-1.5 text-sm">
            Sign out
          </button>
        </form>
      </div>

      <header className="border-b border-border-muted bg-surface px-4 py-5 sm:px-8 sm:py-6">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 pb-28 sm:px-8 sm:py-8 sm:pb-28">{children}</main>

      <BottomNav role={role} />
    </div>
  );
}
