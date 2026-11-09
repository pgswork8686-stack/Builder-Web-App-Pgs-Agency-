"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  FolderKanban,
  LifeBuoy,
  ListChecks,
  TrendingUp,
  TriangleAlert,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { getMe, type UserPayload } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api/client";
import { Widget, Kpi, Empty, SeeAll, initials, shortDate, compactVND, fullVND } from "@/components/dashboard/figma-widgets";
import {
  adminDashboardApi,
  type AdminDashboardData,
} from "@/lib/api/admin-dashboard";

/* ---------- helpers ---------- */
const WEEKDAYS = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

function greeting(hour: number) {
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}




function timeOf(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

const STATE_DOT: Record<string, string> = {
  present: "bg-[#00D09C]",
  late: "bg-[#FF9F24]",
  leave: "bg-[#3B5BDB]",
  none: "bg-[#FF785A]",
};

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  todo: { label: "Cần làm", cls: "bg-[#EEF2FF] text-[#3B5BDB]" },
  in_progress: { label: "Đang làm", cls: "bg-[#FEF3C7] text-[#92400E]" },
  review: { label: "Chờ duyệt", cls: "bg-[#F3E8FF] text-[#7356F1]" },
};


/* ---------- page ---------- */
export default function AdminDashboardPage() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideAttention, setHideAttention] = useState(false);
  const [hideHealth, setHideHealth] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [me, dash, health] = await Promise.allSettled([
        getMe(),
        adminDashboardApi.get(),
        fetch(`${API_BASE_URL}/health`).then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("health")),
        ),
      ]);
      if (!alive) return;
      if (me.status === "fulfilled") setUser(me.value.user);
      if (dash.status === "fulfilled") setData(dash.value);
      else setError("Không tải được số liệu tổng quan. Vui lòng thử lại.");
      setApiHealthy(health.status === "fulfilled" && health.value?.status === "ok");
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const userName =
    user?.fullName || user?.email?.split("@")[0] || "Quản trị viên";
  const hour = Number(
    new Date().toLocaleString("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    }),
  );

  const k = data?.kpi;
  const pendingAcc = k?.pending.accounts ?? 0;
  const staff = k?.staff;
  const maxRev = Math.max(1, ...(data?.revenue.months.map((m) => m.amount) ?? [1]));

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[30px] font-bold text-[#24304A] tracking-tight leading-tight">
            {greeting(hour)}, {userName}
          </h1>
          <p className="text-sm text-[#475569] mt-1">
            {data ? longDate(data.today) : "Đang tải"} · Tình hình vận hành PGS
            Agency hôm nay
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/admin/tasks"
            className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-white border border-[#F2EAD3] text-xs font-bold text-[#161827] hover:bg-[#FFF8E5]"
          >
            Giao việc
          </Link>
          <Link
            href="/app/admin/projects"
            className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-white border border-[#F2EAD3] text-xs font-bold text-[#161827] hover:bg-[#FFF8E5]"
          >
            Tạo dự án
          </Link>
          <Link
            href="/app/admin/accounts/pending"
            className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-[#F3BA2F] hover:bg-[#E7AE18] text-xs font-bold text-[#161827]"
          >
            Duyệt tài khoản ({pendingAcc})
          </Link>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-sm px-4 py-3"
        >
          {error}
        </div>
      )}

      {/* Alert strip */}
      {(!hideAttention || !hideHealth) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {!hideAttention && (
            <div
              className={`relative rounded-2xl border p-4 flex gap-3.5 ${
                (data?.attention.total ?? 0) > 0
                  ? "bg-[#FFFBEB] border-[#FDE68A]"
                  : "bg-[#ECFDF5] border-[#A7F3D0]"
              }`}
            >
              <span
                className={`mt-0.5 ${
                  (data?.attention.total ?? 0) > 0
                    ? "text-[#92400E]"
                    : "text-[#047857]"
                }`}
              >
                {(data?.attention.total ?? 0) > 0 ? (
                  <TriangleAlert className="w-5 h-5" />
                ) : (
                  <CircleCheck className="w-5 h-5" />
                )}
              </span>
              <div className="min-w-0 pr-6">
                <p className="text-sm font-bold text-[#161827]">
                  {(data?.attention.total ?? 0) > 0
                    ? `${data?.attention.total} mục cần xử lý trong hôm nay`
                    : "Không có mục nào cần xử lý hôm nay"}
                </p>
                <p className="text-xs text-[#475569] mt-1">
                  {(data?.attention.items ?? [])
                    .slice(0, 3)
                    .map((i) => i.detail)
                    .join(" · ") || "Mọi việc đang được xử lý đúng hạn."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => setHideAttention(true)}
                className="absolute top-3 right-3 text-[#475569] hover:text-[#161827]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {!hideHealth && (
            <div
              className={`relative rounded-2xl border p-4 flex gap-3.5 ${
                apiHealthy === false
                  ? "bg-[#FEE2E2] border-[#FECACA]"
                  : "bg-[#ECFDF5] border-[#A7F3D0]"
              }`}
            >
              <span
                className={`mt-0.5 ${apiHealthy === false ? "text-[#B91C1C]" : "text-[#047857]"}`}
              >
                {apiHealthy === false ? (
                  <TriangleAlert className="w-5 h-5" />
                ) : (
                  <CircleCheck className="w-5 h-5" />
                )}
              </span>
              <div className="min-w-0 pr-6">
                <p className="text-sm font-bold text-[#161827]">
                  {apiHealthy === false ? "Hệ thống gặp sự cố" : "Hệ thống ổn định"}
                </p>
                <p className="text-xs text-[#475569] mt-1">
                  {apiHealthy === false
                    ? "API không phản hồi. Vui lòng kiểm tra lại sau."
                    : "API phản hồi bình thường · đồng bộ realtime hoạt động."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => setHideHealth(true)}
                className="absolute top-3 right-3 text-[#475569] hover:text-[#161827]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi
          label="Dự án đang chạy"
          value={loading ? "…" : String(k?.activeProjects ?? 0)}
          sub={`${k?.overdueProjects ?? 0} dự án trễ hạn`}
          icon={<FolderKanban className="w-4 h-4" />}
          bg="#FFFFFF"
          border="#F2EAD3"
        />
        <Kpi
          label="Task quá hạn"
          value={loading ? "…" : String(k?.overdueTasks ?? 0)}
          sub="Công việc đang mở đã qua hạn"
          icon={<TriangleAlert className="w-4 h-4" />}
          bg="#FEE2E2"
          border="#FECACA"
        />
        <Kpi
          label="Chờ xử lý"
          value={loading ? "…" : String(k?.pendingTotal ?? 0)}
          sub={`${k?.pending.accounts ?? 0} tài khoản · ${k?.pending.leave ?? 0} nghỉ phép · ${k?.pending.expenses ?? 0} chi phí`}
          icon={<UserCheck className="w-4 h-4" />}
          bg="#FEF9C3"
          border="#FEF08A"
        />
        <Kpi
          label="Nhân sự có mặt"
          value={loading ? "…" : `${staff?.present ?? 0}/${staff?.total ?? 0}`}
          sub={`${staff?.late ?? 0} đi muộn · ${staff?.onLeave ?? 0} nghỉ phép`}
          icon={<Users className="w-4 h-4" />}
          bg="#E6FBF5"
          border="#A7F3D0"
        />
        <Kpi
          label="Phải thu quá hạn"
          value={loading ? "…" : compactVND(k?.receivable.overdueAmount ?? 0)}
          sub={`${k?.receivable.overdueInvoices ?? 0} hóa đơn quá hạn`}
          icon={<CircleDollarSign className="w-4 h-4" />}
          bg="#E0F7FE"
          border="#BAE6FD"
        />
        <Kpi
          label="Phiếu hỗ trợ mở"
          value={loading ? "…" : String(k?.tickets.open ?? 0)}
          sub={`${k?.tickets.waitingClient ?? 0} chờ khách phản hồi`}
          icon={<LifeBuoy className="w-4 h-4" />}
          bg="#F3E8FF"
          border="#E9D5FF"
        />
      </div>

      {/* Row A */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Widget
          className="lg:col-span-3"
          title="Cần xử lý hôm nay"
          icon={<TriangleAlert className="w-4 h-4" />}
          action={
            data && (
              <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-bold">
                {data.attention.items.length} mục
              </span>
            )
          }
        >
          {data && data.attention.items.length > 0 ? (
            <ul className="divide-y divide-[#F2EAD3]">
              {data.attention.items.map((i) => (
                <li key={i.key}>
                  <Link
                    href={i.href}
                    className="flex items-center gap-3 py-3 hover:bg-[#FFFBF0] rounded-xl px-1 -mx-1"
                  >
                    <span className="w-9 h-9 rounded-xl bg-[#FFF8E5] grid place-items-center text-[#8A6400]">
                      <ListChecks className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#161827] truncate">
                        {i.title}
                      </span>
                      <span className="block text-xs text-[#475569] truncate">
                        {i.detail}
                      </span>
                    </span>
                    <span className="hidden sm:block text-xs text-[#475569]">
                      {i.owner}
                    </span>
                    <span className="min-w-7 h-6 px-2 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-bold grid place-items-center">
                      {i.count}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#64748B]" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Không có mục nào cần xử lý" />
          )}
        </Widget>

        <Widget
          className="lg:col-span-2"
          title="Nhân sự hôm nay"
          icon={<Users className="w-4 h-4" />}
          action={<SeeAll href="/app/admin/attendance" label="Chấm công" />}
        >
          {staff && staff.total > 0 ? (
            <>
              <div className="h-2.5 rounded-full bg-[#FBF3DC] overflow-hidden flex">
                <span style={{ width: `${((staff.present - staff.late) / staff.total) * 100}%` }} className="bg-[#00D09C]" />
                <span style={{ width: `${(staff.late / staff.total) * 100}%` }} className="bg-[#FF9F24]" />
                <span style={{ width: `${(staff.onLeave / staff.total) * 100}%` }} className="bg-[#3B5BDB]" />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#475569]">
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#00D09C]" />{staff.present} có mặt</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#FF9F24]" />{staff.late} đi muộn</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#3B5BDB]" />{staff.onLeave} nghỉ phép</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#FF785A]" />{staff.notCheckedIn} chưa check-in</span>
              </div>
              <ul className="space-y-2 mt-1">
                {data!.staffToday.map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#3B5BDB] text-xs font-bold grid place-items-center">
                      {initials(s.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#161827] truncate">{s.name}</span>
                      <span className="block text-xs text-[#475569] truncate">{s.note}</span>
                    </span>
                    <i className={`w-2 h-2 rounded-full ${STATE_DOT[s.state]}`} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty />
          )}
        </Widget>
      </div>

      {/* Row B */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Widget
          title="Phân bổ công việc theo phòng ban"
          icon={<FolderKanban className="w-4 h-4" />}
          action={<SeeAll href="/app/admin/tasks" label="Xem tất cả công việc" />}
        >
          {data && data.workload.length > 0 ? (
            <ul className="space-y-3.5">
              {data.workload.map((w) => {
                const max = Math.max(1, ...data.workload.map((x) => x.open));
                return (
                  <li key={w.departmentId}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-[#161827] truncate">{w.name}</span>
                      <span className="text-[#475569] shrink-0">
                        {w.open} mở
                        {w.overdue > 0 && <b className="text-[#DC2626]"> · {w.overdue} quá hạn</b>}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#FBF3DC] overflow-hidden flex">
                      <span style={{ width: `${((w.open - w.overdue) / max) * 100}%` }} className="bg-[#E7AE18]" />
                      <span style={{ width: `${(w.overdue / max) * 100}%` }} className="bg-[#FF785A]" />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty text="Chưa có công việc theo phòng ban" />
          )}
        </Widget>

        <Widget
          title="Công việc mới giao"
          icon={<ListChecks className="w-4 h-4" />}
          action={
            data && (
              <span className="px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3B5BDB] text-xs font-bold">
                {data.newTasks.last24h} công việc trong 24 giờ
              </span>
            )
          }
        >
          {data && data.newTasks.items.length > 0 ? (
            <ul className="divide-y divide-[#F2EAD3]">
              {data.newTasks.items.map((t) => {
                const st = TASK_STATUS[t.status] ?? TASK_STATUS.todo;
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#3B5BDB] text-xs font-bold grid place-items-center shrink-0">
                      {initials(t.assignee)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#161827] truncate">{t.title}</span>
                      <span className="block text-xs text-[#475569] truncate">
                        {t.project ?? "—"} · giao cho {t.assignee}
                      </span>
                    </span>
                    <span className={`text-xs ${t.overdue ? "text-[#DC2626] font-bold" : "text-[#475569]"}`}>
                      Hạn {shortDate(t.dueDate)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.overdue ? "bg-[#FEE2E2] text-[#B91C1C]" : st.cls}`}>
                      {t.overdue ? "Quá hạn" : st.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty text="Chưa có công việc mới giao" />
          )}
        </Widget>
      </div>

      {/* Row C */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Widget
          className="lg:col-span-3"
          title="Tiến độ dự án"
          icon={<FolderKanban className="w-4 h-4" />}
          action={<SeeAll href="/app/admin/projects" label="Xem tất cả" />}
        >
          {data && data.projects.length > 0 ? (
            <ul className="space-y-4">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/app/admin/projects/${p.id}`} className="block group">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#161827] truncate group-hover:text-[#8A6400]">
                          <span className="font-mono text-xs text-[#475569] mr-2">{p.code}</span>
                          {p.name}
                        </p>
                        <p className="text-xs text-[#475569] truncate">
                          Khách: {p.client ?? "—"} · PM: {p.manager}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[#161827]">{p.progress}%</p>
                        <p className={`text-xs ${p.late ? "text-[#DC2626] font-bold" : "text-[#475569]"}`}>
                          Hạn {shortDate(p.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[#FBF3DC] overflow-hidden mt-2">
                      <span
                        style={{ width: `${p.progress}%` }}
                        className={`block h-full ${p.late ? "bg-[#FF785A]" : "bg-[#E7AE18]"}`}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Chưa có dự án đang chạy" />
          )}
        </Widget>

        <Widget
          className="lg:col-span-2"
          title="Hoạt động gần đây"
          icon={<Activity className="w-4 h-4" />}
        >
          {data && data.activity.length > 0 ? (
            <ul className="space-y-3">
              {data.activity.map((a, i) => (
                <li key={i} className="flex gap-3 text-xs">
                  <span className="text-[#475569] font-mono w-10 shrink-0 pt-0.5">{timeOf(a.at)}</span>
                  <span className="text-[#161827] leading-snug">{a.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Chưa có hoạt động gần đây" />
          )}
        </Widget>
      </div>

      {/* Row D */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Widget
          className="lg:col-span-3"
          title="Tài chính — doanh thu 6 tháng"
          icon={<TrendingUp className="w-4 h-4" />}
          action={<SeeAll href="/app/admin/finance" label="Chi tiết tài chính" />}
        >
          {data ? (
            <>
              <div className="flex items-end gap-3 h-40 px-1">
                {data.revenue.months.map((m, i) => {
                  const last = i === data.revenue.months.length - 1;
                  return (
                    <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5" title={fullVND(m.amount)}>
                      <span className="text-xs text-[#475569]">{m.amount ? compactVND(m.amount) : ""}</span>
                      <span
                        className={`w-full rounded-t-lg ${last ? "bg-[#E7AE18]" : "bg-[#FDE68A]"}`}
                        style={{ height: `${Math.max(m.amount ? 6 : 2, (m.amount / maxRev) * 100)}%` }}
                      />
                      <span className="text-xs text-[#475569]">{m.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="rounded-xl border border-[#F2EAD3] p-3">
                  <p className="text-xs text-[#475569]">Doanh thu lũy kế</p>
                  <p className="text-sm font-bold text-[#161827] mt-1">{fullVND(data.revenue.ytd)}</p>
                </div>
                <div className="rounded-xl border border-[#F2EAD3] p-3">
                  <p className="text-xs text-[#475569]">Phải thu</p>
                  <p className="text-sm font-bold text-[#161827] mt-1">{fullVND(data.revenue.receivable)}</p>
                </div>
                <div className="rounded-xl border border-[#F2EAD3] p-3">
                  <p className="text-xs text-[#475569]">Quá hạn</p>
                  <p className="text-sm font-bold text-[#DC2626] mt-1">{fullVND(data.revenue.overdue)}</p>
                </div>
              </div>
            </>
          ) : (
            <Empty />
          )}
        </Widget>

        <Widget
          className="lg:col-span-2"
          title="Lịch hôm nay & tuần này"
          icon={<CalendarDays className="w-4 h-4" />}
          action={<SeeAll href="/app/admin/calendar" label="Mở lịch" />}
        >
          {data && data.schedule.length > 0 ? (
            <ul className="space-y-2.5">
              {data.schedule.map((s, i) => (
                <li key={i} className="flex items-center gap-3 text-xs">
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-md font-bold ${
                      s.date === data.today ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FFF8E5] text-[#8A6400]"
                    }`}
                  >
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
