"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ListTodo, Loader2, Plus } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { projectsApi, type Project } from "@/lib/api/projects";
import {
  tasksApi,
  type ProjectTask,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api/tasks";
import { getMe } from "@/lib/api/auth";
import { formatDate } from "@/lib/format";

type Row = ProjectTask & { projectName: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  todo: { label: "Cần làm", cls: "bg-[#F4F2FD] border-[#DDDFEA] text-[#475569]" },
  in_progress: { label: "Đang làm", cls: "bg-[#F2EEFF] border-[#E7E0FF] text-[#6044E8]" },
  review: { label: "Chờ duyệt nội bộ", cls: "bg-[#F2EEFF] border-[#E9D5FF] text-[#6D28D9]" },
  done: { label: "Hoàn thành", cls: "bg-[#E6FBF5] border-[#A7F3D0] text-[#047857]" },
  cancelled: { label: "Đã hủy", cls: "bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]" },
};
const APPROVAL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Chờ Trưởng phòng duyệt", cls: "bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]" },
  rejected: { label: "Bị từ chối", cls: "bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]" },
};
const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "todo", label: "Cần làm" },
  { key: "in_progress", label: "Đang làm" },
  { key: "review", label: "Chờ duyệt nội bộ" },
  { key: "pending", label: "Đề xuất chờ duyệt" },
  { key: "done", label: "Hoàn thành" },
];
const NEXT: Partial<Record<TaskStatus, { to: TaskStatus; label: string }>> = {
  todo: { to: "in_progress", label: "Bắt đầu" },
  in_progress: { to: "review", label: "Nộp kết quả" },
};

export default function EmployeeTasksPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    projectId: "",
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    dueDate: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [meRes, projRes] = await Promise.allSettled([
        getMe(),
        projectsApi.getInternalProjects(1, 50),
      ]);
      const me = meRes.status === "fulfilled" ? meRes.value.user?.id : undefined;
      const list = projRes.status === "fulfilled" ? projRes.value.items || [] : [];
      setProjects(list);
      const nested = await Promise.all(
        list.map(async (p) => {
          try {
            const res = await tasksApi.list(p.id, { assigneeUserId: me, pageSize: 100 });
            return (res.items || []).map((t) => ({ ...t, projectName: p.name }));
          } catch {
            return [];
          }
        }),
      );
      setTasks(nested.flat());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () =>
      tasks.filter((t) => {
        if (filter === "all") return true;
        if (filter === "pending") return t.approval_status === "pending";
        return t.status === filter && t.approval_status !== "pending";
      }),
    [tasks, filter],
  );

  const advance = async (t: Row) => {
    const next = NEXT[t.status];
    if (!next) return;
    setBusyId(t.id);
    setError(null);
    try {
      await tasksApi.update(t.project_id, t.id, { status: next.to });
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next.to } : x)));
      setNotice(
        next.to === "review"
          ? `Đã nộp kết quả "${t.title}". Trưởng phòng sẽ duyệt nội bộ.`
          : `Đã bắt đầu "${t.title}".`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được công việc.");
    } finally {
      setBusyId(null);
    }
  };

  const openPropose = () => {
    setForm({ projectId: projects[0]?.id ?? "", title: "", description: "", priority: "medium", dueDate: "" });
    setFormError(null);
    setOpen(true);
  };

  const submitPropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectId) return setFormError("Vui lòng chọn dự án.");
    if (!form.title.trim()) return setFormError("Vui lòng nhập tên công việc.");
    setSaving(true);
    setFormError(null);
    try {
      await tasksApi.create(form.projectId, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        dueDate: form.dueDate || null,
      });
      setOpen(false);
      setNotice("Đã gửi đề xuất. Công việc sẽ bắt đầu sau khi Trưởng phòng duyệt.");
      setFilter("pending");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không gửi được đề xuất.");
    } finally {
      setSaving(false);
    }
  };

  const count = (key: string) =>
    key === "all"
      ? tasks.length
      : key === "pending"
        ? tasks.filter((t) => t.approval_status === "pending").length
        : tasks.filter((t) => t.status === key && t.approval_status !== "pending").length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Công việc của tôi"
        description="Công việc được giao cho bạn theo từng dự án. Bạn có thể đề xuất thêm công việc để Trưởng phòng duyệt."
        badge={`${tasks.length} công việc`}
        action={
          <Button onClick={openPropose} disabled={loading || projects.length === 0} leftIcon={<Plus className="w-4 h-4" />}>Đề xuất công việc</Button>
        }
      />

      {notice && (
        <div role="status" className="rounded-xl border border-[#A7F3D0] bg-[#E6FBF5] text-[#047857] text-sm px-4 py-3">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-sm px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 min-h-11 sm:min-h-9 px-3.5 rounded-xl text-xs font-bold border transition-colors ${
              filter === f.key
                ? "bg-[#202333] border-[#202333] text-white"
                : "bg-white border-[#E7E9F0] text-[#475569] hover:bg-[#F2EEFF]"
            }`}
          >
            {f.label} <span className="opacity-70">({count(f.key)})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-[#475569]">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Đang tải công việc…
        </p>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E7E9F0] p-6">
          <EmptyState
            icon={<ListTodo className="w-8 h-8" />}
            title="Không có công việc nào"
            description={
              filter === "pending"
                ? "Bạn chưa có đề xuất nào đang chờ duyệt."
                : "Chưa có công việc ở nhóm này."
            }
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((t) => {
            const approval = t.approval_status && t.approval_status !== "approved" ? APPROVAL[t.approval_status] : null;
            const st = STATUS[t.status] ?? STATUS.todo;
            const next = !approval ? NEXT[t.status] : undefined;
            const late = !!(t.due_date && t.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10) && t.status !== "done");
            return (
              <li key={t.id} className="bg-white rounded-xl border border-[#E7E9F0] p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-[#5B3FD6] truncate">{t.projectName}</span>
                  <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${approval ? approval.cls : st.cls}`}>
                    {approval ? approval.label : st.label}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#202333] leading-snug">{t.title}</h3>
                {t.description && <p className="text-xs text-[#475569] line-clamp-2">{t.description}</p>}
                {t.approval_status === "rejected" && t.approval_note && (
                  <p className="text-xs text-[#B91C1C]">Lý do: {t.approval_note}</p>
                )}
                <p className={`text-xs ${late ? "text-[#B91C1C] font-bold" : "text-[#475569]"}`}>
                  Hạn: {formatDate(t.due_date)}
                </p>
                <div className="mt-auto pt-3 border-t border-[#E7E9F0] flex items-center justify-between gap-2">
                  <Link
                    href={`/app/projects/${t.project_id}/tasks/${t.id}`}
                    className="inline-flex items-center gap-1 min-h-11 sm:min-h-0 text-xs font-bold text-[#6044E8] hover:underline"
                  >
                    Chi tiết <ArrowRight className="w-3 h-3" />
                  </Link>
                  {next ? (
                    <Button variant="secondary" size="sm" disabled={busyId === t.id} onClick={() => advance(t)}>
                      {busyId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : next.label}
                    </Button>
                  ) : t.status === "done" ? (
                    <span className="text-xs font-bold text-[#047857] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đã xong
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Đề xuất công việc"
        description="Công việc sẽ được giao cho chính bạn và chỉ bắt đầu sau khi Trưởng phòng duyệt."
        maxWidth="lg"
      >
        <form onSubmit={submitPropose} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="propose-project" className="text-xs font-bold text-[#202333]">Dự án *</label>
            <Select
              id="propose-project"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} · {p.name}
                </option>
              ))}
            </Select>
          </div>
          <Input
            id="propose-title"
            label="Tên công việc *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ví dụ: Viết bài chuẩn SEO cho trang dịch vụ"
          />
          <div className="space-y-1.5">
            <label htmlFor="propose-desc" className="text-xs font-bold text-[#202333]">Mô tả</label>
            <textarea
              id="propose-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Nội dung, lý do đề xuất, đường dẫn tài liệu…"
              className="w-full rounded-xl bg-[#F8F9FC] border border-[#DDDFEA] px-4 py-3 text-sm text-[#202333] placeholder:text-[#64748B] outline-none focus:bg-white focus:border-[#6044E8]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="propose-priority" className="text-xs font-bold text-[#202333]">Ưu tiên</label>
              <Select
                id="propose-priority"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn cấp</option>
              </Select>
            </div>
            <Input
              id="propose-due"
              type="date"
              label="Hạn hoàn thành"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
          {formError && (
            <p role="alert" className="text-sm text-[#B91C1C]">{formError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gửi đề xuất"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
