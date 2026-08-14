"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FolderOpen,
  LayoutDashboard,
  Layers3,
  ListTodo,
  Users,
  Plus,
  Trash2,
  Archive,
  Clock,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { peopleApi } from "@/lib/api/people";
import {
  type Project,
  type ProjectMemberRole,
  type ProjectServiceStatus,
  type ProjectStatus,
  projectsApi,
} from "@/lib/api/projects";
import { servicesApi, type ServiceCatalogItem } from "@/lib/api/services";
import {
  tasksApi,
  type ProjectTask,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api/tasks";
import { ProjectLifecycleDialogs } from "./project-lifecycle-dialogs";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

type Mode = "admin" | "internal" | "client";
type Tab = "overview" | "members" | "services" | "tasks";

const statuses: ProjectStatus[] = [
  "draft",
  "active",
  "on_hold",
  "completed",
  "cancelled",
];

const taskStatuses: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
];

export function ProjectDetailView({ mode }: { mode: Mode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [projectServices, setProjectServices] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lifecycle Modals
  const [completeOpen, setCompleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Add Member / Service / Task Dialogs
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const [memberForm, setMemberForm] = useState({
    userId: "",
    projectRole: "member" as ProjectMemberRole,
  });
  const [serviceForm, setServiceForm] = useState({
    serviceId: "",
    status: "planned" as ProjectServiceStatus,
    notes: "",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    assigneeUserId: "",
    priority: "medium" as TaskPriority,
  });

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "admin") {
        const [
          projectData,
          memberData,
          serviceData,
          catalogData,
          taskData,
          peopleData,
        ] = await Promise.all([
          projectsApi.getAdminProject(projectId),
          projectsApi.getMembers(projectId),
          projectsApi.getProjectServices(projectId),
          servicesApi.list({ page: 1, pageSize: 100 }),
          tasksApi.list(projectId, { page: 1, pageSize: 100 }),
          peopleApi.getPeopleDirectory({ page: 1, pageSize: 100 }),
        ]);
        setProject(projectData);
        setMembers(memberData);
        setProjectServices(serviceData);
        setCatalog(catalogData.items);
        setTasks(taskData.items);
        setPeople(
          (peopleData.items ?? []).filter(
            (p: any) => p.role !== "client" && p.accountStatus === "active",
          ),
        );
      } else if (mode === "client") {
        const [projectData, taskData] = await Promise.all([
          projectsApi.getClientProject(projectId),
          tasksApi.list(projectId, { page: 1, pageSize: 100 }),
        ]);
        setProject(projectData);
        setTasks(taskData.items);
      } else {
        const [projectData, memberData, serviceData, taskData, peopleData] =
          await Promise.all([
            projectsApi.getInternalProject(projectId),
            projectsApi.getMembers(projectId),
            projectsApi.getProjectServices(projectId),
            tasksApi.list(projectId, { page: 1, pageSize: 100 }),
            peopleApi.getPeopleDirectory({ page: 1, pageSize: 100 }),
          ]);
        setProject(projectData);
        setMembers(memberData);
        setProjectServices(serviceData);
        setTasks(taskData.items);
        setPeople(
          (peopleData.items ?? []).filter(
            (p: any) => p.role !== "client" && p.accountStatus === "active",
          ),
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể tải chi tiết dự án.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateProject = async (payload: Partial<Project>) => {
    if (!project) return;
    try {
      const updated = await projectsApi.updateProject(project.id, payload);
      setProject(updated);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể cập nhật dự án.",
      );
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!project || !memberForm.userId) return;
    setError(null);
    try {
      await projectsApi.addMember(project.id, memberForm);
      setAddMemberOpen(false);
      setMemberForm({ userId: "", projectRole: "member" });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể thêm thành viên.",
      );
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!project) return;
    try {
      await projectsApi.removeMember(project.id, userId);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể gỡ thành viên.",
      );
    }
  };

  const handleAddService = async (e: FormEvent) => {
    e.preventDefault();
    if (!project || !serviceForm.serviceId) return;
    setError(null);
    try {
      await projectsApi.addProjectService(project.id, serviceForm);
      setAddServiceOpen(false);
      setServiceForm({ serviceId: "", status: "planned", notes: "" });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể gán dịch vụ.",
      );
    }
  };

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!project || !taskForm.title) return;
    setError(null);
    try {
      await tasksApi.create(project.id, {
        title: taskForm.title,
        priority: taskForm.priority,
        assigneeUserId: taskForm.assigneeUserId || null,
      });
      setAddTaskOpen(false);
      setTaskForm({ title: "", assigneeUserId: "", priority: "medium" });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tạo công việc.",
      );
    }
  };

  const tabs = useMemo(() => {
    const list: Array<{
      value: Tab;
      label: string;
      icon: any;
      count?: number;
    }> = [{ value: "overview", label: "Tổng quan", icon: LayoutDashboard }];
    if (mode !== "client") {
      list.push(
        {
          value: "members",
          label: "Nhân sự",
          icon: Users,
          count: members.length,
        },
        {
          value: "services",
          label: "Dịch vụ",
          icon: Layers3,
          count: projectServices.length,
        },
      );
    }
    list.push({
      value: "tasks",
      label: "Công việc",
      icon: ListTodo,
      count: tasks.length,
    });
    return list;
  }, [mode, members.length, projectServices.length, tasks.length]);

  const baseBoardUrl =
    mode === "admin"
      ? `/app/admin/projects/${projectId}/board`
      : `/app/projects/${projectId}/board`;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={<AlertCircle className="w-8 h-8 text-rose-400" />}
        title="Không tìm thấy dự án"
        description={
          error ?? "Dự án không tồn tại hoặc bạn không có quyền truy cập."
        }
      />
    );
  }

  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const taskProgress =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <SectionHeader
        title={project.name}
        description={`Mã dự án: ${project.projectCode} • Khách hàng: ${project.clientCompany?.name ?? "Chưa liên kết"}`}
        badge={project.status ? project.status.toUpperCase() : undefined}
        action={
          <div className="flex items-center gap-2">
            {mode !== "client" && (
              <Link href={baseBoardUrl}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<LayoutDashboard className="w-4 h-4" />}
                >
                  Mở Kanban Board
                </Button>
              </Link>
            )}

            {mode === "admin" && project.status !== "completed" && (
              <Button
                variant="gold-outline"
                size="sm"
                onClick={() => setCompleteOpen(true)}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Nghiệm thu
              </Button>
            )}

            {mode === "admin" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setArchiveOpen(true)}
                leftIcon={<Archive className="w-4 h-4" />}
              >
                Lưu trữ
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tiến độ công việc"
          value={`${taskProgress}%`}
          subtitle={`${completedTasks}/${tasks.length} tasks hoàn thành`}
          icon={<ListTodo className="w-5 h-5" />}
        />
        <StatCard
          title="Đội ngũ nhân sự"
          value={`${members.length} thành viên`}
          subtitle={`PM: ${project.projectManager?.full_name || project.projectManager?.email || "Chưa gán"}`}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Thời hạn bàn giao"
          value={project.dueDate || "Chưa đặt"}
          subtitle={`Bắt đầu: ${project.startDate || "—"}`}
          icon={<CalendarDays className="w-5 h-5" />}
        />
        <StatCard
          variant="purple"
          title="Mức ưu tiên"
          value={project.priority ? project.priority.toUpperCase() : "NORMAL"}
          subtitle={`Trạng thái: ${project.status}`}
          icon={<Briefcase className="w-5 h-5" />}
        />
      </div>

      {/* Workspace Sub-Navigation Cards */}
      {mode !== "client" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href={`${mode === "admin" ? "/app/admin/projects" : "/app/projects"}/${projectId}/board`}
          >
            <Card className="p-5 hover:border-[#4F75FF]/40 transition-all flex items-center justify-between group">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] border border-[#E0EAFF] text-[#4F75FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-[#4F75FF] transition-colors">
                    Kanban Board
                  </h4>
                  <p className="text-xs text-[#64748B]">
                    Kéo thả & phân bổ task thời gian thực
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link
            href={`${mode === "admin" ? "/app/admin/projects" : "/app/projects"}/${projectId}/calendar`}
          >
            <Card className="p-5 hover:border-[#4F75FF]/40 transition-all flex items-center justify-between group">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] border border-[#E0EAFF] text-[#4F75FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-[#4F75FF] transition-colors">
                    Lịch biểu dự án
                  </h4>
                  <p className="text-xs text-[#64748B]">
                    Theo dõi timeline và deadline công việc
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link
            href={`${mode === "admin" ? "/app/admin/projects" : "/app/projects"}/${projectId}/files`}
          >
            <Card className="p-5 hover:border-[#4F75FF]/40 transition-all flex items-center justify-between group">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] border border-[#E0EAFF] text-[#4F75FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-[#4F75FF] transition-colors">
                    Tệp tin & Tài liệu
                  </h4>
                  <p className="text-xs text-[#64748B]">
                    Kho lưu trữ và tài liệu bàn giao
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-[#EDF2F7] flex gap-2 overflow-x-auto scrollbar-none">
        {tabs.map(({ value, label, icon: Icon, count }) => {
          const isActive = tab === value;
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                isActive
                  ? "border-[#4F75FF] text-[#4F75FF]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {typeof count === "number" && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#F1F5F9] text-[10px] text-[#64748B]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Mục tiêu & Phạm vi dự án</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-[#334155] leading-relaxed whitespace-pre-wrap">
                {project.description || "Chưa có nội dung mô tả phạm vi dự án."}
              </p>

              {mode === "admin" && (
                <div className="pt-4 border-t border-[#EDF2F7] space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                    Chuyển nhanh trạng thái
                  </label>
                  <Select
                    value={project.status}
                    onChange={(e) =>
                      void updateProject({
                        status: e.target.value as ProjectStatus,
                      })
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s.toUpperCase()}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thông tin Hợp tác</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-[#EDF2F7]">
                <span className="text-[#64748B]">Công ty khách hàng:</span>
                <span className="font-bold text-[#0F172A]">
                  {project.clientCompany?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#EDF2F7]">
                <span className="text-[#64748B]">Project Manager:</span>
                <span className="font-bold text-[#0F172A]">
                  {project.projectManager?.full_name ||
                    project.projectManager?.email ||
                    "Chưa chỉ định"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#EDF2F7]">
                <span className="text-[#64748B]">Ngày khởi động:</span>
                <span className="text-[#0F172A]">{project.startDate || "—"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#EDF2F7]">
                <span className="text-[#64748B]">Hạn chót bàn giao:</span>
                <span className="text-[#0F172A]">{project.dueDate || "—"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[#64748B]">Ngày nghiệm thu:</span>
                <span className="text-[#00B788] font-semibold">
                  {project.completedAt || "Chưa nghiệm thu"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Members */}
      {tab === "members" && mode !== "client" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0F172A]">
              Danh sách thành viên dự án
            </h3>
            {mode === "admin" && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAddMemberOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Thêm nhân sự
              </Button>
            )}
          </div>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nhân sự</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Vai trò trong dự án</TableHeaderCell>
                  {mode === "admin" && (
                    <TableHeaderCell className="text-right">
                      Thao tác
                    </TableHeaderCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-[#64748B] py-8"
                    >
                      Chưa có thành viên nào được gán vào dự án.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-bold text-[#0F172A]">
                        {m.profile?.full_name || m.profile?.email}
                      </TableCell>
                      <TableCell className="text-[#64748B]">
                        {m.profile?.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="blue" size="sm">
                          {m.projectRole}
                        </Badge>
                      </TableCell>
                      {mode === "admin" && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-600"
                            onClick={() => handleRemoveMember(m.userId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}

      {/* Tab 3: Services */}
      {tab === "services" && mode !== "client" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0F172A]">
              Gói dịch vụ cung cấp
            </h3>
            {mode === "admin" && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAddServiceOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Gán dịch vụ
              </Button>
            )}
          </div>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Mã dịch vụ</TableHeaderCell>
                  <TableHeaderCell>Tên dịch vụ</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell>Ghi chú</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectServices.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-[#64748B] py-8"
                    >
                      Chưa có dịch vụ nào được gán cho dự án này.
                    </TableCell>
                  </TableRow>
                ) : (
                  projectServices.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs font-bold text-[#4F75FF]">
                        {s.service?.code || "—"}
                      </TableCell>
                      <TableCell className="font-bold text-[#0F172A]">
                        {s.service?.name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="blue" size="sm">
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[#64748B]">
                        {s.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}

      {/* Tab 4: Tasks */}
      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0F172A]">
              Danh sách công việc ({tasks.length})
            </h3>
            {mode !== "client" && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAddTaskOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Thêm Task
              </Button>
            )}
          </div>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Tên công việc</TableHeaderCell>
                  <TableHeaderCell>Người phụ trách</TableHeaderCell>
                  <TableHeaderCell>Ưu tiên</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell>Hạn chót</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-[#64748B] py-8"
                    >
                      Chưa có công việc nào trong dự án này.
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-bold text-[#0F172A]">
                        <Link
                          href={`${mode === "admin" ? "/app/admin/projects" : "/app/projects"}/${projectId}/tasks/${t.id}`}
                          className="hover:text-[#4F75FF] transition-colors"
                        >
                          {t.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-[#64748B]">
                        {t.assignee?.full_name ||
                          t.assignee?.email ||
                          "Chưa gán"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.priority === "urgent" || t.priority === "high"
                              ? "danger"
                              : "default"
                          }
                          size="sm"
                        >
                          {t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.status === "done" ? "success" : "blue"}
                          size="sm"
                        >
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[#64748B]">
                        {t.due_date || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}

      {/* Dialogs: Add Member */}
      <Dialog
        isOpen={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        maxWidth="sm"
        title="Thêm nhân sự vào dự án"
      >
        <form onSubmit={handleAddMember} className="space-y-4 pt-2">
          <Select
            label="Chọn nhân viên *"
            required
            value={memberForm.userId}
            onChange={(e) =>
              setMemberForm({ ...memberForm, userId: e.target.value })
            }
          >
            <option value="">-- Chọn nhân sự --</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName || p.email} ({p.email})
              </option>
            ))}
          </Select>

          <Select
            label="Vai trò dự án"
            value={memberForm.projectRole}
            onChange={(e) =>
              setMemberForm({
                ...memberForm,
                projectRole: e.target.value as ProjectMemberRole,
              })
            }
          >
            <option value="member">Thành viên (Member)</option>
            <option value="lead">Trưởng nhóm kỹ thuật (Lead)</option>
            <option value="viewer">Người quan sát (Viewer)</option>
          </Select>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAddMemberOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Lưu thành viên
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialogs: Add Service */}
      <Dialog
        isOpen={addServiceOpen}
        onClose={() => setAddServiceOpen(false)}
        maxWidth="sm"
        title="Gán dịch vụ cho dự án"
      >
        <form onSubmit={handleAddService} className="space-y-4 pt-2">
          <Select
            label="Chọn gói dịch vụ *"
            required
            value={serviceForm.serviceId}
            onChange={(e) =>
              setServiceForm({ ...serviceForm, serviceId: e.target.value })
            }
          >
            <option value="">-- Chọn dịch vụ --</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </Select>

          <Input
            label="Ghi chú phạm vi"
            placeholder="Ghi chú chi tiết gói dịch vụ..."
            value={serviceForm.notes}
            onChange={(e) =>
              setServiceForm({ ...serviceForm, notes: e.target.value })
            }
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAddServiceOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Lưu dịch vụ
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialogs: Add Task */}
      <Dialog
        isOpen={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        maxWidth="sm"
        title="Tạo công việc mới"
      >
        <form onSubmit={handleAddTask} className="space-y-4 pt-2">
          <Input
            label="Tiêu đề công việc *"
            required
            placeholder="Nhập nội dung công việc..."
            value={taskForm.title}
            onChange={(e) =>
              setTaskForm({ ...taskForm, title: e.target.value })
            }
          />

          <Select
            label="Người phụ trách"
            value={taskForm.assigneeUserId}
            onChange={(e) =>
              setTaskForm({ ...taskForm, assigneeUserId: e.target.value })
            }
          >
            <option value="">-- Chưa chỉ định --</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName || p.email}
              </option>
            ))}
          </Select>

          <Select
            label="Mức độ ưu tiên"
            value={taskForm.priority}
            onChange={(e) =>
              setTaskForm({
                ...taskForm,
                priority: e.target.value as TaskPriority,
              })
            }
          >
            <option value="low">Thấp</option>
            <option value="medium">Vừa</option>
            <option value="high">Cao</option>
            <option value="urgent">Khẩn cấp</option>
          </Select>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAddTaskOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Tạo task
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Project Lifecycle Dialogs (Complete & Archive) */}
      <ProjectLifecycleDialogs
        project={project}
        completeOpen={completeOpen}
        archiveOpen={archiveOpen}
        onCloseComplete={() => setCompleteOpen(false)}
        onCloseArchive={() => setArchiveOpen(false)}
        onUpdated={(updated) => setProject(updated)}
      />
    </div>
  );
}
