"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, ClipboardCheck, Clock, Loader2 } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StateBanner } from "@/components/ui/state-banner";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { initials } from "@/components/dashboard/figma-widgets";
import { leaveApi, type LeaveRequest } from "@/lib/api/leave";
import { projectsApi } from "@/lib/api/projects";
import { tasksApi, type ProjectTask } from "@/lib/api/tasks";

type Tab = "leave" | "attendance" | "results";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "leave", label: "Nghỉ phép", icon: <CalendarDays className="w-4 h-4" /> },
  { key: "attendance", label: "Giải trình chấm công", icon: <Clock className="w-4 h-4" /> },
  { key: "results", label: "Kết quả công việc", icon: <ClipboardCheck className="w-4 h-4" /> },
];

const dm = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

export default function TeamLeaderApprovalsPage() {
  const [tab, setTab] = useState<Tab>("leave");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [reviewTasks, setReviewTasks] = useState<(ProjectTask & { projectCode?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [leave, projects] = await Promise.allSettled([
      leaveApi.getDirectory({ status: "pending", pageSize: 50 }),
      projectsApi.getInternalProjects(1, 20),
    ]);
    if (leave.status === "fulfilled") setRequests(leave.value.items || []);
    if (projects.status === "fulfilled") {
      const lists = await Promise.allSettled(
        (projects.value.items || []).map(async (p) => {
          const r = await tasksApi.list(p.id, { status: "review", pageSize: 50 });
          return (r.items || []).map((t) => ({ ...t, projectCode: p.projectCode ?? undefined }));
        }),
      );
      setReviewTasks(lists.flatMap((l) => (l.status === "fulfilled" ? l.value : [])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReview = async (id: string, action: "approved" | "rejected") => {
    setProcessingId(id);
    setFeedback(null);
    try {
      await leaveApi.reviewRequest(id, { action });
      setFeedback({
        type: "success",
        message: action === "approved" ? "Đã duyệt đơn nghỉ phép thành công." : "Đã từ chối đơn nghỉ phép.",
      });
      await load();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Xử lý phê duyệt thất bại. Vui lòng thử lại.",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const counts: Record<Tab, number> = {
    leave: requests.length,
    attendance: 0,
    results: reviewTasks.length,
  };
  const total = counts.leave + counts.results;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Đơn Cần Duyệt"
        description="Xét duyệt đơn xin nghỉ phép và giải trình từ thành viên trong nhóm."
        badge={`${total} đơn`}
        badgeVariant="gold"
      />

      {feedback && (
        <StateBanner
          type={feedback.type === "success" ? "success" : "error"}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <div role="tablist" className="flex gap-1 border-b border-[#F2EAD3]">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 -mb-px transition-colors ${
                active ? "text-[#3B5BDB] border-[#3B5BDB]" : "text-[#475569] border-transparent hover:text-[#161827]"
              }`}
            >
              {t.icon}
              {t.label}
              {counts[t.key] > 0 && (
                <span className="px-1.5 rounded-full bg-[#FFF8E5] text-[#8A6400] text-[10px] font-bold">{counts[t.key]}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#F2EAD3]">
          <Loader2 className="w-7 h-7 animate-spin text-[#3B5BDB] mx-auto" />
          <p className="mt-3 text-xs text-[#475569]">Đang tải danh sách chờ duyệt...</p>
        </div>
      ) : tab === "leave" ? (
        requests.length === 0 ? (
          <EmptyState title="Không có đơn nghỉ phép nào chờ duyệt" description="Tất cả các yêu cầu từ thành viên trong nhóm đã được xử lý xong." />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nhân viên</TableHeaderCell>
                  <TableHeaderCell>Loại nghỉ</TableHeaderCell>
                  <TableHeaderCell>Thời gian</TableHeaderCell>
                  <TableHeaderCell>Số ngày</TableHeaderCell>
                  <TableHeaderCell>Lý do</TableHeaderCell>
                  <TableHeaderCell>Thao tác</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((r) => {
                  const busy = processingId === r.id;
                  const name = r.employee?.fullName || "Nhân viên";
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#3B5BDB] text-[11px] font-bold grid place-items-center">{initials(name)}</span>
                          <span className="font-bold text-xs text-[#161827]">{name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-[#475569]">{r.leave_type?.name || "Nghỉ phép"}</TableCell>
                      <TableCell className="text-xs text-[#475569]">
                        {r.start_date === r.end_date ? dm(r.start_date) : `${dm(r.start_date)} – ${dm(r.end_date)}`}
                      </TableCell>
                      <TableCell className="text-xs text-[#475569]">{r.total_days}</TableCell>
                      <TableCell className="text-xs text-[#475569] max-w-[220px] truncate">{r.reason || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleReview(r.id, "approved")}
                            className="px-3 py-1 rounded-full border border-[#A7F3D0] bg-[#E6FBF5] text-[#047857] text-[10px] font-bold hover:brightness-95 disabled:opacity-50"
                          >
                            {busy ? "Đang xử lý…" : "Duyệt"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleReview(r.id, "rejected")}
                            className="px-3 py-1 rounded-full border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-bold hover:brightness-95 disabled:opacity-50"
                          >
                            Từ chối
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )
      ) : tab === "results" ? (
        reviewTasks.length === 0 ? (
          <EmptyState title="Không có kết quả công việc nào chờ duyệt" description="Khi thành viên nộp kết quả, công việc sẽ xuất hiện ở đây." />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Công việc</TableHeaderCell>
                  <TableHeaderCell>Dự án</TableHeaderCell>
                  <TableHeaderCell>Người thực hiện</TableHeaderCell>
                  <TableHeaderCell>Hạn</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reviewTasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-bold text-xs text-[#161827]">{t.title}</TableCell>
                    <TableCell className="text-xs text-[#475569]">{t.projectCode ?? "—"}</TableCell>
                    <TableCell className="text-xs text-[#475569]">{t.assignee?.full_name || "—"}</TableCell>
                    <TableCell className="text-xs text-[#475569]">{t.due_date ? dm(t.due_date) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      ) : (
        <EmptyState title="Chưa có giải trình chấm công nào" description="Khi thành viên gửi giải trình chấm công, yêu cầu sẽ xuất hiện ở đây." />
      )}
    </div>
  );
}
