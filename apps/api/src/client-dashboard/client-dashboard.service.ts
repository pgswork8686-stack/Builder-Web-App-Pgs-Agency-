import { Injectable, Logger } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import { progressPct, vnDate } from '../admin-dashboard/dashboard.utils';

type Row = Record<string, any>;

/**
 * Dashboard Khách hàng. CÁCH LY TENANT: công ty lấy từ client_memberships của user trong phiên,
 * mọi truy vấn khóa theo các client_company_id đó; hóa đơn chỉ những cái client_visible = true.
 */
@Injectable()
export class ClientDashboardService {
  private readonly logger = new Logger(ClientDashboardService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async safe(name: string, q: PromiseLike<{ data: any; error: any }>): Promise<Row[]> {
    try {
      const { data, error } = await q;
      if (error) {
        this.logger.warn(`client-dashboard.${name}: ${error.message}`);
        return [];
      }
      return data ?? [];
    } catch (e) {
      this.logger.warn(`client-dashboard.${name}: ${(e as Error).message}`);
      return [];
    }
  }

  async getDashboard(user: RequestUser) {
    const sb = this.supabaseService.getSystemClient();
    const today = vnDate(new Date());
    const empty = {
      today, company: null as string | null,
      kpi: { activeProjects: 0, totalProjects: 0, pendingApprovals: 0, unpaidAmount: 0, unpaidInvoices: 0, nextDue: null as string | null, openTickets: 0, completedProjects: 0 },
      attention: [] as Row[], projects: [] as Row[], updates: [] as Row[],
    };

    const memberships = await this.safe('memberships', sb.from('client_memberships').select('client_company_id').eq('user_id', user.profileId));
    const companyIds = memberships.map((m) => m.client_company_id);
    if (!companyIds.length) return empty;

    const [companies, projects, invoices, tickets] = await Promise.all([
      this.safe('companies', sb.from('client_companies').select('id,name').in('id', companyIds)),
      this.safe('projects', sb.from('projects').select('id,project_code,name,status,due_date,completed_at,updated_at').in('client_company_id', companyIds).order('updated_at', { ascending: false }).limit(200)),
      this.safe('invoices', sb.from('invoices').select('id,invoice_number,amount,paid_amount,status,due_date,issue_date,created_at').in('client_company_id', companyIds).eq('client_visible', true).neq('status', 'cancelled').limit(500)),
      this.safe('tickets', sb.from('support_tickets').select('id,ticket_code,title,status,updated_at').in('client_company_id', companyIds).in('status', ['open', 'in_progress', 'waiting_client']).limit(100)),
    ]);

    const projectIds = projects.map((p) => p.id);
    const [approvals, items] = await Promise.all([
      projectIds.length ? this.safe('approvals', sb.from('workflow_approval_requests').select('id,project_code,approval_type,request_note,requested_at').in('project_id', projectIds).eq('status', 'pending').limit(100)) : Promise.resolve([] as Row[]),
      projectIds.length ? this.safe('items', sb.from('project_service_items').select('project_id,status,name,completed_at').in('project_id', projectIds).limit(5000)) : Promise.resolve([] as Row[]),
    ]);

    const outstanding = (i: Row) => Math.max(0, Number(i.amount ?? 0) - Number(i.paid_amount ?? 0));
    const unpaid = invoices.filter((i) => i.status !== 'draft' && outstanding(i) > 0).sort((a, b) => ((a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1));
    const active = projects.filter((p) => p.status === 'active');
    const completed = projects.filter((p) => p.status === 'completed');

    const stats = new Map<string, { done: number; total: number }>();
    for (const it of items) {
      const c = stats.get(it.project_id) ?? { done: 0, total: 0 };
      c.total++;
      if (it.status === 'completed' || it.status === 'done') c.done++;
      stats.set(it.project_id, c);
    }

    const attention = [
      ...approvals.slice(0, 3).map((a) => ({ key: `ap-${a.id}`, kind: 'approval', title: a.request_note || 'Phê duyệt sản phẩm', detail: `${a.project_code ?? ''} · gửi ngày ${(a.requested_at ?? '').slice(8, 10)}/${(a.requested_at ?? '').slice(5, 7)}`, badge: 'Chờ duyệt', href: '/app/client/approvals' })),
      ...unpaid.slice(0, 2).map((i) => ({ key: `inv-${i.id}`, kind: 'invoice', title: `Thanh toán hóa đơn ${i.invoice_number}`, detail: `${outstanding(i).toLocaleString('vi-VN')} ₫${i.due_date ? ` · hạn ${i.due_date.slice(8, 10)}/${i.due_date.slice(5, 7)}` : ''}`, badge: i.due_date && i.due_date < today ? 'Quá hạn' : 'Cần thanh toán', href: '/app/client/invoices' })),
      ...tickets.filter((t) => t.status === 'waiting_client').slice(0, 2).map((t) => ({ key: `tk-${t.id}`, kind: 'ticket', title: `Phản hồi phiếu hỗ trợ ${t.ticket_code ?? ''}`, detail: t.title, badge: 'Chờ bạn', href: '/app/client/support' })),
    ];

    return {
      today,
      company: companies[0]?.name ?? null,
      kpi: {
        activeProjects: active.length,
        totalProjects: projects.length,
        pendingApprovals: approvals.length,
        unpaidAmount: unpaid.reduce((s, i) => s + outstanding(i), 0),
        unpaidInvoices: unpaid.length,
        nextDue: unpaid[0]?.due_date ?? null,
        openTickets: tickets.length,
        completedProjects: completed.length,
      },
      attention,
      projects: projects.slice(0, 4).map((p) => {
        const c = stats.get(p.id) ?? { done: 0, total: 0 };
        return { id: p.id, code: p.project_code, name: p.name, status: p.status, dueDate: p.due_date, progress: p.status === 'completed' ? 100 : progressPct(c.done, c.total), itemsDone: c.done, itemsTotal: c.total };
      }),
      updates: [
        ...items.filter((i) => i.completed_at).sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1)).slice(0, 3).map((i) => ({ at: i.completed_at as string, text: `Hoàn thành hạng mục “${i.name}”` })),
        ...invoices.slice(0, 2).map((i) => ({ at: (i.issue_date ?? i.created_at) as string, text: `Hóa đơn ${i.invoice_number} được phát hành` })),
      ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 4),
    };
  }
}
