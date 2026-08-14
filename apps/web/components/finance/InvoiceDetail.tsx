"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  Loader2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Play,
  CreditCard,
  Eye,
  EyeOff,
  DollarSign,
} from "lucide-react";
import { financeApi, Invoice, Payment } from "@/lib/api/finance";
import {
  formatVietnamDateTime,
  isInvoiceOverdue,
  vietnamLocalDateTimeToIso,
} from "@/lib/finance-date";
import { FinanceConfirmDialog } from "./FinanceConfirmDialog";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface InvoiceDetailProps {
  roleBasePath: string;
}

export default function InvoiceDetail({ roleBasePath }: InvoiceDetailProps) {
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Record payment form states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payReference, setPayReference] = useState("");
  const [payMethod, setPayMethod] = useState("Chuyển khoản ngân hàng");
  const [payNotes, setPayNotes] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

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
      const invoiceData = await financeApi.getInvoiceById(id);
      setInvoice(invoiceData);

      const paymentsData = await financeApi.getPayments(id);
      setPayments(paymentsData);
    } catch (err: any) {
      console.error("Lỗi lấy chi tiết hóa đơn:", err);
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
      setConfirmTitle("Hủy hóa đơn");
      setConfirmMessage(
        "Bạn có chắc chắn muốn HỦY hóa đơn này? Hành động này không thể hoàn tác.",
      );
    } else if (status === "issued") {
      setConfirmTitle("Phát hành hóa đơn");
      setConfirmMessage(
        "Bạn có chắc chắn muốn phát hành hóa đơn này? Sau khi phát hành, thông tin hóa đơn sẽ không thể chỉnh sửa trực tiếp.",
      );
    } else if (status === "overdue") {
      setConfirmTitle("Đánh dấu quá hạn");
      setConfirmMessage(
        "Bạn có chắc chắn muốn chuyển trạng thái hóa đơn này thành quá hạn?",
      );
    }
    setConfirmOpen(true);
  };

  const handleTransition = async () => {
    setConfirmOpen(false);
    try {
      setTransitioning(true);
      await financeApi.transitionInvoice(id, confirmStatus);
      showToast("Cập nhật trạng thái hóa đơn thành công!");
      await loadData();
    } catch (err: any) {
      setActionError(
        err?.response?.data?.message ||
          "Không thể thay đổi trạng thái hóa đơn. Vui lòng kiểm tra lại điều kiện.",
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
      await financeApi.updateInvoice(id, {
        clientVisible: targetVisibility,
      });
      showToast(
        targetVisibility
          ? "Đã cho phép khách hàng xem hóa đơn này."
          : "Đã ẩn hóa đơn với khách hàng.",
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

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) {
      alert("Vui lòng nhập số tiền thanh toán hợp lệ (> 0)");
      return;
    }

    try {
      setPaySubmitting(true);
      const isoPaidAt = vietnamLocalDateTimeToIso(payDate);
      await financeApi.recordPayment(id, {
        amount: Number(payAmount),
        paidAt: isoPaidAt,
        paymentReference: payReference || undefined,
        paymentMethod: payMethod,
        notes: payNotes || undefined,
      });

      setShowPaymentModal(false);
      setPayAmount("");
      setPayDate("");
      setPayReference("");
      setPayNotes("");

      showToast("Đã ghi nhận thanh toán thành công!");
      await loadData();
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          "Lỗi khi ghi nhận thanh toán. Vui lòng kiểm tra lại số tiền.",
      );
    } finally {
      setPaySubmitting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    if (isInvoiceOverdue(status, dueDate)) {
      return (
        <Badge variant="danger" size="sm">
          {status === "partially_paid" ? "Quá hạn · Một phần" : "Quá hạn"}
        </Badge>
      );
    }

    switch (status) {
      case "draft":
        return <Badge variant="gold" size="sm">Nháp</Badge>;
      case "issued":
        return <Badge variant="blue" size="sm">Đã phát hành</Badge>;
      case "partially_paid":
        return <Badge variant="gold" size="sm">Thanh toán một phần</Badge>;
      case "paid":
        return <Badge variant="success" size="sm">Đã thanh toán</Badge>;
      case "cancelled":
        return <Badge variant="default" size="sm">Đã hủy</Badge>;
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

  if (!invoice) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-[#EDF2F7] space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-[#0F172A]">
          Không tìm thấy hóa đơn
        </h2>
        <p className="text-xs text-[#64748B]">
          Hóa đơn không tồn tại hoặc bạn không có quyền truy cập.
        </p>
        <Link href={`${roleBasePath}/finance/invoices`}>
          <Button variant="secondary" size="sm">Quay lại danh sách</Button>
        </Link>
      </div>
    );
  }

  const outstanding = invoice.amount - invoice.paid_amount;
  const isPayable =
    invoice.status === "issued" ||
    invoice.status === "partially_paid" ||
    (invoice.status === "overdue" && outstanding > 0);

  const canCancel =
    invoice.status === "draft" ||
    (invoice.status === "issued" && invoice.paid_amount === 0);
  const showMarkOverdueButton =
    invoice.status === "issued" &&
    isInvoiceOverdue(invoice.status, invoice.due_date);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 font-bold text-xs">
          <CheckCircle className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <SectionHeader
        title={`Hóa đơn: ${invoice.invoice_number}`}
        description={`Khách hàng: ${invoice.client_company?.name || "—"}`}
        badge={invoice.status ? invoice.status.toUpperCase() : undefined}
        action={
          <div className="flex items-center gap-3">
            <Link href={`${roleBasePath}/finance/invoices`}>
              <Button variant="secondary" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
                Quay lại
              </Button>
            </Link>

            {invoice.status === "draft" && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => triggerTransitionConfirm("issued")}
                  leftIcon={<Play className="w-3.5 h-3.5" />}
                >
                  Phát hành hóa đơn
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => triggerTransitionConfirm("cancelled")}
                >
                  Hủy bỏ
                </Button>
              </>
            )}

            {isPayable && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowPaymentModal(true)}
                  leftIcon={<DollarSign className="w-3.5 h-3.5" />}
                >
                  Ghi nhận thanh toán
                </Button>

                {showMarkOverdueButton && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => triggerTransitionConfirm("overdue")}
                  >
                    Đánh dấu quá hạn
                  </Button>
                )}

                {canCancel && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => triggerTransitionConfirm("cancelled")}
                  >
                    Hủy bỏ
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Main Content */}
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
            <div className="flex justify-between items-start gap-4">
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                  Mã số hóa đơn
                </span>
                <h2 className="text-xl font-extrabold text-[#0F172A] mt-1 font-mono">
                  {invoice.invoice_number}
                </h2>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Tổng số tiền
                </span>
                <span className="text-2xl font-black text-[#4F75FF] mt-1 block">
                  {formatCurrency(invoice.amount, invoice.currency_code)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-b border-[#EDF2F7] py-6">
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Khách hàng
                </span>
                <span className="text-sm font-semibold text-[#0F172A] mt-1 block">
                  {invoice.client_company?.name || "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Hợp đồng liên quan
                </span>
                <span className="text-sm font-semibold text-[#0F172A] mt-1 block">
                  {invoice.contract_id ? (
                    <Link
                      href={`${roleBasePath}/finance/contracts/${invoice.contract_id}`}
                      className="text-[#4F75FF] hover:underline font-mono"
                    >
                      {invoice.contract?.contract_number || "Xem chi tiết"}
                    </Link>
                  ) : (
                    "Không liên kết hợp đồng"
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#4F75FF] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Ngày phát hành
                  </span>
                  <span className="text-sm text-[#0F172A] font-mono font-medium mt-0.5 block">
                    {invoice.issue_date}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#4F75FF] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Hạn thanh toán
                  </span>
                  <span className="text-sm text-[#0F172A] font-mono font-medium mt-0.5 block">
                    {invoice.due_date}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Dư nợ còn lại
                </span>
                <span className="text-sm font-bold text-[#0F172A] block mt-0.5">
                  {formatCurrency(outstanding, invoice.currency_code)}
                </span>
              </div>
            </div>

            {invoice.notes && (
              <div className="border-t border-[#EDF2F7] pt-6 space-y-2">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Ghi chú
                </span>
                <p className="text-xs text-[#64748B] leading-relaxed whitespace-pre-line bg-[#F8FAFC] p-4 rounded-xl border border-[#EDF2F7]">
                  {invoice.notes}
                </p>
              </div>
            )}
          </Card>

          {/* Payments Timeline */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
              <h3 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                <CreditCard className="w-4.5 h-4.5 text-[#4F75FF]" />
                Lịch sử thanh toán ({payments.length})
              </h3>
            </div>

            {payments.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#94A3B8]">
                Chưa ghi nhận thanh toán nào cho hóa đơn này.
              </p>
            ) : (
              <div className="divide-y divide-[#EDF2F7]">
                {payments.map((pay) => (
                  <div
                    key={pay.id}
                    className="py-3.5 flex items-start justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-emerald-600">
                          +{formatCurrency(pay.amount, invoice.currency_code)}
                        </span>
                        <Badge variant="blue" size="sm">
                          {pay.paymentMethod || "Khác"}
                        </Badge>
                      </div>
                      {pay.paymentReference && (
                        <div className="text-[#64748B] text-[11px]">
                          Mã tham chiếu:{" "}
                          <span className="font-mono text-[#0F172A]">
                            {pay.paymentReference}
                          </span>
                        </div>
                      )}
                      {pay.notes && (
                        <p className="text-[#64748B] text-[11px] leading-relaxed">
                          {pay.notes}
                        </p>
                      )}
                      <div className="text-[10px] text-[#94A3B8]">
                        Người ghi nhận:{" "}
                        <span className="font-semibold text-[#0F172A]">
                          {pay.recordedBy || "Hệ thống"}
                        </span>
                      </div>
                    </div>

                    <span className="text-[#94A3B8] text-[10px] shrink-0 font-mono">
                      {formatVietnamDateTime(pay.paidAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Action sidebar panel */}
        <div className="space-y-6">
          {/* Client Visibility Panel */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#EDF2F7] pb-3">
              Cổng thông tin Khách hàng
            </h3>
            <div className="flex items-center justify-between text-xs bg-[#F8FAFC] p-3.5 rounded-xl border border-[#EDF2F7]">
              <div className="flex items-center gap-2">
                {invoice.client_visible ? (
                  <Eye className="w-4 h-4 text-emerald-600" />
                ) : (
                  <EyeOff className="w-4 h-4 text-[#94A3B8]" />
                )}
                <span className="font-bold text-xs text-[#0F172A]">
                  {invoice.client_visible ? "Đang hiển thị" : "Đang ẩn"}
                </span>
              </div>

              <Button
                variant={invoice.client_visible ? "outline" : "primary"}
                size="sm"
                disabled={transitioning}
                onClick={() =>
                  triggerToggleVisibility(invoice.client_visible)
                }
              >
                {invoice.client_visible ? "Ẩn đi" : "Hiển thị"}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <Dialog
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          maxWidth="md"
          title="Ghi nhận thanh toán"
          description="Ghi nhận khoản thanh toán từ khách hàng cho hóa đơn này."
        >
          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#64748B] mb-1">
                Số tiền thanh toán *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] font-bold">
                  {invoice.currency_code}
                </span>
                <input
                  type="number"
                  required
                  placeholder="VD: 5000000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full pl-12 pr-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs font-bold outline-none focus:bg-white focus:border-[#4F75FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#64748B] mb-1">
                Ngày & Giờ giao dịch *
              </label>
              <input
                type="datetime-local"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#64748B] mb-1">
                Phương thức thanh toán
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF]"
              >
                <option value="Chuyển khoản ngân hàng">Chuyển khoản ngân hàng</option>
                <option value="Tiền mặt">Tiền mặt</option>
                <option value="Thẻ tín dụng">Thẻ tín dụng</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#64748B] mb-1">
                Mã tham chiếu giao dịch
              </label>
              <input
                type="text"
                placeholder="Mã giao dịch ngân hàng, mã bill..."
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#64748B] mb-1">
                Ghi chú thanh toán
              </label>
              <textarea
                rows={2}
                placeholder="Ghi chú thêm về giao dịch..."
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] resize-none"
              />
            </div>

            <div className="border-t border-[#EDF2F7] pt-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowPaymentModal(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={paySubmitting}
                isLoading={paySubmitting}
              >
                Ghi nhận thanh toán
              </Button>
            </div>
          </form>
        </Dialog>
      )}

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
        } hóa đơn này đối với tài khoản khách hàng trên cổng thông tin?`}
        onConfirm={handleToggleVisibility}
        onCancel={() => setToggleVisibleOpen(false)}
      />
    </div>
  );
}
