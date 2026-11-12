"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  CircleDollarSign,
  FileText,
  ReceiptText,
  TrendingUp,
  TriangleAlert,
  Users,
  Clock,
} from "lucide-react";
import {
  accountantDashboardApi,
  type AccountantDashboardData,
} from "@/lib/api/accountant-dashboard";
import {
  Empty,
  Kpi,
  SeeAll,
  Widget,
  compactVND,
  fullVND,
} from "@/components/dashboard/figma-widgets";

const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  issued: { label: "Đã phát hành", cls: "bg-[#F2EEFF] border-[#E7E0FF] text-[#6044E8]" },
  partially_paid: { label: "Thanh toán một phần", cls: "bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]" },
  paid: { label: "Đã thanh toán", cls: "bg-[#E6FBF5] border-[#A7F3D0] text-[#047857]" },
  overdue: { label: "Quá hạn", cls: "bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]" },
  draft: { label: "Nháp", cls: "bg-[#F4F2FD] border-[#DDDFEA] text-[#475569]" },
};

const TONE: Record<string, string> = {
  danger: "bg-[#FEE2E2] text-[#B91C1C]",
  gold: "bg-[#F2EEFF] text-[#5B3FD6]",
  green: "bg-[#E6FBF5] text-[#047857]",
};

const PAYROLL_LABEL: Record<string, string> = {
  draft: "Chưa chốt",
  processing: "Đang tính",
  locked: "Đã khóa kỳ",
  paid: "Đã chi trả",
};

export default function AccountantDashboardPage() {
  const [data, setData] = useState<AccountantDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    accountantDashboardApi
      .get()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError("Không tải được số liệu tài chính. Vui lòng thử lại."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const k = data?.kpi;
  const maxFlow = Math.max(1, ...(data?.cashflow.months.map((m) => Math.max(m.income, m.expense)) ?? [1]));
  const diff = (data?.cashflow.income ?? 0) - (data?.cashflow.expense ?? 0);
  const maxDebt = Math.max(1, ...(data?.debtByClient.map((d) => d.amount) ?? [1]));
  const val = (v?: number) => (loading ? "…" : compactVND(v ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E7E9F0]">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-[#202333] tracking-tight">Tổng quan tài chính</h1>
          <p className="text-sm text-[#475569] mt-1">Dòng tiền, công nợ và các việc kế toán cần xử lý hôm nay.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/accountant/finance/payments" className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-white border border-[#DDDFEA] text-xs font-bold text-[#202333] hover:bg-[#F2EEFF]">
            Ghi nhận thanh toán
          </Link>
          <Link href="/app/accountant/finance/invoices" className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-[#7257F5] hover:bg-[#6044E8] text-xs font-bold text-white">
            Tạo hóa đơn
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-sm px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi label="Thu tháng này" value={val(k?.incomeThisMonth)} sub={k?.incomeChangePct == null ? "chưa có số liệu tháng trước" : `${k.incomeChangePct >= 0 ? "+" : ""}${k.incomeChangePct}% so với tháng trước`} icon={<CircleDollarSign className="w-4 h-4" />} bg="#E6FBF5" border="#A7F3D0" />
        <Kpi label="Phải thu" value={val(k?.receivable)} sub={`${k?.receivableInvoices ?? 0} hóa đơn`} icon={<ReceiptText className="w-4 h-4" />} bg="#FEF9C3" border="#FEF08A" />
        <Kpi label="Quá hạn" value={val(k?.overdueAmount)} sub={`${k?.overdueClients ?? 0} khách`} icon={<TriangleAlert className="w-4 h-4" />} bg="#FEE2E2" border="#FECACA" />
        <Kpi label="Chi phí chờ duyệt" value={val(k?.pendingExpenseAmount)} sub={`${k?.pendingExpenseCount ?? 0} đề nghị`} icon={<FileText className="w-4 h-4" />} bg="#E0F7FE" border="#BAE6FD" />
        <Kpi label="Lương kỳ này" value={loading ? "…" : PAYROLL_LABEL[k?.payrollStatus ?? ""] ?? (k?.payrollStatus ? k.payrollStatus : "Chưa chốt")} sub={k?.payrollLabel ?? "chờ khóa kỳ công"} icon={<Users className="w-4 h-4" />} bg="#F2EEFF" border="#E9D5FF" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Widget className="lg:col-span-3" title="Dòng tiền 6 tháng" icon={<TrendingUp className="w-4 h-4" />} action={<SeeAll href="/app/accountant/finance/cashflow" label="Thu chi" />}>
          {data ? (
            <>
              <div className="flex items-end gap-4 h-44 px-1">
                {data.cashflow.months.map((m, i) => {
                  const last = i === data.cashflow.months.length - 1;
                  return (
                    <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5" title={`Thu ${fullVND(m.income)} · Chi ${fullVND(m.expense)}`}>
                      <span className={`w-full max-w-9 rounded-t-lg ${last ? "bg-[#7257F5]" : "bg-[#FDE68A]"}`} style={{ height: `${Math.max(m.income ? 6 : 2, (m.income / maxFlow) * 100)}%` }} />
                      <span className="text-xs text-[#475569]">{m.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="rounded-xl border border-[#E7E9F0] bg-[#F8F9FC] p-3">
                  <p className="text-xs text-[#475569]">Thu</p>
                  <p className="text-sm font-bold text-[#202333] mt-1">{fullVND(data.cashflow.income)}</p>
                </div>
                <div className="rounded-xl border border-[#E7E9F0] bg-[#F8F9FC] p-3">
                  <p className="text-xs text-[#475569]">Chi</p>
                  <p className="text-sm font-bold text-[#202333] mt-1">{fullVND(data.cashflow.expense)}</p>
                </div>
                <div className="rounded-xl border border-[#E7E9F0] bg-[#F8F9FC] p-3">
                  <p className="text-xs text-[#475569]">Chênh lệch</p>
                  <p className={`text-sm font-bold mt-1 ${diff >= 0 ? "text-[#047857]" : "text-[#B91C1C]"}`}>{diff >= 0 ? "+" : ""}{fullVND(diff)}</p>
                </div>
              </div>
            </>
          ) : (
            <Empty />
          )}
        </Widget>

        <Widget
          className="lg:col-span-2"
          title="Cần xử lý hôm nay"
          icon={<Bell className="w-4 h-4" />}
          action={data && <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs font-bold">{data.attention.total} mục</span>}
        >
          {data && data.attention.items.length > 0 ? (
            <ul className="divide-y divide-[#E7E9F0]">
              {data.attention.items.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center gap-3 py-3 hover:bg-[#F8F9FC] rounded-xl px-1 -mx-1">
                    <span className={`w-9 h-9 rounded-xl grid place-items-center ${TONE[a.tone]}`}>
                      {a.key === "attendance" ? <Clock className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#202333] truncate">{a.title}</span>
                      <span className="block text-xs text-[#475569] truncate">{a.detail}</span>
                    </span>
                    <span className="min-w-7 h-6 px-2 rounded-full bg-[#F2EEFF] border border-[#DDD5FF] text-[#5B3FD6] text-xs font-bold grid place-items-center">{a.count}</span>
                    <ChevronRight className="w-4 h-4 text-[#64748B]" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Không có việc nào cần xử lý" />
          )}
        </Widget>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <section className="lg:col-span-3 bg-white rounded-2xl border border-[#E7E9F0] overflow-hidden">
          {data && data.recentInvoices.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F4F2FD] text-left text-xs uppercase tracking-wide text-[#475569]">
                  <th className="px-5 py-3 font-bold">Hóa đơn</th>
                  <th className="px-3 py-3 font-bold">Khách hàng</th>
                  <th className="px-3 py-3 font-bold">Giá trị</th>
                  <th className="px-5 py-3 font-bold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9F0]">
                {data.recentInvoices.map((i) => {
                  const st = INVOICE_STATUS[i.overdue ? "overdue" : i.status] ?? INVOICE_STATUS.issued;
                  return (
                    <tr key={i.id} className="hover:bg-[#F8F9FC]">
                      <td className="px-5 py-3.5"><Link href={`/app/accountant/finance/invoices/${i.id}`} className="font-bold text-[#6044E8]">{i.number}</Link></td>
                      <td className="px-3 py-3.5 font-bold text-[#202333] max-w-[220px] truncate" title={i.client}>{i.client}</td>
                      <td className="px-3 py-3.5 text-[#475569] whitespace-nowrap">{fullVND(i.amount)}</td>
                      <td className="px-5 py-3.5"><span className={`whitespace-nowrap px-2 py-0.5 rounded-full border text-xs font-bold ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-5"><Empty text="Chưa có hóa đơn" /></div>
          )}
        </section>

        <Widget className="lg:col-span-2" title="Công nợ theo khách hàng" icon={<Users className="w-4 h-4" />}>
          {data && data.debtByClient.length > 0 ? (
            <ul className="space-y-3.5">
              {data.debtByClient.map((d) => (
                <li key={d.clientId}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#475569] truncate">{d.name}</span>
                    <b className="text-[#202333] shrink-0">{compactVND(d.amount)}</b>
                  </div>
                  <div className="h-2 rounded-full bg-[#F4F2FD] overflow-hidden">
                    <span className="block h-full bg-[#7257F5]" style={{ width: `${(d.amount / maxDebt) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Không có công nợ" />
          )}
        </Widget>
      </div>
    </div>
  );
}
