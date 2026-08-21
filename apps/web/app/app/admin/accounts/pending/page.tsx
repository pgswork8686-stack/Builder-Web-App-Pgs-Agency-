"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  CheckCircle2,
  XCircle,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  AlertCircle,
} from "lucide-react";
import {
  getPendingUsers,
  approveUser,
  rejectUser,
  PendingUser,
} from "@/lib/api/admin";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/table";

const ROLE_OPTIONS = [
  { value: "team_leader", label: "Trưởng nhóm (Team Leader)" },
  { value: "employee", label: "Nhân viên (Employee)" },
  { value: "accountant", label: "Kế toán (Accountant)" },
  { value: "client", label: "Khách hàng (Client)" },
];

export default function AdminPendingAccountsPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>(
    {},
  );
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
  const [approveLoading, setApproveLoading] = useState<Record<string, boolean>>(
    {},
  );

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await getPendingUsers(1, 100);
      setUsers(response.items);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err.message || "Không thể tải danh sách tài khoản chờ duyệt.",
      );
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
        `Đã phê duyệt tài khoản ${user.fullName || user.email} với vai trò "${ROLE_OPTIONS.find((r) => r.value === assignedRole)?.label}".`,
      );
    } catch (err: any) {
      console.error(err);
      showNotification("error", err.message || "Phê duyệt tài khoản thất bại.");
    } finally {
      setApproveLoading((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const handleOpenRejectModal = (user: PendingUser) => {
    setRejectingUser(user);
    setRejectionReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectingUser) return;
    if (!rejectionReason.trim()) {
      showNotification("error", "Vui lòng nhập lý do từ chối.");
      return;
    }

    setRejectLoading(true);
    try {
      await rejectUser(rejectingUser.id, rejectionReason.trim());
      setUsers((prev) => prev.filter((u) => u.id !== rejectingUser.id));
      showNotification(
        "success",
        `Đã từ chối tài khoản ${rejectingUser.fullName || rejectingUser.email}.`,
      );
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
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.fullName && u.fullName.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <SectionHeader
        title="Duyệt & Phân quyền Tài khoản"
        description="Xét duyệt danh tính nhân sự mới đăng ký và cấp quyền truy cập các phân hệ phù hợp."
        badge={`${users.length} Yêu cầu chờ`}
      />

      {/* Global Alerts */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-3 animate-in fade-in duration-150 ${
            notification.type === "success"
              ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/40 border border-rose-500/30 text-rose-300"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-[#EDF2F7] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full sm:w-80 flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-[#94A3B8] pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs placeholder-[#94A3B8] outline-none focus:bg-white focus:border-[#4F75FF] transition-colors"
          />
        </div>

        <div className="text-xs text-[#64748B] hidden sm:block">
          Hiển thị:{" "}
          <span className="font-bold text-[#0F172A]">
            {filteredUsers.length}
          </span>{" "}
          tài khoản
        </div>
      </div>

      {/* Pending Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="w-8 h-8 text-[#00D09C]" />}
          title="Không có yêu cầu chờ duyệt"
          description={
            searchTerm
              ? "Không tìm thấy người dùng nào khớp với từ khóa tìm kiếm."
              : "Tất cả tài khoản đăng ký mới đã được xử lý xong."
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Người dùng</TableHeaderCell>
                <TableHeaderCell>Phương thức</TableHeaderCell>
                <TableHeaderCell>Thời gian đăng ký</TableHeaderCell>
                <TableHeaderCell>Chỉ định vai trò</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  Hành động
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => {
                const assignedRole = selectedRoles[user.id] || "";
                const isApproving = approveLoading[user.id] || false;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={user.avatarUrl}
                          name={user.fullName || user.email}
                          size="md"
                        />
                        <div>
                          <p className="font-bold text-[#0F172A]">
                            {user.fullName || "Chưa đặt tên"}
                          </p>
                          <p className="text-xs text-[#64748B]">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="gold" size="sm">
                        {user.accountStatus
                          ? user.accountStatus.toUpperCase()
                          : "PENDING"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-[#64748B]">
                      {new Date(user.createdAt).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>

                    <TableCell>
                      <select
                        value={assignedRole}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value)
                        }
                        className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] px-3 py-2 outline-none focus:bg-white focus:border-[#4F75FF] transition-colors"
                      >
                        <option value="">-- Chọn vai trò --</option>
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={!assignedRole || isApproving}
                          isLoading={isApproving}
                          onClick={() => handleApprove(user)}
                          leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                        >
                          Duyệt
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isApproving}
                          onClick={() => handleOpenRejectModal(user)}
                          leftIcon={<UserX className="w-3.5 h-3.5" />}
                        >
                          Từ chối
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Reject Modal */}
      <Dialog
        isOpen={!!rejectingUser}
        onClose={() => setRejectingUser(null)}
        maxWidth="sm"
        title="Từ chối yêu cầu tài khoản"
        description={`Nhập lý do từ chối cấp quyền cho tài khoản ${rejectingUser?.fullName || rejectingUser?.email}.`}
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Lý do từ chối *
            </label>
            <textarea
              rows={3}
              required
              placeholder="VD: Không thuộc danh sách nhân sự chính thức của doanh nghiệp..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#FF785A] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRejectingUser(null)}
              disabled={rejectLoading}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmReject}
              isLoading={rejectLoading}
            >
              Xác nhận từ chối
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
