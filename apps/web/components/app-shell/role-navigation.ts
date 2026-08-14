import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  Clock,
  CalendarDays,
  CreditCard,
  MessageSquare,
  Bell,
  Bot,
  UserCheck,
  Briefcase,
  Layers,
  Network,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/api/auth";

export interface NavItem {
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

export function getNavigationForRole(role: AppRole): NavGroup[] {
  switch (role) {
    case "admin":
      return [
        {
          items: [
            {
              title: "Bảng điều khiển",
              href: "/app/admin",
              icon: LayoutDashboard,
              exact: true,
            },
            {
              title: "Duyệt tài khoản",
              href: "/app/admin/accounts/pending",
              icon: UserCheck,
            },
          ],
        },
        {
          groupTitle: "Tổ chức & Nhân sự",
          items: [
            {
              title: "Cơ cấu tổ chức",
              href: "/app/admin/organization",
              icon: Network,
            },
            { title: "Nhân sự", href: "/app/admin/people", icon: Users },
            {
              title: "Phòng ban",
              href: "/app/admin/departments",
              icon: Building2,
            },
            { title: "Team", href: "/app/admin/teams", icon: Layers },
            {
              title: "Khách hàng",
              href: "/app/admin/clients",
              icon: Briefcase,
            },
          ],
        },
        {
          groupTitle: "Vận hành & Nghiệp vụ",
          items: [
            { title: "Dự án", href: "/app/admin/projects", icon: FolderKanban },
            {
              title: "Dịch vụ",
              href: "/app/admin/services",
              icon: Package,
            },
            { title: "Chấm công", href: "/app/admin/attendance", icon: Clock },
            {
              title: "Nghỉ phép",
              href: "/app/admin/leave",
              icon: CalendarDays,
            },
            {
              title: "Tài chính",
              href: "/app/admin/finance",
              icon: CreditCard,
            },
          ],
        },
        {
          groupTitle: "Giao tiếp & Tự động hóa",
          items: [
            {
              title: "Tin nhắn (Chat)",
              href: "/app/chat",
              icon: MessageSquare,
            },
            { title: "Thông báo", href: "/app/notifications", icon: Bell },
            { title: "Tự động hóa", href: "/app/admin/automation", icon: Bot },
          ],
        },
      ];

    case "team_leader":
      return [
        {
          items: [
            {
              title: "Tổng quan",
              href: "/app/team-leader",
              icon: LayoutDashboard,
              exact: true,
            },
            {
              title: "Dự án & Board",
              href: "/app/projects",
              icon: FolderKanban,
            },
          ],
        },
        {
          groupTitle: "Vận hành nhóm",
          items: [
            { title: "Chấm công", href: "/app/attendance", icon: Clock },
            { title: "Nghỉ phép", href: "/app/leave", icon: CalendarDays },
          ],
        },
        {
          groupTitle: "Giao tiếp",
          items: [
            {
              title: "Tin nhắn (Chat)",
              href: "/app/chat",
              icon: MessageSquare,
            },
            { title: "Thông báo", href: "/app/notifications", icon: Bell },
          ],
        },
      ];

    case "employee":
      return [
        {
          items: [
            {
              title: "Tổng quan cá nhân",
              href: "/app/employee",
              icon: LayoutDashboard,
              exact: true,
            },
            {
              title: "Dự án của tôi",
              href: "/app/projects",
              icon: FolderKanban,
            },
          ],
        },
        {
          groupTitle: "Chấm công & Nghỉ phép",
          items: [
            { title: "Chấm công GPS", href: "/app/attendance", icon: Clock },
            { title: "Nghỉ phép", href: "/app/leave", icon: CalendarDays },
          ],
        },
        {
          groupTitle: "Giao tiếp",
          items: [
            {
              title: "Tin nhắn (Chat)",
              href: "/app/chat",
              icon: MessageSquare,
            },
            { title: "Thông báo", href: "/app/notifications", icon: Bell },
          ],
        },
      ];

    case "accountant":
      return [
        {
          items: [
            {
              title: "Tổng quan tài chính",
              href: "/app/accountant",
              icon: LayoutDashboard,
              exact: true,
            },
            {
              title: "Hợp đồng dịch vụ",
              href: "/app/accountant/finance/contracts",
              icon: CreditCard,
            },
            {
              title: "Hóa đơn & Thanh toán",
              href: "/app/accountant/finance/invoices",
              icon: Briefcase,
            },
          ],
        },
        {
          groupTitle: "Dự án & Giao tiếp",
          items: [
            { title: "Dự án", href: "/app/projects", icon: FolderKanban },
            {
              title: "Tin nhắn (Chat)",
              href: "/app/chat",
              icon: MessageSquare,
            },
            { title: "Thông báo", href: "/app/notifications", icon: Bell },
          ],
        },
      ];

    case "client":
      return [
        {
          items: [
            {
              title: "Cổng thông tin",
              href: "/app/client",
              icon: LayoutDashboard,
              exact: true,
            },
            {
              title: "Dự án hợp tác",
              href: "/app/client/projects",
              icon: FolderKanban,
            },
            {
              title: "Hợp đồng dịch vụ",
              href: "/app/client/contracts",
              icon: CreditCard,
            },
            { title: "Hóa đơn", href: "/app/client/invoices", icon: Briefcase },
          ],
        },
        {
          groupTitle: "Liên lạc",
          items: [
            { title: "Chat dự án", href: "/app/chat", icon: MessageSquare },
            { title: "Thông báo", href: "/app/notifications", icon: Bell },
          ],
        },
      ];

    default:
      return [];
  }
}
