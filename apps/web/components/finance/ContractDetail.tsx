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
  Play,
  FileText,
  Eye,
  Plus,
  EyeOff,
} from "lucide-react";
import { financeApi, Contract, Invoice } from "@/lib/api/finance";
import { FinanceConfirmDialog } from "./FinanceConfirmDialog";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
      showToast("Cập nhật trạng thái hợp đồng thành công!");
      await loadData();
    } catch (err: any) {
      setActionError(
        err?.response?.data?.message ||
          "Không thể thay đổi trạng thái hợp đồng. Vui lòng kiểm tra lại điều kiện.",
      );
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
      await financeApi.updateContract(id, {
        clientVisible: targetVisibility,
      });
      showToast(
        targetVisibility
          ? "Đã cho phép khách hàng xem hợp đồng này."
          : "Đã ẩn hợp đồng với khách hàng.",
      );
      await loadData();
    } catch (err: any) {
      setActionError(
        err?.response?.data?.message ||
          "Không thể cập nhật quyền hiển thị khách hàng.",
      );
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
          <Badge variant="gold" size="sm">
            Nháp
          </Badge>
        );
      case "active":
        return (
          <Badge variant="success" size="sm">
            Đang hiệu lực
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="blue" size="sm">
            Hoàn thành
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="default" size="sm">
            Đã hủy
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4F75FF] animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-[#EDF2F7] space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-[#0F172A]">
          Không tìm thấy hợp đồng
        </h2>
        <p className="text-xs text-[#64748B]">
          Hợp đồng không tồn tại hoặc bạn không có quyền truy cập.
        </p>
        <Link href={`${roleBasePath}/finance/contracts`}>
          <Button variant="secondary" size="sm">Quay lại danh sách</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 font-bold text-xs">
          <CheckCircle className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <SectionHeader
        title={`Hợp đồng: ${contract.contract_number}`}
        description={contract.title}
        badge={contract.status ? contract.status.toUpperCase() : undefined}
        action={
          <div className="flex items-center gap-3">
            <Link href={`${roleBasePath}/finance/contracts`}>
              <Button variant="secondary" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
                Quay lại
              </Button>
            </Link>

            {contract.status === "draft" && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => triggerTransitionConfirm("active")}
                  leftIcon={<Play className="w-3.5 h-3.5" />}
                >
                  Kích hoạt
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => triggerTransitionConfirm("cancelled")}
                >
                  Hủy hợp đồng
                </Button>
              </>
            )}

            {contract.status === "active" && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => triggerTransitionConfirm("completed")}
                  leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                >
                  Hoàn thành
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => triggerTransitionConfirm("cancelled")}
                >
                  Hủy hợp đồng
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {actionError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Details Overview Card */}
          <Card className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDF2F7] pb-4">
              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                  Tiêu đề hợp đồng
                </span>
                <h2 className="text-lg font-extrabold text-[#0F172A] leading-tight">
                  {contract.title}
                </h2>
              </div>
              <div>{getStatusBadge(contract.status)}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                  Mã hợp đồng
                </span>
                <p className="text-sm font-mono font-bold text-[#0F172A]">
                  {contract.contract_number}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                  Khách hàng
                </span>
                <p className="text-sm text-[#0F172A] font-medium">
                  {contract.client_company?.name || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                  Giá trị hợp đồng
                </span>
                <p className="text-lg font-black text-[#4F75FF]">
                  {formatCurrency(
                    contract.contract_value,
                    contract.currency_code,
                  )}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                  Dự án liên kết
                </span>
                <p className="text-sm text-[#0F172A] font-medium">
                  {contract.project?.name || "—"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-[#EDF2F7] pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#4F75FF]" />
                <div className="space-y-0.5">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                    Ngày bắt đầu
                  </span>
                  <p className="text-xs font-mono text-[#0F172A]">
                    {contract.start_date}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#4F75FF]" />
                <div className="space-y-0.5">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                    Ngày kết thúc
                  </span>
                  <p className="text-xs font-mono text-[#0F172A]">
                    {contract.end_date || "Không giới hạn"}
                  </p>
                </div>
              </div>
            </div>

            {contract.notes && (
              <div className="border-t border-[#EDF2F7] pt-6 space-y-2">
                <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider block">
                  Điều khoản & Ghi chú
                </span>
                <p className="text-xs text-[#64748B] leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-[#EDF2F7] whitespace-pre-wrap">
                  {contract.notes}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar Info & Invoices */}
        <div className="space-y-6">
          {/* Client Visibility Card */}
          <Card className="p-5 space-y-3">
            <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Hiển thị với khách hàng
            </h4>
            <div className="flex items-center justify-between bg-[#F8FAFC] p-3.5 rounded-xl border border-[#EDF2F7]">
              <div className="flex items-center gap-2">
                {contract.client_visible ? (
                  <Eye className="w-4 h-4 text-emerald-600" />
                ) : (
                  <EyeOff className="w-4 h-4 text-[#94A3B8]" />
                )}
                <span className="text-xs font-bold text-[#0F172A]">
                  {contract.client_visible ? "Đang hiển thị" : "Đang ẩn"}
                </span>
              </div>

              <Button
                variant={contract.client_visible ? "outline" : "primary"}
                size="sm"
                disabled={transitioning}
                onClick={() => triggerToggleVisibility(contract.client_visible)}
              >
                {contract.client_visible ? "Ẩn đi" : "Hiển thị"}
              </Button>
            </div>
          </Card>

          {/* Invoices List Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
              <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Hóa đơn của hợp đồng
              </h4>
              <Link
                href={`${roleBasePath}/finance/invoices?contractId=${contract.id}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#4F75FF] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </Link>
            </div>

            {invoices.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#94A3B8]">
                Chưa có hóa đơn nào liên kết.
              </p>
            ) : (
              <div className="space-y-2.5">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-xl bg-[#F8FAFC] border border-[#EDF2F7] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-[#0F172A] font-mono">
                        {inv.invoice_number}
                      </p>
                      <p className="text-[10px] text-[#94A3B8] font-mono">
                        {inv.issue_date}
                      </p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="font-extrabold text-[#4F75FF]">
                        {formatCurrency(inv.amount, inv.currency_code)}
                      </p>
                      <Link
                        href={`${roleBasePath}/finance/invoices/${inv.id}`}
                        className="inline-flex items-center gap-0.5 text-[10px] text-[#64748B] hover:text-[#0F172A]"
                      >
                        <span>Chi tiết</span>
                        <ChevronLeft className="w-2.5 h-2.5 rotate-180" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

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
