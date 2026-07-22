import { logoutAction } from "@/app/(auth)/login/actions";

export function DashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Halo</p>
        <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-600">{subtitle}</p>}
      </div>
      <form action={logoutAction}>
        <button type="submit" className="rounded-lg border border-black/10 px-3 py-1.5 text-sm text-ink-700 hover:bg-sand-100">
          Sign out
        </button>
      </form>
    </header>
  );
}
