"use client";

import { CheckCircle2, MessageSquareWarning, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { tasksApi, type ProjectTask } from "@/lib/api/tasks";

const MIN_NOTE = 5;

/**
 * The review loop of a task: the assignee submits the result ("Gửi duyệt"),
 * a manager approves it or sends it back with a reason. The API enforces the
 * same rules; this panel only makes them usable.
 */
export function TaskReviewPanel({
  task,
  projectId,
  onChanged,
  onError,
}: {
  task: ProjectTask;
  projectId: string;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const run = async (
    payload: Parameters<typeof tasksApi.update>[2],
    fallback: string,
  ): Promise<boolean> => {
    setBusy(true);
    try {
      await tasksApi.update(projectId, task.id, payload);
      await onChanged();
      return true;
    } catch (caught) {
      onError(
        caught instanceof Error && caught.message ? caught.message : fallback,
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendBack = async () => {
    const trimmed = note.trim();
    if (trimmed.length < MIN_NOTE) {
      setNoteError(
        `Vui lòng nhập lý do yêu cầu chỉnh sửa (tối thiểu ${MIN_NOTE} ký tự).`,
      );
      return;
    }
    const ok = await run(
      { status: "in_progress", reviewNote: trimmed },
      "Không thể gửi yêu cầu chỉnh sửa.",
    );
    if (ok) {
      setRejectOpen(false);
      setNote("");
    }
  };

  if (task.status === "review") {
    if (task.canApprove) {
      return (
        <section
          aria-label="Duyệt kết quả công việc"
          className="rounded-2xl border border-[#FDE68A] bg-[#FFF8E5] p-5"
        >
          <h3 className="text-sm font-bold text-[#24304A]">
            Kết quả đang chờ bạn duyệt
          </h3>
          <p className="mt-1 text-xs text-[#5B6B82]">
            Duyệt để hoàn thành công việc, hoặc gửi lại kèm lý do để người phụ
            trách chỉnh sửa.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              isLoading={busy}
              onClick={() =>
                void run({ status: "done" }, "Không thể duyệt công việc.")
              }
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Duyệt hoàn thành
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setNote("");
                setNoteError(null);
                setRejectOpen(true);
              }}
              leftIcon={<MessageSquareWarning className="h-3.5 w-3.5" />}
            >
              Yêu cầu chỉnh sửa
            </Button>
          </div>

          <Dialog
            isOpen={rejectOpen}
            onClose={() => !busy && setRejectOpen(false)}
            maxWidth="md"
            title="Yêu cầu chỉnh sửa"
            description={task.title}
          >
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="review-note"
                  className="mb-1 block text-xs font-semibold text-[#5F6E85]"
                >
                  Lý do cần chỉnh sửa *
                </label>
                <textarea
                  id="review-note"
                  rows={4}
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setNoteError(null);
                  }}
                  aria-invalid={noteError ? true : undefined}
                  aria-describedby={noteError ? "review-note-error" : undefined}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#24304A]"
                  placeholder="Mô tả cụ thể phần cần sửa để người phụ trách làm lại."
                />
                {noteError && (
                  <p
                    id="review-note-error"
                    role="alert"
                    className="mt-1 text-xs font-semibold text-[#B91C1C]"
                  >
                    {noteError}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setRejectOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  variant="danger"
                  isLoading={busy}
                  onClick={() => void sendBack()}
                >
                  Gửi yêu cầu chỉnh sửa
                </Button>
              </div>
            </div>
          </Dialog>
        </section>
      );
    }
    return (
      <p
        role="status"
        className="rounded-2xl border border-[#E0EAFF] bg-[#EEF2FF] p-4 text-xs font-semibold text-[#3453D1]"
      >
        Kết quả đã gửi, đang chờ Trưởng nhóm duyệt.
      </p>
    );
  }

  if (
    !task.canApprove &&
    task.canUpdateStatus &&
    (task.status === "todo" || task.status === "in_progress")
  ) {
    return (
      <section
        aria-label="Gửi kết quả để duyệt"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EDF2F7] bg-white p-5"
      >
        <p className="text-xs text-[#5B6B82]">
          Hoàn tất công việc? Gửi kết quả để Trưởng nhóm duyệt.
        </p>
        <Button
          size="sm"
          variant="primary"
          isLoading={busy}
          onClick={() =>
            void run({ status: "review" }, "Không thể gửi duyệt công việc.")
          }
          leftIcon={<Send className="h-3.5 w-3.5" />}
        >
          Gửi duyệt
        </Button>
      </section>
    );
  }

  return null;
}
