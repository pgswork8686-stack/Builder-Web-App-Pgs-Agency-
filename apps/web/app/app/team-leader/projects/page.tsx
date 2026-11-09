"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, Search } from "lucide-react";
import { projectsApi, type Project } from "@/lib/api/projects";
import { SectionHeader } from "@/components/dashboard/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { shortDate } from "@/components/dashboard/figma-widgets";

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Đang chạy", cls: "bg-[#EEF2FF] border-[#E0EAFF] text-[#3B5BDB]" },
  draft: { label: "Mới", cls: "bg-[#FBF3DC] border-[#E8DDB8] text-[#475569]" },
  pending_approval: { label: "Chờ duyệt", cls: "bg-[#F3E8FF] border-[#E9D5FF] text-[#7356F1]" },
  on_hold: { label: "Tạm dừng", cls: "bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]" },
  completed: { label: "Hoàn thành", cls: "bg-[#E6FBF5] border-[#A7F3D0] text-[#047857]" },
  cancelled: { label: "Đã hủy", cls: "bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]" },
};
const PRIORITY: Record<string, string> = { low: "Thấp", medium: "Trung bình", high: "Cao", urgent: "Khẩn cấp" };

export default function TeamLeaderProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  useEffect(() => {
    projectsApi
      .getInternalProjects(1, 100)
      .then((res) => setProjects(res?.items || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return projects.filter(
      (p) =>
        (!status || p.status === status) &&
        (!priority || p.priority === priority) &&
        (!t || `${p.projectCode} ${p.name}`.toLowerCase().includes(t)),
    );
  }, [projects, q, status, priority]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dự án của tôi"
        description="Danh sách các dự án đang phụ trách quản lý, phân bổ nhân sự và theo dõi tiến độ."
        badge={`${projects.length} dự án`}
        badgeVariant="gold"
      />

      <div className="bg-white rounded-2xl border border-[#F2EAD3] p-4 grid gap-3 md:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã hoặc tên dự án…"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#FFFBF0] border border-[#E8DDB8] text-sm text-[#161827] placeholder:text-[#94A3B8] outline-none focus:bg-white focus:border-[#3B5BDB]"
          />
        </div>
        <Select aria-label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value)} className="!py-2.5">
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </Select>
        <Select aria-label="Mức ưu tiên" value={priority} onChange={(e) => setPriority(e.target.value)} className="!py-2.5">
          <option value="">Mọi mức ưu tiên</option>
          {Object.entries(PRIORITY).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </div>

      <section className="bg-white rounded-2xl border border-[#F2EAD3] p-6">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#161827] mb-2">
          <FolderKanban className="w-4 h-4 text-[#8A6400]" /> Dự án phụ trách
        </h2>
        {loading ? (
          <p className="py-10 text-center text-sm text-[#475569]">Đang tải dự án…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            title="Chưa có dự án nào"
            description="Khi được phân công làm Trưởng nhóm dự án, các dự án sẽ hiển thị tại đây."
          />
        ) : (
          <ul className="divide-y divide-[#F2EAD3]">
            {visible.map((p) => {
              const late = !!(p.dueDate && p.dueDate.slice(0, 10) < today && p.status === "active");
              const st = late ? { label: "Trễ hạn", cls: "bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]" } : STATUS[p.status] ?? STATUS.draft;
              return (
                <li key={p.id}>
                  <Link href={`/app/projects/${p.id}`} className="flex items-center gap-4 py-4 group">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#161827] truncate group-hover:text-[#8A6400]">
                        <span className="font-mono text-[12px] text-[#8A6400] mr-2">{p.projectCode}</span>
                        {p.name}
                      </span>
                      <span className="block text-[11px] text-[#475569] mt-0.5">
                        Khách: {p.clientCompany?.name || "Chưa liên kết"}
                        {Array.isArray(p.members) ? ` · ${p.members.length} thành viên` : ""}
                      </span>
                    </span>
                    <span className="w-44 shrink-0 text-right text-[11px]">
                      <span className={late ? "text-[#B91C1C] font-bold" : "text-[#64748B]"}>
                        Hạn {shortDate(p.dueDate ? p.dueDate.slice(0, 10) : null)}
                      </span>
                    </span>
                    <span className={`px-3 py-1 rounded-full border text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
