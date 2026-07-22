/**
 * Status tiers deliberately use only the two brand accents plus neutrals — teal is
 * reserved for genuinely "safe / on track" states (per the Halo theme), gold never
 * appears here (it's reserved for primary actions/links), and safety-critical states
 * are distinguished by weight/border/an explicit marker rather than inventing a new hue.
 */
const SAFE_STATUSES = new Set([
  "CONFIRMED",
  "DRIVER_ASSIGNED",
  "WORKER_EN_ROUTE",
  "WORKER_ARRIVED",
  "SERVICE_IN_PROGRESS",
  "SERVICE_COMPLETED",
  "FULLY_COMPLETED",
]);

const INACTIVE_STATUSES = new Set(["CANCELLED", "NO_SHOW"]);

const ATTENTION_STATUSES = new Set(["SAFETY_REVIEW", "BLOCKED"]);

export function StatusPill({ status }: { status: string }) {
  const label = status.replaceAll("_", " ");

  if (SAFE_STATUSES.has(status)) {
    return <span className="status-pill status-safe bg-status-safe/15">{label}</span>;
  }

  if (ATTENTION_STATUSES.has(status)) {
    return (
      <span className="status-pill border border-border bg-surface-raised font-semibold text-text">
        ⚠ {label}
      </span>
    );
  }

  if (INACTIVE_STATUSES.has(status)) {
    return <span className="status-pill bg-transparent text-text-muted/70">{label}</span>;
  }

  return <span className="status-pill bg-surface-raised text-text-muted">{label}</span>;
}
