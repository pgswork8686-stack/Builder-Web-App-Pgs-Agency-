import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  CheckCircle2,
  ListTodo,
  Kanban,
  Calendar,
  CreditCard,
  FileText,
  FileSpreadsheet,
  Settings,
  UserCheck,
  Briefcase,
  Layers,
  Clock,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Receipt,
  HelpCircle,
  FolderOpen,
  MessageSquare,
  Bell,
  Cpu,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/api/auth";

export interface NavItem {
  index?: string;
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
}

export interface NavGroup {
  groupTitle?: string;
  items: NavItem[];
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Quản trị viên (Admin)",
  team_leader: "Trưởng nhóm (Team Leader)",
  employee: "Nhân viên (Employee)",
  accountant: "Kế toán (Accountant)",
  client: "Khách hàng (Client)",
};

export const ROLE_HEADER_SUBTITLE: Record<AppRole, string> = {
  admin: "Agency Workspace",
  team_leader: "Manager Workspace",
  employee: "Nhân viên",
  accountant: "Kế toán",
  client: "Khách hàng",
};

export function getNavigationForRole(role: AppRole): NavGroup[] {
  switch (role) {
    case "admin":
      return [
        {
          groupTitle: "TỔNG QUAN",
          items: [
            {
              index: "01",
              title: "Dashboard",
              href: "/app/admin",
              icon: LayoutDashboard,
              exact: true,
            },
          ],
        },
        {
          groupTitle: "TỔ CHỨC",
          items: [
            {
              index: "02",
              title: "Cơ cấu tổ chức",
              href: "/app/admin/organization",
              icon: Building2,
            },
            {
              index: "03",
              title: "Phòng ban",
              href: "/app/admin/departments",
              icon: Layers,
            },
            {
              index: "04",
              title: "Teams",
              href: "/app/admin/teams",
              icon: Users,
            },
            {
              index: "05",
              title: "Nhân sự",
              href: "/app/admin/people",
              icon: Users,
            },
            {
              index: "06",
              title: "Tài khoản chờ duyệt",
              href: "/app/admin/accounts/pending",
              icon: UserCheck,
            },
          ],
        },
        {
          groupTitle: "KHÁCH HÀNG & DỰ ÁN",
          items: [
            {
              index: "07",
              title: "Khách hàng",
              href: "/app/admin/clients",
              icon: Briefcase,
            },
            {
              index: "08",
              title: "Dự án",
              href: "/app/admin/projects",
              icon: FolderKanban,
              exact: true,
            },
            {
              index: "09",
              title: "Dịch vụ",
              href: "/app/admin/services",
              icon: Shield,
            },
            {
              index: "10",
              title: "Công việc",
              href: "/app/admin/tasks",
              icon: ListTodo,
            },
            {
              index: "11",
              title: "Kanban",
              href: "/app/admin/kanban",
              icon: Kanban,
            },
            {
              index: "12",
              title: "Lịch",
              href: "/app/admin/calendar",
              icon: Calendar,
            },
            {
              index: "13",
              title: "Tài liệu PGS",
              href: "/app/admin/documents",
              icon: FolderOpen,
            },
          ],
        },
        {
          groupTitle: "NHÂN SỰ & CHẤM CÔNG",
          items: [
            {
              index: "14",
              title: "Chấm công",
              href: "/app/admin/attendance",
              icon: Clock,
            },
            {
              index: "15",
              title: "Nghỉ phép",
              href: "/app/admin/leave",
              icon: CalendarDays,
            },
          ],
        },
        {
          groupTitle: "TÀI CHÍNH",
          items: [
            {
              index: "16",
              title: "Finance",
              href: "/app/admin/finance",
              icon: CreditCard,
            },
            {
              index: "17",
              title: "Báo cáo",
              href: "/app/admin/reports",
              icon: FileSpreadsheet,
            },
          ],
        },
        {
          groupTitle: "GIAO TIẾP",
          items: [
            {
              index: "18",
              title: "Tin nhắn (Chat)",
              href: "/app/chat",
              icon: MessageSquare,
            },
            {
              index: "19",
              title: "Thông báo",
              href: "/app/notifications",
              icon: Bell,
            },
          ],
        },
        {
          groupTitle: "HỆ THỐNG",
          items: [
            {
              index: "20",
              title: "Tự động hóa",
              href: "/app/admin/automation",
              icon: Cpu,
            },
            {
              index: "21",
              title: "Cài đặt",
              href: "/app/admin/settings",
              icon: Settings,
            },
          ],
        },
      ];

    case "team_leader":
      return [
        {
          groupTitle: "KHÔNG GIAN LÀM VIỆC",
          items: [
            {
              index: "01",
              title: "Tổng quan",
              href: "/app/team-leader",
              icon: LayoutDashboard,
              exact: true,
            },
            {
              index: "02",
              title: "Dự án của tôi",
              href: "/app/team-leader/projects",
              icon: FolderKanban,
              exact: true,
            },
            {
              index: "03",
              title: "Dự án hoàn thành",
              href: "/app/team-leader/projects/completed",
              icon: CheckCircle2,
            },
            {
              index: "04",
              title: "Công việc",
              href: "/app/team-leader/tasks",
              icon: ListTodo,
            },
            {
              index: "05",
              title: "Kanban",
              href: "/app/team-leader/kanban",
              icon: Kanban,
            },
            {
              index: "06",
              title: "Lịch",
              href: "/app/team-leader/calendar",
              icon: Calendar,
            },
            {
              index: "07",
              title: "Đội nhóm",
              href: "/app/team-leader/teams",
              icon: Layers,
            },
            {
              index: "08",
              title: "Đơn cần duyệt",
              href: "/app/team-leader/approvals",
              icon: UserCheck,
            },
            {
              index: "09",
              title: "Tài liệu PGS",
              href: "/app/team-leader/documents",
              icon: FolderOpen,
            },
            {
              index: "10",
              title: "Báo cáo",
              href: "/app/team-leader/reports",
              icon: FileSpreadsheet,
            },
            {
              index: "11",
              title: "Chấm công",
              href: "/app/attendance",
              icon: Clock,
            },
            {
              index: "12",
              title: "Nghỉ phép",
              href: "/app/leave",
              icon: CalendarDays,
            },
          ],
        },
        {
          groupTitle: "GIAO TIẾP",
          items: [
            {
              index: "13",
              title: "Tin nhắn (Chat)",
              href: "/app/chat",
              icon: MessageSquare,
            },
            {
              index: "14",
              title: "Thông báo",
              href: "/app/notifications",
              icon: Bell,
            },
          ],
        },
      ];

    case "employee":
      return [
        {
          groupTitle: "KHÔNG GIAN LÀM VIỆC",
          items: [
            {
              index: "01",
              title: "Trang của tôi",
              href: "/app/employee",
              icon: LayoutDashboard,
              exact: true,
            },
            {
              index: "02",
              title: "Công việc",
              href: "/app/employee/tasks",
              icon: ListTodo,
            },
            {
              index: "03",
              title: "Dự án tham gia",
              href: "/app/employee/projects",
              icon: FolderKanban,
              exact: true,
            },
            {
              index: "04",
              title: "Dự án hoàn thành",
              href: "/app/employee/projects/completed",
              icon: CheckCircle2,
            },
            {
              index: "05",
              title: "Lịch",
              href: "/app/employee/calendar",
              icon: Calendar,
            },
            {
              index: "06",
              title: "Chấm công",
              href: "/app/attendance",
              icon: Clock,
            },
            {
              index: "07",
              title: "Nghỉ phép",
              href: "/app/leave",
              icon: CalendarDays,
            },
            {
              index: "08",
              title: "Báo cáo công việc",
              href: "/app/employee/reports",
              icon: FileText,
            },
            {
              index: "09",
              title: "Tài liệu PGS",
              href: "/app/employee/documents",
              icon: FolderOpen,
            },
            {
              index: "10",
              title: "Phiếu lương",
              href: "/app/employee/payroll",
              icon: DollarSign,
            },
          ],
        },
        {
          groupTitle: "GIAO TIẾP",
          items: [
            {
              index: "11",
              title: "Tin nhắn (Chat)",
              href: "/app/chat",
              icon: MessageSquare,
            },
            {
              index: "12",
              title: "Thông báo",
              href: "/app/notifications",
              icon: Bell,
            },
          ],
        },
      ];

    case "accountant":
      return [
        {
          groupTitle: "KHÔNG GIAN LÀM VIỆC",
          items: [
            {
              index: "01",
              title: "Tổng quan tài chính",
              href: "/app/accountant",
              icon: LayoutDashboard,
              exact: true,
            },
            {
              index: "02",
              title: "Khách hàng",
              href: "/app/accountant/clients",
              icon: Briefcase,
            },
            {
              index: "03",
              title: "Hợp đồng",
              href: "/app/accountant/finance/contracts",
              icon: FileText,
            },
            {
              index: "04",
              title: "Hóa đơn",
              href: "/app/accountant/finance/invoices",
              icon: Receipt,
            },
            {
              index: "05",
              title: "Thanh toán",
              href: "/app/accountant/finance/payments",
              icon: DollarSign,
            },
            {
              index: "06",
              title: "Công nợ",
              href: "/app/accountant/finance/debts",
              icon: TrendingUp,
            },
            {
              index: "07",
              title: "Thu chi",
              href: "/app/accountant/finance/cashflow",
              icon: CreditCard,
            },
            {
              index: "08",
              title: "Chi phí dự án",
              href: "/app/accountant/finance/project-expenses",
              icon: FolderKanban,
            },
            {
              index: "09",
              title: "Bảng lương",
              href: "/app/accountant/payroll",
              icon: FileSpreadsheet,
            },
            {
              index: "10",
              title: "Chứng từ",
              href: "/app/accountant/vouchers",
              icon: FolderOpen,
            },
            {
              index: "11",
              title: "Báo cáo",
              href: "/app/accountant/reports",
              icon: FileSpreadsheet,
            },
            {
              index: "12",
              title: "Chấm công",
              href: "/app/accountant/attendance",
              icon: Clock,
            },
          ],
        },
        {
          groupTitle: "GIAO TIẾP",
          items: [
            {
              index: "13",
              title: "Tin nhắn (Chat)",
              href: "/app/chat",
              icon: MessageSquare,
            },
            {
              index: "14",
              title: "Thông báo",
              href: "/app/notifications",
              icon: Bell,
            },
          ],
        },
      ];

    case "client":
      return [
        {
          groupTitle: "KHÔNG GIAN LÀM VIỆC",
          items: [
            {
              index: "01",
              title: "Tổng quan",
              href: "/app/client",
              icon: LayoutDashboard,
              exact: true,
            },
            {
              index: "02",
              title: "Dự án đang triển khai",
              href: "/app/client/projects",
              icon: FolderKanban,
              exact: true,
            },
            {
              index: "03",
              title: "Dự án hoàn thành",
              href: "/app/client/projects/completed",
              icon: CheckCircle2,
            },
            {
              index: "04",
              title: "Sản phẩm chờ duyệt",
              href: "/app/client/approvals",
              icon: UserCheck,
            },
            {
              index: "05",
              title: "Tài liệu bàn giao",
              href: "/app/client/documents",
              icon: FolderOpen,
            },
            {
              index: "06",
              title: "Lịch họp",
              href: "/app/client/meetings",
              icon: Calendar,
            },
            {
              index: "07",
              title: "Hợp đồng",
              href: "/app/client/contracts",
              icon: FileText,
            },
            {
              index: "08",
              title: "Hóa đơn",
              href: "/app/client/invoices",
              icon: Receipt,
            },
            {
              index: "09",
              title: "Thanh toán",
              href: "/app/client/payments",
              icon: DollarSign,
            },
            {
              index: "10",
              title: "Yêu cầu hỗ trợ",
              href: "/app/client/support",
              icon: HelpCircle,
            },
          ],
        },
        {
          groupTitle: "GIAO TIẾP",
          items: [
            {
              index: "11",
              title: "Tin nhắn (Chat)",
              href: "/app/chat",
              icon: MessageSquare,
            },
            {
              index: "12",
              title: "Thông báo",
              href: "/app/notifications",
              icon: Bell,
            },
          ],
        },
      ];

    default:
      return [];
  }
}
