"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ListTodo,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ArrowRight,
  FolderKanban,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { projectsApi, type Project } from "@/lib/api/projects";
import { tasksApi, type ProjectTask, type TaskStatus } from "@/lib/api/tasks";
import { getMe } from "@/lib/api/auth";

export default function EmployeeTasksPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<(ProjectTask & { projectName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [meRes, projRes] = await Promise.allSettled([
        getMe(),
        projectsApi.getInternalProjects(1, 20),
      ]);

      const currentUserId = meRes.status === "fulfilled" ? meRes.value.user?.id : null;
      const userProjects = projRes.status === "fulfilled" ? projRes.value.items || [] : [];
      setProjects(userProjects);

      if (userProjects.length > 0) {
        const taskPromises = userProjects.map(async (p) => {
          try {
            const taskRes = await tasksApi.list(p.id, {
              assigneeUserId: currentUserId || undefined,
              pageSize: 50,
            });
            return (taskRes.items || []).map((t) => ({
              ...t,
              projectName: p.name,
            }));
          } catch {
            return [];
          }
        });

        const allTasksNested = await Promise.all(taskPromises);
        setTasks(allTasksNested.flat());
      }
    } catch {
      // Safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleUpdateStatus = async (
    projectId: string,
    taskId: string,
    newStatus: TaskStatus,
  ) => {
    setUpdatingTaskId(taskId);
    try {
      await tasksApi.update(projectId, taskId, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      );
    } catch {
      // Ignore or feedback
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === "all") return true;
    return t.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Nhiệm vụ của tôi (My Assigned Tasks)"
        description="Danh sách các công việc cá nhân được phân công thực hiện theo từng dự án."
        badge={`${tasks.length} Nhiệm vụ`}
      />

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === "all"
              ? "bg-[#5D87FF] text-white shadow-xs"
              : "bg-white border border-[#EDF2F7] text-[#7C879D] hover:bg-[#F6F8FC]"
          }`}
        >
          Tất cả ({tasks.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("in_progress")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === "in_progress"
              ? "bg-[#5D87FF] text-white shadow-xs"
              : "bg-white border border-[#EDF2F7] text-[#7C879D] hover:bg-[#F6F8FC]"
          }`}
        >
          Đang làm
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("todo")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === "todo"
              ? "bg-[#5D87FF] text-white shadow-xs"
              : "bg-white border border-[#EDF2F7] text-[#7C879D] hover:bg-[#F6F8FC]"
          }`}
        >
          Cần làm
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("done")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === "done"
              ? "bg-[#5D87FF] text-white shadow-xs"
              : "bg-white border border-[#EDF2F7] text-[#7C879D] hover:bg-[#F6F8FC]"
          }`}
        >
          Hoàn thành
        </button>
      </div>

      {loading ? (
        <Card className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#5D87FF] mx-auto" />
          <p className="mt-3 text-xs text-[#7C879D]">
            Đang tải danh sách nhiệm vụ...
          </p>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<ListTodo className="w-10 h-10 text-[#7C879D]" />}
            title="Không có nhiệm vụ nào"
            description="Bạn đã hoàn thành tất cả công việc hoặc chưa có task được giao."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((t) => {
            const isUpdating = updatingTaskId === t.id;
            return (
              <Card key={t.id} className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#5D87FF] truncate">
                      {t.projectName}
                    </span>
                    <Badge
                      variant={
                        t.status === "done"
                          ? "success"
                          : t.status === "in_progress"
                          ? "blue"
                          : "default"
                      }
                      size="sm"
                    >
                      {t.status}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-bold text-[#24304A] leading-snug">
                    {t.title}
                  </h4>
                  {t.description && (
                    <p className="text-xs text-[#7C879D] line-clamp-2">
                      {t.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#EDF2F7] flex items-center justify-between gap-2">
                  <Link
                    href={`/app/projects/${t.project_id}/tasks/${t.id}`}
                    className="text-xs font-bold text-[#5D87FF] hover:underline flex items-center gap-1"
                  >
                    Chi tiết <ArrowRight className="w-3 h-3" />
                  </Link>

                  {t.status !== "done" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isUpdating}
                      onClick={() =>
                        handleUpdateStatus(
                          t.project_id,
                          t.id,
                          t.status === "todo" ? "in_progress" : "done",
                        )
                      }
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : t.status === "todo" ? (
                        "Bắt đầu"
                      ) : (
                        "Hoàn thành"
                      )}
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-[#13DEB9] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đã xong
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
