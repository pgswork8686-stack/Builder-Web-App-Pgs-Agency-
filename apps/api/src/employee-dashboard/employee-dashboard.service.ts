import { Injectable, Logger } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import { addDays, progressPct, vnDate } from '../admin-dashboard/dashboard.utils';

type Row = Record<string, any>;
const OPEN = ['todo', 'in_progress', 'review'];

/** Dashboard Nhân viên: MỌI truy vấn đều khóa theo user của phiên (profileId), không nhận id từ client. */
@Injectable()
export class EmployeeDashboardService {
  private readonly logger = new Logger(EmployeeDashboardService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async safe(name: string, q: PromiseLike<{ data: any; error: any }>): Promise<Row[]> {
    try {
      const { data, error } = await q;
      if (error) {
        this.logger.warn(`employee-dashboard.${name}: ${error.message}`);
        return [];
      }
      return data ?? [];
    } catch (e) {
      this.logger.warn(`employee-dashboard.${name}: ${(e as Error).message}`);
      return [];
    }
  }

  async getDashboard(user: RequestUser) {
    const sb = this.supabaseService.getSystemClient();
    const uid = user.profileId;
    const today = vnDate(new Date());
    const weekEnd = addDays(today, 7);
    const monthStart = `${today.slice(0, 8)}01`;
    const year = Number(today.slice(0, 4));

    const [tasks, memberships, balances, pendingLeave, attendance, notifications, leaveWeek] = await Promise.all([
      this.safe('tasks', sb.from('tasks').select('id,task_code,title,status,due_date,project_id,project_code,updated_at').eq('assignee_user_id', uid).in('status', OPEN).limit(500)),
      this.safe('memberships', sb.from('project_memberships').select('project_id,project_role').eq('user_id', uid).limit(100)),
      this.safe('balances', sb.from('leave_balances').select('allocated_days,used_days,adjusted_days').eq('user_id', uid).eq('year', year)),
      this.safe('pendingLeave', sb.from('leave_requests').select('id').eq('user_id', uid).eq('status', 'pending')),
      this.safe('attendance', sb.from('attendance_records').select('attendance_date,check_in_at,status').eq('user_id', uid).gte('attendance_date', monthStart).lte('attendance_date', today)),
      this.safe('notifications', sb.from('notifications').select('id,title,message,type,action_url,created_at,read_at').eq('recipient_user_id', uid).order('created_at', { ascending: false }).limit(3)),
      this.safe('leaveWeek', sb.from('leave_requests').select('start_date,end_date').eq('user_id', uid).eq('status', 'approved').lte('start_date', weekEnd).gte('end_date', today)),
    ]);

    const projectIds = memberships.map((m) => m.project_id);
    const [projects, unread, allTasks] = await Promise.all([
      projectIds.length ? this.safe('projects', sb.from('projects').select('id,project_code,name,status,due_date').in('id', projectIds).eq('status', 'active')) : Promise.resolve([] as Row[]),
      this.safe('unread', sb.from('notifications').select('id').eq('recipient_user_id', uid).is('read_at', null)),
      projectIds.length ? this.safe('projectTasks', sb.from('tasks').select('project_id,status').in('project_id', projectIds).limit(10000)) : Promise.resolve([] as Row[]),
    ]);

    const overdue = tasks.filter((t) => t.due_date && t.due_date < today);
    const urgent = [...tasks]
      .sort((a, b) => (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1)
      .slice(0, 3)
      .map((t) => ({
        id: t.id, code: t.task_code, title: t.title, project: t.project_code, status: t.status,
        dueDate: t.due_date, overdue: !!(t.due_date && t.due_date < today),
        daysLate: t.due_date && t.due_date < today ? Math.round((Date.parse(today) - Date.parse(t.due_date)) / 86400000) : 0,
      }));

    const bal = balances.reduce((s, b) => s + Number(b.allocated_days ?? 0) + Number(b.adjusted_days ?? 0) - Number(b.used_days ?? 0), 0);
    const presentDays = attendance.filter((a) => a.check_in_at).length;
    const workingDays = (() => {
      let n = 0;
      for (let d = monthStart; d <= today; d = addDays(d, 1)) {
        const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
        if (wd !== 0) n++; // lịch làm việc PGS: nghỉ Chủ nhật
      }
      return n;
    })();

    const totals = new Map<string, { done: number; total: number }>();
    for (const t of allTasks) {
      if (t.status === 'cancelled') continue;
      const c = totals.get(t.project_id) ?? { done: 0, total: 0 };
      c.total++;
      if (t.status === 'done') c.done++;
      totals.set(t.project_id, c);
    }
    const roleOf = new Map<string, string>(memberships.map((m) => [m.project_id, m.project_role]));

    const schedule = [
      ...tasks.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd).map((t) => ({ date: t.due_date as string, label: `Hạn: ${t.title}` })),
      ...leaveWeek.map((l) => ({ date: (l.start_date < today ? today : l.start_date) as string, label: 'Nghỉ phép đã duyệt' })),
    ].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 6);

    return {
      today,
      kpi: {
        todayTasks: tasks.length,
        inProgress: tasks.filter((t) => t.status === 'in_progress').length,
        overdue: overdue.length,
        inReview: tasks.filter((t) => t.status === 'review').length,
        leaveRemaining: Math.round(bal * 10) / 10,
        pendingLeave: pendingLeave.length,
        presentDays,
        workingDays,
      },
      alert: overdue[0] ? { title: `Bạn có ${overdue.length} công việc quá hạn`, detail: `${overdue[0].task_code ?? ''} “${overdue[0].title}” — cập nhật tiến độ hoặc báo Trưởng nhóm.` } : null,
      urgent,
      notifications: { unread: unread.length, items: notifications.map((n) => ({ id: n.id, title: n.title, message: n.message, href: n.action_url, at: n.created_at, read: !!n.read_at })) },
      projects: projects.slice(0, 5).map((p) => {
        const c = totals.get(p.id) ?? { done: 0, total: 0 };
        return { id: p.id, code: p.project_code, name: p.name, role: roleOf.get(p.id) ?? 'member', dueDate: p.due_date, progress: progressPct(c.done, c.total), late: !!(p.due_date && p.due_date < today) };
      }),
      schedule,
    };
  }
}
