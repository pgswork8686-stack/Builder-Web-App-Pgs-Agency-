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
    <main className="min-h-screen bg-[#070707] px-4 py-7 text-[#FFF8E6] lg:px-8">
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
      const result = await filesApi.list(
        projectId,
        { q: query || undefined, page, pageSize: compact ? 20 : 30 },
        taskId,
      );
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
        className={`grid gap-3 rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-4 ${compact ? "" : "md:grid-cols-[1fr_auto]"}`}
      >
        {!compact && (
          <input
            value={query}
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="Tìm theo tên tệp"
            aria-label="Tìm tệp"
            className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm"
          />
        )}
        {canUpload && (
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FFC400] px-4 py-2 text-sm font-bold text-black hover:bg-[#FFD84D]">
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
          className="rounded-xl border border-[#FFC400]/30 bg-[#FFC400]/10 p-3"
          aria-live="polite"
        >
          <div className="mb-2 flex justify-between text-xs text-[#FFD84D]">
            <span>Đang tải tệp</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black">
            <div
              className="h-full bg-[#FFC400] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {loading ? (
        <div className="rounded-2xl border border-zinc-800 p-6 text-zinc-500">
          Đang tải tệp…
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-600">
          Chưa có tệp nào.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-[#0E0E0F]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-600">
              <tr>
                <th className="p-4">Tệp</th>
                <th className="p-4">Kích thước</th>
                <th className="p-4">Người tải</th>
                <th className="p-4">Công việc</th>
                <th className="p-4">Thời gian</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {files.map((file) => (
                <tr key={file.id}>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-2 font-semibold text-white">
                      <FileText className="h-4 w-4 text-[#FFC400]" />
                      {file.originalName}
                    </span>
                    <p className="mt-1 text-xs text-zinc-600">
                      {file.mimeType}
                    </p>
                  </td>
                  <td className="p-4 text-zinc-400">
                    {formatSize(file.sizeBytes)}
                  </td>
                  <td className="p-4 text-zinc-400">
                    {file.uploader?.full_name || file.uploader?.email || "—"}
                  </td>
                  <td className="p-4 text-zinc-400">
                    {file.task?.title || "Tệp dự án"}
                  </td>
                  <td className="p-4 text-zinc-500">
                    {new Date(file.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void download(file)}
                        aria-label={`Tải xuống ${file.originalName}`}
                        className="rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:text-white"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {file.canDelete && (
                        <button
                          type="button"
                          onClick={() => void remove(file)}
                          aria-label={`Xóa ${file.originalName}`}
                          className="rounded-lg border border-red-500/30 p-2 text-red-300"
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
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-lg border border-zinc-800 px-3 py-2 disabled:opacity-40"
          >
            Trước
          </button>
          <span className="text-zinc-500">
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border border-zinc-800 px-3 py-2 disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}
    </section>
  );
}
