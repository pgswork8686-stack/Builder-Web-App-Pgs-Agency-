import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  ListTodo,
  CalendarDays,
  Wallet,
  FileText,
  Settings,
  Clock,
  TrendingUp,
  Receipt,
  HelpCircle,
  FolderOpen,
  Inbox,
  PackageCheck,
  BookOpen,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/api/auth";

/** Một tab trong module: mỗi tab là một route thật đang có. */
export interface NavTab {
  title: string;
  href: string;
  exact?: boolean;
}

export interface NavItem {
  /** Không còn đánh số menu (V2). Giữ trường để tương thích ngược. */
  index?: string;
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
  activePaths?: string[];
  /** Các view/trang con của module — hiển thị thành tab trên đầu trang, không thành mục sidebar. */
  tabs?: NavTab[];
}

export interface NavGroup {
  groupTitle?: string;
  items: NavItem[];
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Quản trị viên",
  team_leader: "Trưởng phòng",
  employee: "Nhân viên",
  accountant: "Kế toán",
  client: "Khách hàng",
};

export const ROLE_HEADER_SUBTITLE: Record<AppRole, string> = {
  admin: "Quản trị toàn Agency",
  team_leader: "Không gian quản lý",
  employee: "Không gian làm việc",
  accountant: "Tài chính & lương",
  client: "Cổng khách hàng",
};

/** Module có tab: activePaths lấy từ các tab để sidebar sáng đúng khi mở trang con hoặc deep-link. */
function mod(title: string, icon: LucideIcon, tabs: NavTab[], extra?: Partial<NavItem>): NavItem {
  return { title, icon, href: tabs[0].href, tabs, activePaths: tabs.map((t) => t.href), ...extra };
}

const MY_WORK_TABS: NavTab[] = [
  { title: "Chấm công", href: "/app/attendance" },
  { title: "Nghỉ phép", href: "/app/leave" },
];

export function getNavigationForRole(role: AppRole): NavGroup[] {
  switch (role) {
    case "admin":
      return [
        {
          items: [
            { title: "Tổng quan", href: "/app/admin", icon: LayoutDashboard, exact: true },
            mod("Dự án & Công việc", FolderKanban, [
              { title: "Dự án", href: "/app/admin/projects", exact: true },
              { title: "Công việc", href: "/app/admin/tasks" },
              { title: "Kanban", href: "/app/admin/kanban" },
              { title: "Lịch", href: "/app/admin/calendar" },
              { title: "Dự án hoàn thành", href: "/app/admin/projects/completed" },
            ], { activePaths: ["/app/admin/projects", "/app/admin/tasks", "/app/admin/kanban", "/app/admin/calendar"] }),
            { title: "Khách hàng", href: "/app/admin/clients", icon: Building2 },
            mod("Nhân sự & Tổ chức", Users, [
              { title: "Nhân sự", href: "/app/admin/people" },
              { title: "Tài khoản chờ duyệt", href: "/app/admin/accounts/pending" },
              { title: "Cơ cấu tổ chức", href: "/app/admin/organization" },
              { title: "Phòng ban", href: "/app/admin/departments" },
              { title: "Đội nhóm", href: "/app/admin/teams" },
            ], { activePaths: ["/app/admin/people", "/app/admin/accounts", "/app/admin/organization", "/app/admin/departments", "/app/admin/teams"] }),
            mod("Chấm công & Nghỉ phép", Clock, [
              { title: "Chấm công", href: "/app/admin/attendance" },
              { title: "Nghỉ phép", href: "/app/admin/leave" },
              { title: "Lịch làm việc", href: "/app/admin/settings/work-calendar" },
            ]),
            mod("Tài chính", Wallet, [
              { title: "Tổng quan", href: "/app/admin/finance", exact: true },
              { title: "Hợp đồng", href: "/app/admin/finance/contracts" },
              { title: "Hóa đơn", href: "/app/admin/finance/invoices" },
            ], { activePaths: ["/app/admin/finance"] }),
            { title: "Báo cáo", href: "/app/admin/reports", icon: TrendingUp },
          ],
        },
        {
          groupTitle: "Quản trị",
          items: [
            { title: "Tài liệu PGS", href: "/app/admin/documents", icon: BookOpen },
            mod("Cấu hình", Settings, [
              { title: "Cài đặt", href: "/app/admin/settings", exact: true },
              { title: "Dịch vụ", href: "/app/admin/services" },
              { title: "Quy trình", href: "/app/admin/workflows" },
              { title: "Tự động hóa", href: "/app/admin/automation" },
            ], { activePaths: ["/app/admin/services", "/app/admin/workflows", "/app/admin/automation"] }),
          ],
        },
      ];

    case "team_leader":
      return [
        {
          items: [
            { title: "Hôm nay", href: "/app/team-leader", icon: LayoutDashboard, exact: true },
            { title: "Cần xử lý", href: "/app/team-leader/approvals", icon: Inbox },
            mod("Dự án", FolderKanban, [
              { title: "Đang chạy", href: "/app/team-leader/projects", exact: true },
              { title: "Hoàn thành", href: "/app/team-leader/projects/completed" },
            ], { activePaths: ["/app/team-leader/projects"] }),
            mod("Công việc", ListTodo, [
              { title: "Danh sách", href: "/app/team-leader/tasks" },
              { title: "Kanban", href: "/app/team-leader/kanban" },
              { title: "Lịch", href: "/app/team-leader/calendar" },
            ]),
            mod("Đội nhóm", Users, [
              { title: "Thành viên", href: "/app/team-leader/teams" },
              { title: "Chấm công phòng", href: "/app/team-leader/attendance" },
            ]),
            { title: "Khách hàng", href: "/app/team-leader/clients", icon: Building2 },
            mod("Tài liệu & Báo cáo", FileText, [
              { title: "Báo cáo", href: "/app/team-leader/reports" },
              { title: "Tài liệu PGS", href: "/app/team-leader/documents" },
            ]),
          ],
        },
        { groupTitle: "Của tôi", items: [mod("Chấm công & Nghỉ phép", Clock, MY_WORK_TABS)] },
      ];

    case "employee":
      return [
        {
          items: [
            { title: "Hôm nay", href: "/app/employee", icon: LayoutDashboard, exact: true },
            mod("Công việc", ListTodo, [
              { title: "Việc của tôi", href: "/app/employee/tasks" },
              { title: "Báo cáo công việc", href: "/app/employee/reports" },
            ]),
            mod("Dự án", FolderKanban, [
              { title: "Đang tham gia", href: "/app/employee/projects", exact: true },
              { title: "Hoàn thành", href: "/app/employee/projects/completed" },
            ], { activePaths: ["/app/employee/projects"] }),
            mod("Chấm công & Đơn từ", Clock, [
              ...MY_WORK_TABS,
              { title: "Phiếu lương", href: "/app/employee/payroll" },
            ]),
            { title: "Lịch", href: "/app/employee/calendar", icon: CalendarDays },
            { title: "Tài liệu", href: "/app/employee/documents", icon: BookOpen },
          ],
        },
      ];

    case "accountant":
      return [
        {
          items: [
            { title: "Tổng quan", href: "/app/accountant", icon: LayoutDashboard, exact: true },
            mod("Khách hàng & Hợp đồng", Building2, [
              { title: "Khách hàng", href: "/app/accountant/clients" },
              { title: "Hợp đồng", href: "/app/accountant/finance/contracts" },
              { title: "Hóa đơn", href: "/app/accountant/finance/invoices" },
            ]),
            mod("Thu tiền & Công nợ", Receipt, [
              { title: "Thanh toán", href: "/app/accountant/finance/payments" },
              { title: "Công nợ", href: "/app/accountant/finance/debts" },
            ]),
            mod("Thu chi & Chứng từ", Wallet, [
              { title: "Thu chi", href: "/app/accountant/finance/cashflow" },
              { title: "Chi phí dự án", href: "/app/accountant/finance/project-expenses" },
              { title: "Chứng từ", href: "/app/accountant/vouchers" },
            ], { activePaths: ["/app/accountant/finance/cashflow", "/app/accountant/finance/project-expenses", "/app/accountant/vouchers", "/app/accountant/finance"] }),
            mod("Bảng công & Lương", Clock, [
              { title: "Bảng lương", href: "/app/accountant/payroll" },
              { title: "Chấm công nhân sự", href: "/app/accountant/attendance" },
            ]),
            { title: "Báo cáo", href: "/app/accountant/reports", icon: TrendingUp },
          ],
        },
        { groupTitle: "Của tôi", items: [mod("Chấm công & Nghỉ phép", UserRound, MY_WORK_TABS)] },
      ];

    case "client":
      return [
        {
          items: [
            { title: "Tổng quan", href: "/app/client", icon: LayoutDashboard, exact: true },
            mod("Dự án", FolderKanban, [
              { title: "Đang triển khai", href: "/app/client/projects", exact: true },
              { title: "Hoàn thành", href: "/app/client/projects/completed" },
              { title: "Lịch họp", href: "/app/client/meetings" },
            ], { activePaths: ["/app/client/projects", "/app/client/meetings"] }),
            { title: "Sản phẩm cần phản hồi", href: "/app/client/approvals", icon: PackageCheck },
            { title: "Tài liệu bàn giao", href: "/app/client/documents", icon: FolderOpen },
            mod("Hợp đồng & Thanh toán", Receipt, [
              { title: "Hợp đồng", href: "/app/client/contracts" },
              { title: "Hóa đơn", href: "/app/client/invoices" },
              { title: "Thanh toán", href: "/app/client/payments" },
            ]),
            { title: "Hỗ trợ", href: "/app/client/support", icon: HelpCircle },
          ],
        },
      ];

    default:
      return [];
  }
}

/** Tìm module đang mở theo pathname để hiển thị tab. Trả null nếu module không có tab. */
export function getActiveModuleTabs(role: AppRole, pathname: string): { module: string; tabs: NavTab[] } | null {
  for (const g of getNavigationForRole(role)) {
    for (const it of g.items) {
      if (!it.tabs || it.tabs.length < 2) continue;
      const hit = it.tabs.some((t) => pathname === t.href || (!t.exact && pathname.startsWith(t.href + "/")))
        || (it.activePaths || []).some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (hit) return { module: it.title, tabs: it.tabs };
    }
  }
  return null;
}

/** Tab đang chọn: khớp dài nhất để /projects/completed không sáng tab /projects. */
export function getActiveTabHref(tabs: NavTab[], pathname: string): string | null {
  let best: NavTab | null = null;
  for (const t of tabs) {
    const ok = pathname === t.href || (!t.exact && pathname.startsWith(t.href + "/"));
    if (ok && (!best || t.href.length > best.href.length)) best = t;
  }
  return best ? best.href : null;
}
