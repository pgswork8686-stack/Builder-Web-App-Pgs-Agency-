"use client";

import { Check, Pencil, Send, Trash2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { commentsApi, type TaskComment } from "@/lib/api/comments";
import { projectsApi, type Project } from "@/lib/api/projects";
import { tasksApi, type ProjectTask, type TaskStatus } from "@/lib/api/tasks";
import { FileManager } from "./project-files-view";
import {
  ProjectWorkspaceRealtimeProvider,
  useProjectWorkspaceRealtime,
} from "./project-workspace-realtime-provider";
import { WorkspaceHeader, type WorkspaceMode } from "./workspace-header";

const statuses: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "Cần làm" },
  { value: "in_progress", label: "Đang thực hiện" },
  { value: "review", label: "Đang duyệt" },
  { value: "done", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
];

export function TaskDetailView({ mode }: { mode: WorkspaceMode }) {
  const { projectId, taskId } = useParams<{
    projectId: string;
    taskId: string;
  }>();
  return (
    <ProjectWorkspaceRealtimeProvider projectId={projectId}>
      <TaskDetailContent mode={mode} projectId={projectId} taskId={taskId} />
    </ProjectWorkspaceRealtimeProvider>
  );
}

function TaskDetailContent({
  mode,
  projectId,
  taskId,
}: {
  mode: WorkspaceMode;
  projectId: string;
  taskId: string;
}) {
  const { revision } = useProjectWorkspaceRealtime();
  const [project, setProject] = useState<Project | null>(null);
  const [task, setTask] = useState<ProjectTask | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentPages, setCommentPages] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [projectData, taskData, commentData] = await Promise.all([
        mode === "admin"
          ? projectsApi.getAdminProject(projectId)
          : projectsApi.getInternalProject(projectId),
        tasksApi.get(projectId, taskId),
        commentsApi.list(projectId, taskId, commentPage, 20),
      ]);
      setProject(projectData);
      setTask(taskData);
      setComments(commentData.items);
      setCommentPages(commentData.totalPages);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tải công việc.",
      );
    } finally {
      setLoading(false);
    }
  }, [commentPage, mode, projectId, taskId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load, revision]);

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await commentsApi.create(projectId, taskId, newComment);
      setNewComment("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể bình luận.",
      );
    }
  };

  const saveComment = async (commentId: string) => {
    try {
      await commentsApi.update(projectId, taskId, commentId, editingContent);
      setEditingId(null);
      setEditingContent("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể sửa bình luận.",
      );
    }
  };

  const removeComment = async (commentId: string) => {
    try {
      await commentsApi.remove(projectId, taskId, commentId);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể xóa bình luận.",
      );
    }
  };

  const updateStatus = async (status: TaskStatus) => {
    if (!task) return;
    try {
      await tasksApi.update(projectId, task.id, { status });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật trạng thái.",
      );
    }
  };

  const canComment =
    mode === "admin" || project?.currentProjectRole !== "viewer";

  return (
    <main className="min-h-screen bg-[#070707] px-4 py-7 text-[#FFF8E6] lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <WorkspaceHeader
          mode={mode}
          projectId={projectId}
          projectName={project?.name}
          projectCode={project?.projectCode}
          active="task"
        />
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {loading && !task ? (
          <div className="rounded-2xl border border-zinc-800 p-8 text-zinc-500">
            Đang tải chi tiết công việc…
          </div>
        ) : !task ? (
          <div className="rounded-2xl border border-zinc-800 p-8 text-red-300">
            Không tìm thấy công việc.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#FFC400]">
                    Thông tin
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    {task.title}
                  </h2>
                </div>
                {task.canUpdateStatus ? (
                  <select
                    value={task.status}
                    onChange={(event) =>
                      void updateStatus(event.target.value as TaskStatus)
                    }
                    aria-label="Đổi trạng thái công việc"
                    className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm"
                  >
                    {statuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                    {task.status}
                  </span>
                )}
              </div>
              <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Ưu tiên" value={task.priority} />
                <Info
                  label="Người phụ trách"
                  value={task.assignee?.full_name || task.assignee?.email}
                />
                <Info
                  label="Người báo cáo"
                  value={task.reporter?.full_name || task.reporter?.email}
                />
                <Info label="Công việc cha" value={task.parent_task_id} />
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-5">
                <h3 className="font-bold text-white">Mô tả</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                  {task.description || "Chưa có mô tả."}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-5">
                <h3 className="font-bold text-white">Thời gian</h3>
                <dl className="mt-3 space-y-3 text-sm">
                  <Info label="Bắt đầu" value={task.start_date} />
                  <Info label="Đến hạn" value={task.due_date} />
                  <Info
                    label="Tạo lúc"
                    value={new Date(task.created_at).toLocaleString("vi-VN")}
                  />
                  <Info
                    label="Cập nhật"
                    value={new Date(task.updated_at).toLocaleString("vi-VN")}
                  />
                  <Info
                    label="Hoàn thành"
                    value={
                      task.completed_at
                        ? new Date(task.completed_at).toLocaleString("vi-VN")
                        : null
                    }
                  />
                </dl>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-5">
              <h3 className="font-bold text-white">Bình luận</h3>
              {comments.length === 0 ? (
                <p className="text-sm text-zinc-600">Chưa có bình luận.</p>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <article
                      key={comment.id}
                      className="rounded-xl border border-zinc-800 bg-black p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">
                            {comment.author?.full_name ||
                              comment.author?.email ||
                              "Thành viên"}
                          </p>
                          <p className="text-xs text-zinc-600">
                            {new Date(comment.createdAt).toLocaleString(
                              "vi-VN",
                            )}
                            {comment.editedAt ? " · đã chỉnh sửa" : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {comment.canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(comment.id);
                                setEditingContent(comment.content);
                              }}
                              aria-label="Sửa bình luận"
                              className="text-zinc-500 hover:text-white"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {comment.canDelete && (
                            <button
                              type="button"
                              onClick={() => void removeComment(comment.id)}
                              aria-label="Xóa bình luận"
                              className="text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {editingId === comment.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(event) =>
                              setEditingContent(event.target.value)
                            }
                            maxLength={10000}
                            aria-label="Nội dung chỉnh sửa"
                            className="min-h-24 w-full rounded-xl border border-zinc-800 bg-[#0E0E0F] p-3 text-sm"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-zinc-800 p-2"
                              aria-label="Hủy sửa"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void saveComment(comment.id)}
                              className="rounded-lg bg-[#FFC400] p-2 text-black"
                              aria-label="Lưu bình luận"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                          {comment.content}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {commentPages > 1 && (
                <div className="flex justify-center gap-3 text-sm">
                  <button
                    type="button"
                    disabled={commentPage <= 1}
                    onClick={() => setCommentPage((value) => value - 1)}
                    className="rounded-lg border border-zinc-800 px-3 py-2 disabled:opacity-40"
                  >
                    Trước
                  </button>
                  <span className="py-2 text-zinc-500">
                    {commentPage}/{commentPages}
                  </span>
                  <button
                    type="button"
                    disabled={commentPage >= commentPages}
                    onClick={() => setCommentPage((value) => value + 1)}
                    className="rounded-lg border border-zinc-800 px-3 py-2 disabled:opacity-40"
                  >
                    Sau
                  </button>
                </div>
              )}
              {canComment && (
                <form onSubmit={submitComment} className="space-y-3">
                  <textarea
                    required
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    maxLength={10000}
                    placeholder="Viết bình luận…"
                    aria-label="Bình luận mới"
                    className="min-h-28 w-full rounded-xl border border-zinc-800 bg-black p-3 text-sm"
                  />
                  <div className="flex justify-end">
                    <button className="inline-flex items-center gap-2 rounded-xl bg-[#FFC400] px-4 py-2 text-sm font-bold text-black">
                      <Send className="h-4 w-4" /> Gửi bình luận
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section className="space-y-4">
              <h3 className="font-bold text-white">Tệp đính kèm</h3>
              <FileManager
                projectId={projectId}
                taskId={taskId}
                compact
                refreshSignal={revision}
                canUpload={canComment}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-900 pb-2">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="break-all text-right text-zinc-300">{value || "—"}</dd>
    </div>
  );
}
