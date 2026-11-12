"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList, FolderPlus, Inbox, ListPlus } from "lucide-react";
import { getMe, type UserPayload } from "@/lib/api/auth";
import { teamLeaderDashboardApi, type TeamLeaderDashboardData } from "@/lib/api/team-leader-dashboard";
import { initials, shortDate } from "@/components/dashboard/figma-widgets";

/** Trạng thái hiện diện: màu theo ngữ nghĩa (không dùng tím thương hiệu cho cảnh báo). */
const PRESENCE: Record<string, { dot: string; label: string }> = {
  present: { dot: "bg-[#067647]", label: "Có mặt" },
  late: { dot: "bg-[#DC6803]", label: "Đi muộn" },
  leave: { dot: "bg-[#64748B]", label: "Nghỉ phép" },
  none: { dot: "bg-[#D92D20]", label: "Chưa chấm công" },
};

function Metric({ label, value, sub, href, tone = "default" }: { label: string; value: string; sub: string; href: string; tone?: "default" | "danger" | "warning" }) {
  const color = tone === "danger" ? "text-[#B42318]" : tone === "warning" ? "text-[#B54708]" : "text-[#202333]";
  return (
    <Link href={href} className="group rounded-xl border border-[#E7E9F0] bg-white px-4 py-3 hover:border-[#DDD5FF] hover:bg-[#FBFBFD] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257F5]">
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[#64748B] truncate">{sub}</p>
    </Link>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[#E7E9F0] bg-white ${className}`}>
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E7E9F0]">
        <h2 className="text-sm font-semibold text-[#202333]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-[#64748B]">{text}</p>;
}

export default function TeamLeaderDashboardPage() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [data, setData] = useState<TeamLeaderDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [me, dash] = await Promise.allSettled([getMe(), teamLeaderDashboardApi.get()]);
      if (!alive) return;
      if (me.status === "fulfilled") setUser(me.value.user);
      if (dash.status === "fulfilled") setData(dash.value);
      else setError("Không tải được số liệu của đội. Vui lòng thử lại.");
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const name = user?.fullName || user?.email?.split("@")[0] || "Trưởng phòng";
  const k = data?.kpi;
  const t = data?.teamToday;
  const members = k?.members ?? 0;
  const maxOpen = Math.max(1, ...(data?.workload.map((w) => w.open) ?? [1]));
  const num = (v?: number) => (loading ? "…" : String(v ?? 0));
  const attentionTotal = data?.attention.reduce((s, a) => s + a.count, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-[#202333]">Chào {name}</h1>
          <p className="text-sm text-[#64748B] mt-1">
            {loading ? "Đang tải số liệu của đội…" : `${attentionTotal} mục cần bạn xử lý · ${k?.overdueTasks ?? 0} việc của đội đã quá hạn`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/app/team-leader/tasks?new=1" className="inline-flex items-center gap-2 h-11 sm:h-9 px-3.5 rounded-lg border border-[#DDDFEA] bg-white text-sm font-semibold text-[#202333] hover:bg-[#F8F9FC]">
            <ListPlus className="w-4 h-4" /> Giao việc
          </Link>
          <Link href="/app/team-leader/projects?create=1" className="inline-flex items-center gap-2 h-11 sm:h-9 px-3.5 rounded-lg bg-[#7257F5] hover:bg-[#6044E8] text-sm font-semibold text-white">
            <FolderPlus className="w-4 h-4" /> Tạo dự án
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-[#FECDCA] bg-[#FEF3F2] text-[#B42318] text-sm px-4 py-3">{error}</div>
      )}
      {data && !data.departmentId && (
        <div className="rounded-lg border border-[#FEDF89] bg-[#FFFAEB] text-[#B54708] text-sm px-4 py-3">
          Tài khoản của bạn chưa được gán vào phòng ban nên chưa có số liệu đội. Liên hệ Quản trị viên để được gán.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Cần tôi xử lý" value={num(attentionTotal)} sub={`${k?.pendingReview ?? 0} chờ duyệt · ${k?.pendingLeave ?? 0} đơn nghỉ`} href="/app/team-leader/approvals" tone={attentionTotal ? "warning" : "default"} />
        <Metric label="Việc quá hạn của đội" value={num(k?.overdueTasks)} sub={`${k?.overdueAssignees ?? 0} người bị ảnh hưởng`} href="/app/team-leader/tasks" tone={k?.overdueTasks ? "danger" : "default"} />
        <Metric label="Dự án đang chạy" value={num(k?.projects)} sub={`${k?.projectsAtRisk ?? 0} dự án trễ hạn`} href="/app/team-leader/projects" tone={k?.projectsAtRisk ? "danger" : "default"} />
        <Metric label="Có mặt hôm nay" value={loading ? "…" : `${k?.presentToday ?? 0}/${members}`} sub={`${k?.openTasks ?? 0} việc đang mở`} href="/app/team-leader/attendance" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          className="xl:col-span-2"
          title="Cần tôi xử lý"
          action={<Link href="/app/team-leader/approvals" className="text-sm font-medium text-[#5B3FD6] hover:underline">Mở hộp Cần xử lý</Link>}
        >
          {data && data.attention.length > 0 ? (
            <ul className="divide-y divide-[#E7E9F0]">
              {data.attention.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8F9FC] focus-visible:bg-[#F8F9FC] focus-visible:outline-none">
                    <span className="w-8 h-8 rounded-lg bg-[#F2EEFF] text-[#5B3FD6] grid place-items-center shrink-0">
                      <Inbox className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[#202333] truncate">{a.title}</span>
                      <span className="block text-xs text-[#64748B] truncate">{a.detail}</span>
                    </span>
                    <span className="min-w-7 h-6 px-2 rounded-full bg-[#FFFAEB] text-[#B54708] text-xs font-semibold grid place-items-center tabular-nums">{a.count}</span>
                    <ChevronRight className="w-4 h-4 text-[#94A3B8] shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow text={loading ? "Đang tải…" : "Không có mục nào cần bạn xử lý."} />
          )}
        </Panel>

        <Panel title="Đội hôm nay" action={t && members > 0 ? <span className="text-xs text-[#64748B]">{t.present}/{members} có mặt</span> : undefined}>
          {t && members > 0 ? (
            <ul className="divide-y divide-[#E7E9F0] max-h-[360px] overflow-y-auto">
              {t.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-8 h-8 rounded-full bg-[#F2EEFF] text-[#5B3FD6] text-xs font-semibold grid place-items-center shrink-0">{initials(m.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-[#202333] truncate">{m.name}</span>
                    <span className="block text-xs text-[#64748B] truncate">{m.note}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-[#475569] shrink-0">
                    <i className={`w-2 h-2 rounded-full ${PRESENCE[m.state]?.dot}`} />
                    {PRESENCE[m.state]?.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow text={loading ? "Đang tải…" : "Chưa có thành viên trong phòng ban."} />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          className="xl:col-span-2"
          title="Dự án của tôi"
          action={<Link href="/app/team-leader/projects" className="text-sm font-medium text-[#5B3FD6] hover:underline">Xem tất cả</Link>}
        >
          {data && data.projects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FBFBFD] text-xs text-[#64748B] text-left">
                    <th className="px-4 py-2 font-medium">Dự án</th>
                    <th className="px-4 py-2 font-medium w-48">Tiến độ</th>
                    <th className="px-4 py-2 font-medium w-28">Hạn</th>
                    <th className="px-4 py-2 font-medium w-28">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9F0]">
                  {data.projects.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F8F9FC]">
                      <td className="px-4 py-2.5 max-w-0">
                        <Link href={`/app/projects/${p.id}`} className="block min-w-0 focus-visible:outline-none focus-visible:underline">
                          <span className="block font-medium text-[#202333] truncate">{p.name}</span>
                          <span className="block text-xs text-[#64748B] truncate">{[p.code, p.client].filter(Boolean).join(" · ") || "—"}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex-1 h-1.5 rounded-full bg-[#F2F4F7] overflow-hidden">
                            <span style={{ width: `${p.progress}%` }} className={`block h-full ${p.late ? "bg-[#D92D20]" : "bg-[#7257F5]"}`} />
                          </span>
                          <span className="text-xs text-[#475569] tabular-nums w-9 text-right">{p.progress}%</span>
                        </div>
                      </td>
                      <td className={`px-4 py-2.5 text-sm tabular-nums ${p.late ? "text-[#B42318] font-medium" : "text-[#475569]"}`}>{shortDate(p.dueDate)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${p.late ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#F2EEFF] text-[#5B3FD6]"}`}>
                          <i className={`w-1.5 h-1.5 rounded-full ${p.late ? "bg-[#D92D20]" : "bg-[#7257F5]"}`} />
                          {p.late ? "Trễ hạn" : "Đang chạy"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyRow text={loading ? "Đang tải…" : "Chưa có dự án đang chạy."} />
          )}
        </Panel>

        <Panel title="Tải việc theo thành viên" action={<ClipboardList className="w-4 h-4 text-[#94A3B8]" />}>
          {data && data.workload.length > 0 ? (
            <ul className="px-4 py-3 space-y-3">
              {data.workload.map((w) => (
                <li key={w.userId}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#202333] truncate">{w.name}</span>
                    <span className="text-[#475569] tabular-nums shrink-0">
                      {w.open} việc{w.overdue > 0 && <b className="text-[#B42318] font-semibold"> · {w.overdue} quá hạn</b>}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#F2F4F7] overflow-hidden flex">
                    <span style={{ width: `${((w.open - w.overdue) / maxOpen) * 100}%` }} className="bg-[#7257F5]" />
                    <span style={{ width: `${(w.overdue / maxOpen) * 100}%` }} className="bg-[#D92D20]" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow text={loading ? "Đang tải…" : "Chưa có công việc được giao."} />
          )}
        </Panel>
      </div>
    </div>
  );
}
