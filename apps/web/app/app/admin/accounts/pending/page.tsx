"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ShieldCheck,
  Clock,
  ArrowLeft,
  ChevronDown,
  AlertTriangle,
  X,
  UserCheck,
  UserX,
} from "lucide-react";
import { getPendingUsers, approveUser, rejectUser, PendingUser } from "@/lib/api/admin";

const ROLE_OPTIONS = [
  { value: "team_leader", label: "Trưởng nhóm (Team Leader)" },
  { value: "employee", label: "Nhân viên (Employee)" },
  { value: "accountant", label: "Kế toán (Accountant)" },
  { value: "client", label: "Khách hàng (Client)" },
];

export default function AdminPendingAccountsPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Rejection Modal State
  const [rejectingUser, setRejectingUser] = useState<PendingUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await getPendingUsers(1, 100);
      setUsers(response.items);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Không thể tải danh sách tài khoản chờ duyệt.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRoleChange = (userId: string, newRole: string) => {
    setSelectedRoles((prev) => ({ ...prev, [userId]: newRole }));
  };

  const handleApprove = async (user: PendingUser) => {
    const assignedRole = selectedRoles[user.id];
    if (!assignedRole) {
      showNotification("error", "Vui lòng chọn vai trò trước khi phê duyệt.");
      return;
    }

    setApproveLoading((prev) => ({ ...prev, [user.id]: true }));
    try {
      await approveUser(user.id, assignedRole);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      showNotification(
        "success",
        `Đã phê duyệt tài khoản ${user.fullName || user.email} với vai trò "${ROLE_OPTIONS.find((r) => r.value === assignedRole)?.label}".`
      );
    } catch (err: any) {
      console.error(err);
      showNotification("error", err.message || "Phê duyệt tài khoản thất bại.");
    } finally {
      setApproveLoading((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const openRejectModal = (user: PendingUser) => {
    setRejectingUser(user);
    setRejectionReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectingUser) return;
    const user = rejectingUser;
    const trimmedReason = rejectionReason.trim();

    if (!trimmedReason || trimmedReason.length < 3 || trimmedReason.length > 500) {
      showNotification("error", "Lý do từ chối phải từ 3 đến 500 ký tự.");
      return;
    }

    setRejectLoading(true);
    try {
      await rejectUser(user.id, trimmedReason);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      showNotification("success", `Đã từ chối tài khoản ${user.fullName || user.email}.`);
      setRejectingUser(null);
    } catch (err: any) {
      console.error(err);
      showNotification("error", err.message || "Từ chối tài khoản thất bại.");
    } finally {
      setRejectLoading(false);
    }
  };

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const filteredUsers = users.filter(
    (u) =>
      (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 border-b border-[#151516] bg-[#0E0E0F]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/app/admin"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FFC400] text-black font-black flex items-center justify-center text-xs">
              P
            </div>
            <span className="font-bold text-sm tracking-wide text-white">
              PGS HUB <span className="text-[#FFC400] font-normal">| Admin Center</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#151516] border border-[#FFC400]/20 text-xs text-[#FFC400]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Quyền Admin</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-6">
        {/* Page Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#151516] pb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>Phê duyệt tài khoản người dùng</span>
              <span className="px-3 py-1 rounded-full bg-[#FFC400]/10 border border-[#FFC400]/30 text-[#FFC400] text-xs font-semibold">
                {users.length} Yêu cầu
              </span>
            </h1>
            <p className="mt-1 text-sm text-[#606060]">
              Kiểm duyệt thông tin đăng ký, phân vai trò chính thức và kích hoạt quyền truy cập cho nhân sự.
            </p>
          </div>
        </div>

        {/* Global Notification */}
        {notification && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
              notification.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                : "bg-red-950/40 border-red-500/30 text-red-300"
            }`}
          >
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-[#606060] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606060]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên hoặc email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0E0E0F] border border-[#151516] focus:border-[#FFC400] text-white text-sm placeholder-[#606060] outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-[#606060]">
            <Clock className="w-4 h-4 text-[#FFC400]" />
            <span>Kết nối thời gian thực với backend NestJS</span>
          </div>
        </div>

        {/* Pending Users Desktop Table */}
        <div className="bg-[#0E0E0F] border border-[#151516] rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-[#151516] bg-[#151516]/40 text-[11px] font-semibold uppercase tracking-wider text-[#606060]">
                  <th className="py-4 px-6">Người dùng</th>
                  <th className="py-4 px-4">Ngày đăng ký</th>
                  <th className="py-4 px-4">Vai trò chỉ định</th>
                  <th className="py-4 px-4">Trạng thái</th>
                  <th className="py-4 px-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151516] text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#606060]">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-[#FFC400] border-t-transparent rounded-full animate-spin" />
                        <span>Đang tải danh sách tài khoản chờ duyệt...</span>
                      </div>
                    </td>
                  </tr>
                ) : errorMsg ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-red-400">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                        <span>{errorMsg}</span>
                        <button onClick={loadData} className="mt-2 px-3 py-1.5 rounded-lg bg-[#151516] text-white text-xs font-semibold hover:bg-[#1f1f22]">
                          Thử lại
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#606060]">
                      <div className="flex flex-col items-center gap-2">
                        <UserCheck className="w-8 h-8 text-[#151516]" />
                        <span>Không có yêu cầu phê duyệt nào cần xử lý</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const currentRole = selectedRoles[user.id] || "";
                    const isApproveDisabled = !currentRole;
                    const isUserApproving = !!approveLoading[user.id];

                    return (
                      <tr key={user.id} className="hover:bg-[#151516]/30 transition-colors">
                        {/* User Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFC400] to-[#9A7216] text-black font-bold flex items-center justify-center text-sm shadow-md">
                              {(user.fullName || user.email || "P").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{user.fullName || "Chưa thiết lập"}</div>
                              <div className="text-xs text-[#606060]">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Registration Date */}
                        <td className="py-4 px-4 text-xs text-[#FFF8E6]/70 font-mono">
                          {new Date(user.createdAt).toLocaleString("vi-VN")}
                        </td>

                        {/* Role Select Dropdown */}
                        <td className="py-4 px-4">
                          <div className="relative inline-block w-52">
                            <select
                              value={currentRole}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              className="w-full appearance-none px-3 py-2 pr-8 rounded-lg bg-[#151516] border border-[#151516] hover:border-[#FFC400]/40 text-white text-xs font-medium focus:outline-none transition-colors cursor-pointer"
                            >
                              <option value="">Chọn vai trò...</option>
                              {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#606060] pointer-events-none" />
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFC400]/10 border border-[#FFC400]/30 text-[#FFC400] text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFC400] animate-pulse" />
                            Chờ duyệt
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={isApproveDisabled || isUserApproving}
                              onClick={() => handleApprove(user)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium text-xs transition-colors cursor-pointer ${
                                isApproveDisabled || isUserApproving
                                  ? "bg-[#151516] border-[#151516] text-[#606060] cursor-not-allowed"
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                              }`}
                            >
                              {isUserApproving ? (
                                <div className="w-3.5 h-3.5 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Phê duyệt</span>
                            </button>

                            <button
                              onClick={() => openRejectModal(user)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium text-xs transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Từ chối</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Rejection Modal */}
      {rejectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0E0E0F] border border-[#151516] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#151516] pb-4">
              <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                <span>Từ chối tài khoản</span>
              </div>
              <button onClick={() => setRejectingUser(null)} className="text-[#606060] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-[#FFF8E6]/80">
                Bạn đang thực hiện từ chối yêu cầu truy cập của tài khoản:
              </p>
              <div className="p-3 bg-[#151516] rounded-xl text-xs space-y-1">
                <div className="font-bold text-white">{rejectingUser.fullName || "Chưa thiết lập"}</div>
                <div className="text-[#606060]">{rejectingUser.email}</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#606060] mb-2">
                Lý do từ chối (Gửi đến người dùng)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Nhập lý do từ chối đăng ký tài khoản (tối thiểu 3 ký tự, tối đa 500 ký tự)"
                className="w-full p-3 rounded-xl bg-[#070707] border border-[#151516] focus:border-red-500/50 text-white text-sm placeholder-[#606060] outline-none transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingUser(null)}
                className="px-4 py-2 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={rejectLoading}
                onClick={handleConfirmReject}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-red-600/20"
              >
                {rejectLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UserX className="w-4 h-4" />
                )}
                <span>Xác nhận Từ chối</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
