"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CircleCheck,
  CircleHelp,
  FolderKanban,
  ReceiptText,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { getMe, type UserPayload } from "@/lib/api/auth";
import {
  clientDashboardApi,
  type ClientDashboardData,
} from "@/lib/api/client-dashboard";
import {
  Empty,
  Kpi,
  SeeAll,
  Widget,
  compactVND,
  shortDate,
} from "@/components/dashboard/figma-widgets";

const KIND_ICON = {
  approval: <UserCheck className="w-4 h-4" />,
  invoice: <ReceiptText className="w-4 h-4" />,
  ticket: <CircleHelp className="w-4 h-4" />,
};
const KIND_TONE = {
  approval: "bg-[#FFF8E5] text-[#8A6400]",
  invoice: "bg-[#FEE2E2] text-[#B91C1C]",
  ticket: "bg-[#EEF2FF] text-[#3B5BDB]",
};

function dm(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

export default function ClientDashboardPage() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [data, setData] = useState<ClientDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [me, dash] = await Promise.allSettled([getMe(), clientDashboardApi.get()]);
      if (!alive) return;
      if (me.status === "fulfilled") setUser(me.value.user);
      if (dash.status === "fulfilled") setData(dash.value);
      else setError("Không tải được dữ liệu dự án. Vui lòng thử lại.");
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const name = user?.fullName || user?.email?.split("@")[0] || "quý khách";
  const k = data?.kpi;
  const n = (v?: number) => (loading ? "…" : String(v ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#F2EAD3]">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-[#161827] tracking-tight">Xin chào, {name}</h1>
          <p className="text-sm text-[#475569] mt-1">
            {data?.company ? `${data.company} · ` : ""}Theo dõi dự án hợp tác với PGS Agency.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/client/support" className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-white border border-[#E8DDB8] text-xs font-bold text-[#161827] hover:bg-[#FFF8E5]">
            Gửi yêu cầu hỗ trợ
          </Link>
          <Link href="/app/client/approvals" className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-[#E7AE18] hover:bg-[#CC9410] text-xs font-bold text-[#161827]">
            Xem sản phẩm chờ duyệt
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-sm px-4 py-3">{error}</div>
      )}
      {data && !data.company && (
        <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] text-sm px-4 py-3">
          Tài khoản của bạn chưa được liên kết với doanh nghiệp nào. Vui lòng liên hệ PGS Agency.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi label="Dự án đang chạy" value={n(k?.activeProjects)} sub={`trên tổng ${k?.totalProjects ?? 0} dự án`} icon={<FolderKanban className="w-4 h-4" />} bg="#EEF2FF" border="#E0EAFF" />
        <Kpi label="Chờ bạn phê duyệt" value={n(k?.pendingApprovals)} sub="sản phẩm / hạng mục" icon={<UserCheck className="w-4 h-4" />} bg="#FEF9C3" border="#FEF08A" />
        <Kpi label="Chưa thanh toán" value={loading ? "…" : compactVND(k?.unpaidAmount ?? 0)} sub={`${k?.unpaidInvoices ?? 0} hóa đơn${k?.nextDue ? ` · hạn ${shortDate(k.nextDue)}` : ""}`} icon={<ReceiptText className="w-4 h-4" />} bg="#FEE2E2" border="#FECACA" />
        <Kpi label="Phiếu hỗ trợ mở" value={n(k?.openTickets)} sub="đang được xử lý" icon={<CircleHelp className="w-4 h-4" />} bg="#F3E8FF" border="#E9D5FF" />
        <Kpi label="Dự án hoàn thành" value={loading ? "…" : `${k?.completedProjects ?? 0}/${k?.totalProjects ?? 0}`} sub="tính từ trạng thái thật" icon={<CircleCheck className="w-4 h-4" />} bg="#E6FBF5" border="#A7F3D0" />
      </div>

      <Widget
        title="Việc cần bạn xử lý"
        icon={<Bell className="w-4 h-4" />}
        action={data && <span className="px-2 py-0.5 rounded-full bg-[#FFF8E5] border border-[#FDE68A] text-[#8A6400] text-xs font-bold">{data.attention.length} mục</span>}
      >
        {data && data.attention.length > 0 ? (
          <ul className="divide-y divide-[#F2EAD3]">
            {data.attention.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="flex items-center gap-3 py-3 hover:bg-[#FFFBF0] rounded-xl px-1 -mx-1">
                  <span className={`w-9 h-9 rounded-xl grid place-items-center ${KIND_TONE[a.kind]}`}>{KIND_ICON[a.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#161827] truncate">{a.title}</span>
                    <span className="block text-xs text-[#475569] truncate">{a.detail}</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFF8E5] border border-[#FDE68A] text-[#8A6400] text-xs font-bold">{a.badge}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="Hiện không có việc nào cần bạn xử lý" />
        )}
      </Widget>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Widget className="lg:col-span-3" title="Dự án của bạn" icon={<FolderKanban className="w-4 h-4" />} action={<SeeAll href="/app/client/projects" label="Xem tất cả" />}>
          {data && data.projects.length > 0 ? (
            <ul className="divide-y divide-[#F2EAD3]">
              {data.projects.map((p) => {
                const done = p.status === "completed";
                return (
                  <li key={p.id}>
                    <Link href={`/app/client/projects/${p.id}`} className="flex items-center gap-4 py-3 group">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[#161827] truncate group-hover:text-[#8A6400]">
                          <span className="font-mono text-xs text-[#8A6400] mr-2">{p.code}</span>
                          {p.name}
                        </span>
                        <span className="block text-xs text-[#475569]">{done ? "Đã nghiệm thu" : `${p.itemsDone}/${p.itemsTotal} hạng mục hoàn thành`}</span>
                      </span>
                      <span className="w-36 shrink-0">
                        <span className="flex justify-between text-xs mb-1">
                          <b className="text-[#161827]">{p.progress}%</b>
                          <span className="text-[#475569]">{done ? "Hoàn thành" : `Hạn ${shortDate(p.dueDate)}`}</span>
                        </span>
                        <span className="block h-2 rounded-full bg-[#FBF3DC] overflow-hidden">
                          <span style={{ width: `${p.progress}%` }} className={`block h-full ${done ? "bg-[#00D09C]" : "bg-[#E7AE18]"}`} />
                        </span>
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${done ? "bg-[#E6FBF5] text-[#047857]" : "bg-[#EEF2FF] text-[#3B5BDB]"}`}>
                        {done ? "Hoàn thành" : "Đang thực hiện"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty text="Chưa có dự án nào" />
          )}
        </Widget>

        <Widget className="lg:col-span-2" title="Cập nhật mới nhất" icon={<RefreshCw className="w-4 h-4" />}>
          {data && data.updates.length > 0 ? (
            <ul className="space-y-3">
              {data.updates.map((u, i) => (
                <li key={i} className="flex gap-3 text-xs">
                  <i className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${i === 0 ? "bg-[#E7AE18]" : "bg-[#FDE68A]"}`} />
                  <span className="text-[#475569] font-mono w-10 shrink-0">{dm(u.at)}</span>
                  <span className="text-[#161827] leading-snug">{u.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Chưa có cập nhật" />
          )}
        </Widget>
      </div>
    </div>
  );
}
