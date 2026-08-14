import { describe, expect, it } from "vitest";
import {
  formatVietnamDateTime,
  getVietnamDateOnly,
  isInvoiceOverdue,
  vietnamLocalDateTimeToIso,
} from "./finance-date";

describe("Phase 6 Finance Vietnam business date helpers", () => {
  it("rolls the business date at midnight Asia/Ho_Chi_Minh, not midnight UTC", () => {
    expect(getVietnamDateOnly(new Date("2026-08-12T16:59:59.000Z"))).toBe(
      "2026-08-12",
    );
    expect(getVietnamDateOnly(new Date("2026-08-12T17:00:00.000Z"))).toBe(
      "2026-08-13",
    );
  });

  it("does not mark an invoice due today as overdue", () => {
    const now = new Date("2026-08-13T02:30:00.000Z"); // 09:30 in Vietnam
    expect(isInvoiceOverdue("issued", "2026-08-13", now)).toBe(false);
    expect(isInvoiceOverdue("partially_paid", "2026-08-13", now)).toBe(false);
  });

  it("derives overdue for issued and partially-paid invoices only", () => {
    const now = new Date("2026-08-13T02:30:00.000Z");
    expect(isInvoiceOverdue("issued", "2026-08-12", now)).toBe(true);
    expect(isInvoiceOverdue("partially_paid", "2026-08-12", now)).toBe(true);
    expect(isInvoiceOverdue("paid", "2026-08-12", now)).toBe(false);
    expect(isInvoiceOverdue("cancelled", "2026-08-12", now)).toBe(false);
    expect(isInvoiceOverdue("overdue", "2026-08-13", now)).toBe(true);
  });

  it("serializes datetime-local as explicit Vietnam time regardless of device timezone", () => {
    expect(vietnamLocalDateTimeToIso("2026-08-13T09:30")).toBe(
      "2026-08-13T02:30:00.000Z",
    );
  });

  it("rejects impossible local calendar values", () => {
    expect(() => vietnamLocalDateTimeToIso("2026-02-31T09:30")).toThrow();
  });

  it("formats payment timestamps in Asia/Ho_Chi_Minh", () => {
    const formatted = formatVietnamDateTime("2026-08-13T02:30:00.000Z");
    expect(formatted).toContain("09:30");
  });
});
