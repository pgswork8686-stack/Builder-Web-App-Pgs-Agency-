"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  ChevronRight,
  CircleAlert,
  FolderKanban,
  ListChecks,
  Users,
  UserCheck,
  Layers,
} from "lucide-react";
import { getMe, type UserPayload } from "@/lib/api/auth";
import {
  teamLeaderDashboardApi,
  type TeamLeaderDashboardData,
} from "@/lib/api/team-leader-dashboard";
import {
  Empty,
  Kpi,
  SeeAll,
  Widget,
  initials,
  shortDate,
} from "@/components/dashboard/figma-widgets";

const STATE_DOT: Record<string, string> = {
  present: "bg-[#00D09C]",
  late: "bg-[#FF9F24]",
  leave: "bg-[#6044E8]",
  none: "bg-[#FF785A]",
};

export default function TeamLeaderDashboardPage() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [data, setData] = useState<TeamLeaderDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [me, dash] = await Promise.allSettled([
        getMe(),
        teamLeaderDashboardApi.get(),
      ]);
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

  const name = user?.fullName || user?.email?.split("@")[0] || "Trưởng nhóm";
  const k = data?.kpi;
  const t = data?.teamToday;
  const members = k?.members ?? 0;
  const maxOpen = Math.max(1, ...(data?.workload.map((w) => w.open) ?? [1]));
  const num = (v?: number) => (loading ? "…" : String(v ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E7E9F0]">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-[#202333] tracking-tight">
            Chào {name}
          </h1>
          <p className="text-sm text-[#475569] mt-1">
            Theo dõi tiến độ dự án, đội nhóm và các nội dung đang chờ duyệt hôm
            nay.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/team-leader/kanban"
            className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-white border border-[#E7E9F0] text-xs font-bold text-[#202333] hover:bg-[#F2EEFF]"
          >
            Mở Kanban
          </Link>
          <Link
            href="/app/team-leader/tasks?new=1"
            className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-[#7257F5] hover:bg-[#6044E8] text-xs font-bold text-white"
          >
            Giao việc mới
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-sm px-4 py-3">
          {error}
        </div>
      )}
      {data && !data.departmentId && (
        <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] text-sm px-4 py-3">
          Tài khoản của bạn chưa được gán vào phòng ban nên chưa có số liệu đội. Liên hệ Admin để được gán.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi label="Dự án phụ trách" value={num(k?.projects)} sub={`${k?.projectsAtRisk ?? 0} dự án rủi ro`} icon={<FolderKanban className="w-4 h-4" />} bg="#FFFFFF" border="#E7E9F0" />
        <Kpi label="Việc đang mở" value={num(k?.openTasks)} sub="Công việc chưa hoàn thành" icon={<ListChecks className="w-4 h-4" />} bg="#F2EEFF" border="#E7E0FF" />
        <Kpi label="Quá hạn" value={num(k?.overdueTasks)} sub={`${k?.overdueAssignees ?? 0} người bị ảnh hưởng`} icon={<CircleAlert className="w-4 h-4" />} bg="#FEE2E2" border="#FECACA" />
        <Kpi label="Cần duyệt" value={num(k?.pendingReview)} sub={`${k?.pendingLeave ?? 0} đơn nghỉ phép`} icon={<UserCheck className="w-4 h-4" />} bg="#FEF9C3" border="#FEF08A" />
        <Kpi label="Thành viên" value={num(members)} sub={`${k?.presentToday ?? 0} có mặt hôm nay`} icon={<Users className="w-4 h-4" />} bg="#E6FBF5" border="#A7F3D0" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Widget
          className="lg:col-span-3"
          title="Cần xử lý hôm nay"
          icon={<Bell className="w-4 h-4" />}
          action={
            data && (
              <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-bold">
                {data.attention.length} mục
              </span>
            )
          }
        >
          {data && data.attention.length > 0 ? (
            <ul className="divide-y divide-[#E7E9F0]">
              {data.attention.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center gap-3 py-3 hover:bg-[#F8F9FC] rounded-xl px-1 -mx-1">
                    <span className="w-9 h-9 rounded-xl bg-[#F2EEFF] text-[#7257F5] grid place-items-center">
                      <ListChecks className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#202333] truncate">{a.title}</span>
                      <span className="block text-xs text-[#475569] truncate">{a.detail}</span>
                    </span>
                    <span className="min-w-7 h-6 px-2 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-bold grid place-items-center">
                      {a.count}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#64748B]" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Hiện không có mục nào cần xử lý" />
          )}
        </Widget>

        <Widget
          className="lg:col-span-2"
          title="Đội nhóm hôm nay"
          icon={<Users className="w-4 h-4" />}
          action={
            t && members > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-[#E6FBF5] text-[#047857] text-xs font-bold">
                {t.present}/{members} có mặt
              </span>
            ) : undefined
          }
        >
          {t && members > 0 ? (
            <>
              <div className="h-2.5 rounded-full bg-[#F4F2FD] overflow-hidden flex">
                <span style={{ width: `${((t.present - t.late) / members) * 100}%` }} className="bg-[#00D09C]" />
                <span style={{ width: `${(t.late / members) * 100}%` }} className="bg-[#7257F5]" />
                <span style={{ width: `${(t.onLeave / members) * 100}%` }} className="bg-[#6044E8]" />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#475569]">
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#00D09C]" />{t.present} có mặt</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#7257F5]" />{t.late} đi muộn</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#6044E8]" />{t.onLeave} nghỉ phép</span>
              </div>
              <ul className="space-y-2.5 mt-1">
                {t.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 pb-2.5 border-b border-[#E7E9F0] last:border-0">
                    <span className="w-9 h-9 rounded-full bg-[#F2EEFF] text-[#6044E8] text-xs font-bold grid place-items-center">{initials(m.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#202333] truncate">{m.name}</span>
                      <span className="block text-xs text-[#475569] truncate">{m.note}</span>
                    </span>
                    <i className={`w-2 h-2 rounded-full ${STATE_DOT[m.state]}`} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty text="Chưa có thành viên trong phòng ban" />
          )}
        </Widget>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Widget className="lg:col-span-2" title="Khối lượng theo thành viên" icon={<Layers className="w-4 h-4" />}>
          {data && data.workload.length > 0 ? (
            <ul className="space-y-3.5">
              {data.workload.map((w) => (
                <li key={w.userId}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#202333]">{w.name}</span>
                    <span className="text-[#475569]">
                      {w.open}
                      {w.overdue > 0 && <b className="text-[#B91C1C]"> · {w.overdue} quá hạn</b>}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#F4F2FD] overflow-hidden flex">
                    <span style={{ width: `${((w.open - w.overdue) / maxOpen) * 100}%` }} className="bg-[#7257F5]" />
                    <span style={{ width: `${(w.overdue / maxOpen) * 100}%` }} className="bg-[#FF785A]" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Chưa có công việc được giao" />
          )}
        </Widget>

        <Widget
          className="lg:col-span-3"
          title="Dự án của tôi"
          icon={<CalendarCheck className="w-4 h-4" />}
          action={<SeeAll href="/app/team-leader/projects" label="Xem tất cả" />}
        >
          {data && data.projects.length > 0 ? (
            <ul className="divide-y divide-[#E7E9F0]">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/app/projects/${p.id}`} className="flex items-center gap-4 py-3 group">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#202333] truncate group-hover:text-[#5B3FD6]">
                        <span className="font-mono text-xs text-[#5B3FD6] mr-2">{p.code}</span>
                        {p.name}
                      </span>
                      <span className="block text-xs text-[#475569]">Khách: {p.client ?? "—"}</span>
                    </span>
                    <span className="w-40 shrink-0">
                      <span className="flex justify-between text-xs mb-1">
                        <b className="text-[#202333]">{p.progress}%</b>
                        <span className={p.late ? "text-[#B91C1C] font-bold" : "text-[#475569]"}>Hạn {shortDate(p.dueDate)}</span>
                      </span>
                      <span className="block h-2 rounded-full bg-[#F4F2FD] overflow-hidden">
                        <span style={{ width: `${p.progress}%` }} className={`block h-full ${p.late ? "bg-[#FF785A]" : "bg-[#7257F5]"}`} />
                      </span>
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.late ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#F2EEFF] text-[#6044E8]"}`}>
                      {p.late ? "Trễ hạn" : "Đang chạy"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Chưa có dự án đang chạy" />
          )}
        </Widget>
      </div>
    </div>
  );
}
