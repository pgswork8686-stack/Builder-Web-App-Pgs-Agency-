import { Injectable, Logger } from '@nestjs/common';
import { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import { progressPct, vnDate } from '../admin-dashboard/dashboard.utils';

type Row = Record<string, any>;
const OPEN = ['todo', 'in_progress', 'review'];

/** Dashboard Trưởng nhóm: chỉ số liệu trong PHẠM VI PHÒNG BAN của người gọi (departmentId lấy từ phiên, không từ client). */
@Injectable()
export class TeamLeaderDashboardService {
  private readonly logger = new Logger(TeamLeaderDashboardService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async safe(name: string, q: PromiseLike<{ data: any; error: any }>): Promise<Row[]> {
    try {
      const { data, error } = await q;
      if (error) {
        this.logger.warn(`team-dashboard.${name}: ${error.message}`);
        return [];
      }
      return data ?? [];
    } catch (e) {
      this.logger.warn(`team-dashboard.${name}: ${(e as Error).message}`);
      return [];
    }
  }

  async getDashboard(user: RequestUser) {
    const empty = {
      today: vnDate(new Date()),
      departmentId: null as string | null,
      kpi: { projects: 0, projectsAtRisk: 0, openTasks: 0, overdueTasks: 0, overdueAssignees: 0, pendingReview: 0, pendingLeave: 0, members: 0, presentToday: 0 },
      attention: [] as Row[],
      teamToday: { present: 0, late: 0, onLeave: 0, members: [] as Row[] },
      workload: [] as Row[],
      projects: [] as Row[],
    };
    const deptId = user.departmentId ?? null;
    if (!deptId) return empty;

    const sb = this.supabaseService.getSystemClient();
    const today = vnDate(new Date());

    const [emps, projects] = await Promise.all([
      this.safe('members', sb.from('employee_profiles').select('user_id,job_title').eq('department_id', deptId).limit(500)),
      this.safe('projects', sb.from('projects').select('id,project_code,name,status,due_date,client_company_id').eq('department_id', deptId).order('updated_at', { ascending: false }).limit(200)),
    ]);
    const memberIds = emps.map((e) => e.user_id);
    const projectIds = projects.map((p) => p.id);

    const [names, tasks, attendance, leaveToday, pendingLeave, clients] = await Promise.all([
      memberIds.length ? this.safe('names', sb.from('profiles').select('id,full_name').in('id', memberIds)) : Promise.resolve([] as Row[]),
      projectIds.length ? this.safe('tasks', sb.from('tasks').select('id,task_code,title,status,due_date,assignee_user_id,project_id').in('project_id', projectIds).limit(10000)) : Promise.resolve([] as Row[]),
      memberIds.length ? this.safe('attendance', sb.from('attendance_records').select('user_id,check_in_at,late_minutes,check_out_at').eq('attendance_date', today).in('user_id', memberIds)) : Promise.resolve([] as Row[]),
      memberIds.length ? this.safe('leaveToday', sb.from('leave_requests').select('user_id,start_date,end_date').eq('status', 'approved').lte('start_date', today).gte('end_date', today).in('user_id', memberIds)) : Promise.resolve([] as Row[]),
      memberIds.length ? this.safe('pendingLeave', sb.from('leave_requests').select('id,user_id,start_date,end_date').eq('status', 'pending').in('user_id', memberIds).limit(100)) : Promise.resolve([] as Row[]),
      this.safe('clients', sb.from('client_companies').select('id,name').limit(1000)),
    ]);

    const nameOf = new Map<string, string>(names.map((n) => [n.id, n.full_name]));
    const clientName = new Map<string, string>(clients.map((c) => [c.id, c.name]));
    const open = tasks.filter((t) => OPEN.includes(t.status));
    const overdue = open.filter((t) => t.due_date && t.due_date < today);
    const review = tasks.filter((t) => t.status === 'review');
    const active = projects.filter((p) => p.status === 'active');
    const atRisk = active.filter((p) => p.due_date && p.due_date < today);

    const attBy = new Map<string, Row>(attendance.map((a) => [a.user_id, a]));
    const leaveSet = new Set<string>(leaveToday.map((l) => l.user_id));
    const present = attendance.filter((a) => a.check_in_at).length;
    const late = attendance.filter((a) => (a.late_minutes ?? 0) > 0).length;
    const ORDER = ['leave', 'late', 'none', 'present'];
    const members = memberIds
      .map((id) => {
        const a = attBy.get(id);
        let state = 'none';
        let note = 'chưa check-in';
        if (leaveSet.has(id)) { state = 'leave'; note = 'nghỉ phép hôm nay'; }
        else if (a?.check_in_at && (a.late_minutes ?? 0) > 0) { state = 'late'; note = `đi muộn ${a.late_minutes} phút`; }
        else if (a?.check_in_at && a.check_out_at) { state = 'present'; note = 'đã check-out'; }
        else if (a?.check_in_at) { state = 'present'; note = 'đang làm việc'; }
        return { id, name: nameOf.get(id) ?? '—', state, note };
      })
      .sort((x, y) => ORDER.indexOf(x.state) - ORDER.indexOf(y.state));

    const per = new Map<string, { open: number; overdue: number }>();
    for (const t of open) {
      if (!t.assignee_user_id || !memberIds.includes(t.assignee_user_id)) continue;
      const c = per.get(t.assignee_user_id) ?? { open: 0, overdue: 0 };
      c.open++;
      if (t.due_date && t.due_date < today) c.overdue++;
      per.set(t.assignee_user_id, c);
    }
    const workload = [...per.entries()]
      .map(([id, c]) => ({ userId: id, name: nameOf.get(id) ?? '—', ...c }))
      .sort((a, b) => b.open - a.open)
      .slice(0, 6);

    const totals = new Map<string, { done: number; total: number }>();
    for (const t of tasks) {
      if (t.status === 'cancelled') continue;
      const c = totals.get(t.project_id) ?? { done: 0, total: 0 };
      c.total++;
      if (t.status === 'done') c.done++;
      totals.set(t.project_id, c);
    }

    const attention = [
      { key: 'review', title: 'Kết quả công việc chờ duyệt', detail: review.slice(0, 4).map((t) => t.task_code ?? t.title).join(', ') || '—', count: review.length, href: '/app/team-leader/approvals' },
      { key: 'leave', title: 'Đơn nghỉ phép của đội', detail: pendingLeave.slice(0, 3).map((l) => nameOf.get(l.user_id) ?? '—').join(', ') || '—', count: pendingLeave.length, href: '/app/team-leader/approvals' },
      { key: 'overdue', title: 'Công việc quá hạn', detail: overdue.slice(0, 3).map((t) => t.task_code ?? t.title).join(', ') || '—', count: overdue.length, href: '/app/team-leader/tasks' },
    ].filter((a) => a.count > 0);

    return {
      today,
      departmentId: deptId,
      kpi: {
        projects: active.length,
        projectsAtRisk: atRisk.length,
        openTasks: open.length,
        overdueTasks: overdue.length,
        overdueAssignees: new Set(overdue.map((t) => t.assignee_user_id).filter(Boolean)).size,
        pendingReview: review.length + pendingLeave.length,
        pendingLeave: pendingLeave.length,
        members: memberIds.length,
        presentToday: present,
      },
      attention,
      teamToday: { present, late, onLeave: leaveSet.size, members: members.slice(0, 5) },
      workload,
      projects: active.slice(0, 5).map((p) => {
        const c = totals.get(p.id) ?? { done: 0, total: 0 };
        return {
          id: p.id, code: p.project_code, name: p.name,
          client: clientName.get(p.client_company_id) ?? null,
          dueDate: p.due_date, progress: progressPct(c.done, c.total),
          late: !!(p.due_date && p.due_date < today),
        };
      }),
    };
  }
}
