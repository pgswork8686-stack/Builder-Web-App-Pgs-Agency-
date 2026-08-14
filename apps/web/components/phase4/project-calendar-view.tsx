"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { projectsApi, type Project } from "@/lib/api/projects";
import { workspaceApi, type CalendarTask } from "@/lib/api/workspace";
import {
  ProjectWorkspaceRealtimeProvider,
  useProjectWorkspaceRealtime,
} from "./project-workspace-realtime-provider";
import { WorkspaceHeader, type WorkspaceMode } from "./workspace-header";

const weekdayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function dateKey(date: Date) {
  return date.toISOString().substring(0, 10);
}

function monthGrid(month: Date) {
  const first = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1),
  );
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date;
  });
}

export function ProjectCalendarView({ mode }: { mode: WorkspaceMode }) {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ProjectWorkspaceRealtimeProvider projectId={projectId}>
      <ProjectCalendarContent mode={mode} projectId={projectId} />
    </ProjectWorkspaceRealtimeProvider>
  );
}

function ProjectCalendarContent({
  mode,
  projectId,
}: {
  mode: WorkspaceMode;
  projectId: string;
}) {
  const { revision } = useProjectWorkspaceRealtime();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const days = useMemo(() => monthGrid(month), [month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectData, taskData] = await Promise.all([
        mode === "admin"
          ? projectsApi.getAdminProject(projectId)
          : projectsApi.getInternalProject(projectId),
        workspaceApi.calendar(projectId, dateKey(days[0]), dateKey(days[41])),
      ]);
      setProject(projectData);
      setTasks(taskData);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tải lịch.",
      );
    } finally {
      setLoading(false);
    }
  }, [days, mode, projectId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load, revision]);

  const changeMonth = (amount: number) => {
    setMonth(
      new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + amount, 1),
      ),
    );
  };
  const base = mode === "admin" ? "/app/admin/projects" : "/app/projects";

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-7 text-[#0F172A] lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <WorkspaceHeader
          mode={mode}
          projectId={projectId}
          projectName={project?.name}
          projectCode={project?.projectCode}
          active="calendar"
        />
        <div className="flex items-center justify-between rounded-2xl border border-[#EDF2F7] bg-white p-4 shadow-xs">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Tháng trước"
            className="rounded-xl border border-[#E2E8F0] p-2 hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="font-bold text-[#0F172A] text-base">
            Tháng {month.getUTCMonth() + 1}/{month.getUTCFullYear()}
          </h2>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Tháng sau"
            className="rounded-xl border border-[#E2E8F0] p-2 hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="rounded-2xl border border-[#EDF2F7] bg-white p-8 text-[#64748B]">
            Đang tải lịch công việc…
          </div>
        ) : (
          <section className="overflow-x-auto rounded-2xl border border-[#EDF2F7] bg-white shadow-xs">
            <div className="grid min-w-[900px] grid-cols-7 border-b border-[#EDF2F7] bg-[#F8FAFC]">
              {weekdayLabels.map((label) => (
                <div
                  key={label}
                  className="p-3 text-center text-xs font-bold text-[#64748B]"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid min-w-[900px] grid-cols-7">
              {days.map((day) => {
                const key = dateKey(day);
                const dayTasks = tasks.filter((task) => {
                  const start = task.startDate ?? task.dueDate;
                  const end = task.dueDate ?? task.startDate;
                  return Boolean(start && end && key >= start && key <= end);
                });
                const currentMonth = day.getUTCMonth() === month.getUTCMonth();
                return (
                  <div
                    key={key}
                    className="min-h-36 border-b border-r border-[#EDF2F7] p-2 transition-colors hover:bg-[#F8FAFC]/60"
                  >
                    <p
                      className={`mb-2 text-xs font-bold ${
                        currentMonth ? "text-[#0F172A]" : "text-[#CBD5E1]"
                      }`}
                    >
                      {day.getUTCDate()}
                    </p>
                    <div className="space-y-1">
                      {dayTasks.map((task) => (
                        <Link
                          key={task.taskId}
                          href={`${base}/${projectId}/tasks/${task.taskId}`}
                          className="block truncate rounded-lg border border-[#E0EAFF] bg-[#EEF2FF] px-2 py-1 text-[11px] font-semibold text-[#4F75FF] hover:border-[#4F75FF] transition-colors"
                          title={task.title}
                        >
                          {task.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {!loading && tasks.length === 0 && (
          <p className="text-center text-xs text-[#94A3B8]">
            Không có công việc có ngày bắt đầu hoặc đến hạn trong khoảng này.
          </p>
        )}
      </div>
    </main>
  );
}
