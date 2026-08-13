"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Plus,
  AlertCircle,
  CheckCircle,
  FileText,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  leaveApi,
  LeaveRequest,
  LeaveBalance,
  LeaveType,
} from "@/lib/api/leave";
import { FinanceConfirmDialog } from "@/components/finance/FinanceConfirmDialog";

export default function EmployeeLeavePage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);

  // New leave request states
  const [selectedType, setSelectedType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);
  const pageSize = 10;

  const loadMetadata = async () => {
    try {
      setLoading(true);
      const typesRes = await leaveApi.getLeaveTypes();
      setLeaveTypes(typesRes);

      const balancesRes = await leaveApi.getMyBalances();
      setBalances(balancesRes);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Không thể tải cấu hình nghỉ phép.",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async (pageNum: number) => {
    try {
      const res = await leaveApi.getMyRequests({ page: pageNum, pageSize });
      setRequests(res.items);
      setTotalRequests(res.total);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadRequests(page);
  }, [page]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !startDate || !endDate) {
      setFeedback({
        type: "error",
        message: "Vui lòng chọn loại nghỉ phép và thời gian.",
      });
      return;
    }

    try {
      setSubmitLoading(true);
      setFeedback(null);

      await leaveApi.createRequest({
        leaveTypeId: selectedType,
        startDate,
        endDate,
        reason: reason || null,
      });

      setFeedback({
        type: "success",
        message: "Đăng ký đơn xin nghỉ phép thành công. Đang chờ duyệt.",
      });

      // Clear form inputs
      setSelectedType("");
      setStartDate("");
      setEndDate("");
      setReason("");

      // Reload state
      await loadRequests(1);
      const balancesRes = await leaveApi.getMyBalances();
      setBalances(balancesRes);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Gửi yêu cầu thất bại.",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelTarget) return;

    const requestId = cancelTarget.id;

    try {
      setCancelLoading(requestId);
      setCancelTarget(null);
      setFeedback(null);

      await leaveApi.cancelRequest(requestId);
      setFeedback({
        type: "success",
        message: "Hủy đơn xin nghỉ phép thành công.",
      });

      await loadRequests(page);
      const balancesRes = await leaveApi.getMyBalances();
      setBalances(balancesRes);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Không thể hủy đơn phép.",
      });
    } finally {
      setCancelLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707] text-[#FFF8E6] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FFC400] animate-spin mb-4" />
        <span className="text-sm font-semibold tracking-wider text-[#606060]">
          Đang tải dữ liệu nghỉ phép...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-8">
        {/* Welcome Header */}
        <div className="border-b border-[#151516] pb-6">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Quản Lý Nghỉ Phép Cá Nhân
          </h1>
          <p className="mt-1 text-sm text-[#606060]">
            Theo dõi số dư ngày phép khả dụng, gửi đơn đăng ký mới và xem lịch
            sử nghỉ phép.
          </p>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
        )}

        {/* Leave Balances Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {balances.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-4 p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] text-center text-xs text-[#606060]">
              Không tìm thấy thông tin số dư phép khả dụng cho năm hiện tại.
            </div>
          ) : (
            balances.map((bal) => {
              const allocated = Number(bal.allocated_days);
              const adjusted = Number(bal.adjusted_days);
              const used = Number(bal.used_days);
              const available = allocated + adjusted - used;

              return (
                <div
                  key={bal.id}
                  className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-3 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#FFC400]/5 rounded-bl-full pointer-events-none" />
                  <div className="flex items-center justify-between text-[#606060]">
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {bal.leave_type?.name}
                    </span>
                    <Calendar className="w-4 h-4 text-[#FFC400]" />
                  </div>
                  <div className="text-3xl font-black text-white">
                    {available.toFixed(1)}{" "}
                    <span className="text-xs font-normal text-[#606060]">
                      ngày khả dụng
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] text-[#606060] border-t border-[#151516]">
                    <div>Được cấp: {allocated} ngày</div>
                    <div>Đã dùng: {used} ngày</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* New Leave Request Form */}
          <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-5 h-fit">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#FFC400]" />
              Tạo đơn xin nghỉ phép
            </h2>

            <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#606060] uppercase mb-1">
                  Loại phép đăng ký
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                >
                  <option value="">Chọn loại phép...</option>
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#606060] uppercase mb-1">
                    Từ ngày
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#606060] uppercase mb-1">
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#606060] uppercase mb-1">
                  Lý do xin nghỉ
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập lý do chi tiết..."
                  className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-4 py-3 text-white placeholder-[#606060] min-h-[80px] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full py-3 rounded-xl bg-[#FFC400] text-black font-extrabold transition-all hover:brightness-105"
              >
                {submitLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "GỬI ĐƠN ĐĂNG KÝ"
                )}
              </button>
            </form>
          </div>

          {/* Leave History List */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FFC400]" />
              Lịch sử nghỉ phép của bạn
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#151516] text-[#606060]">
                    <th className="py-3 px-4 uppercase font-semibold">
                      Loại phép
                    </th>
                    <th className="py-3 px-4 uppercase font-semibold">
                      Thời gian
                    </th>
                    <th className="py-3 px-4 uppercase font-semibold">
                      Số ngày
                    </th>
                    <th className="py-3 px-4 uppercase font-semibold">
                      Trạng thái
                    </th>
                    <th className="py-3 px-4 uppercase font-semibold text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151516]/50">
                  {requests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-[#606060]"
                      >
                        Bạn chưa gửi đơn xin nghỉ phép nào.
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr
                        key={req.id}
                        className="hover:bg-[#151516]/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {req.leave_type?.name}
                        </td>
                        <td className="py-3.5 px-4 text-[#FFF8E6]/80">
                          {req.start_date} ~ {req.end_date}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          {Number(req.total_days).toFixed(1)} ngày
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              req.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : req.status === "pending"
                                  ? "bg-amber-500/10 text-amber-400"
                                  : req.status === "rejected"
                                    ? "bg-rose-500/10 text-rose-400"
                                    : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {req.status === "approved"
                              ? "Đã duyệt"
                              : req.status === "pending"
                                ? "Chờ duyệt"
                                : req.status === "rejected"
                                  ? "Từ chối"
                                  : req.status === "cancelled"
                                    ? "Đã hủy"
                                    : req.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {req.status === "pending" && (
                            <button
                              onClick={() => setCancelTarget(req)}
                              disabled={cancelLoading === req.id}
                              className="p-1 text-rose-500 hover:text-rose-400 disabled:opacity-50 transition-colors"
                              title="Hủy đơn xin nghỉ"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <FinanceConfirmDialog
        isOpen={Boolean(cancelTarget)}
        title="Hủy đơn xin nghỉ"
        message="Bạn có chắc chắn muốn hủy đơn xin nghỉ phép này không? Thao tác này sẽ được gửi lên hệ thống ngay lập tức."
        isDanger
        onConfirm={handleCancelRequest}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
