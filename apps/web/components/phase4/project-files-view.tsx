"use client";

import { Download, FileText, Trash2, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { filesApi, uploadToSignedUrl, type ProjectFile } from "@/lib/api/files";
import { projectsApi, type Project } from "@/lib/api/projects";
import {
  ProjectWorkspaceRealtimeProvider,
  useProjectWorkspaceRealtime,
} from "./project-workspace-realtime-provider";
import { WorkspaceHeader, type WorkspaceMode } from "./workspace-header";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectFilesView({ mode }: { mode: WorkspaceMode }) {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ProjectWorkspaceRealtimeProvider projectId={projectId}>
      <ProjectFilesContent mode={mode} projectId={projectId} />
    </ProjectWorkspaceRealtimeProvider>
  );
}

function ProjectFilesContent({
  mode,
  projectId,
}: {
  mode: WorkspaceMode;
  projectId: string;
}) {
  const { revision } = useProjectWorkspaceRealtime();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    const load =
      mode === "admin"
        ? projectsApi.getAdminProject(projectId)
        : projectsApi.getInternalProject(projectId);
    void load.then(setProject).catch(() => setProject(null));
  }, [mode, projectId]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-7 text-[#0F172A] lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <WorkspaceHeader
          mode={mode}
          projectId={projectId}
          projectName={project?.name}
          projectCode={project?.projectCode}
          active="files"
        />
        <FileManager
          projectId={projectId}
          refreshSignal={revision}
          canUpload={
            mode === "admin" || project?.currentProjectRole !== "viewer"
          }
        />
      </div>
    </main>
  );
}

export function FileManager({
  projectId,
  taskId,
  compact = false,
  refreshSignal = 0,
  canUpload = true,
}: {
  projectId: string;
  taskId?: string;
  compact?: boolean;
  refreshSignal?: number;
  canUpload?: boolean;
}) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await filesApi.list(projectId, {
        taskId,
        page,
        pageSize: compact ? 5 : 20,
        q: query || undefined,
      });
      setFiles(result.items);
      setTotalPages(result.totalPages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải tệp.");
    } finally {
      setLoading(false);
    }
  }, [compact, page, projectId, query, taskId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load, refreshSignal]);

  const upload = async (file: File) => {
    setError(null);
    setProgress(0);
    try {
      const authorization = await filesApi.requestUpload(
        projectId,
        file,
        taskId,
      );
      await uploadToSignedUrl(authorization, file, setProgress);
      await filesApi.finalize(projectId, authorization.uploadSessionId, taskId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải tệp.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async (file: ProjectFile) => {
    try {
      const result = await filesApi.download(projectId, file.id);
      window.location.assign(result.signedUrl);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tải xuống.",
      );
    }
  };

  const remove = async (file: ProjectFile) => {
    try {
      await filesApi.remove(projectId, file.id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xóa tệp.");
    }
  };

  return (
    <section className="space-y-4">
      <div
        className={`grid gap-3 rounded-2xl border border-[#EDF2F7] bg-white p-4 shadow-xs ${compact ? "" : "md:grid-cols-[1fr_auto]"}`}
      >
        {!compact && (
          <input
            value={query}
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="Tìm theo tên tệp..."
            aria-label="Tìm tệp"
            className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
          />
        )}
        {canUpload && (
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#4F75FF] px-4 py-2 text-xs font-bold text-white hover:bg-[#3D62EE] transition-colors shadow-xs">
            <Upload className="h-4 w-4" /> Chọn tệp tải lên
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              aria-label="Chọn tệp tải lên"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              disabled={progress !== null}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>
        )}
      </div>
      {progress !== null && (
        <div
          className="rounded-xl border border-blue-200 bg-blue-50 p-3"
          aria-live="polite"
        >
          <div className="mb-2 flex justify-between text-xs text-blue-700 font-bold">
            <span>Đang tải tệp</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full bg-[#4F75FF] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}
      {loading ? (
        <div className="rounded-2xl border border-[#EDF2F7] bg-white p-6 text-[#64748B]">
          Đang tải tệp…
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-8 text-center text-xs text-[#94A3B8]">
          Chưa có tệp nào.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#EDF2F7] bg-white shadow-xs">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-[#EDF2F7] text-[11px] uppercase tracking-wider text-[#64748B] bg-[#F8FAFC]">
              <tr>
                <th className="p-4">Tệp</th>
                <th className="p-4">Kích thước</th>
                <th className="p-4">Người tải</th>
                <th className="p-4">Công việc</th>
                <th className="p-4">Thời gian</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2F7] text-[#0F172A]">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="p-4">
                    <span className="inline-flex items-center gap-2 font-bold text-[#0F172A]">
                      <FileText className="h-4 w-4 text-[#4F75FF]" />
                      {file.originalName}
                    </span>
                    <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                      {file.mimeType}
                    </p>
                  </td>
                  <td className="p-4 text-[#64748B]">
                    {formatSize(file.sizeBytes)}
                  </td>
                  <td className="p-4 text-[#64748B]">
                    {file.uploader?.full_name || file.uploader?.email || "—"}
                  </td>
                  <td className="p-4 text-[#64748B]">
                    {file.task?.title || "Tệp dự án"}
                  </td>
                  <td className="p-4 text-[#94A3B8] font-mono">
                    {new Date(file.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void download(file)}
                        aria-label={`Tải xuống ${file.originalName}`}
                        className="rounded-lg border border-[#E2E8F0] p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {file.canDelete && (
                        <button
                          type="button"
                          onClick={() => void remove(file)}
                          aria-label={`Xóa ${file.originalName}`}
                          className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!compact && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[#0F172A] disabled:opacity-40 hover:bg-[#F8FAFC]"
          >
            Trước
          </button>
          <span className="text-[#64748B]">
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[#0F172A] disabled:opacity-40 hover:bg-[#F8FAFC]"
          >
            Sau
          </button>
        </div>
      )}
    </section>
  );
}
