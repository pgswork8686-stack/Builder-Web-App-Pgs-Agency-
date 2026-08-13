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
  FileText,
  DollarSign,
  Plus,
  X,
  CreditCard,
} from "lucide-react";
import { financeApi, Invoice, Payment } from "@/lib/api/finance";

export default function AdminInvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Record payment form states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payReference, setPayReference] = useState("");
  const [payMethod, setPayMethod] = useState("Chuyển khoản ngân hàng");
  const [payNotes, setPayNotes] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

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

  const handleTransition = async (status: string) => {
    setActionError(null);
    const confirmMsg =
      status === "cancelled"
        ? "Bạn có chắc chắn muốn HỦY hóa đơn này? Hành động này không thể hoàn tác."
        : `Bạn có chắc chắn muốn chuyển trạng thái hóa đơn thành "${
            status === "issued" ? "Đã phát hành" : "Quá hạn"
          }"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setTransitioning(true);
      await financeApi.transitionInvoice(id, status);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Chuyển trạng thái thất bại.");
    } finally {
      setTransitioning(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!payAmount || parseFloat(payAmount) <= 0 || !payDate) {
      setActionError("Vui lòng nhập số tiền hợp lệ và ngày thanh toán.");
      return;
    }

    const outstanding = (invoice?.amount || 0) - (invoice?.paid_amount || 0);
    if (parseFloat(payAmount) > outstanding) {
      setActionError("Số tiền thanh toán vượt quá dư nợ còn lại của hóa đơn.");
      return;
    }

    try {
      setPaySubmitting(true);
      // Construct UTC string from datetime-local input safely
      const paidTimestamp = new Date(payDate).toISOString();

      await financeApi.recordPayment(id, {
        amount: parseFloat(payAmount),
        paidAt: paidTimestamp,
        paymentReference: payReference || null,
        paymentMethod: payMethod || null,
        notes: payNotes || null,
      });

      // Clear form & close modal
      setPayAmount("");
      setPayDate("");
      setPayReference("");
      setPayMethod("Chuyển khoản ngân hàng");
      setPayNotes("");
      setShowPaymentModal(false);

      // Reload
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Ghi nhận thanh toán thất bại.");
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
    const isOverdue =
      (status === "issued" || status === "partially_paid") &&
      new Date(dueDate) < new Date();

    if (status === "overdue" || isOverdue) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-[#FF1744]/10 border border-[#FF1744]/30 text-[#FF1744] text-xs font-bold">
          Quá hạn
        </span>
      );
    }

    switch (status) {
      case "draft":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#151516] border border-[#FFC400]/30 text-[#FFC400] text-xs font-bold">
            Nháp (Draft)
          </span>
        );
      case "issued":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#FFC400]/10 border border-[#FFC400]/30 text-[#FFC400] text-xs font-bold">
            Đã phát hành (Issued)
          </span>
        );
      case "partially_paid":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-bold">
            Thanh toán một phần
          </span>
        );
      case "paid":
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] text-xs font-bold">
            Đã thanh toán (Paid)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707] text-[#FFF8E6] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#FFC400] animate-spin" />
        <span className="text-sm text-[#606060]">
          Đang tải chi tiết hóa đơn...
        </span>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-[#070707] text-[#FFF8E6] flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-12 h-12 text-[#FF1744]" />
        <span className="text-sm text-[#606060]">
          Không tìm thấy hóa đơn yêu cầu hoặc không có quyền truy cập.
        </span>
        <Link
          href="/app/admin/finance/invoices"
          className="text-xs text-[#FFC400] underline"
        >
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const outstanding = invoice.amount - invoice.paid_amount;
  const isPayable =
    invoice.status === "issued" ||
    invoice.status === "partially_paid" ||
    (invoice.status === "overdue" && outstanding > 0);

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-[#151516] bg-[#0E0E0F]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/app/admin/finance/invoices"
            className="p-2 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="font-bold text-base tracking-wide text-white">
            Hóa đơn{" "}
            <span className="text-[#FFC400] font-normal">
              | {invoice.invoice_number}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(invoice.status, invoice.due_date)}
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
              <div className="flex justify-between items-start gap-4">
                <div>
                  <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider">
                    Mã số hóa đơn
                  </span>
                  <h2 className="text-xl font-extrabold text-white mt-1 font-mono">
                    {invoice.invoice_number}
                  </h2>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                    Tổng số tiền
                  </span>
                  <span className="text-2xl font-black text-[#FFC400] mt-1 block">
                    {formatCurrency(invoice.amount, invoice.currency_code)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-b border-[#151516] py-6">
                <div>
                  <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                    Khách hàng
                  </span>
                  <span className="text-sm font-semibold text-[#FFF8E6]/90 mt-1 block">
                    {invoice.client_company?.name || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                    Hợp đồng liên quan
                  </span>
                  <span className="text-sm font-semibold text-[#FFF8E6]/90 mt-1 block">
                    {invoice.contract?.contract_number ? (
                      <Link
                        href={`/app/admin/finance/contracts/${invoice.contract_id}`}
                        className="text-[#FFC400] hover:underline font-mono"
                      >
                        {invoice.contract.contract_number}
                      </Link>
                    ) : (
                      "Không liên kết hợp đồng"
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#FFC400] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                      Ngày phát hành
                    </span>
                    <span className="text-sm text-white font-mono font-medium mt-0.5 block">
                      {invoice.issue_date}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#FFC400] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                      Hạn thanh toán
                    </span>
                    <span className="text-sm text-white font-mono font-medium mt-0.5 block">
                      {invoice.due_date}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                    Dư nợ còn lại
                  </span>
                  <span className="text-sm font-bold text-white block mt-0.5">
                    {formatCurrency(outstanding, invoice.currency_code)}
                  </span>
                </div>
              </div>

              {invoice.notes && (
                <div className="border-t border-[#151516] pt-6 space-y-2">
                  <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                    Ghi chú
                  </span>
                  <p className="text-xs text-[#FFF8E6]/70 leading-relaxed whitespace-pre-line">
                    {invoice.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Payments Timeline */}
            <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
              <div className="flex items-center justify-between border-b border-[#151516] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4.5 h-4.5 text-[#FFC400]" />
                  Lịch sử thanh toán ({payments.length})
                </h3>
              </div>

              {payments.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#606060]">
                  Chưa ghi nhận thanh toán nào cho hóa đơn này.
                </div>
              ) : (
                <div className="divide-y divide-[#151516]">
                  {payments.map((pay) => (
                    <div
                      key={pay.id}
                      className="py-3.5 flex items-start justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">
                            +{formatCurrency(pay.amount, invoice.currency_code)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[#151516] border border-[#1f1f22] text-[9px] text-[#606060]">
                            {pay.paymentMethod || "Khác"}
                          </span>
                        </div>
                        {pay.paymentReference && (
                          <div className="text-[#606060]">
                            Mã tham chiếu:{" "}
                            <span className="font-mono text-[#FFF8E6]/60">
                              {pay.paymentReference}
                            </span>
                          </div>
                        )}
                        {pay.notes && (
                          <p className="text-[#FFF8E6]/70 text-[11px] leading-relaxed">
                            {pay.notes}
                          </p>
                        )}
                        <div className="text-[10px] text-[#606060]">
                          Người ghi nhận:{" "}
                          <span className="text-[#FFF8E6]">
                            {pay.recordedBy || "Hệ thống"}
                          </span>
                        </div>
                      </div>

                      <span className="text-[#606060] text-[10px] shrink-0 font-mono">
                        {new Date(pay.paidAt).toLocaleString("vi-VN")}
                      </span>
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
                Thao tác hóa đơn
              </h3>

              {transitioning ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 text-[#FFC400] animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {invoice.status === "draft" && (
                    <>
                      <button
                        onClick={() => handleTransition("issued")}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FFC400] text-black font-bold text-xs hover:brightness-110 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-black" />
                        <span>Phát hành hóa đơn</span>
                      </button>

                      <button
                        onClick={() => handleTransition("cancelled")}
                        className="w-full py-2.5 rounded-xl bg-[#151516] border border-[#FF1744]/20 hover:border-[#FF1744]/50 text-[#FF1744] font-bold text-xs transition-all cursor-pointer"
                      >
                        <span>Hủy bỏ hóa đơn</span>
                      </button>
                    </>
                  )}

                  {isPayable && (
                    <>
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00E676] text-black font-bold text-xs hover:brightness-110 transition-all cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Ghi nhận thanh toán</span>
                      </button>

                      {invoice.status === "issued" && (
                        <button
                          onClick={() => handleTransition("overdue")}
                          className="w-full py-2.5 rounded-xl bg-[#151516] border border-[#FF1744]/20 hover:border-[#FF1744]/50 text-[#FF1744] font-bold text-xs transition-all cursor-pointer"
                        >
                          <span>Đánh dấu quá hạn</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleTransition("cancelled")}
                        className="w-full py-2.5 rounded-xl bg-[#151516] border border-transparent hover:border-[#FF1744]/30 text-[#606060] hover:text-[#FF1744] font-bold text-xs transition-all cursor-pointer"
                      >
                        <span>Hủy bỏ hóa đơn</span>
                      </button>
                    </>
                  )}

                  {(invoice.status === "paid" ||
                    invoice.status === "cancelled") && (
                    <div className="text-center py-4 text-xs text-[#606060] bg-[#151516] rounded-xl border border-[#1f1f22]">
                      Hóa đơn đã được đóng (
                      {invoice.status === "paid" ? "Đã thanh toán" : "Đã hủy"}).
                      không thể thao tác thêm.
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
                      invoice.client_visible
                        ? "text-[#00E676]"
                        : "text-[#FF1744]"
                    }`}
                  >
                    {invoice.client_visible ? "ĐANG HIỆN" : "ĐANG ẨN"}
                  </span>
                </div>
                <p className="text-[10px] text-[#606060] leading-relaxed">
                  Bật tùy chọn này để khách hàng liên kết kiểm tra hạn nợ và số
                  tiền thanh toán thực tế trực tuyến.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Record Payment Modal Dialog */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0E0E0F] border border-[#151516] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#151516] flex items-center justify-between bg-[#0c0c0d]">
              <h3 className="text-lg font-bold text-white">
                Ghi nhận thanh toán hóa đơn
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-[#606060] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleRecordPayment}
              className="p-6 overflow-y-auto space-y-4 flex-1"
            >
              <div>
                <span className="text-[10px] font-bold text-[#606060] uppercase tracking-wider block">
                  Dư nợ còn lại
                </span>
                <span className="text-xl font-black text-[#FFC400] block mt-0.5">
                  {formatCurrency(outstanding, invoice.currency_code)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                  Số tiền thu *
                </label>
                <input
                  type="number"
                  required
                  placeholder="VD: 5000000"
                  max={outstanding}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                  Thời gian thanh toán *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                  Mã tham chiếu thanh toán (Reference)
                </label>
                <input
                  type="text"
                  placeholder="Mã chuyển khoản, giao dịch..."
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                  Phương thức thanh toán
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer"
                >
                  <option value="Chuyển khoản ngân hàng">
                    Chuyển khoản ngân hàng
                  </option>
                  <option value="Tiền mặt">Tiền mặt</option>
                  <option value="Thẻ tín dụng">Thẻ tín dụng</option>
                  <option value="Ví điện tử">Ví điện tử</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                  Ghi chú thanh toán
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm thông tin giao dịch..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 resize-none"
                />
              </div>

              <div className="border-t border-[#151516] pt-4 flex items-center justify-end gap-3 bg-[#0E0E0F]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#151516] text-[#606060] hover:text-white transition-colors cursor-pointer text-xs font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="px-4 py-2 rounded-xl bg-[#00E676] text-black hover:brightness-110 font-bold transition-all disabled:opacity-40 cursor-pointer text-xs flex items-center gap-2"
                >
                  {paySubmitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Xác nhận thu tiền</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
