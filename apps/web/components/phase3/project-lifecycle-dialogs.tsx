"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Archive } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  projectsApi,
  type Project,
  type ProjectCompletionCheck,
} from "@/lib/api/projects";

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
  const [check, setCheck] = useState<ProjectCompletionCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Every time the acceptance dialog opens, read the conditions again.
  useEffect(() => {
    if (!completeOpen) return;
    let cancelled = false;
    setChecking(true);
    setCheck(null);
    setCheckError(null);
    setError(null);
    projectsApi
      .getCompletionCheck(project.id)
      .then((result) => {
        if (!cancelled) setCheck(result);
      })
      .catch((caught) => {
        if (!cancelled) {
          setCheckError(
            caught instanceof Error
              ? caught.message
              : "Không thể kiểm tra điều kiện hoàn thành.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [completeOpen, project.id]);

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
        status: "archived",
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

  const blocked = check !== null && !check.ready;

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

          <section aria-label="Điều kiện hoàn thành" className="text-xs">
            {checking ? (
              <p role="status" className="text-[#5F6E85]">
                Đang kiểm tra điều kiện hoàn thành…
              </p>
            ) : checkError ? (
              <p role="alert" className="font-semibold text-[#B91C1C]">
                {checkError}
              </p>
            ) : check?.ready ? (
              <p className="flex items-center gap-2 font-semibold text-[#047857]">
                <CheckCircle2 className="h-4 w-4" />
                Đủ điều kiện nghiệm thu: không còn công việc mở hay yêu cầu
                duyệt đang chờ.
              </p>
            ) : check ? (
              <div className="rounded-xl border border-[#FDE68A] bg-[#FFF8E5] p-3 text-[#7A5700]">
                <p className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4" />
                  Chưa đủ điều kiện nghiệm thu
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {check.blockers.map((blocker) => (
                    <li key={blocker.code}>{blocker.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {error && (
            <p role="alert" className="text-xs text-[#B91C1C]">
              {error}
            </p>
          )}

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
              disabled={checking || blocked || checkError !== null}
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

          {error && (
            <p role="alert" className="text-xs text-[#B91C1C]">
              {error}
            </p>
          )}

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
