"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ListTodo, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  tasksApi,
  type AggregateTasksResponse,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api/tasks";
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_VARIANT,
  TASK_STATUS_LABEL,
  TASK_STATUS_VARIANT,
  describeApiError,
  isTaskOverdue,
  taskHref,
} from "./task-meta";

const PAGE_SIZE = 20;

export function AggregateTaskList() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [priority, setPriority] = useState<TaskPriority | "all">("all");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<AggregateTasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    tasksApi
      .listAggregate({
        q: debouncedSearch || undefined,
        status: status === "all" ? undefined : status,
        priority: priority === "all" ? undefined : priority,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(describeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, status, priority, page, reloadKey]);

  const hasFilters =
    debouncedSearch !== "" || status !== "all" || priority !== "all";

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white border border-[#EDF2F7] flex flex-wrap items-center gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search
            className="w-4 h-4 text-[#7C879D] absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Tìm kiếm công việc"
            placeholder="Tìm kiếm công việc theo tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E7AE18]"
          />
        </div>
        <select
          aria-label="Lọc theo trạng thái"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TaskStatus | "all");
            setPage(1);
          }}
          className="px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus-visible:ring-2 focus-visible:ring-[#E7AE18]"
        >
          <option value="all">Tất cả trạng thái</option>
          {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc theo độ ưu tiên"
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value as TaskPriority | "all");
            setPage(1);
          }}
          className="px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus-visible:ring-2 focus-visible:ring-[#E7AE18]"
        >
          <option value="all">Mọi độ ưu tiên</option>
          {(Object.keys(TASK_PRIORITY_LABEL) as TaskPriority[]).map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <Card className="p-6 text-center" role="alert">
          <p className="text-sm font-semibold text-rose-600">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Thử lại
          </Button>
        </Card>
      ) : loading && !data ? (
        <Card className="p-10 flex items-center justify-center gap-2 text-sm text-[#7C879D]">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Đang tải công việc...
        </Card>
      ) : !data || data.items.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<ListTodo className="w-10 h-10 text-[#7C879D]" />}
            title={
              hasFilters
                ? "Không có công việc phù hợp bộ lọc"
                : "Chưa có công việc nào"
            }
            description={
              hasFilters
                ? "Thử thay đổi từ khoá hoặc bộ lọc."
                : "Công việc được tạo trong từng dự án mà bạn tham gia sẽ hiển thị tại đây."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto" aria-busy={loading}>
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Danh sách công việc</caption>
              <thead className="bg-[#F6F8FC] text-[#7C879D]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Công việc
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Dự án
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Người thực hiện
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Ưu tiên
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Hạn
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((task) => {
                  const overdue = isTaskOverdue(task);
                  return (
                    <tr key={task.id} className="border-t border-[#EDF2F7]">
                      <td className="px-4 py-3 font-semibold text-[#161827]">
                        <Link href={taskHref(task)} className="hover:underline">
                          {task.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[#24304A]">
                        {task.project?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[#24304A]">
                        {task.assignee?.full_name ??
                          task.assignee?.email ??
                          "Chưa giao"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          size="sm"
                          variant={TASK_PRIORITY_VARIANT[task.priority]}
                        >
                          {TASK_PRIORITY_LABEL[task.priority]}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 py-3 ${overdue ? "font-bold text-rose-600" : "text-[#24304A]"}`}
                      >
                        {task.due_date ?? "—"}
                        {overdue ? " (quá hạn)" : ""}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          size="sm"
                          variant={TASK_STATUS_VARIANT[task.status]}
                        >
                          {TASK_STATUS_LABEL[task.status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#EDF2F7] px-4 py-3 text-xs text-[#7C879D]">
            <span>
              {data.total} công việc · Trang {data.page}/
              {Math.max(data.totalPages, 1)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= data.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
