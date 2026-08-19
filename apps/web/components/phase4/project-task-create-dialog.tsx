"use client";

import { FormEvent, useEffect, useState } from "react";
import { projectsApi, type ProjectServiceItem } from "@/lib/api/projects";
import { tasksApi, type TaskPriority, type TaskStatus } from "@/lib/api/tasks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type BoardStatus = Exclude<TaskStatus, "cancelled">;

const statuses: Array<{ value: BoardStatus; label: string }> = [
  { value: "todo", label: "Cần làm" },
  { value: "in_progress", label: "Đang thực hiện" },
  { value: "review", label: "Đang duyệt" },
  { value: "done", label: "Hoàn thành" },
];

const priorities: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
  { value: "urgent", label: "Khẩn cấp" },
];

export function ProjectTaskCreateDialog({
  isOpen,
  onClose,
  onCreated,
  projectId,
  projectName,
  projectCode,
  defaultStatus = "todo",
  defaultStartDate = "",
  defaultDueDate = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  projectId: string;
  projectName?: string;
  projectCode?: string;
  defaultStatus?: BoardStatus;
  defaultStartDate?: string;
  defaultDueDate?: string;
}) {
  const [serviceItems, setServiceItems] = useState<ProjectServiceItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: defaultStatus,
    priority: "medium" as TaskPriority,
    projectServiceItemId: "",
    startDate: defaultStartDate,
    dueDate: defaultDueDate,
  });

  useEffect(() => {
    if (!isOpen) return;

    setForm({
      title: "",
      description: "",
      status: defaultStatus,
      priority: "medium",
      projectServiceItemId: "",
      startDate: defaultStartDate,
      dueDate: defaultDueDate,
    });
    setError(null);

    let cancelled = false;
    const loadServiceItems = async () => {
      setLoadingOptions(true);
      try {
        const items = await projectsApi.getProjectServiceItems(projectId);
        if (!cancelled) {
          setServiceItems(items.filter((item) => item.status !== "cancelled"));
        }
      } catch {
        if (!cancelled) setServiceItems([]);
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };
    void loadServiceItems();

    return () => {
      cancelled = true;
    };
  }, [defaultDueDate, defaultStartDate, defaultStatus, isOpen, projectId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const title = form.title.trim();
    if (!title) {
      setError("Tên công việc không được để trống.");
      return;
    }

    if (form.startDate && form.dueDate && form.dueDate < form.startDate) {
      setError("Deadline không được trước ngày bắt đầu.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await tasksApi.create(projectId, {
        title,
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        projectServiceItemId: form.projectServiceItemId || null,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
      });
      await onCreated();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể tạo công việc lúc này.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!saving) onClose();
      }}
      maxWidth="lg"
      title="Tạo công việc"
      description="Task được tạo trực tiếp trong workspace nhưng luôn bị khóa theo dự án hiện tại."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="rounded-xl border border-[#E0EAFF] bg-[#F8FAFF] px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
            Dự án
          </div>
          <div className="mt-1 text-xs font-bold text-[#0F172A]">
            {projectCode ?? "PROJECT"} · {projectName ?? "Dự án hiện tại"}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B]">
            Project ID được lấy từ URL workspace và không thể đổi trong form
            này.
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#64748B]">
            Tên công việc *
          </label>
          <input
            autoFocus
            required
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            placeholder="VD: Thiết kế giao diện Homepage"
            className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#4F75FF] focus:bg-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#64748B]">
            Mô tả
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
            placeholder="Yêu cầu, đường dẫn tài liệu đính kèm hoặc ghi chú triển khai..."
            className="w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#4F75FF] focus:bg-white"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#64748B]">
              Trạng thái
            </label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as BoardStatus,
                })
              }
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#4F75FF]"
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#64748B]">
              Ưu tiên
            </label>
            <select
              value={form.priority}
              onChange={(event) =>
                setForm({
                  ...form,
                  priority: event.target.value as TaskPriority,
                })
              }
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#4F75FF]"
            >
              {priorities.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#64748B]">
            Hạng mục triển khai
          </label>
          <select
            value={form.projectServiceItemId}
            disabled={loadingOptions}
            onChange={(event) =>
              setForm({
                ...form,
                projectServiceItemId: event.target.value,
              })
            }
            className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#4F75FF] disabled:opacity-60"
          >
            <option value="">
              {loadingOptions
                ? "Đang tải hạng mục..."
                : "Không gắn hạng mục (tùy chọn)"}
            </option>
            {serviceItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.project_service_item_code} · {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#64748B]">
              Ngày bắt đầu
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm({ ...form, startDate: event.target.value })
              }
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#4F75FF]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#64748B]">
              Deadline
            </label>
            <input
              type="date"
              min={form.startDate || undefined}
              value={form.dueDate}
              onChange={(event) =>
                setForm({ ...form, dueDate: event.target.value })
              }
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#4F75FF]"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-[#EDF2F7] pt-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={saving}
            isLoading={saving}
          >
            Tạo công việc
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
