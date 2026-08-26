"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  Plus,
  Search,
  Calendar,
  ChevronRight,
  FolderOpen,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { clientsApi } from "@/lib/api/clients";
import { peopleApi } from "@/lib/api/people";
import {
  type Paginated,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
  projectsApi,
} from "@/lib/api/projects";
import { ProjectCreateWizardDialog } from "./project-create-wizard-dialog";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";

type Mode = "admin" | "internal" | "client";

const statusConfig: Record<
  ProjectStatus,
  {
    label: string;
    variant: "blue" | "success" | "warning" | "default" | "danger";
  }
> = {
  draft: { label: "Nháp", variant: "default" },
  pending_approval: { label: "Chờ duyệt", variant: "warning" },
  active: { label: "Đang chạy", variant: "blue" },
  on_hold: { label: "Tạm dừng", variant: "warning" },
  completed: { label: "Hoàn thành", variant: "success" },
  archived: { label: "Đã lưu trữ", variant: "default" },
  cancelled: { label: "Đã hủy", variant: "danger" },
};

const priorityConfig: Record<
  ProjectPriority,
  { label: string; variant: "default" | "gold" | "warning" | "danger" }
> = {
  low: { label: "Thấp", variant: "default" },
  medium: { label: "Vừa", variant: "gold" },
  high: { label: "Cao", variant: "warning" },
  urgent: { label: "Khẩn cấp", variant: "danger" },
};

export function ProjectListView({ mode }: { mode: Mode }) {
  const [result, setResult] = useState<Paginated<Project>>({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [priority, setPriority] = useState<ProjectPriority | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);

  // Delete project states
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data =
        mode === "admin"
          ? await projectsApi.getAdminProjects({
              q: q || undefined,
              status: status || undefined,
              priority: priority || undefined,
              page,
              pageSize: 20,
            })
          : mode === "client"
            ? await projectsApi.getClientProjects(page, 20)
            : await projectsApi.getInternalProjects(page, 20);
      setResult(data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể tải danh sách dự án.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, page, priority, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "admin") {
      void clientsApi
        .getClientCompanies({ pageSize: 100 })
        .then((res: any) => setCompanies(res?.items ?? []))
        .catch(() => setCompanies([]));

      void peopleApi
        .getPeopleDirectory({ pageSize: 100 })
        .then((res: any) => setPeople(res?.items ?? []))
        .catch(() => setPeople([]));
    }
  }, [mode]);

  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await projectsApi.deleteProject(deletingProject.id);
      setDeletingProject(null);
      void load();
    } catch (err: any) {
      setDeleteError(err.message || "Không thể xóa dự án lúc này.");
    } finally {
      setDeleting(false);
    }
  };

  const detailBase =
    mode === "admin"
      ? "/app/admin/projects"
      : mode === "client"
        ? "/app/client/projects"
        : "/app/projects";

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title={
          mode === "admin"
            ? "Quản trị Dự án Khách hàng"
            : mode === "client"
              ? "Dự án của bạn"
              : "Dự án tham gia"
        }
        description={
          mode === "admin"
            ? "Khởi tạo, điều phối nguồn lực và giám sát tiến độ toàn bộ dự án agency."
            : mode === "client"
              ? "Theo dõi tiến độ bàn giao và kết quả các dịch vụ của công ty bạn."
              : "Danh sách các dự án bạn được phân công thực hiện nhiệm vụ."
        }
        badge={`${result.total} Dự án`}
        action={
          mode === "admin" ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setWizardOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Tạo dự án mới
            </Button>
          ) : undefined
        }
      />

      {/* Filter / Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-white border border-[#EDF2F7] shadow-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Tìm mã hoặc tên dự án..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#4F75FF]"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus | "")}
          className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] px-3 py-2 outline-none focus:border-[#4F75FF]"
        >
          <option value="">-- Mọi trạng thái --</option>
          {Object.entries(statusConfig).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as ProjectPriority | "")}
          className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] px-3 py-2 outline-none focus:border-[#4F75FF]"
        >
          <option value="">-- Mọi mức ưu tiên --</option>
          {Object.entries(priorityConfig).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setPage(1);
            void load();
          }}
        >
          Áp dụng
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Projects List / Grid */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : result.items.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-8 h-8 text-[#4F75FF]" />}
          title="Không tìm thấy dự án nào"
          description="Chưa có dự án nào phù hợp với bộ lọc hiện tại hoặc bạn chưa được gán vào dự án."
          actionLabel={mode === "admin" ? "Tạo dự án đầu tiên" : undefined}
          onAction={mode === "admin" ? () => setWizardOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {result.items.map((project) => {
            const sConf = statusConfig[project.status] || {
              label: project.status,
              variant: "default",
            };
            const pConf = priorityConfig[project.priority] || {
              label: project.priority,
              variant: "default",
            };

            return (
              <div key={project.id} className="relative group">
                <Link href={`${detailBase}/${project.id}`}>
                  <Card className="p-5 hover:border-[#4F75FF]/40 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0 pr-12 md:pr-0">
                      <div className="w-11 h-11 rounded-xl bg-[#EEF2FF] border border-[#E0EAFF] text-[#4F75FF] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <BriefcaseBusiness className="w-5 h-5" />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#4F75FF]">
                            {project.projectCode}
                          </span>
                          <Badge variant={sConf.variant} size="sm">
                            {sConf.label}
                          </Badge>
                          <Badge variant={pConf.variant} size="sm">
                            {pConf.label}
                          </Badge>
                        </div>

                        <h3 className="text-base font-extrabold text-[#0F172A] group-hover:text-[#4F75FF] transition-colors truncate">
                          {project.name}
                        </h3>

                        <p className="text-xs text-[#64748B] truncate">
                          Khách hàng:{" "}
                          <span className="text-[#0F172A] font-medium">
                            {project.clientCompany?.name ?? "Chưa liên kết"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-none border-[#EDF2F7] text-xs text-[#64748B] shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span>
                          {project.startDate || "—"} ➔ {project.dueDate || "—"}
                        </span>
                      </div>

                      {mode === "admin" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeletingProject(project);
                          }}
                          title="Xóa dự án"
                          className="text-rose-500 hover:bg-rose-50 hover:text-rose-700 p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}

                      <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#4F75FF] group-hover:translate-x-1 transition-all hidden md:block" />
                    </div>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {result.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7] text-xs text-[#64748B]">
          <span>
            Hiển thị trang {result.page} / {result.totalPages} ({result.total}{" "}
            dự án)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= result.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}

      {/* 3-Step Project Create Wizard Modal */}
      {mode === "admin" && (
        <ProjectCreateWizardDialog
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onSuccess={() => {
            setPage(1);
            void load();
          }}
          companies={companies}
          people={people}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        maxWidth="md"
        title="Xác nhận lưu trữ dự án"
        description={`Bạn có chắc chắn muốn lưu trữ dự án "${deletingProject?.name}" (${deletingProject?.projectCode})?`}
      >
        <div className="space-y-4 pt-2">
          {deleteError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <p className="text-xs text-[#64748B] leading-relaxed">
            Dữ liệu dịch vụ, công việc, tệp và tài chính vẫn được giữ nguyên để tra cứu và kiểm toán.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#EDF2F7]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => setDeletingProject(null)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={deleting}
              onClick={handleDeleteProject}
            >
              Lưu trữ dự án
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
