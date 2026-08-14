export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export type FinanceInvoiceStatus =
  "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";

export function getVietnamDateOnly(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to derive Vietnam business date");
  }

  return `${year}-${month}-${day}`;
}

export function isInvoiceOverdue(
  status: FinanceInvoiceStatus | string,
  dueDate: string,
  now: Date = new Date(),
): boolean {
  if (status === "overdue") return true;
  if (status !== "issued" && status !== "partially_paid") return false;
  if (!DATE_ONLY_PATTERN.test(dueDate)) return false;

  return dueDate < getVietnamDateOnly(now);
}

export function vietnamLocalDateTimeToIso(value: string): string {
  const match = DATETIME_LOCAL_PATTERN.exec(value);
  if (!match) {
    throw new Error("Invalid Vietnam local date-time");
  }

  const [, year, month, day, hour, minute, second = "00"] = match;

  // PGS Finance records business time in Asia/Ho_Chi_Minh. Vietnam uses
  // UTC+07:00 without daylight-saving time, so make the offset explicit
  // instead of relying on the browser/device timezone.
  const parsed = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`,
  );

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid Vietnam local date-time");
  }

  // Reject impossible calendar dates that JavaScript would otherwise normalize.
  const local = new Date(parsed.getTime() + 7 * 60 * 60 * 1000);
  if (
    local.getUTCFullYear() !== Number(year) ||
    local.getUTCMonth() + 1 !== Number(month) ||
    local.getUTCDate() !== Number(day) ||
    local.getUTCHours() !== Number(hour) ||
    local.getUTCMinutes() !== Number(minute) ||
    local.getUTCSeconds() !== Number(second)
  ) {
    throw new Error("Invalid Vietnam local date-time");
  }

  return parsed.toISOString();
}

export function formatVietnamDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}
