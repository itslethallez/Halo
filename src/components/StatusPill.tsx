const STATUS_STYLES: Record<string, string> = {
  NEW_ENQUIRY: "bg-sand-200 text-ink-700",
  AVAILABILITY_OFFERED: "bg-sand-200 text-ink-700",
  AWAITING_CLIENT_RESPONSE: "bg-sand-200 text-ink-700",
  AWAITING_DEPOSIT: "bg-amber-100 text-amber-800",
  AWAITING_WORKER_APPROVAL: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-brand-100 text-brand-800",
  DRIVER_REQUIRED: "bg-amber-100 text-amber-800",
  DRIVER_ASSIGNED: "bg-brand-100 text-brand-800",
  WORKER_EN_ROUTE: "bg-blue-100 text-blue-800",
  WORKER_ARRIVED: "bg-blue-100 text-blue-800",
  SERVICE_IN_PROGRESS: "bg-blue-100 text-blue-800",
  SERVICE_COMPLETED: "bg-brand-100 text-brand-800",
  AWAITING_WORKER_SURVEY: "bg-amber-100 text-amber-800",
  AWAITING_CLIENT_SURVEY: "bg-amber-100 text-amber-800",
  FULLY_COMPLETED: "bg-brand-200 text-brand-900",
  CANCELLED: "bg-ink-100 text-ink-600",
  NO_SHOW: "bg-ink-100 text-ink-600",
  SAFETY_REVIEW: "bg-alert-500/10 text-alert-600",
  BLOCKED: "bg-alert-500/10 text-alert-600",
};

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-sand-200 text-ink-700";
  return <span className={`status-pill ${style}`}>{status.replaceAll("_", " ")}</span>;
}
