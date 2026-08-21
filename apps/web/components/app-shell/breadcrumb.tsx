"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_NAME_MAP: Record<string, string> = {
  app: "PGS Hub",
  admin: "Quản trị",
  accounts: "Tài khoản",
  pending: "Chờ phê duyệt",
  people: "Nhân sự",
  departments: "Phòng ban",
  teams: "Team",
  clients: "Khách hàng",
  projects: "Dự án",
  attendance: "Chấm công",
  leave: "Nghỉ phép",
  finance: "Tài chính",
  contracts: "Hợp đồng",
  invoices: "Hóa đơn",
  chat: "Tin nhắn",
  notifications: "Thông báo",
  automation: "Tự động hóa",
  profile: "Hồ sơ cá nhân",
  "team-leader": "Trưởng nhóm",
  employee: "Nhân viên",
  accountant: "Kế toán",
  client: "Khách hàng",
  board: "Kanban Board",
  calendar: "Lịch biểu",
  files: "Tệp tin",
  tasks: "Công việc",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold text-[#8E8E93]">
        <Home className="w-3.5 h-3.5 text-[#FFC400]" />
        <span>PGS Hub</span>
      </div>
    );
  }

  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const isLast = idx === segments.length - 1;
    const isId = /^[0-9a-f-]{10,}$/i.test(seg) || /^[A-Z0-9_-]{4,}$/i.test(seg);
    const title = isId ? "Chi tiết" : ROUTE_NAME_MAP[seg] || seg;

    return {
      title,
      href,
      isLast,
    };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-[#8E8E93] overflow-x-auto whitespace-nowrap scrollbar-none"
    >
      <Link
        href="/app"
        className="flex items-center gap-1 hover:text-white transition-colors"
      >
        <Home className="w-3.5 h-3.5 text-[#FFC400]" />
      </Link>

      {crumbs.slice(1).map((crumb, i) => (
        <React.Fragment key={crumb.href + i}>
          <ChevronRight className="w-3 h-3 text-[#48484A] shrink-0" />
          {crumb.isLast ? (
            <span className="font-bold text-white tracking-wide truncate max-w-[180px]">
              {crumb.title}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-white transition-colors truncate max-w-[140px]"
            >
              {crumb.title}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
