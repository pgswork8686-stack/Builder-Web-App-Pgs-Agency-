"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarDays,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { leaveApi, type LeaveRequest } from "@/lib/api/leave";

export default function TeamLeaderApprovalsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const res = await leaveApi.getDirectory({ status: "pending", pageSize: 50 });
      setRequests(res.items || []);
    } catch {
      // Safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPendingRequests();
  }, []);

  const handleReview = async (
    requestId: string,
    action: "approved" | "rejected",
  ) => {
    setProcessingId(requestId);
    setFeedback(null);
    try {
      await leaveApi.reviewRequest(requestId, { action });
      setFeedback({
        type: "success",
        message:
          action === "approved"
            ? "Đã duyệt đơn nghỉ phép thành công."
            : "Đã từ chối đơn nghỉ phép.",
      });
      await fetchPendingRequests();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Xử lý phê duyệt thất bại. Vui lòng thử lại.",
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Đơn Cần Duyệt (Pending Approvals)"
        description="Xét duyệt các đơn xin nghỉ phép và giải trình từ thành viên trong nhóm."
        badge="Phê duyệt"
        action={
          <Link href="/app/leave">
            <Button variant="secondary" size="sm">
              Xem lịch sử nghỉ phép
            </Button>
          </Link>
        }
      />

      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-[#E6FBF5] border-[#A7F3D0] text-[#13DEB9]"
              : "bg-red-50 border-red-200 text-red-600"
          }`}
        >
          {feedback.type === "success" ? (
            <ShieldCheck className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <Card className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#5D87FF] mx-auto" />
          <p className="mt-3 text-xs text-[#7C879D]">
            Đang tải danh sách đơn chờ duyệt...
          </p>
        </Card>
      ) : requests.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<UserCheck className="w-10 h-10 text-[#13DEB9]" />}
            title="Không có đơn nào đang chờ duyệt"
            description="Tất cả các yêu cầu từ thành viên trong nhóm đã được xử lý xong."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden border border-[#EDF2F7]">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nhân viên</TableHeaderCell>
                  <TableHeaderCell>Loại nghỉ</TableHeaderCell>
                  <TableHeaderCell>Thời gian</TableHeaderCell>
                  <TableHeaderCell>Số ngày</TableHeaderCell>
                  <TableHeaderCell>Lý do</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Thao tác
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((req) => {
                  const isProcessing = processingId === req.id;
                  return (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div className="font-bold text-xs text-[#24304A]">
                          {req.employee?.fullName || "Nhân viên"}
                        </div>
                        <div className="text-[11px] text-[#7C879D]">
                          {req.employee?.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="blue" size="sm">
                          {req.leave_type?.name || "Nghỉ phép"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-[#24304A]">
                          {new Date(req.start_date).toLocaleDateString("vi-VN")}{" "}
                          - {new Date(req.end_date).toLocaleDateString("vi-VN")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-xs text-[#24304A]">
                          {req.total_days} ngày
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-[#7C879D] max-w-xs truncate">
                          {req.reason || "—"}
                        </p>
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleReview(req.id, "approved")}
                            leftIcon={
                              isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )
                            }
                          >
                            Duyệt
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleReview(req.id, "rejected")}
                            leftIcon={<XCircle className="w-3.5 h-3.5" />}
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
        </Card>
      )}
    </div>
  );
}
