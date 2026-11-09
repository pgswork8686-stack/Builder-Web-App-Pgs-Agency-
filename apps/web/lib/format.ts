/** Định dạng tiền/ngày dùng chung toàn app (một cách hiển thị duy nhất). */

/** 1.250.000.000 → "1,25 tỷ"; 85.500.000 → "85,5 tr"; 12.000 → "12.000 ₫". */
export function compactVND(n: number): string {
  if (!n) return "0 ₫";
  const f = (v: number) => v.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1e9) return `${f(n / 1e9)} tỷ`;
  if (Math.abs(n) >= 1e6) return `${f(n / 1e6)} tr`;
  return `${n.toLocaleString("vi-VN")} ₫`;
}

export function fullVND(n: number): string {
  return `${(n || 0).toLocaleString("vi-VN")} ₫`;
}

/** ISO (yyyy-MM-dd hoặc ISO đầy đủ) → "dd/MM/yyyy"; rỗng → "—". */
export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}
