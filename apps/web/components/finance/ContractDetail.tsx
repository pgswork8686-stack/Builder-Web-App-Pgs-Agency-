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
  Eye,
  Plus,
  EyeOff,
} from "lucide-react";
import { financeApi, Contract, Invoice } from "@/lib/api/finance";
import { FinanceConfirmDialog } from "./FinanceConfirmDialog";

interface ContractDetailProps {
  roleBasePath: string;
}

export default function ContractDetail({ roleBasePath }: ContractDetailProps) {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Confirm Dialog states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<string>("");
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");

  const [toggleVisibleOpen, setToggleVisibleOpen] = useState(false);
  const [targetVisibility, setTargetVisibility] = useState(false);

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

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const triggerTransitionConfirm = (status: string) => {
    setActionError(null);
    setConfirmStatus(status);
    if (status === "cancelled") {
      setConfirmTitle("Hủy hợp đồng");
      setConfirmMessage(
        "Bạn có chắc chắn muốn HỦY hợp đồng này? Hành động này không thể hoàn tác.",
      );
    } else if (status === "active") {
      setConfirmTitle("Kích hoạt hợp đồng");
      setConfirmMessage(
        "Bạn có chắc chắn muốn kích hoạt hợp đồng này? Sau khi kích hoạt, hầu hết các thông tin cốt lõi sẽ không thể sửa đổi.",
      );
    } else {
      setConfirmTitle("Hoàn thành hợp đồng");
      setConfirmMessage(
        "Bạn có chắc chắn muốn đánh dấu hợp đồng này đã hoàn thành?",
      );
    }
    setConfirmOpen(true);
  };

  const handleTransition = async () => {
    setConfirmOpen(false);
    try {
      setTransitioning(true);
      await financeApi.transitionContract(id, confirmStatus);
      showToast("Chuyển trạng thái hợp đồng thành công.");
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Chuyển trạng thái thất bại.");
    } finally {
      setTransitioning(false);
    }
  };

  const triggerToggleVisibility = (currentVal: boolean) => {
    setTargetVisibility(!currentVal);
    setToggleVisibleOpen(true);
  };

  const handleToggleVisibility = async () => {
    setToggleVisibleOpen(false);
    try {
      setTransitioning(true);
      await financeApi.updateContract(id, { clientVisible: targetVisibility });
      showToast(
        `Đã ${targetVisibility ? "hiển thị" : "ẩn"} hợp đồng với khách hàng.`,
      );
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Thay đổi hiển thị thất bại.");
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
            Nháp
          </span>
        );
      case "active":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] text-xs font-bold">
            Đang hiệu lực
          </span>
        );
      case "completed":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-bold">
            Hoàn thành
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#FF1744]/10 border border-[#FF1744]/30 text-[#FF1744] text-xs font-bold">
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
      <div className="min-h-screen bg-[#070707] text-[#FFF8E6] flex flex-col items-center justify-center gap-4 p-6">
        <AlertTriangle className="w-12 h-12 text-[#FF1744]" />
        <span className="text-sm text-[#606060]">
          Không tìm thấy hợp đồng yêu cầu.
        </span>
        <Link
          href={`${roleBasePath}/finance/contracts`}
          className="px-4 py-2 rounded-xl bg-[#151516] text-[#FFC400] hover:brightness-110 border border-[#FFC400]/20 font-bold text-xs"
        >
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col relative">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-[#00E676] text-black px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 font-bold text-xs animate-bounce">
          <CheckCircle className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-[#151516] bg-[#0E0E0F]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href={`${roleBasePath}/finance/contracts`}
            className="p-2 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="font-bold text-base tracking-wide text-white">
            Chi tiết hợp đồng{" "}
            <span className="text-[#FFC400] font-normal">
              | {contract.contract_number}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {contract.status === "draft" && (
            <>
              <button
                disabled={transitioning}
                onClick={() => triggerTransitionConfirm("active")}
                className="px-4 py-2.5 rounded-xl bg-[#00E676] text-black font-bold text-xs hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Kích hoạt</span>
              </button>
              <button
                disabled={transitioning}
                onClick={() => triggerTransitionConfirm("cancelled")}
                className="px-4 py-2.5 rounded-xl bg-[#FF1744]/10 border border-[#FF1744]/30 text-[#FF1744] hover:bg-[#FF1744]/20 font-bold text-xs transition-all cursor-pointer"
              >
                Hủy hợp đồng
              </button>
            </>
          )}

          {contract.status === "active" && (
            <>
              <button
                disabled={transitioning}
                onClick={() => triggerTransitionConfirm("completed")}
                className="px-4 py-2.5 rounded-xl bg-[#00E5FF] text-black font-bold text-xs hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Hoàn thành</span>
              </button>
              <button
                disabled={transitioning}
                onClick={() => triggerTransitionConfirm("cancelled")}
                className="px-4 py-2.5 rounded-xl bg-[#FF1744]/10 border border-[#FF1744]/30 text-[#FF1744] hover:bg-[#FF1744]/20 font-bold text-xs transition-all cursor-pointer"
              >
                Hủy hợp đồng
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Action Error Alerts */}
          {actionError && (
            <div className="p-4 rounded-2xl bg-[#FF1744]/10 border border-[#FF1744]/20 text-[#FF1744] text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Details Overview Card */}
          <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#151516] pb-4">
              <div className="space-y-1">
                <span className="text-[10px] text-[#606060] uppercase font-bold tracking-wider">
                  Tiêu đề hợp đồng
                </span>
                <h2 className="text-xl font-bold text-white leading-tight">
                  {contract.title}
                </h2>
              </div>
              <div>{getStatusBadge(contract.status)}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <span className="text-[10px] text-[#606060] uppercase font-bold tracking-wider">
                  Mã hợp đồng
                </span>
                <p className="text-sm font-mono font-bold text-white">
                  {contract.contract_number}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-[#606060] uppercase font-bold tracking-wider">
                  Khách hàng
                </span>
                <p className="text-sm text-[#FFF8E6]/85 font-medium">
                  {contract.client_company?.name || "—"}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-[#606060] uppercase font-bold tracking-wider">
                  Giá trị hợp đồng
                </span>
                <p className="text-lg font-extrabold text-[#FFC400]">
                  {formatCurrency(
                    contract.contract_value,
                    contract.currency_code,
                  )}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-[#606060] uppercase font-bold tracking-wider">
                  Dự án liên kết
                </span>
                <p className="text-sm text-[#FFF8E6]/85 font-medium">
                  {contract.project?.name || "—"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-[#151516] pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#606060]" />
                <div className="space-y-0.5">
                  <span className="text-[10px] text-[#606060] uppercase font-bold tracking-wider">
                    Ngày bắt đầu
                  </span>
                  <p className="text-xs font-mono text-white">
                    {contract.start_date}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#606060]" />
                <div className="space-y-0.5">
                  <span className="text-[10px] text-[#606060] uppercase font-bold tracking-wider">
                    Ngày kết thúc
                  </span>
                  <p className="text-xs font-mono text-white">
                    {contract.end_date || "Không giới hạn"}
                  </p>
                </div>
              </div>
            </div>

            {contract.notes && (
              <div className="border-t border-[#151516] pt-6 space-y-2">
                <span className="text-[10px] text-[#606060] uppercase font-bold tracking-wider block">
                  Điều khoản & Ghi chú
                </span>
                <p className="text-xs text-[#FFF8E6]/70 leading-relaxed bg-[#151516]/40 p-4 rounded-xl border border-[#1f1f22] whitespace-pre-wrap">
                  {contract.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info & Invoices */}
        <div className="space-y-6">
          {/* Client Visibility Control Card */}
          <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Hiển thị với khách hàng
            </h4>
            <div className="flex items-center justify-between bg-[#151516] p-4 rounded-xl border border-[#1f1f22]">
              <div className="flex items-center gap-2">
                {contract.client_visible ? (
                  <Eye className="w-4 h-4 text-[#00E676]" />
                ) : (
                  <EyeOff className="w-4 h-4 text-[#606060]" />
                )}
                <span className="text-xs font-bold">
                  {contract.client_visible ? "Đang hiển thị" : "Đang ẩn"}
                </span>
              </div>

              <button
                disabled={transitioning}
                onClick={() => triggerToggleVisibility(contract.client_visible)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all border ${
                  contract.client_visible
                    ? "bg-[#FF1744]/10 border-[#FF1744]/35 text-[#FF1744] hover:bg-[#FF1744]/20"
                    : "bg-[#00E676]/10 border-[#00E676]/35 text-[#00E676] hover:bg-[#00E676]/20"
                }`}
              >
                {contract.client_visible ? "Ẩn đi" : "Hiển thị"}
              </button>
            </div>
          </div>

          {/* Invoices List Card */}
          <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
            <div className="flex items-center justify-between border-b border-[#151516] pb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Hóa đơn của hợp đồng
              </h4>
              <Link
                href={`${roleBasePath}/finance/invoices?contractId=${contract.id}`}
                className="inline-flex items-center gap-1 text-[10px] text-[#FFC400] hover:underline"
              >
                <Plus className="w-3 h-3" />
                <span>Thêm</span>
              </Link>
            </div>

            {invoices.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#606060]">
                Chưa có hóa đơn nào liên kết.
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-xl bg-[#151516]/40 border border-[#1f1f22] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-white font-mono">
                        {inv.invoice_number}
                      </p>
                      <p className="text-[10px] text-[#606060]">
                        {inv.issue_date}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-bold text-[#FFC400]">
                        {formatCurrency(inv.amount, inv.currency_code)}
                      </p>
                      <Link
                        href={`${roleBasePath}/finance/invoices/${inv.id}`}
                        className="inline-flex items-center gap-0.5 text-[10px] text-[#606060] hover:text-white"
                      >
                        <span>Chi tiết</span>
                        <ChevronLeft className="w-2.5 h-2.5 rotate-180" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Confirmation Modals */}
      <FinanceConfirmDialog
        isOpen={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        isDanger={confirmStatus === "cancelled"}
        onConfirm={handleTransition}
        onCancel={() => setConfirmOpen(false)}
      />

      <FinanceConfirmDialog
        isOpen={toggleVisibleOpen}
        title="Thay đổi hiển thị khách hàng"
        message={`Bạn có chắc chắn muốn ${
          targetVisibility ? "HIỂN THỊ" : "ẨN"
        } hợp đồng này đối với tài khoản khách hàng trên cổng thông tin?`}
        onConfirm={handleToggleVisibility}
        onCancel={() => setToggleVisibleOpen(false)}
      />
    </div>
  );
}
