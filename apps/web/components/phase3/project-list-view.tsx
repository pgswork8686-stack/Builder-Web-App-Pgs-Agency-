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

type Mode = "admin" | "internal" | "client";

const statusConfig: Record<
  ProjectStatus,
  { label: string; variant: "blue" | "success" | "warning" | "default" | "danger" }
> = {
  draft: { label: "Nháp", variant: "default" },
  active: { label: "Đang chạy", variant: "blue" },
  on_hold: { label: "Tạm dừng", variant: "warning" },
  completed: { label: "Hoàn thành", variant: "success" },
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
        caught instanceof Error ? caught.message : "Không thể tải danh sách dự án.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, page, priority, q, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    if (mode !== "admin") return;
    void Promise.all([
      clientsApi.getClientCompanies({ page: 1, pageSize: 100 }),
      peopleApi.getPeopleDirectory({ page: 1, pageSize: 100 }),
    ]).then(([clientData, peopleData]) => {
      setCompanies(clientData.items ?? []);
      setPeople(
        (peopleData.items ?? []).filter(
          (person: any) =>
            person.role !== "client" && person.accountStatus === "active",
        ),
      );
    });
  }, [mode]);

  const detailBase =
    mode === "admin"
      ? "/app/admin/projects"
      : mode === "client"
        ? "/app/client/projects"
        : "/app/projects";

  const heading =
    mode === "admin"
      ? "Quản trị Dự án"
      : mode === "client"
        ? "Dự án Hợp tác Doanh nghiệp"
        : "Dự án của Tôi";

  const description =
    mode === "admin"
      ? "Theo dõi tiến độ, bàn giao sản phẩm và quản lý toàn bộ vòng đời dự án."
      : mode === "client"
        ? "Tra cứu tiến độ thực hiện và kết quả bàn giao của PGS Agency."
        : "Không gian làm việc và nhiệm vụ trong các dự án bạn tham gia.";

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <SectionHeader
        title={heading}
        description={description}
        badge={`${result.total} Dự án`}
        action={
          mode === "admin" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setWizardOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Tạo dự án mới
            </Button>
          )
        }
      />

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_200px_180px_auto] gap-3 p-4 rounded-2xl bg-white border border-[#EDF2F7] shadow-xs">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-[#94A3B8] pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo mã hoặc tên dự án..."
            className="w-full rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] py-2.5 pl-10 pr-3 text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none focus:bg-white focus:border-[#4F75FF] transition-colors"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus | "")}
          className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2.5 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          <option value="">-- Tất cả trạng thái --</option>
          {Object.entries(statusConfig).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as ProjectPriority | "")}
          className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2.5 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          <option value="">-- Mọi mức ưu tiên --</option>
          {Object.entries(priorityConfig).map(([key, config]) => (
            <option key={key} value={key}>
              Ưu tiên: {config.label}
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
              <Link key={project.id} href={`${detailBase}/${project.id}`}>
                <Card className="p-5 hover:border-[#4F75FF]/40 transition-all duration-150 group flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
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

                  <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-none border-[#EDF2F7] text-xs text-[#64748B] shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span>
                        {project.startDate || "—"} ➔ {project.dueDate || "—"}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#4F75FF] group-hover:translate-x-1 transition-all hidden md:block" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {result.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7] text-xs text-[#64748B]">
          <span>
            Hiển thị trang {result.page} / {result.totalPages} ({result.total} dự án)
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
    </div>
  );
}
