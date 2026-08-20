"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { projectsApi, type Project } from "@/lib/api/projects";
import { workspaceApi, type CalendarTask } from "@/lib/api/workspace";
import { workCalendarApi, type WorkCalendarDay } from "@/lib/api/work-calendar";
import { ProjectTaskCreateDialog } from "./project-task-create-dialog";
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

/** Embeddable version — accepts explicit projectId, no page wrapper */
export function EmbeddedCalendarView({
  mode,
  projectId,
}: {
  mode: WorkspaceMode;
  projectId: string;
}) {
  return (
    <ProjectWorkspaceRealtimeProvider projectId={projectId}>
      <ProjectCalendarContent mode={mode} projectId={projectId} embedded />
    </ProjectWorkspaceRealtimeProvider>
  );
}

function ProjectCalendarContent({
  mode,
  projectId,
  embedded = false,
}: {
  mode: WorkspaceMode;
  projectId: string;
  embedded?: boolean;
}) {
  const { revision } = useProjectWorkspaceRealtime();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [calendarDaysMap, setCalendarDaysMap] = useState<
    Map<string, WorkCalendarDay>
  >(new Map());
  const [showTasks, setShowTasks] = useState(true);
  const [showWorkSchedule, setShowWorkSchedule] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const days = useMemo(() => monthGrid(month), [month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = dateKey(days[0]);
      const to = dateKey(days[41]);
      const [projectData, taskData, calendarData] = await Promise.all([
        mode === "admin"
          ? projectsApi.getAdminProject(projectId)
          : projectsApi.getInternalProject(projectId),
        workspaceApi.calendar(projectId, from, to),
        workCalendarApi.range(from, to).catch(() => ({ days: [] })),
      ]);
      setProject(projectData);
      setTasks(taskData);

      const map = new Map<string, WorkCalendarDay>();
      calendarData.days.forEach((day) => {
        map.set(day.date, day);
      });
      setCalendarDaysMap(map);
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
  const canCreateTask =
    mode === "admin" || project?.currentProjectRole === "project_manager";
  const base = mode === "admin" ? "/app/admin/projects" : "/app/projects";

  const inner = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Legend and Toggles */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[#64748B]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#4F75FF]" /> Công
              việc
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#64748B]">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Ngày
              làm việc
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#64748B]">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Ngày
              nghỉ
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#64748B]">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Ngày lễ
            </span>
          </div>

          <div className="h-4 w-px bg-[#E2E8F0] hidden sm:block" />

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-[#0F172A] cursor-pointer">
              <input
                type="checkbox"
                checked={showTasks}
                onChange={(e) => setShowTasks(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#4F75FF] focus:ring-[#4F75FF]"
              />
              <span>Công việc</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-[#0F172A] cursor-pointer">
              <input
                type="checkbox"
                checked={showWorkSchedule}
                onChange={(e) => setShowWorkSchedule(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#4F75FF] focus:ring-[#4F75FF]"
              />
              <span>Lịch làm việc</span>
            </label>
          </div>
        </div>

        {canCreateTask && (
          <button
            type="button"
            onClick={() => setCreateDate(dateKey(new Date()))}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4F75FF] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#3D61E6] cursor-pointer transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tạo công việc
          </button>
        )}
      </div>

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
              const workDay = calendarDaysMap.get(key);
              const isNonWorking = workDay ? !workDay.isWorkingDay : false;
              const isHoliday =
                workDay?.reason === "public_holiday" ||
                workDay?.eventType === "public_holiday";

              // Cell styling based on work schedule toggle
              let cellBg = "bg-white";
              if (showWorkSchedule && isNonWorking) {
                cellBg = isHoliday ? "bg-amber-50/40" : "bg-slate-50/80";
              }

              return (
                <div
                  key={key}
                  onClick={() => {
                    if (canCreateTask) setCreateDate(key);
                  }}
                  className={`min-h-36 border-b border-r border-[#EDF2F7] p-2 transition-colors ${cellBg} hover:bg-[#F8FAFC] ${
                    canCreateTask ? "cursor-pointer" : ""
                  }`}
                  title={
                    canCreateTask
                      ? `Tạo công việc ngày ${key}${workDay ? ` (${workDay.title})` : ""}`
                      : workDay?.title
                  }
                >
                  <div className="mb-2 flex items-start justify-between">
                    <p
                      className={`text-xs font-bold ${
                        currentMonth ? "text-[#0F172A]" : "text-[#CBD5E1]"
                      }`}
                    >
                      {day.getUTCDate()}
                    </p>

                    {showWorkSchedule && workDay && (
                      <span
                        className={`inline-block truncate max-w-[85px] rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                          !workDay.isWorkingDay
                            ? isHoliday
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-200 text-slate-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                        title={workDay.title}
                      >
                        {workDay.title}
                      </span>
                    )}
                  </div>

                  {showTasks && (
                    <div className="space-y-1">
                      {dayTasks.map((task) => {
                        const isDeadlineDay = task.dueDate === key;
                        const taskDueInfo = task.dueDate
                          ? calendarDaysMap.get(task.dueDate)
                          : null;
                        const isDueOnNonWorking =
                          taskDueInfo && !taskDueInfo.isWorkingDay;

                        return (
                          <Link
                            key={task.taskId}
                            href={`${base}/${projectId}/tasks/${task.taskId}`}
                            onClick={(event) => event.stopPropagation()}
                            className="group block truncate rounded-lg border border-[#E0EAFF] bg-[#EEF2FF] px-2 py-1 text-[11px] font-semibold text-[#4F75FF] hover:border-[#4F75FF] transition-colors"
                            title={task.title}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate">{task.title}</span>
                              {isDeadlineDay && isDueOnNonWorking && (
                                <span
                                  className="inline-flex items-center text-amber-600 shrink-0"
                                  title="⚠ Deadline rơi vào ngày nghỉ"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
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

      <ProjectTaskCreateDialog
        isOpen={createDate !== null}
        onClose={() => setCreateDate(null)}
        onCreated={load}
        projectId={projectId}
        projectName={project?.name}
        projectCode={project?.projectCode}
        defaultStatus="todo"
        defaultStartDate={createDate ?? ""}
        defaultDueDate={createDate ?? ""}
      />
    </div>
  );

  if (embedded) return inner;

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
        {inner}
      </div>
    </main>
  );
}
