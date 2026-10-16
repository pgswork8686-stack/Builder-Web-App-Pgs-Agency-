import type { Invoice } from "@/lib/api/finance";
import type { Project } from "@/lib/api/projects";

const OUTSTANDING_STATUSES: ReadonlyArray<Invoice["status"]> = [
  "issued",
  "partially_paid",
  "overdue",
];

/**
 * Outstanding balance = sum(amount - paid_amount) over invoices that have been
 * issued to the client and are not yet fully paid. Draft, paid and cancelled
 * invoices never count. Totals are kept per currency; they are never mixed.
 */
export function computeOutstandingByCurrency(
  invoices: ReadonlyArray<
    Pick<Invoice, "status" | "amount" | "paid_amount" | "currency_code">
  >,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const invoice of invoices) {
    if (!OUTSTANDING_STATUSES.includes(invoice.status)) continue;
    const remaining = Number(invoice.amount) - Number(invoice.paid_amount ?? 0);
    if (!Number.isFinite(remaining) || remaining <= 0) continue;
    totals[invoice.currency_code] =
      (totals[invoice.currency_code] ?? 0) + remaining;
  }
  return totals;
}

/** Completed projects out of all of the client's non-draft, non-archived projects. */
export function computeProjectCompletion(
  projects: ReadonlyArray<Pick<Project, "status">>,
): { completed: number; total: number } {
  const counted = projects.filter(
    (project) => project.status !== "draft" && project.status !== "archived",
  );
  return {
    completed: counted.filter((project) => project.status === "completed")
      .length,
    total: counted.length,
  };
}
