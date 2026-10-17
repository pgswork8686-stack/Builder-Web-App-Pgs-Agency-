import type { ProjectTask, TaskPriority, TaskStatus } from "@/lib/api/tasks";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Cần làm",
  in_progress: "Đang thực hiện",
  review: "Chờ nghiệm thu",
  done: "Hoàn tất",
  cancelled: "Đã huỷ",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp",
};

export const TASK_PRIORITY_VARIANT: Record<
  TaskPriority,
  "default" | "blue" | "warning" | "danger"
> = {
  low: "default",
  medium: "blue",
  high: "warning",
  urgent: "danger",
};

export const TASK_STATUS_VARIANT: Record<
  TaskStatus,
  "default" | "blue" | "gold" | "success" | "outline"
> = {
  todo: "default",
  in_progress: "blue",
  review: "gold",
  done: "success",
  cancelled: "outline",
};

export function isTaskOverdue(
  task: Pick<ProjectTask, "due_date" | "status">,
  today = new Date(),
): boolean {
  if (!task.due_date || task.status === "done" || task.status === "cancelled") {
    return false;
  }
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return task.due_date < iso;
}

export function toIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function taskHref(task: Pick<ProjectTask, "id" | "project_id">) {
  return `/app/projects/${task.project_id}/tasks/${task.id}`;
}

export function describeApiError(error: unknown): string {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    if (status === 403) return "Bạn không có quyền xem dữ liệu này.";
    if (status === 401) return "Phiên đăng nhập đã hết hạn.";
  }
  return error instanceof Error && error.message
    ? error.message
    : "Không thể tải dữ liệu công việc.";
}
