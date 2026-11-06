import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  addDays,
  lastMonths,
  monthKey,
  progressPct,
  vnDate,
} from './dashboard.utils';

type Row = Record<string, any>;
const OPEN_TASK_STATUS = ['todo', 'in_progress', 'review'];
const OPEN_TICKET_STATUS = ['open', 'in_progress', 'waiting_client'];

/**
 * Tổng hợp số liệu toàn công ty cho Admin Dashboard (chỉ admin, qua system client).
 * Mỗi truy vấn độc lập: một phần lỗi chỉ làm phần đó rỗng, không làm hỏng cả dashboard.
 */
@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async safe<T = Row[]>(
    name: string,
    query: PromiseLike<{ data: any; error: any; count?: number | null }>,
    fallback: T,
  ): Promise<{ data: T; count: number | null }> {
    try {
      const { data, error, count } = await query;
      if (error) {
        this.logger.warn(`dashboard.${name}: ${error.message}`);
        return { data: fallback, count: null };
      }
      return { data: (data ?? fallback) as T, count: count ?? null };
    } catch (e) {
      this.logger.warn(`dashboard.${name}: ${(e as Error).message}`);
      return { data: fallback, count: null };
    }
  }

  async getDashboard() {
    const sb = this.supabaseService.getSystemClient();
    const now = new Date();
    const today = vnDate(now);
    const weekEnd = addDays(today, 7);
    const since24h = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const months = lastMonths(6, now);
    const firstMonthStart = `${months[0].key}-01T00:00:00+07:00`;
    const year = today.slice(0, 4);

    const [
      projects,
      openTasks,
      recentTasks,
      staff,
      pendingAccounts,
      attendance,
      leaveToday,
      leaveWeek,
      pendingLeave,
      invoices,
      payments,
      tickets,
      departments,
      clients,
      pendingExpenses,
      calendarEvents,
      doneRecent,
      newPending,
      newLeave,
    ] = await Promise.all([
      this.safe('projects', sb.from('projects').select('id,project_code,name,status,due_date,department_id,project_manager_user_id,client_company_id,updated_at').order('updated_at', { ascending: false }).limit(300), [] as Row[]),
      this.safe('openTasks', sb.from('tasks').select('id,task_code,title,status,due_date,assignee_user_id,project_id,project_code,created_at').in('status', OPEN_TASK_STATUS).limit(5000), [] as Row[]),
      this.safe('recentTasks', sb.from('tasks').select('id,task_code,title,status,due_date,assignee_user_id,project_code,created_at').gte('created_at', since24h).order('created_at', { ascending: false }).limit(50), [] as Row[]),
      this.safe('staff', sb.from('profiles').select('id,full_name,role').eq('account_status', 'active').neq('role', 'client').limit(1000), [] as Row[]),
      this.safe('pendingAccounts', sb.from('profiles').select('id', { count: 'exact', head: true }).eq('account_status', 'pending'), null as any),
      this.safe('attendance', sb.from('attendance_records').select('user_id,status,check_in_at,late_minutes').eq('attendance_date', today).limit(2000), [] as Row[]),
      this.safe('leaveToday', sb.from('leave_requests').select('user_id,start_date,end_date').eq('status', 'approved').lte('start_date', today).gte('end_date', today).limit(500), [] as Row[]),
      this.safe('leaveWeek', sb.from('leave_requests').select('user_id,start_date,end_date').eq('status', 'approved').lte('start_date', weekEnd).gte('end_date', today).limit(500), [] as Row[]),
      this.safe('pendingLeave', sb.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'), null as any),
      this.safe('invoices', sb.from('invoices').select('id,invoice_number,client_company_id,amount,paid_amount,status,due_date,paid_at,created_at').neq('status', 'cancelled').limit(5000), [] as Row[]),
      this.safe('payments', sb.from('invoice_payments').select('amount,paid_at').gte('paid_at', firstMonthStart).limit(5000), [] as Row[]),
      this.safe('tickets', sb.from('support_tickets').select('id,status,priority,title,created_at').in('status', OPEN_TICKET_STATUS).limit(500), [] as Row[]),
      this.safe('departments', sb.from('departments').select('id,name').eq('is_active', true).order('sort_order', { ascending: true }).limit(100), [] as Row[]),
      this.safe('clients', sb.from('client_companies').select('id,name').limit(1000), [] as Row[]),
      this.safe('pendingExpenses', sb.from('project_expenses').select('id', { count: 'exact', head: true }).in('status', ['pending', 'submitted']), null as any),
      this.safe('calendar', sb.from('company_work_calendar_events').select('event_date,title,event_type').gte('event_date', today).lte('event_date', weekEnd).order('event_date', { ascending: true }).limit(20), [] as Row[]),
      this.safe('doneRecent', sb.from('tasks').select('title,task_code,completed_at,assignee_user_id').eq('status', 'done').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(5), [] as Row[]),
      this.safe('newPending', sb.from('profiles').select('email,full_name,created_at').eq('account_status', 'pending').order('created_at', { ascending: false }).limit(5), [] as Row[]),
      this.safe('newLeave', sb.from('leave_requests').select('user_id,created_at,start_date,end_date,status').order('created_at', { ascending: false }).limit(5), [] as Row[]),
    ]);

    const staffById = new Map<string, Row>(staff.data.map((s) => [s.id, s]));
    const nameOf = (id?: string | null) => (id && staffById.get(id)?.full_name) || '—';
    const clientName = new Map<string, string>(clients.data.map((c) => [c.id, c.name]));
    const deptName = new Map<string, string>(departments.data.map((d) => [d.id, d.name]));
    const projectById = new Map<string, Row>(projects.data.map((p) => [p.id, p]));

    // --- Công việc
    const overdueTasks = openTasks.data.filter((t) => t.due_date && t.due_date < today);

    // --- Dự án: tiến độ = task done / tổng task (không tính task đã hủy)
    const activeProjects = projects.data.filter((p) => p.status === 'active');
    const ids = activeProjects.slice(0, 8).map((p) => p.id);
    const projTasks = ids.length
      ? await this.safe('projectTasks', sb.from('tasks').select('project_id,status').in('project_id', ids).limit(20000), [] as Row[])
      : { data: [] as Row[], count: null };
    const totals = new Map<string, { done: number; total: number }>();
    for (const t of projTasks.data) {
      if (t.status === 'cancelled') continue;
      const c = totals.get(t.project_id) ?? { done: 0, total: 0 };
      c.total++;
      if (t.status === 'done') c.done++;
      totals.set(t.project_id, c);
    }
    const projectList = activeProjects.slice(0, 5).map((p) => {
      const c = totals.get(p.id) ?? { done: 0, total: 0 };
      return {
        id: p.id,
        code: p.project_code,
        name: p.name,
        status: p.status,
        client: clientName.get(p.client_company_id) ?? null,
        manager: nameOf(p.project_manager_user_id),
        dueDate: p.due_date,
        progress: progressPct(c.done, c.total),
        late: !!(p.due_date && p.due_date < today),
      };
    });

    // --- Phân bổ công việc theo phòng ban
    const byDept = new Map<string, { open: number; overdue: number }>();
    for (const t of openTasks.data) {
      const dept = projectById.get(t.project_id)?.department_id;
      if (!dept) continue;
      const c = byDept.get(dept) ?? { open: 0, overdue: 0 };
      c.open++;
      if (t.due_date && t.due_date < today) c.overdue++;
      byDept.set(dept, c);
    }
    const workload = [...byDept.entries()]
      .map(([id, c]) => ({ departmentId: id, name: deptName.get(id) ?? 'Chưa phân phòng', ...c }))
      .sort((a, b) => b.open - a.open)
      .slice(0, 6);

    // --- Nhân sự hôm nay
    const attByUser = new Map<string, Row>(attendance.data.map((a) => [a.user_id, a]));
    const leaveUsers = new Set<string>(leaveToday.data.map((l) => l.user_id));
    const presentCount = attendance.data.filter((a) => a.check_in_at).length;
    const lateCount = attendance.data.filter((a) => (a.late_minutes ?? 0) > 0 || /late/.test(a.status ?? '')).length;
    const notCheckedIn = staff.data.filter((s) => !attByUser.get(s.id)?.check_in_at && !leaveUsers.has(s.id)).length;
    const ORDER = ['leave', 'late', 'none', 'present'];
    const staffToday = staff.data
      .map((s) => {
        const a = attByUser.get(s.id);
        let state = 'none';
        let note = 'chưa check-in';
        if (leaveUsers.has(s.id)) { state = 'leave'; note = 'nghỉ phép hôm nay'; }
        else if (a?.check_in_at && (a.late_minutes ?? 0) > 0) { state = 'late'; note = `đi muộn ${a.late_minutes} phút`; }
        else if (a?.check_in_at) { state = 'present'; note = 'đã check-in'; }
        return { id: s.id, name: s.full_name, role: s.role, state, note };
      })
      .sort((x, y) => ORDER.indexOf(x.state) - ORDER.indexOf(y.state))
      .slice(0, 6);

    // --- Tài chính
    const outstanding = (i: Row) => Math.max(0, Number(i.amount ?? 0) - Number(i.paid_amount ?? 0));
    const liveInv = invoices.data.filter((i) => i.status !== 'draft');
    const overdueInv = liveInv.filter((i) => outstanding(i) > 0 && i.due_date && i.due_date < today);
    const receivableOverdue = overdueInv.reduce((s, i) => s + outstanding(i), 0);
    const receivableTotal = liveInv.reduce((s, i) => s + outstanding(i), 0);
    const revenueByMonth = new Map<string, number>(months.map((m) => [m.key, 0]));
    for (const p of payments.data) {
      const k = monthKey(p.paid_at);
      if (k && revenueByMonth.has(k)) revenueByMonth.set(k, (revenueByMonth.get(k) ?? 0) + Number(p.amount ?? 0));
    }
    const revenueYtd = liveInv.filter((i) => (i.paid_at ?? '').startsWith(year)).reduce((s, i) => s + Number(i.paid_amount ?? 0), 0);

    // --- Hỗ trợ
    const openTickets = tickets.data.length;
    const waitingClient = tickets.data.filter((t) => t.status === 'waiting_client').length;
    const urgentTickets = tickets.data.filter((t) => t.priority === 'urgent' || t.priority === 'high').length;

    // --- Cần xử lý hôm nay
    const pendingAcc = pendingAccounts.count ?? 0;
    const pendLeave = pendingLeave.count ?? 0;
    const pendExp = pendingExpenses.count ?? 0;
    const attention = [
      { key: 'accounts', title: 'Tài khoản chờ duyệt', detail: `${pendingAcc} tài khoản đăng ký mới`, count: pendingAcc, href: '/app/admin/accounts/pending', owner: 'Quản trị' },
      { key: 'leave', title: 'Đơn nghỉ phép chờ duyệt', detail: `${pendLeave} đơn chờ phê duyệt`, count: pendLeave, href: '/app/admin/leave', owner: 'Quản trị / Trưởng nhóm' },
      { key: 'attendance', title: 'Nhân sự chưa check-in', detail: `${notCheckedIn} người chưa check-in hôm nay`, count: notCheckedIn, href: '/app/admin/attendance', owner: 'Quản trị' },
      { key: 'invoices', title: 'Hóa đơn quá hạn thanh toán', detail: `${overdueInv.length} hóa đơn quá hạn`, count: overdueInv.length, href: '/app/admin/finance/invoices', owner: 'Kế toán' },
      { key: 'expenses', title: 'Đề nghị chi chờ duyệt', detail: `${pendExp} đề nghị chi phí dự án`, count: pendExp, href: '/app/accountant/finance/project-expenses', owner: 'Kế toán' },
      { key: 'tickets', title: 'Phiếu hỗ trợ đang mở', detail: `${openTickets} phiếu · ${urgentTickets} ưu tiên cao`, count: openTickets, href: '/app/client/support', owner: 'CSKH' },
    ];
    const actionable = attention.filter((a) => a.count > 0);

    // --- Hoạt động gần đây
    const activity = [
      ...newPending.data.map((p) => ({ at: p.created_at as string, text: `Tài khoản mới đăng ký: ${p.email} — chờ duyệt` })),
      ...newLeave.data.map((l) => ({ at: l.created_at as string, text: `${nameOf(l.user_id)} gửi đơn nghỉ phép ${l.start_date}${l.end_date !== l.start_date ? ' → ' + l.end_date : ''}` })),
      ...doneRecent.data.map((t) => ({ at: t.completed_at as string, text: `${nameOf(t.assignee_user_id)} hoàn thành "${t.title}"${t.task_code ? ` (${t.task_code})` : ''}` })),
      ...recentTasks.data.slice(0, 5).map((t) => ({ at: t.created_at as string, text: `Công việc mới: "${t.title}"${t.project_code ? ` (${t.project_code})` : ''}` })),
    ]
      .filter((x) => x.at)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 8);

    // --- Lịch hôm nay & tuần
    const dueProjects = projects.data.filter((p) => p.due_date && p.due_date >= today && p.due_date <= weekEnd && !['completed', 'cancelled'].includes(p.status));
    const schedule = [
      ...leaveWeek.data.map((l) => ({ date: l.start_date < today ? today : l.start_date, label: `${nameOf(l.user_id)} nghỉ phép`, kind: 'leave' })),
      ...dueProjects.map((p) => ({ date: p.due_date as string, label: `Hạn dự án: ${p.name}`, kind: 'project' })),
      ...openTasks.data.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd).slice(0, 10).map((t) => ({ date: t.due_date as string, label: `Hạn: ${t.title}`, kind: 'task' })),
      ...calendarEvents.data.map((e) => ({ date: e.event_date as string, label: e.title as string, kind: 'calendar' })),
    ]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(0, 8);

    return {
      generatedAt: now.toISOString(),
      today,
      kpi: {
        activeProjects: activeProjects.length,
        overdueTasks: overdueTasks.length,
        overdueProjects: activeProjects.filter((p) => p.due_date && p.due_date < today).length,
        pendingTotal: pendingAcc + pendLeave + pendExp,
        pending: { accounts: pendingAcc, leave: pendLeave, expenses: pendExp },
        staff: { total: staff.data.length, present: presentCount, late: lateCount, onLeave: leaveUsers.size, notCheckedIn },
        receivable: { overdueAmount: receivableOverdue, overdueInvoices: overdueInv.length, totalOutstanding: receivableTotal },
        tickets: { open: openTickets, waitingClient, urgent: urgentTickets },
      },
      attention: { total: actionable.reduce((s, a) => s + a.count, 0), items: actionable },
      staffToday,
      workload,
      newTasks: {
        last24h: recentTasks.data.length,
        items: recentTasks.data.slice(0, 5).map((t) => ({
          id: t.id,
          code: t.task_code,
          title: t.title,
          project: t.project_code,
          assignee: nameOf(t.assignee_user_id),
          dueDate: t.due_date,
          status: t.status,
          overdue: !!(t.due_date && t.due_date < today && OPEN_TASK_STATUS.includes(t.status)),
        })),
      },
      projects: projectList,
      activity,
      revenue: {
        months: months.map((m) => ({ key: m.key, label: m.label, amount: revenueByMonth.get(m.key) ?? 0 })),
        ytd: revenueYtd,
        receivable: receivableTotal,
        overdue: receivableOverdue,
      },
      schedule,
    };
  }
}
