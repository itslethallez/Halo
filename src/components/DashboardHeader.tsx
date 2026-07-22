import { logoutAction } from "@/app/(auth)/login/actions";

export function DashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-border-muted bg-surface px-6 py-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Halo</p>
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
      </div>
      <form action={logoutAction}>
        <button type="submit" className="btn-secondary py-1.5 text-sm">
          Sign out
        </button>
      </form>
    </header>
  );
}
