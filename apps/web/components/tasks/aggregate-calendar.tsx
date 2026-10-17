"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  MonthCalendar,
  type CalendarDayItem,
} from "@/components/ui/month-calendar";
import { tasksApi, type ProjectTask } from "@/lib/api/tasks";
import { getMe } from "@/lib/api/auth";
import { workCalendarApi } from "@/lib/api/work-calendar";
import { describeApiError, isTaskOverdue, taskHref } from "./task-meta";

const PAGE_SIZE = 100;
const MAX_PAGES = 5;

/**
 * Month calendar fed by the same /tasks aggregate endpoint as the list and
 * Kanban views (task deadlines) plus /work-calendar (company holidays and
 * working-day exceptions). Leave schedules and project milestones are not
 * rendered yet — see docs/audit/FUNCTIONAL_GAPS.md.
 */
export function AggregateCalendar({
  onlyMine = false,
}: {
  onlyMine?: boolean;
}) {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [events, setEvents] = useState<Record<string, CalendarDayItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const assigneeUserId = onlyMine ? (await getMe()).user.id : undefined;
      const collected: ProjectTask[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const result = await tasksApi.listAggregate({
          dueFrom: range.from,
          dueTo: range.to,
          assigneeUserId,
          page,
          pageSize: PAGE_SIZE,
        });
        collected.push(...result.items);
        totalPages = result.totalPages;
        page += 1;
      } while (page <= totalPages && page <= MAX_PAGES);
      const holidays = await workCalendarApi
        .range(range.from, range.to)
        .catch(() => null);
      if (cancelled) return;
      setTasks(collected);
      setTruncated(totalPages > MAX_PAGES);
      const byDate: Record<string, CalendarDayItem[]> = {};
      for (const day of holidays?.days ?? []) {
        // eventType is only set for real calendar events (holidays, make-up
        // workdays); ordinary weekends carry no event and are not listed.
        if (!day.eventType || !day.title) continue;
        byDate[day.date] = [
          {
            key: `ev-${day.date}`,
            label: day.title,
            tone: day.isWorkingDay ? "success" : "muted",
          },
        ];
      }
      setEvents(byDate);
    })()
      .catch((err) => {
        if (!cancelled) setError(describeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, onlyMine]);

  const items = useMemo(() => {
    const byDate: Record<string, CalendarDayItem[]> = {};
    for (const [date, list] of Object.entries(events)) byDate[date] = [...list];
    for (const task of tasks) {
      if (!task.due_date) continue;
      (byDate[task.due_date] ??= []).push({
        key: `task-${task.id}`,
        label: task.title,
        tone:
          task.status === "done"
            ? "success"
            : isTaskOverdue(task)
              ? "danger"
              : "default",
        href: taskHref(task),
      });
    }
    return byDate;
  }, [tasks, events]);

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700"
        >
          {error}
        </div>
      )}
      {truncated && (
        <p className="text-xs text-[#5F6E85]">
          Tháng này có nhiều hơn {PAGE_SIZE * MAX_PAGES} công việc; chỉ hiển thị
          một phần. Dùng danh sách để lọc chi tiết.
        </p>
      )}
      <MonthCalendar items={items} loading={loading} onMonthChange={setRange} />
    </div>
  );
}
