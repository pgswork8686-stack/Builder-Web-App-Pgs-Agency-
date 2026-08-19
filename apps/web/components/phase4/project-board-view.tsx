"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Search } from "lucide-react";
import { projectsApi, type Project } from "@/lib/api/projects";
import { tasksApi, type TaskPriority } from "@/lib/api/tasks";
import {
  workspaceApi,
  type BoardStatus,
  type BoardTask,
  type ProjectBoard,
} from "@/lib/api/workspace";
import { ProjectTaskCreateDialog } from "./project-task-create-dialog";
import {
  ProjectWorkspaceRealtimeProvider,
  useProjectWorkspaceRealtime,
} from "./project-workspace-realtime-provider";
import { WorkspaceHeader, type WorkspaceMode } from "./workspace-header";

const columns: {
  status: BoardStatus;
  label: string;
  key: keyof ProjectBoard;
}[] = [
  { status: "todo", label: "Cần làm", key: "todo" },
  { status: "in_progress", label: "Đang thực hiện", key: "inProgress" },
  { status: "review", label: "Đang duyệt", key: "review" },
  { status: "done", label: "Hoàn thành", key: "done" },
];

export function ProjectBoardView({ mode }: { mode: WorkspaceMode }) {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ProjectWorkspaceRealtimeProvider projectId={projectId}>
      <ProjectBoardContent mode={mode} projectId={projectId} />
    </ProjectWorkspaceRealtimeProvider>
  );
}

function ProjectBoardContent({
  mode,
  projectId,
}: {
  mode: WorkspaceMode;
  projectId: string;
}) {
  const { revision } = useProjectWorkspaceRealtime();
  const [project, setProject] = useState<Project | null>(null);
  const [board, setBoard] = useState<ProjectBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<BoardStatus | null>(null);
  const [filters, setFilters] = useState({
    q: "",
    priority: "" as "" | TaskPriority,
    assigneeUserId: "",
    status: "" as "" | BoardStatus,
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [projectData, boardData] = await Promise.all([
        mode === "admin"
          ? projectsApi.getAdminProject(projectId)
          : projectsApi.getInternalProject(projectId),
        workspaceApi.board(projectId, {
          q: filters.q || undefined,
          priority: filters.priority || undefined,
          assigneeUserId: filters.assigneeUserId || undefined,
          status: filters.status || undefined,
        }),
      ]);
      setProject(projectData);
      setBoard(boardData);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tải Kanban.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, mode, projectId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load, revision]);

  const allTasks = useMemo(
    () =>
      board
        ? [...board.todo, ...board.inProgress, ...board.review, ...board.done]
        : [],
    [board],
  );
  const assignees = useMemo(() => {
    const values = new Map<string, string>();
    allTasks.forEach((task) => {
      if (task.assignee?.id) {
        values.set(
          task.assignee.id,
          task.assignee.full_name || task.assignee.email || "Thành viên",
        );
      }
    });
    return [...values.entries()];
  }, [allTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const optimisticMove = (
    current: ProjectBoard,
    taskId: string,
    targetStatus: BoardStatus,
    beforeTaskId: string | null,
  ) => {
    const task = allTasks.find((item) => item.id === taskId);
    if (!task) return current;
    const next: ProjectBoard = {
      ...current,
      todo: current.todo.filter((item) => item.id !== taskId),
      inProgress: current.inProgress.filter((item) => item.id !== taskId),
      review: current.review.filter((item) => item.id !== taskId),
      done: current.done.filter((item) => item.id !== taskId),
    };
    const targetColumn = columns.find(
      (column) => column.status === targetStatus,
    );
    if (!targetColumn) return current;
    const target = next[targetColumn.key] as BoardTask[];
    const moved = { ...task, status: targetStatus };
    const inserted: BoardTask[] = [];
    let didInsert = false;
    target.forEach((item) => {
      if (!didInsert && item.id === beforeTaskId) {
        inserted.push(moved);
        didInsert = true;
      }
      inserted.push(item);
    });
    if (!didInsert) inserted.push(moved);
    return { ...next, [targetColumn.key]: inserted };
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!board?.canReorder || !over || saving) return;
    const taskId = String(active.id).replace("task:", "");
    const targetStatus = over.data.current?.status as BoardStatus | undefined;
    if (!targetStatus) return;
    const overTaskId = over.data.current?.taskId as string | undefined;
    const beforeTaskId =
      overTaskId && overTaskId !== taskId ? overTaskId : null;
    const previous = board;
    setBoard(optimisticMove(board, taskId, targetStatus, beforeTaskId));
    setSaving(true);
    setError(null);
    try {
      await workspaceApi.moveTask(projectId, taskId, {
        status: targetStatus,
        beforeTaskId,
        afterTaskId: null,
      });
      await load();
    } catch (caught) {
      setBoard(previous);
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể di chuyển công việc.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (task: BoardTask, status: BoardStatus) => {
    setSaving(true);
    setError(null);
    try {
      await tasksApi.update(projectId, task.id, { status });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật trạng thái.",
      );
    } finally {
      setSaving(false);
    }
  };

  const canCreateTask =
    mode === "admin" || project?.currentProjectRole === "project_manager";
  const base = mode === "admin" ? "/app/admin/projects" : "/app/projects";

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-7 text-[#0F172A] lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <WorkspaceHeader
          mode={mode}
          projectId={projectId}
          projectName={project?.name}
          projectCode={project?.projectCode}
          active="board"
        />

        <section className="grid gap-3 rounded-2xl border border-[#EDF2F7] bg-white p-4 shadow-xs md:grid-cols-[minmax(220px,1fr)_180px_200px_180px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <input
              value={filters.q}
              onChange={(event) =>
                setFilters({ ...filters, q: event.target.value })
              }
              placeholder="Tìm theo tên công việc"
              aria-label="Tìm công việc"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pl-9 pr-3 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
            />
          </label>
          <select
            value={filters.priority}
            onChange={(event) =>
              setFilters({
                ...filters,
                priority: event.target.value as "" | TaskPriority,
              })
            }
            aria-label="Lọc mức ưu tiên"
            className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
          >
            <option value="">Mọi ưu tiên</option>
            {(["low", "medium", "high", "urgent"] as TaskPriority[]).map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
          <select
            value={filters.assigneeUserId}
            onChange={(event) =>
              setFilters({ ...filters, assigneeUserId: event.target.value })
            }
            aria-label="Lọc người phụ trách"
            className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
          >
            <option value="">Mọi người phụ trách</option>
            {assignees.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters({
                ...filters,
                status: event.target.value as "" | BoardStatus,
              })
            }
            aria-label="Lọc trạng thái"
            className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
          >
            <option value="">Mọi trạng thái</option>
            {columns.map((column) => (
              <option key={column.status} value={column.status}>
                {column.label}
              </option>
            ))}
          </select>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}
        {board?.truncated && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Dự án có {board.total} công việc đang hoạt động. Kanban hiển thị{" "}
            {board.limit} công việc đầu tiên; hãy dùng bộ lọc để thu hẹp.
          </div>
        )}
        {!board?.canReorder && board && (
          <p className="text-xs text-[#64748B]">
            Bạn có thể đổi trạng thái công việc được giao bằng hộp chọn; kéo thả
            chỉ dành cho Admin và quản lý dự án.
          </p>
        )}

        {loading && !board ? (
          <div className="rounded-2xl border border-[#EDF2F7] bg-white p-8 text-[#64748B]">
            Đang tải Kanban…
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <div className="flex min-w-full gap-4 overflow-x-auto pb-4">
              {columns.map((column) => (
                <BoardColumn
                  key={column.status}
                  status={column.status}
                  label={column.label}
                  tasks={(board?.[column.key] as BoardTask[] | undefined) ?? []}
                  canReorder={board?.canReorder ?? false}
                  canCreate={canCreateTask}
                  taskHref={(taskId) => `${base}/${projectId}/tasks/${taskId}`}
                  saving={saving}
                  onStatus={updateStatus}
                  onCreate={() => setCreateStatus(column.status)}
                />
              ))}
            </div>
          </DndContext>
        )}

        <ProjectTaskCreateDialog
          isOpen={createStatus !== null}
          onClose={() => setCreateStatus(null)}
          onCreated={load}
          projectId={projectId}
          projectName={project?.name}
          projectCode={project?.projectCode}
          defaultStatus={createStatus ?? "todo"}
        />
      </div>
    </main>
  );
}

function BoardColumn({
  status,
  label,
  tasks,
  canReorder,
  canCreate,
  taskHref,
  saving,
  onStatus,
  onCreate,
}: {
  status: BoardStatus;
  label: string;
  tasks: BoardTask[];
  canReorder: boolean;
  canCreate: boolean;
  taskHref: (taskId: string) => string;
  saving: boolean;
  onStatus: (task: BoardTask, status: BoardStatus) => void;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${status}`,
    data: { status },
  });
  return (
    <section
      ref={setNodeRef}
      className={`w-[310px] shrink-0 rounded-2xl border p-3.5 shadow-xs transition-colors ${
        isOver
          ? "border-[#4F75FF] bg-[#EEF2FF]/60"
          : "border-[#EDF2F7] bg-[#F1F5F9]/50"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-[#0F172A] text-sm">{label}</h2>
          <span className="rounded-full bg-white border border-[#E2E8F0] px-2.5 py-0.5 text-xs font-bold text-[#4F75FF] shadow-xs">
            {tasks.length}
          </span>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1 rounded-lg border border-[#DCE5FF] bg-white px-2 py-1 text-[11px] font-bold text-[#4F75FF] hover:bg-[#EEF2FF] cursor-pointer transition-colors"
          >
            <Plus className="h-3 w-3" />
            Tạo
          </button>
        )}
      </div>
      <SortableContext
        items={tasks.map((task) => `task:${task.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="min-h-24 space-y-3">
          {tasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              canReorder={canReorder}
              href={taskHref(task.id)}
              saving={saving}
              onStatus={onStatus}
            />
          ))}
          {tasks.length === 0 && (
            <p className="rounded-xl border border-dashed border-[#CBD5E1] p-6 text-center text-xs text-[#94A3B8]">
              Chưa có công việc
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function BoardCard({
  task,
  canReorder,
  href,
  saving,
  onStatus,
}: {
  task: BoardTask;
  canReorder: boolean;
  href: string;
  saving: boolean;
  onStatus: (task: BoardTask, status: BoardStatus) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task:${task.id}`,
    disabled: !canReorder,
    data: { taskId: task.id, status: task.status },
  });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border border-[#EDF2F7] bg-white p-3.5 shadow-xs transition-shadow hover:shadow-md ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex gap-2">
        {canReorder && (
          <button
            type="button"
            aria-label={`Kéo để sắp xếp ${task.title}`}
            className="mt-0.5 cursor-grab text-[#94A3B8] active:cursor-grabbing hover:text-[#0F172A]"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={href}
            className="font-bold text-sm text-[#0F172A] hover:text-[#4F75FF] transition-colors"
          >
            {task.title}
          </Link>
          <p className="mt-1 truncate text-xs text-[#64748B]">
            {task.assignee?.full_name || task.assignee?.email || "Chưa giao"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold text-[#4F75FF]">
          {task.priority ? task.priority.toUpperCase() : "NORMAL"}
        </span>
        <span className="text-[#94A3B8] text-[11px] font-mono">
          {task.due_date || "Chưa có hạn"}
        </span>
      </div>
      {task.canUpdateStatus && (
        <select
          value={task.status}
          disabled={saving}
          onChange={(event) =>
            onStatus(task, event.target.value as BoardStatus)
          }
          aria-label={`Đổi trạng thái ${task.title}`}
          className="mt-3 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          {columns.map((column) => (
            <option key={column.status} value={column.status}>
              {column.label}
            </option>
          ))}
        </select>
      )}
    </article>
  );
}
