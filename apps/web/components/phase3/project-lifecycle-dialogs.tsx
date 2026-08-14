"use client";

import React, { useState } from "react";
import { CheckCircle2, Archive } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { projectsApi, type Project } from "@/lib/api/projects";

export interface ProjectLifecycleDialogsProps {
  project: Project;
  completeOpen: boolean;
  archiveOpen: boolean;
  onCloseComplete: () => void;
  onCloseArchive: () => void;
  onUpdated: (project: Project) => void;
}

export function ProjectLifecycleDialogs({
  project,
  completeOpen,
  archiveOpen,
  onCloseComplete,
  onCloseArchive,
  onUpdated,
}: ProjectLifecycleDialogsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await projectsApi.updateProject(project.id, {
        status: "completed",
      });
      onUpdated(updated);
      onCloseComplete();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể hoàn thành dự án.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await projectsApi.updateProject(project.id, {
        status: "cancelled", // hoặc archived
      });
      onUpdated(updated);
      onCloseArchive();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể lưu trữ dự án.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Complete Project Dialog */}
      <Dialog
        isOpen={completeOpen}
        onClose={onCloseComplete}
        maxWidth="sm"
        title="Nghiệm thu & Hoàn thành dự án"
        description="Xác nhận dự án đã hoàn tất tất cả hạng mục công việc và sẵn sàng bàn giao."
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">{project.name}</p>
              <p className="opacity-80">Mã: {project.projectCode}</p>
            </div>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCloseComplete}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleComplete}
              isLoading={loading}
            >
              Xác nhận hoàn tất
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Archive Project Dialog */}
      <Dialog
        isOpen={archiveOpen}
        onClose={onCloseArchive}
        maxWidth="sm"
        title="Lưu trữ & Đóng dự án"
        description="Dự án sẽ được chuyển vào kho lưu trữ và giới hạn các hoạt động chỉnh sửa."
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs">
            <Archive className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold">{project.name}</p>
              <p className="opacity-80">Mã: {project.projectCode}</p>
            </div>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCloseArchive}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleArchive}
              isLoading={loading}
            >
              Lưu trữ dự án
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
