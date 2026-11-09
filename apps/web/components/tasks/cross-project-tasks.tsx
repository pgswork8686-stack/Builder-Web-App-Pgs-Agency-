"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { ProjectTaskCreateDialog } from "@/components/phase4/project-task-create-dialog";
import { shortDate } from "@/components/dashboard/figma-widgets";
import { projectsApi, type Project } from "@/lib/api/projects";
import { tasksApi, type ProjectTask, type TaskStatus } from "@/lib/api/tasks";

type Role = "admin" | "team_leader";
type Row = ProjectTask & { project: Project };

const STATUS: Record<string, { label: string; cls: string }> = {
  todo: { label: "Cần làm", cls: "bg-[#EEF2FF] border-[#E0EAFF] text-[#3B5BDB]" },
  in_progress: { label: "Đang làm", cls: "bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]" },
  review: { label: "Chờ duyệt", cls: "bg-[#F3E8FF] border-[#E9D5FF] text-[#7356F1]" },
  done: { label: "Hoàn thành", cls: "bg-[#E6FBF5] border-[#A7F3D0] text-[#047857]" },
  cancelled: { label: "Đã hủy", cls: "bg-[#FBF3DC] border-[#E8DDB8] text-[#475569]" },
};
const PRIORITY: Record<string, string> = { low: "Thấp", medium: "Trung bình", high: "Cao", urgent: "Khẩn cấp" };
const COLUMNS: TaskStatus[] = ["todo", "in_progress", "review", "done"];

const COPY = {
  admin: {
    list: { title: "Danh sách công việc", description: "Quản lý và điều phối tất cả các đầu việc trong toàn bộ dự án của agency.", badge: "Danh sách" },
    kanban: { title: "Bảng Kanban tổng hợp", description: "Theo dõi luồng công việc của toàn agency theo trạng thái thực hiện.", badge: "Kanban" },
  },
  team_leader: {
    list: { title: "Công việc của nhóm", description: "Theo dõi toàn bộ các đầu việc được giao cho thành viên trong nhóm.", badge: "Danh sách" },
    kanban: { title: "Bảng Kanban nhóm", description: "Theo dõi luồng công việc của nhóm theo các trạng thái thực hiện.", badge: "Kanban" },
  },
} as const;

/** Công việc thật của mọi dự án người dùng được thấy: danh sách + Kanban + giao việc mới. */
export function CrossProjectTasks({ role, view }: { role: Role; view: "list" | "kanban" }) {
  const search = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pick, setPick] = useState(false); // chọn dự án để giao việc
  const [createFor, setCreateFor] = useState<Project | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res =
        role === "admin"
          ? await projectsApi.getAdminProjects({ page: 1, pageSize: 100 })
          : await projectsApi.getInternalProjects(1, 100);
      const list = (res.items || []).filter((p) => !["completed", "cancelled", "archived"].includes(p.status));
      setProjects(list);
      const results = await Promise.allSettled(list.map((p) => tasksApi.list(p.id, { pageSize: 100 })));
      const all: Row[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") (r.value.items || []).forEach((t) => all.push({ ...t, project: list[i] }));
      });
      setRows(all);
    } catch {
      setError("Không tải được danh sách công việc. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (search.get("new") === "1") setPick(true);
  }, [search]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!status || r.status === status) &&
        (!projectId || r.project_id === projectId) &&
        (!t || `${r.title} ${r.task_code ?? ""} ${r.assignee?.full_name ?? ""}`.toLowerCase().includes(t)),
    );
  }, [rows, q, status, projectId]);

  const taskHref = (r: Row) =>
    role === "admin" ? `/app/admin/projects/${r.project_id}/tasks/${r.id}` : `/app/projects/${r.project_id}/tasks/${r.id}`;
  const today = new Date().toISOString().slice(0, 10);
  const copy = COPY[role][view];

  const newButton = (
    <button
      type="button"
      onClick={() => setPick(true)}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E7AE18] hover:bg-[#CC9410] text-xs font-bold text-[#161827]"
    >
      <Plus className="w-4 h-4" /> Giao việc mới
    </button>
  );

  const Pill = ({ s }: { s: string }) => {
    const st = STATUS[s] ?? STATUS.todo;
    return <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${st.cls}`}>{st.label}</span>;
  };

  return (
    <div className="space-y-6">
      <TaskModuleHeader role={role} activeView={view} title={copy.title} description={copy.description} badge={copy.badge} actions={newButton} />

      <div className="bg-white rounded-2xl border border-[#F2EAD3] p-4 grid gap-3 md:grid-cols-[1fr_200px_220px]">
        <div className="relative">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm công việc" placeholder="Tìm công việc theo tên, mã, người phụ trách…"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#FFFBF0] border border-[#E8DDB8] text-sm placeholder:text-[#94A3B8] outline-none focus:bg-white focus:border-[#3B5BDB]"
          />
        </div>
        <Select aria-label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value)} className="!py-2.5">
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </Select>
        <Select aria-label="Dự án" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="!py-2.5">
          <option value="">Mọi dự án</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.projectCode} · {p.name}</option>
          ))}
        </Select>
      </div>

      {error && <div role="alert" className="rounded-2xl border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-sm px-4 py-3">{error}</div>}

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#F2EAD3]">
          <Loader2 className="w-7 h-7 animate-spin text-[#3B5BDB] mx-auto" />
          <p className="mt-3 text-xs text-[#475569]">Đang tải công việc…</p>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState title="Chưa có dự án đang chạy" description="Cần có dự án trước khi giao việc. Công việc được tạo bên trong từng dự án." />
      ) : view === "list" ? (
        visible.length === 0 ? (
          <EmptyState title="Chưa có công việc nào" description="Bấm “Giao việc mới” để tạo công việc đầu tiên cho một dự án." actionLabel="Giao việc mới" onAction={() => setPick(true)} />
        ) : (
          <div className="bg-white rounded-2xl border border-[#F2EAD3] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FBF3DC] text-left text-[11px] uppercase tracking-wide text-[#475569]">
                  <th className="px-5 py-3 font-bold">Công việc</th>
                  <th className="px-3 py-3 font-bold">Dự án</th>
                  <th className="px-3 py-3 font-bold">Người thực hiện</th>
                  <th className="px-3 py-3 font-bold">Ưu tiên</th>
                  <th className="px-3 py-3 font-bold">Hạn</th>
                  <th className="px-5 py-3 font-bold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2EAD3]">
                {visible.map((r) => {
                  const late = !!(r.due_date && r.due_date.slice(0, 10) < today && ["todo", "in_progress", "review"].includes(r.status));
                  return (
                    <tr key={r.id} className="hover:bg-[#FFFBF0]">
                      <td className="px-5 py-3.5">
                        <Link href={taskHref(r)} className="font-bold text-[#161827] hover:text-[#8A6400]">{r.title}</Link>
                        {r.task_code && <span className="ml-2 font-mono text-[11px] text-[#8A6400]">{r.task_code}</span>}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-[#475569]">{r.project.projectCode}</td>
                      <td className="px-3 py-3.5 text-xs text-[#475569]">{r.assignee?.full_name || "Chưa giao"}</td>
                      <td className="px-3 py-3.5 text-xs text-[#475569]">{PRIORITY[r.priority] ?? r.priority}</td>
                      <td className={`px-3 py-3.5 text-xs ${late ? "text-[#B91C1C] font-bold" : "text-[#475569]"}`}>{r.due_date ? shortDate(r.due_date.slice(0, 10)) : "—"}</td>
                      <td className="px-5 py-3.5"><Pill s={late ? "todo" : r.status} />{late && <span className="ml-1 px-2 py-0.5 rounded-full border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-bold">Quá hạn</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[420px]">
          {COLUMNS.map((col) => {
            const items = visible.filter((r) => r.status === col);
            return (
              <section key={col} className="p-4 rounded-2xl bg-white border border-[#F2EAD3] flex flex-col gap-3">
                <header className="flex items-center justify-between pb-2 border-b border-[#F2EAD3]">
                  <span className="text-xs font-bold text-[#161827]">{STATUS[col].label}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FBF3DC] text-[#475569]">{items.length}</span>
                </header>
                {items.length === 0 ? (
                  <p className="flex-1 grid place-items-center text-xs text-[#94A3B8] border border-dashed border-[#E8DDB8] rounded-xl p-4">Trống</p>
                ) : (
                  <ul className="space-y-2.5">
                    {items.map((r) => (
                      <li key={r.id}>
                        <Link href={taskHref(r)} className="block rounded-xl border border-[#F2EAD3] bg-[#FFFBF0] p-3 hover:border-[#E7AE18]">
                          <p className="text-[11px] font-mono text-[#8A6400]">{r.project.projectCode}{r.task_code ? ` · ${r.task_code}` : ""}</p>
                          <p className="text-sm font-bold text-[#161827] mt-0.5">{r.title}</p>
                          <p className="text-[11px] text-[#475569] mt-1.5 flex justify-between gap-2">
                            <span className="truncate">{r.assignee?.full_name || "Chưa giao"}</span>
                            <span>{r.due_date ? `Hạn ${shortDate(r.due_date.slice(0, 10))}` : ""}</span>
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Dialog isOpen={pick} onClose={() => setPick(false)} title="Giao việc mới" description="Chọn dự án để tạo công việc.">
        <div className="space-y-4 pt-2">
          {projects.length === 0 ? (
            <p className="text-sm text-[#475569]">Chưa có dự án đang chạy để giao việc.</p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { setPick(false); setCreateFor(p); }}
                    className="w-full text-left px-4 py-3 rounded-xl border border-[#E8DDB8] hover:bg-[#FFF8E5] hover:border-[#E7AE18]"
                  >
                    <span className="font-mono text-[11px] text-[#8A6400] mr-2">{p.projectCode}</span>
                    <span className="text-sm font-bold text-[#161827]">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>

      {createFor && (
        <ProjectTaskCreateDialog
          isOpen
          onClose={() => setCreateFor(null)}
          onCreated={load}
          projectId={createFor.id}
          projectName={createFor.name}
          projectCode={createFor.projectCode}
        />
      )}
    </div>
  );
}
