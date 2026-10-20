import { describe, expect, it } from "vitest";
import {
  computeOutstandingByCurrency,
  computeProjectCompletion,
} from "./client-dashboard-kpis";

const inv = (
  status: string,
  amount: number,
  paid: number,
  currency = "VND",
) => ({
  status: status as never,
  amount,
  paid_amount: paid,
  currency_code: currency,
});

describe("computeOutstandingByCurrency", () => {
  it("returns an empty object when there are no invoices", () => {
    expect(computeOutstandingByCurrency([])).toEqual({});
  });

  it("counts issued, partially paid and overdue invoices only", () => {
    expect(
      computeOutstandingByCurrency([
        inv("issued", 1000, 0),
        inv("partially_paid", 2000, 500),
        inv("overdue", 300, 0),
        inv("draft", 9999, 0),
        inv("paid", 800, 800),
        inv("cancelled", 700, 0),
      ]),
    ).toEqual({ VND: 2800 });
  });

  it("never lets an overpayment produce a negative balance", () => {
    expect(computeOutstandingByCurrency([inv("issued", 100, 150)])).toEqual({});
  });

  it("keeps currencies separate", () => {
    expect(
      computeOutstandingByCurrency([
        inv("issued", 100, 0, "VND"),
        inv("issued", 5, 0, "USD"),
      ]),
    ).toEqual({ VND: 100, USD: 5 });
  });
});

describe("computeProjectCompletion", () => {
  it("is 0/0 for no projects", () => {
    expect(computeProjectCompletion([])).toEqual({ completed: 0, total: 0 });
  });

  it("ignores draft and archived projects", () => {
    expect(
      computeProjectCompletion([
        { status: "completed" },
        { status: "active" },
        { status: "on_hold" },
        { status: "draft" },
        { status: "archived" },
      ]),
    ).toEqual({ completed: 1, total: 3 });
  });
});
