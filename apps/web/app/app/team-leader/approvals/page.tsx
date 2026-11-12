"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StateBanner } from "@/components/ui/state-banner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/v2/data-table";
import { Drawer, DrawerField } from "@/components/v2/drawer";
import { leaveApi, type LeaveRequest } from "@/lib/api/leave";
import { projectsApi } from "@/lib/api/projects";
import { tasksApi, type ProjectTask } from "@/lib/api/tasks";
import { statusLabel } from "@/lib/labels";

/** Hộp Cần xử lý (V2): một danh sách cho mọi việc chờ Trưởng phòng; duyệt trong drawer, không rời trang. */
type Kind = "proposal" | "result" | "leave";
type Task = ProjectTask & { projectCode?: string };
interface Item {
  key: string;
  kind: Kind;
  title: string;
  context: string;
  person: string;
  date: string | null;
  task?: Task;
  leave?: LeaveRequest;
}

const KIND: Record<Kind, { label: string; badge: "warning" | "purple" | "blue" }> = {
  proposal: { label: "Đề xuất việc", badge: "warning" },
  result: { label: "Kết quả chờ duyệt", badge: "purple" },
  leave: { label: "Nghỉ phép", badge: "blue" },
};
const FILTERS: { key: "all" | Kind; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "proposal", label: "Đề xuất việc" },
  { key: "result", label: "Kết quả chờ duyệt" },
  { key: "leave", label: "Nghỉ phép" },
];
const dmy = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

export default function TeamLeaderApprovalsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [reviewTasks, setReviewTasks] = useState<Task[]>([]);
  const [proposals, setProposals] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [open, setOpen] = useState<Item | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [leave, projects] = await Promise.allSettled([
      leaveApi.getDirectory({ status: "pending", pageSize: 50 }),
      // shortcut: lấy 20 dự án đầu; phòng có hơn 20 dự án đang chạy cần endpoint tổng hợp phía API.
      projectsApi.getInternalProjects(1, 20),
    ]);
    if (leave.status === "fulfilled") setRequests(leave.value.items || []);
    if (projects.status === "fulfilled") {
      const lists = await Promise.allSettled(
        (projects.value.items || []).map(async (p) => {
          const [review, pending] = await Promise.all([
            tasksApi.list(p.id, { status: "review", pageSize: 50 }),
            tasksApi.list(p.id, { approvalStatus: "pending", pageSize: 50 }),
          ]);
          const tag = (t: ProjectTask) => ({ ...t, projectCode: p.projectCode ?? undefined });
          return { review: (review.items || []).map(tag), pending: (pending.items || []).map(tag) };
        }),
      );
      const ok = lists.flatMap((l) => (l.status === "fulfilled" ? [l.value] : []));
      setReviewTasks(ok.flatMap((x) => x.review));
      setProposals(ok.flatMap((x) => x.pending));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<Item[]>(() => {
    const fromTask = (kind: Kind) => (t: Task): Item => ({
      key: `${kind}-${t.id}`,
      kind,
      title: t.title,
      context: [t.projectCode, t.due_date ? `hạn ${dmy(t.due_date)}` : null].filter(Boolean).join(" · ") || "—",
      person: t.assignee?.full_name || t.assignee?.email || "—",
      date: t.updated_at ?? t.created_at ?? null,
      task: t,
    });
    const all = [
      ...proposals.map(fromTask("proposal")),
      ...reviewTasks.map(fromTask("result")),
      ...requests.map<Item>((r) => ({
        key: `leave-${r.id}`,
        kind: "leave",
        title: `${r.leave_type?.name || "Nghỉ phép"} · ${r.total_days} ngày`,
        context: `${dmy(r.start_date)} – ${dmy(r.end_date)}`,
        person: r.employee?.fullName || r.employee?.email || "—",
        date: r.created_at,
        leave: r,
      })),
    ];
    // Việc chờ lâu nhất lên trước.
    return all.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }, [proposals, reviewTasks, requests]);

  const count = (k: "all" | Kind) => (k === "all" ? items.length : items.filter((i) => i.kind === k).length);
  const shown = filter === "all" ? items : items.filter((i) => i.kind === filter);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await fn();
      setFeedback({ type: "success", message });
      setOpen(null);
      setNote("");
      await load();
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Xử lý thất bại. Vui lòng thử lại." });
    } finally {
      setBusy(false);
    }
  };

  const decide = (approve: boolean) => {
    if (!open) return;
    const reason = note.trim();
    if (!approve && !reason) {
      setFeedback({ type: "error", message: "Nhập lý do để người gửi biết cần làm gì." });
      return;
    }
    const t = open.task;
    if (open.kind === "proposal" && t)
      return act(() => tasksApi.reviewProposal(t.project_id, t.id, approve ? { action: "approve" } : { action: "reject", note: reason }), approve ? `Đã duyệt công việc "${t.title}".` : `Đã từ chối công việc "${t.title}".`);
    if (open.kind === "result" && t)
      return act(() => tasksApi.update(t.project_id, t.id, { status: approve ? "done" : "in_progress" }), approve ? `Đã duyệt nội bộ "${t.title}".` : `Đã trả lại "${t.title}" để chỉnh sửa.`);
    if (open.kind === "leave" && open.leave)
      return act(() => leaveApi.reviewRequest(open.leave!.id, approve ? { action: "approved" } : { action: "rejected", reviewNote: reason }), approve ? "Đã duyệt đơn nghỉ phép." : "Đã từ chối đơn nghỉ phép.");
  };

  const columns: Column<Item>[] = [
    { key: "kind", header: "Loại", className: "w-44", render: (i) => <Badge variant={KIND[i.kind].badge} size="sm">{KIND[i.kind].label}</Badge>, hideOnMobile: true },
    {
      key: "title",
      header: "Nội dung",
      render: (i) => (
        <div className="min-w-0">
          <p className="font-medium text-[#202333] truncate">{i.title}</p>
          <p className="text-xs text-[#64748B] truncate">
            <span className="md:hidden">{KIND[i.kind].label} · </span>
            {i.context}
          </p>
        </div>
      ),
    },
    { key: "person", header: "Người gửi", className: "w-48 whitespace-nowrap", render: (i) => <span className="text-[#475569]">{i.person}</span> },
    { key: "date", header: "Gửi lúc", className: "w-32 whitespace-nowrap tabular-nums", render: (i) => <span className="text-[#475569]">{dmy(i.date)}</span> },
  ];

  const approveLabel = open?.kind === "result" ? "Duyệt nội bộ" : "Duyệt";
  const rejectLabel = open?.kind === "result" ? "Yêu cầu sửa" : "Từ chối";

  return (
    <div className="space-y-4">
      <SectionHeader title="Cần xử lý" description={loading ? "Đang tải…" : items.length ? `${items.length} mục đang chờ bạn. Bấm một dòng để xem và duyệt.` : "Không có mục nào chờ bạn."} />

      {feedback && !open && <StateBanner type={feedback.type} message={feedback.message} />}

      <DataTable
        columns={columns}
        rows={shown}
        rowKey={(i) => i.key}
        loading={loading}
        onRowClick={(i) => {
          setOpen(i);
          setNote("");
          setFeedback(null);
        }}
        selectedKey={open?.key}
        toolbar={
          <div role="tablist" aria-label="Lọc theo loại" className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`h-9 px-3 rounded-lg text-sm transition-colors ${filter === f.key ? "bg-[#F2EEFF] text-[#5B3FD6] font-semibold" : "text-[#475569] hover:bg-[#F2F4F7]"}`}
              >
                {f.label} <span className="tabular-nums text-[#94A3B8]">{count(f.key)}</span>
              </button>
            ))}
          </div>
        }
        empty={{ title: "Không có mục nào cần xử lý", text: "Đề xuất việc, kết quả cần duyệt và đơn nghỉ phép của phòng sẽ hiện ở đây." }}
      />

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.title ?? ""}
        subtitle={open && <Badge variant={KIND[open.kind].badge} size="sm">{KIND[open.kind].label}</Badge>}
        footer={
          open && (
            <>
              <Button variant="secondary" disabled={busy} onClick={() => decide(false)}>{rejectLabel}</Button>
              <Button variant="primary" isLoading={busy} onClick={() => decide(true)}>{approveLabel}</Button>
            </>
          )
        }
      >
        {open && (
          <>
            {feedback && <StateBanner type={feedback.type} message={feedback.message} />}
            <div className="space-y-2.5">
              <DrawerField label="Người gửi">{open.person}</DrawerField>
              {open.task && (
                <>
                  <DrawerField label="Dự án">{open.task.projectCode || "—"}</DrawerField>
                  <DrawerField label="Hạn">{dmy(open.task.due_date)}</DrawerField>
                  <DrawerField label="Ưu tiên">{statusLabel(open.task.priority)}</DrawerField>
                  {open.task.description && <DrawerField label="Mô tả">{open.task.description}</DrawerField>}
                </>
              )}
              {open.leave && (
                <>
                  <DrawerField label="Loại nghỉ">{open.leave.leave_type?.name || "Nghỉ phép"}</DrawerField>
                  <DrawerField label="Thời gian">{`${dmy(open.leave.start_date)} – ${dmy(open.leave.end_date)} (${open.leave.total_days} ngày)`}</DrawerField>
                  <DrawerField label="Lý do">{open.leave.reason || "—"}</DrawerField>
                </>
              )}
              <DrawerField label="Gửi lúc">{dmy(open.date)}</DrawerField>
            </div>
            {open.kind === "result" && <p className="text-sm text-[#475569] bg-[#F8F9FC] rounded-lg px-3 py-2">Duyệt nội bộ không tự công khai cho khách hàng.</p>}
            <label className="block">
              <span className="text-sm font-medium text-[#202333]">Lý do (bắt buộc khi {rejectLabel.toLowerCase()})</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-[#DDDFEA] px-3 py-2 text-sm focus:outline-none focus:border-[#6044E8] focus:ring-2 focus:ring-[#6044E8]/20"
                placeholder="Ví dụ: Bổ sung kích thước 1080×1920 rồi nộp lại."
              />
            </label>
          </>
        )}
      </Drawer>
    </div>
  );
}
