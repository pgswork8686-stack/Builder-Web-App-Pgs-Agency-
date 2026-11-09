"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  Clock,
  FolderKanban,
  ListChecks,
  TriangleAlert,
  X,
} from "lucide-react";
import { getMe, type UserPayload } from "@/lib/api/auth";
import {
  employeeDashboardApi,
  type EmployeeDashboardData,
} from "@/lib/api/employee-dashboard";
import {
  Empty,
  Kpi,
  SeeAll,
  Widget,
  shortDate,
} from "@/components/dashboard/figma-widgets";

const STATUS: Record<string, { label: string; cls: string }> = {
  todo: { label: "Cần làm", cls: "bg-[#EEF2FF] text-[#3B5BDB]" },
  in_progress: { label: "Đang làm", cls: "bg-[#EEF2FF] text-[#3B5BDB]" },
  review: { label: "Chờ duyệt", cls: "bg-[#F3E8FF] text-[#7356F1]" },
};

export default function EmployeeDashboardPage() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [data, setData] = useState<EmployeeDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideAlert, setHideAlert] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [me, dash] = await Promise.allSettled([
        getMe(),
        employeeDashboardApi.get(),
      ]);
      if (!alive) return;
      if (me.status === "fulfilled") setUser(me.value.user);
      if (dash.status === "fulfilled") setData(dash.value);
      else setError("Không tải được dữ liệu của bạn. Vui lòng thử lại.");
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const name = user?.fullName || user?.email?.split("@")[0] || "bạn";
  const k = data?.kpi;
  const n = (v?: number) => (loading ? "…" : String(v ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#F2EAD3]">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-[#161827] tracking-tight">
            Chào {name}
          </h1>
          <p className="text-sm text-[#475569] mt-1">
            Việc của bạn hôm nay, lịch làm việc và các thông báo mới.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/leave"
            className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-white border border-[#E8DDB8] text-xs font-bold text-[#161827] hover:bg-[#FFF8E5]"
          >
            Xin nghỉ phép
          </Link>
          <Link
            href="/app/attendance"
            className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-[#E7AE18] hover:bg-[#CC9410] text-xs font-bold text-[#161827]"
          >
            Chấm công
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-sm px-4 py-3">
          {error}
        </div>
      )}

      {data?.alert && !hideAlert && (
        <div className="relative rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 flex gap-3.5">
          <TriangleAlert className="w-5 h-5 text-[#92400E] mt-0.5 shrink-0" />
          <div className="pr-6">
            <p className="text-sm font-bold text-[#92400E]">{data.alert.title}</p>
            <p className="text-xs text-[#475569] mt-1">{data.alert.detail}</p>
          </div>
          <button type="button" aria-label="Đóng" onClick={() => setHideAlert(true)} className="absolute top-3 right-3 text-[#475569] hover:text-[#161827]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi label="Việc hôm nay" value={n(k?.todayTasks)} sub={`${k?.inProgress ?? 0} đang làm`} icon={<ListChecks className="w-4 h-4" />} bg="#EEF2FF" border="#E0EAFF" />
        <Kpi label="Quá hạn" value={n(k?.overdue)} sub="cần xử lý ngay" icon={<TriangleAlert className="w-4 h-4" />} bg="#FEE2E2" border="#FECACA" />
        <Kpi label="Chờ duyệt" value={n(k?.inReview)} sub="đã nộp kết quả" icon={<Clock className="w-4 h-4" />} bg="#F3E8FF" border="#E9D5FF" />
        <Kpi label="Quỹ phép" value={loading ? "…" : `${k?.leaveRemaining ?? 0} ngày`} sub={`${k?.pendingLeave ?? 0} đơn chờ duyệt`} icon={<CalendarDays className="w-4 h-4" />} bg="#E6FBF5" border="#A7F3D0" />
        <Kpi label="Công tháng" value={loading ? "…" : `${k?.presentDays ?? 0}/${k?.workingDays ?? 0}`} sub="ngày công" icon={<CircleCheck className="w-4 h-4" />} bg="#FFFFFF" border="#F2EAD3" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Widget
          className="lg:col-span-3"
          title="Việc cần xử lý gấp"
          icon={<ListChecks className="w-4 h-4" />}
          action={<SeeAll href="/app/employee/tasks" label="Công việc của tôi" />}
        >
          {data && data.urgent.length > 0 ? (
            <ul className="divide-y divide-[#F2EAD3]">
              {data.urgent.map((t) => {
                const st = STATUS[t.status] ?? STATUS.todo;
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#161827] truncate">{t.title}</span>
                      <span className="block text-xs text-[#475569] truncate">
                        {t.project ?? "—"} · {t.overdue ? `quá hạn ${t.daysLate} ngày` : `hạn ${shortDate(t.dueDate)}`}
                      </span>
                    </span>
                    <span className={`text-xs ${t.overdue ? "text-[#B91C1C]" : "text-[#475569]"}`}>
                      {t.overdue ? "Quá hạn" : `Hạn ${shortDate(t.dueDate)}`}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-bold ${t.overdue ? "bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]" : `${st.cls} border-transparent`}`}>
                      {t.overdue ? "Quá hạn" : st.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty text="Bạn không có việc nào đang mở" />
          )}
        </Widget>

        <Widget
          className="lg:col-span-2"
          title="Thông báo mới"
          icon={<Bell className="w-4 h-4" />}
          action={
            data && data.notifications.unread > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-bold">
                {data.notifications.unread}
              </span>
            ) : undefined
          }
        >
          {data && data.notifications.items.length > 0 ? (
            <ul className="divide-y divide-[#F2EAD3]">
              {data.notifications.items.map((x) => (
                <li key={x.id}>
                  <Link href={x.href || "/app/notifications"} className="flex gap-3 py-3 hover:bg-[#FFFBF0] rounded-xl">
                    <span className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#3B5BDB] grid place-items-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm text-[#161827] truncate ${x.read ? "font-medium" : "font-bold"}`}>{x.title}</span>
                      <span className="block text-xs text-[#475569] truncate">{x.message}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Chưa có thông báo" />
          )}
        </Widget>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Widget
          className="lg:col-span-3"
          title="Dự án tham gia"
          icon={<FolderKanban className="w-4 h-4" />}
          action={<SeeAll href="/app/employee/projects" label="Xem tất cả" />}
        >
          {data && data.projects.length > 0 ? (
            <ul className="divide-y divide-[#F2EAD3]">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/app/projects/${p.id}`} className="flex items-center gap-4 py-3 group">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#161827] truncate group-hover:text-[#8A6400]">
                        <span className="font-mono text-xs text-[#8A6400] mr-2">{p.code}</span>
                        {p.name}
                      </span>
                      <span className="block text-xs text-[#475569]">Vai trò: {p.role === "project_manager" ? "quản lý dự án" : "thành viên"}</span>
                    </span>
                    <span className="w-36 shrink-0">
                      <span className="flex justify-between text-xs mb-1">
                        <b className="text-[#161827]">{p.progress}%</b>
                        <span className={p.late ? "text-[#B91C1C] font-bold" : "text-[#475569]"}>Hạn {shortDate(p.dueDate)}</span>
                      </span>
                      <span className="block h-2 rounded-full bg-[#FBF3DC] overflow-hidden">
                        <span style={{ width: `${p.progress}%` }} className={`block h-full ${p.late ? "bg-[#FF785A]" : "bg-[#E7AE18]"}`} />
                      </span>
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.late ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#EEF2FF] text-[#3B5BDB]"}`}>
                      {p.late ? "Trễ hạn" : "Đang chạy"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Bạn chưa tham gia dự án nào" />
          )}
        </Widget>

        <Widget
          className="lg:col-span-2"
          title="Lịch tuần này"
          icon={<CalendarCheck className="w-4 h-4" />}
          action={<SeeAll href="/app/employee/calendar" label="Mở lịch" />}
        >
          {data && data.schedule.length > 0 ? (
            <ul className="space-y-2.5">
              {data.schedule.map((s, i) => (
                <li key={i} className="flex items-center gap-3 text-xs">
                  <span className={`shrink-0 px-2 py-0.5 rounded-full border font-bold ${s.date === data.today ? "bg-[#E6FBF5] border-[#A7F3D0] text-[#047857]" : "bg-[#FFF8E5] border-[#FDE68A] text-[#8A6400]"}`}>
                    {s.date === data.today ? "Hôm nay" : shortDate(s.date)}
                  </span>
                  <span className="text-[#161827] truncate">{s.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Không có lịch trong tuần này" />
          )}
        </Widget>
      </div>
    </div>
  );
}
