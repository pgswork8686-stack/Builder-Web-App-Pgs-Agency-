import { addDays, lastMonths, monthKey, progressPct, vnDate } from './dashboard.utils';

describe('dashboard.utils', () => {
  it('vnDate dùng múi giờ Việt Nam (UTC+7)', () => {
    expect(vnDate(new Date('2026-10-15T20:00:00Z'))).toBe('2026-10-16');
  });
  it('addDays qua tháng/năm', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('lastMonths trả đúng 6 tháng, vắt qua năm', () => {
    const m = lastMonths(6, new Date('2026-02-10T00:00:00Z'));
    expect(m.map((x) => x.key)).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
    expect(m[5].label).toBe('T2');
  });
  it('monthKey xử lý rỗng/sai và biên tháng theo giờ VN', () => {
    expect(monthKey(null)).toBeNull();
    expect(monthKey('không phải ngày')).toBeNull();
    expect(monthKey('2026-09-30T18:00:00Z')).toBe('2026-10');
  });
  it('progressPct không chia cho 0', () => {
    expect(progressPct(0, 0)).toBe(0);
    expect(progressPct(1, 3)).toBe(33);
  });
});
