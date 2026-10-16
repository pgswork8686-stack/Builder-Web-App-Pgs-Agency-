"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { tasksApi, type ProjectTask, type TaskStatus } from "@/lib/api/tasks";
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_VARIANT,
  TASK_STATUS_LABEL,
  describeApiError,
  isTaskOverdue,
  taskHref,
} from "./task-meta";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "review", "done"];
const LOAD_LIMIT = 100;

export function AggregateKanban() {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [counts, setCounts] = useState<Record<TaskStatus, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tasksApi.listAggregate({
        includeCounts: true,
        pageSize: LOAD_LIMIT,
      });
      setTasks(result.items);
      setCounts(result.statusCounts ?? null);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function moveTask(task: ProjectTask, status: TaskStatus) {
    if (task.status === status) return;
    if (!task.canUpdateStatus) {
      setNotice("Bạn không có quyền đổi trạng thái công việc này.");
      return;
    }
    const previous = tasks;
    const previousCounts = counts;
    setNotice(null);
    setSavingId(task.id);
    // optimistic update; rolled back if the server rejects it
    setTasks((current) =>
      current.map((t) => (t.id === task.id ? { ...t, status } : t)),
    );
    if (counts) {
      setCounts({
        ...counts,
        [task.status]: Math.max(0, counts[task.status] - 1),
        [status]: counts[status] + 1,
      });
    }
    try {
      const updated = await tasksApi.update(task.project_id, task.id, {
        status,
      });
      setTasks((current) =>
        current.map((t) =>
          t.id === task.id
            ? { ...t, status: updated.status, updated_at: updated.updated_at }
            : t,
        ),
      );
    } catch (err) {
      setTasks(previous);
      setCounts(previousCounts);
      setNotice(describeApiError(err));
    } finally {
      setSavingId(null);
    }
  }

  if (loading && tasks.length === 0) {
    return (
      <Card className="p-10 flex items-center justify-center gap-2 text-sm text-[#7C879D]">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Đang tải bảng Kanban...
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center" role="alert">
        <p className="text-sm font-semibold text-rose-600">{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={load}>
          Thử lại
        </Button>
      </Card>
    );
  }

  const totalForColumns = counts
    ? COLUMNS.reduce((sum, s) => sum + counts[s], 0)
    : tasks.length;
  const truncated =
    totalForColumns > tasks.filter((t) => COLUMNS.includes(t.status)).length;

  return (
    <div className="space-y-3">
      {notice && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800"
        >
          {notice}
        </div>
      )}
      {truncated && (
        <p className="text-xs text-[#7C879D]">
          Đang hiển thị {LOAD_LIMIT} công việc gần hạn nhất; số đếm từng cột là
          tổng thực tế.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[450px]">
        {COLUMNS.map((column) => {
          const items = tasks.filter((t) => t.status === column);
          return (
            <section
              key={column}
              aria-label={TASK_STATUS_LABEL[column]}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const task = tasks.find((t) => t.id === dragId);
                setDragId(null);
                if (task) void moveTask(task, column);
              }}
              className="p-4 rounded-2xl bg-[#F6F8FC] border border-[#EDF2F7] flex flex-col space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#EDF2F7]">
                <h2 className="text-xs font-bold text-[#161827]">
                  {TASK_STATUS_LABEL[column]}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#7C879D] border border-[#EDF2F7]">
                  {counts ? counts[column] : items.length}
                </span>
              </div>
              {items.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-4 border border-dashed border-[#EDF2F7] rounded-xl text-center">
                  <span className="text-xs text-[#7C879D]">Trống</span>
                </div>
              ) : (
                items.map((task) => {
                  const overdue = isTaskOverdue(task);
                  const index = COLUMNS.indexOf(task.status);
                  return (
                    <article
                      key={task.id}
                      draggable={task.canUpdateStatus}
                      onDragStart={() => setDragId(task.id)}
                      onDragEnd={() => setDragId(null)}
                      aria-busy={savingId === task.id}
                      className={`rounded-xl bg-white border border-[#EDF2F7] p-3 space-y-2 shadow-xs ${
                        task.canUpdateStatus ? "cursor-grab" : ""
                      } ${savingId === task.id ? "opacity-60" : ""}`}
                    >
                      <Link
                        href={taskHref(task)}
                        className="block text-xs font-bold text-[#161827] hover:underline"
                      >
                        {task.title}
                      </Link>
                      <p className="text-[11px] text-[#7C879D]">
                        {task.project?.name ?? "—"} ·{" "}
                        {task.assignee?.full_name ?? "Chưa giao"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          size="sm"
                          variant={TASK_PRIORITY_VARIANT[task.priority]}
                        >
                          {TASK_PRIORITY_LABEL[task.priority]}
                        </Badge>
                        {task.due_date && (
                          <span
                            className={`text-[10px] font-semibold ${overdue ? "text-rose-600" : "text-[#7C879D]"}`}
                          >
                            {task.due_date}
                            {overdue ? " · quá hạn" : ""}
                          </span>
                        )}
                      </div>
                      {task.canUpdateStatus && (
                        // keyboard / touch alternative to drag-and-drop
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={index <= 0 || savingId !== null}
                            aria-label={`Chuyển "${task.title}" về ${TASK_STATUS_LABEL[COLUMNS[Math.max(index - 1, 0)]]}`}
                            onClick={() => moveTask(task, COLUMNS[index - 1])}
                          >
                            ←
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={
                              index < 0 ||
                              index >= COLUMNS.length - 1 ||
                              savingId !== null
                            }
                            aria-label={`Chuyển "${task.title}" sang ${TASK_STATUS_LABEL[COLUMNS[Math.min(index + 1, COLUMNS.length - 1)]]}`}
                            onClick={() => moveTask(task, COLUMNS[index + 1])}
                          >
                            →
                          </Button>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
