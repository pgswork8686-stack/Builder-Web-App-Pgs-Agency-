import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { lastMonths, monthKey, vnDate } from '../admin-dashboard/dashboard.utils';

type Row = Record<string, any>;
const DONE_EXPENSE = ['approved', 'paid'];

/** Dashboard Kế toán: tiền thu/chi 6 tháng, công nợ, đề nghị chi chờ duyệt. Chỉ vai trò accountant. */
@Injectable()
export class AccountantDashboardService {
  private readonly logger = new Logger(AccountantDashboardService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async safe(name: string, q: PromiseLike<{ data: any; error: any }>): Promise<Row[]> {
    try {
      const { data, error } = await q;
      if (error) {
        this.logger.warn(`accountant-dashboard.${name}: ${error.message}`);
        return [];
      }
      return data ?? [];
    } catch (e) {
      this.logger.warn(`accountant-dashboard.${name}: ${(e as Error).message}`);
      return [];
    }
  }

  async getDashboard() {
    const sb = this.supabaseService.getSystemClient();
    const now = new Date();
    const today = vnDate(now);
    const months = lastMonths(6, now);
    const thisKey = months[5].key;
    const prevKey = months[4].key;
    const from = `${months[0].key}-01`;

    const [invoices, payments, expenses, clients, payroll, attendancePending] = await Promise.all([
      this.safe('invoices', sb.from('invoices').select('id,invoice_number,client_company_id,amount,paid_amount,status,due_date,created_at').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(5000)),
      this.safe('payments', sb.from('invoice_payments').select('amount,paid_at').gte('paid_at', `${from}T00:00:00+07:00`).limit(5000)),
      this.safe('expenses', sb.from('project_expenses').select('id,amount,status,expense_date').gte('expense_date', from).limit(5000)),
      this.safe('clients', sb.from('client_companies').select('id,name').limit(1000)),
      this.safe('payroll', sb.from('payroll_runs').select('*').order('created_at', { ascending: false }).limit(1)),
      this.safe('attendance', sb.from('attendance_records').select('id').not('check_in_at', 'is', null).is('check_out_at', null).lt('attendance_date', today).limit(500)),
    ]);

    const cname = new Map<string, string>(clients.map((c) => [c.id, c.name]));
    const outstanding = (i: Row) => Math.max(0, Number(i.amount ?? 0) - Number(i.paid_amount ?? 0));
    const live = invoices.filter((i) => i.status !== 'draft');
    const open = live.filter((i) => outstanding(i) > 0);
    const overdue = open.filter((i) => i.due_date && i.due_date < today);

    const income = new Map<string, number>(months.map((m) => [m.key, 0]));
    for (const p of payments) {
      const k = monthKey(p.paid_at);
      if (k && income.has(k)) income.set(k, (income.get(k) ?? 0) + Number(p.amount ?? 0));
    }
    const spend = new Map<string, number>(months.map((m) => [m.key, 0]));
    for (const e of expenses) {
      if (!DONE_EXPENSE.includes(e.status)) continue;
      const k = (e.expense_date ?? '').slice(0, 7);
      if (spend.has(k)) spend.set(k, (spend.get(k) ?? 0) + Number(e.amount ?? 0));
    }
    const pendingExp = expenses.filter((e) => e.status === 'pending' || e.status === 'submitted');
    const thisIncome = income.get(thisKey) ?? 0;
    const prevIncome = income.get(prevKey) ?? 0;

    const debtBy = new Map<string, number>();
    for (const i of open) debtBy.set(i.client_company_id, (debtBy.get(i.client_company_id) ?? 0) + outstanding(i));
    const sum = (rows: Row[], f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0);

    const attention = [
      { key: 'overdue', title: 'Hóa đơn quá hạn', detail: overdue.slice(0, 3).map((i) => i.invoice_number).join(' · ') || '—', count: overdue.length, href: '/app/accountant/finance/invoices', tone: 'danger' },
      { key: 'expenses', title: 'Đề nghị chi phí chờ duyệt', detail: `${pendingExp.length} đề nghị · ${Math.round(sum(pendingExp, (e) => Number(e.amount ?? 0)) / 1e6 * 10) / 10}tr`, count: pendingExp.length, href: '/app/accountant/finance/project-expenses', tone: 'gold' },
      { key: 'attendance', title: 'Chấm công chờ khóa kỳ', detail: `${attendancePending.length} ca chưa chốt`, count: attendancePending.length, href: '/app/accountant/attendance', tone: 'green' },
    ].filter((a) => a.count > 0);

    const run = payroll[0];
    return {
      today,
      kpi: {
        incomeThisMonth: thisIncome,
        incomeChangePct: prevIncome > 0 ? Math.round(((thisIncome - prevIncome) / prevIncome) * 100) : null,
        receivable: sum(open, outstanding),
        receivableInvoices: open.length,
        overdueAmount: sum(overdue, outstanding),
        overdueClients: new Set(overdue.map((i) => i.client_company_id)).size,
        pendingExpenseAmount: sum(pendingExp, (e) => Number(e.amount ?? 0)),
        pendingExpenseCount: pendingExp.length,
        payrollStatus: run ? String(run.status ?? '') : null,
        payrollLabel: run ? (run.period_label ?? run.name ?? run.period ?? null) : null,
      },
      cashflow: {
        months: months.map((m) => ({ key: m.key, label: m.label, income: income.get(m.key) ?? 0, expense: spend.get(m.key) ?? 0 })),
        income: thisIncome,
        expense: spend.get(thisKey) ?? 0,
      },
      attention: { total: attention.reduce((s, a) => s + a.count, 0), items: attention },
      recentInvoices: invoices.slice(0, 4).map((i) => ({
        id: i.id, number: i.invoice_number, client: cname.get(i.client_company_id) ?? '—', amount: Number(i.amount ?? 0), status: i.status,
        overdue: !!(outstanding(i) > 0 && i.due_date && i.due_date < today && i.status !== 'draft'),
      })),
      debtByClient: [...debtBy.entries()].map(([id, amount]) => ({ clientId: id, name: cname.get(id) ?? '—', amount })).sort((a, b) => b.amount - a.amount).slice(0, 5),
    };
  }
}
