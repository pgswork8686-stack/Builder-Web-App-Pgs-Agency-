"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Loader2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  FileText,
  UserCheck,
  Eye,
  Plus,
} from "lucide-react";
import { financeApi, Contract, Invoice } from "@/lib/api/finance";

export default function AdminContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const contractData = await financeApi.getContractById(id);
      setContract(contractData);

      const invoicesRes = await financeApi.getInvoices({
        contractId: id,
        pageSize: 50,
      });
      setInvoices(invoicesRes.items);
    } catch (err: any) {
      console.error("Lỗi lấy chi tiết hợp đồng:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const handleTransition = async (status: string) => {
    setActionError(null);
    const confirmMsg =
      status === "cancelled"
        ? "Bạn có chắc chắn muốn HỦY hợp đồng này? Hành động này không thể hoàn tác."
        : `Bạn có chắc chắn muốn chuyển trạng thái hợp đồng thành "${
            status === "active" ? "Đang hiệu lực" : "Hoàn thành"
          }"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setTransitioning(true);
      await financeApi.transitionContract(id, status);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Chuyển trạng thái thất bại.");
    } finally {
      setTransitioning(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#151516] border border-[#FFC400]/30 text-[#FFC400] text-xs font-bold">
            Nháp (Draft)
          </span>
        );
      case "active":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] text-xs font-bold">
            Đang hoạt động (Active)
          </span>
        );
      case "completed":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-bold">
            Hoàn thành (Completed)
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#FF1744]/10 border border-[#FF1744]/30 text-[#FF1744] text-xs font-bold">
            Đã hủy (Cancelled)
          </span>
        );
      default:
        return null;
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <span className="px-2 py-0.5 rounded bg-[#151516] text-[#606060] text-[10px] font-bold">
            Nháp
          </span>
        );
      case "issued":
        return (
          <span className="px-2 py-0.5 rounded bg-[#FFC400]/10 text-[#FFC400] text-[10px] font-bold">
            Đã phát hành
          </span>
        );
      case "partially_paid":
        return (
          <span className="px-2 py-0.5 rounded bg-[#00E5FF]/10 text-[#00E5FF] text-[10px] font-bold">
            Thanh toán một phần
          </span>
        );
      case "paid":
        return (
          <span className="px-2 py-0.5 rounded bg-[#00E676]/10 text-[#00E676] text-[10px] font-bold">
            Đã thanh toán
          </span>
        );
      case "overdue":
        return (
          <span className="px-2 py-0.5 rounded bg-[#FF1744]/10 text-[#FF1744] text-[10px] font-bold">
            Quá hạn
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-0.5 rounded bg-[#FF1744]/10 text-[#FF1744] text-[10px] font-bold">
            Đã hủy
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707] text-[#FFF8E6] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#FFC400] animate-spin" />
        <span className="text-sm text-[#606060]">
          Đang tải chi tiết hợp đồng...
        </span>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-[#070707] text-[#FFF8E6] flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-12 h-12 text-[#FF1744]" />
        <span className="text-sm text-[#606060]">
          Không tìm thấy hợp đồng yêu cầu hoặc không có quyền truy cập.
        </span>
        <Link
          href="/app/admin/finance/contracts"
          className="text-xs text-[#FFC400] underline"
        >
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-[#151516] bg-[#0E0E0F]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/app/admin/finance/contracts"
            className="p-2 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="font-bold text-base tracking-wide text-white">
            Hợp đồng{" "}
            <span className="text-[#FFC400] font-normal">
              | {contract.contract_number}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(contract.status)}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-6">
        {actionError && (
          <div className="p-3.5 rounded-xl bg-[#FF1744]/10 border border-[#FF1744]/20 text-[#FF1744] text-xs font-semibold">
            {actionError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-6">
              <div>
                <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider">
                  Tiêu đề hợp đồng
                </span>
                <h2 className="text-xl font-extrabold text-white mt-1">
                  {contract.title}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-b border-[#151516] py-6">
                <div>
                  <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                    Khách hàng
                  </span>
                  <span className="text-sm font-semibold text-[#FFF8E6]/90 mt-1 block">
                    {contract.client_company?.name || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                    Dự án liên kết
                  </span>
                  <span className="text-sm font-semibold text-[#FFF8E6]/90 mt-1 block">
                    {contract.project?.name || "Dự án chung / Không liên kết"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#FFC400] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                      Ngày hiệu lực
                    </span>
                    <span className="text-sm text-white font-medium mt-0.5 block">
                      Từ:{" "}
                      <span className="font-mono">{contract.start_date}</span>
                    </span>
                    <span className="text-sm text-white font-medium mt-0.5 block">
                      Đến:{" "}
                      <span className="font-mono">
                        {contract.end_date || "Không xác định"}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                    Giá trị hợp đồng
                  </span>
                  <span className="text-2xl font-black text-[#FFC400] block">
                    {formatCurrency(
                      contract.contract_value,
                      contract.currency_code,
                    )}
                  </span>
                </div>
              </div>

              {contract.notes && (
                <div className="border-t border-[#151516] pt-6 space-y-2">
                  <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                    Điều khoản & Ghi chú
                  </span>
                  <p className="text-xs text-[#FFF8E6]/70 leading-relaxed whitespace-pre-line">
                    {contract.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Invoices List */}
            <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
              <div className="flex items-center justify-between border-b border-[#151516] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4.5 h-4.5 text-[#FFC400]" />
                  Hóa đơn liên quan ({invoices.length})
                </h3>

                {contract.status === "active" && (
                  <Link
                    href={`/app/admin/finance/invoices?contractId=${contract.id}`}
                    className="inline-flex items-center gap-1 text-xs text-[#FFC400] font-bold hover:underline"
                  >
                    <span>Xem tất cả hóa đơn</span>
                  </Link>
                )}
              </div>

              {invoices.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#606060]">
                  Chưa có hóa đơn nào liên kết với hợp đồng này.
                </div>
              ) : (
                <div className="divide-y divide-[#151516]">
                  {invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="py-3.5 flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">
                            {inv.invoice_number}
                          </span>
                          {getInvoiceStatusBadge(inv.status)}
                        </div>
                        <div className="text-[#606060] mt-1">
                          Hạn thanh toán:{" "}
                          <span className="font-mono text-[#FFF8E6]/60">
                            {inv.due_date}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="font-bold text-white block">
                            {formatCurrency(inv.amount, inv.currency_code)}
                          </span>
                          <span className="text-[10px] text-[#606060] block">
                            Đã thanh toán:{" "}
                            {formatCurrency(inv.paid_amount, inv.currency_code)}
                          </span>
                        </div>

                        <Link
                          href={`/app/admin/finance/invoices/${inv.id}`}
                          className="p-1.5 rounded-lg bg-[#151516] border border-[#FFC400]/10 text-[#FFC400]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action sidebar panel */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#151516] pb-3">
                Thao tác hợp đồng
              </h3>

              {transitioning ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 text-[#FFC400] animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {contract.status === "draft" && (
                    <>
                      <button
                        onClick={() => handleTransition("active")}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00E676] text-black font-bold text-xs hover:brightness-110 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-black" />
                        <span>Kích hoạt hợp đồng</span>
                      </button>

                      <button
                        onClick={() => handleTransition("cancelled")}
                        className="w-full py-2.5 rounded-xl bg-[#151516] border border-[#FF1744]/20 hover:border-[#FF1744]/50 text-[#FF1744] font-bold text-xs transition-all cursor-pointer"
                      >
                        <span>Hủy bỏ hợp đồng</span>
                      </button>
                    </>
                  )}

                  {contract.status === "active" && (
                    <>
                      <button
                        onClick={() => handleTransition("completed")}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00E5FF] text-black font-bold text-xs hover:brightness-110 transition-all cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Đánh dấu hoàn thành</span>
                      </button>

                      <button
                        onClick={() => handleTransition("cancelled")}
                        className="w-full py-2.5 rounded-xl bg-[#151516] border border-[#FF1744]/20 hover:border-[#FF1744]/50 text-[#FF1744] font-bold text-xs transition-all cursor-pointer"
                      >
                        <span>Hủy bỏ hợp đồng</span>
                      </button>
                    </>
                  )}

                  {(contract.status === "completed" ||
                    contract.status === "cancelled") && (
                    <div className="text-center py-4 text-xs text-[#606060] bg-[#151516] rounded-xl border border-[#1f1f22]">
                      Hợp đồng đã ở trạng thái khóa (
                      {contract.status === "completed"
                        ? "Đã hoàn thành"
                        : "Đã hủy"}
                      ). không thể thao tác thêm.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Client Visibility Panel */}
            <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#151516] pb-3">
                Cổng thông tin Khách hàng
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#606060]">
                    Hiển thị cho khách hàng:
                  </span>
                  <span
                    className={`font-bold ${
                      contract.client_visible
                        ? "text-[#00E676]"
                        : "text-[#FF1744]"
                    }`}
                  >
                    {contract.client_visible ? "ĐANG HIỆN" : "ĐANG ẨN"}
                  </span>
                </div>
                <p className="text-[10px] text-[#606060] leading-relaxed">
                  Khi bật, khách hàng liên kết với công ty có thể xem hợp đồng
                  này dưới dạng Đọc ở chế độ bảo mật.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
