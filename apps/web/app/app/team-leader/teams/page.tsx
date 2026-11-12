"use client";

import React, { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { peopleApi } from "@/lib/api/people";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { statusLabel } from "@/lib/labels";
import { ROLE_LABELS } from "@/components/app-shell/role-navigation";
import type { AppRole } from "@/lib/api/auth";

interface TeamMember {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: AppRole | null;
  employeeCode: string;
  jobTitle: string | null;
  employmentStatus: string;
}

/** Thành viên phòng của Trưởng phòng — dùng /team/members (không gọi API riêng của Quản trị viên). */
export default function TeamLeaderTeamsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    peopleApi
      .getTeamMembers()
      .then((res) => setMembers(Array.isArray(res) ? res : []))
      .catch(() => setError("Không tải được danh sách thành viên. Vui lòng thử lại."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <SectionHeader title="Thành viên trong phòng" description="Người thuộc phòng bạn quản lý. Thêm người vào dự án ở trang chi tiết dự án." badge={loading ? undefined : `${members.length} người`} />

      {error && <div role="alert" className="rounded-lg border border-[#FECDCA] bg-[#FEF3F2] text-[#B42318] text-sm px-4 py-3">{error}</div>}

      {!loading && !error && members.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState icon={<Users className="w-10 h-10 text-[#64748B]" />} title="Phòng chưa có thành viên" description="Liên hệ Quản trị viên để gán nhân sự vào phòng của bạn." />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E7E9F0] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FBFBFD] text-xs text-[#64748B] text-left border-b border-[#E7E9F0]">
                <th className="px-4 py-2.5 font-medium">Thành viên</th>
                <th className="px-4 py-2.5 font-medium">Mã</th>
                <th className="px-4 py-2.5 font-medium">Vai trò</th>
                <th className="px-4 py-2.5 font-medium">Chức danh</th>
                <th className="px-4 py-2.5 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E9F0]">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[#64748B]">Đang tải…</td></tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F8F9FC]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={m.avatarUrl} name={m.fullName || m.email || "?"} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-[#202333] truncate">{m.fullName || "Chưa có tên"}</p>
                          <p className="text-xs text-[#64748B] truncate">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[#475569] tabular-nums whitespace-nowrap">{m.employeeCode}</td>
                    <td className="px-4 py-2.5 text-[#475569] whitespace-nowrap">{m.role ? ROLE_LABELS[m.role] : "—"}</td>
                    <td className="px-4 py-2.5 text-[#475569]">{m.jobTitle || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={m.employmentStatus === "active" ? "success" : "default"} size="sm">{statusLabel(m.employmentStatus)}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
