/** Hàm thuần cho dashboard admin (dễ kiểm thử). Múi giờ nghiệp vụ: Asia/Ho_Chi_Minh. */

export function vnDate(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 6 tháng gần nhất (cũ → mới) theo giờ VN, mỗi phần tử { key: 'YYYY-MM', label: 'T10' }. */
export function lastMonths(
  count: number,
  now: Date = new Date(),
): { key: string; label: string }[] {
  const [y, m] = vnDate(now).split('-').map(Number);
  const out: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: `T${d.getUTCMonth() + 1}` });
  }
  return out;
}

export function monthKey(isoTimestamp: string | null | undefined): string | null {
  if (!isoTimestamp) return null;
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return null;
  return vnDate(d).slice(0, 7);
}

export function progressPct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
