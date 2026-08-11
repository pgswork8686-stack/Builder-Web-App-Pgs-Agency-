"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Layers3,
  ListTodo,
  Users,
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
        setPeople(peopleData.items ?? []);
      } else if (mode === "client") {
        const projectData = await projectsApi.getClientProject(projectId);
        setProject(projectData);
        setProjectServices((projectData.services as any[]) ?? []);
      } else {
        const [projectData, taskData] = await Promise.all([
          projectsApi.getInternalProject(projectId),
          tasksApi.list(projectId, { page: 1, pageSize: 100 }),
        ]);
        setProject(projectData);
        setMembers((projectData.members as any[]) ?? []);
        setProjectServices((projectData.services as any[]) ?? []);
        setTasks(taskData.items);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tải dự án.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, projectId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const tabs = useMemo(() => {
    const values: { value: Tab; label: string; icon: typeof Users }[] = [
      { value: "overview", label: "Tổng quan", icon: Layers3 },
      { value: "services", label: "Dịch vụ", icon: CheckCircle2 },
    ];
    if (mode !== "client") {
      values.splice(1, 0, {
        value: "members",
        label: "Thành viên",
        icon: Users,
      });
      values.push({ value: "tasks", label: "Công việc", icon: ListTodo });
    }
    return values;
  }, [mode]);

  const updateProject = async (data: Record<string, unknown>) => {
    if (!projectId) return;
    try {
      await projectsApi.updateProject(projectId, data);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể cập nhật dự án.",
      );
    }
  };

  const addMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId) return;
    try {
      await projectsApi.addMember(projectId, memberForm);
      setMemberForm({ userId: "", projectRole: "member" });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể thêm thành viên.",
      );
    }
  };

  const addService = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId) return;
    try {
      await projectsApi.addProjectService(projectId, {
        ...serviceForm,
        notes: serviceForm.notes || null,
      });
      setServiceForm({ serviceId: "", status: "planned", notes: "" });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể gán dịch vụ.",
      );
    }
  };

  const addTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId) return;
    try {
      await tasksApi.create(projectId, {
        title: taskForm.title,
        assigneeUserId: taskForm.assigneeUserId || null,
        priority: taskForm.priority,
      });
      setTaskForm({ title: "", assigneeUserId: "", priority: "medium" });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tạo công việc.",
      );
    }
  };

  const backHref =
    mode === "admin"
      ? "/app/admin/projects"
      : mode === "client"
        ? "/app/client/projects"
        : "/app/projects";

  if (loading)
    return (
      <main className="min-h-screen bg-[#070707] p-10 text-zinc-500">
        Đang tải dự án…
      </main>
    );
  if (!project)
    return (
      <main className="min-h-screen bg-[#070707] p-10 text-red-300">
        {error ?? "Không tìm thấy dự án."}
      </main>
    );

  return (
    <main className="min-h-screen bg-[#070707] px-5 py-8 text-[#FFF8E6] lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-4 border-b border-zinc-800 pb-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Danh sách dự án
          </Link>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFC400]">
                {project.projectCode}
              </p>
              <h1 className="mt-1 text-3xl font-black text-white">
                {project.name}
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                {project.clientCompany?.name ?? "—"}
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-[#FFC400]/10 px-3 py-1 text-xs font-bold text-[#FFC400]">
                {project.status}
              </span>
              <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                {project.priority}
              </span>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <nav className="flex gap-2 overflow-x-auto border-b border-zinc-800">
          {tabs.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm ${tab === value ? "border-[#FFC400] text-[#FFC400]" : "border-transparent text-zinc-500"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-5">
              <h2 className="mb-4 font-bold text-white">Thông tin dự án</h2>
              <dl className="space-y-3 text-sm">
                <Info label="Khách hàng" value={project.clientCompany?.name} />
                <Info
                  label="PM"
                  value={
                    project.projectManager?.full_name ||
                    project.projectManager?.email
                  }
                />
                <Info label="Bắt đầu" value={project.startDate} />
                <Info label="Đến hạn" value={project.dueDate} />
                <Info label="Hoàn thành" value={project.completedAt} />
              </dl>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-5">
              <h2 className="mb-4 font-bold text-white">Mô tả</h2>
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                {project.description || "Chưa có mô tả."}
              </p>
              {mode === "admin" && (
                <div className="mt-6 grid gap-3">
                  <select
                    value={project.status}
                    onChange={(event) =>
                      void updateProject({ status: event.target.value })
                    }
                    className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm"
                  >
                    {statuses.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <select
                    value={project.priority}
                    onChange={(event) =>
                      void updateProject({ priority: event.target.value })
                    }
                    className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm"
                  >
                    {["low", "medium", "high", "urgent"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "members" && mode !== "client" && (
          <section className="space-y-4">
            {mode === "admin" && (
              <form
                onSubmit={addMember}
                className="grid gap-3 rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-4 md:grid-cols-[1fr_220px_auto]"
              >
                <select
                  required
                  value={memberForm.userId}
                  onChange={(event) =>
                    setMemberForm({ ...memberForm, userId: event.target.value })
                  }
                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
                >
                  <option value="">Chọn người dùng</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName || person.email} · {person.role}
                    </option>
                  ))}
                </select>
                <select
                  value={memberForm.projectRole}
                  onChange={(event) =>
                    setMemberForm({
                      ...memberForm,
                      projectRole: event.target.value as ProjectMemberRole,
                    })
                  }
                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
                >
                  {[
                    "project_manager",
                    "member",
                    "client_contact",
                    "viewer",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button className="rounded-xl bg-[#FFC400] px-4 py-2 font-bold text-black">
                  Thêm
                </button>
              </form>
            )}
            <div className="divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-800 bg-[#0E0E0F]">
              {members.map((member) => {
                const profile = member.profile ?? {};
                const role = member.projectRole ?? member.project_role;
                return (
                  <div
                    key={member.id}
                    className="flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {profile.full_name ||
                          profile.email ||
                          member.userId ||
                          member.user_id}
                      </p>
                      <p className="text-xs text-zinc-500">{profile.email}</p>
                    </div>
                    {mode === "admin" ? (
                      <div className="flex gap-2">
                        <select
                          value={role}
                          onChange={(event) =>
                            void projectsApi
                              .updateMember(
                                projectId,
                                member.id,
                                event.target.value as ProjectMemberRole,
                              )
                              .then(load)
                              .catch((caught) => setError(caught.message))
                          }
                          className="rounded-lg border border-zinc-800 bg-black px-2 py-1 text-xs"
                        >
                          {[
                            "project_manager",
                            "member",
                            "client_contact",
                            "viewer",
                          ].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            void projectsApi
                              .removeMember(projectId, member.id)
                              .then(load)
                              .catch((caught) => setError(caught.message))
                          }
                          className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-300"
                        >
                          Gỡ
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-[#FFC400]">{role}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "services" && (
          <section className="space-y-4">
            {mode === "admin" && (
              <form
                onSubmit={addService}
                className="grid gap-3 rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-4 md:grid-cols-[1fr_180px_1fr_auto]"
              >
                <select
                  required
                  value={serviceForm.serviceId}
                  onChange={(event) =>
                    setServiceForm({
                      ...serviceForm,
                      serviceId: event.target.value,
                    })
                  }
                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
                >
                  <option value="">Chọn dịch vụ</option>
                  {catalog
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} · {item.name}
                      </option>
                    ))}
                </select>
                <select
                  value={serviceForm.status}
                  onChange={(event) =>
                    setServiceForm({
                      ...serviceForm,
                      status: event.target.value as ProjectServiceStatus,
                    })
                  }
                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
                >
                  {[
                    "planned",
                    "active",
                    "paused",
                    "completed",
                    "cancelled",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <input
                  value={serviceForm.notes}
                  onChange={(event) =>
                    setServiceForm({
                      ...serviceForm,
                      notes: event.target.value,
                    })
                  }
                  placeholder="Ghi chú"
                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
                />
                <button className="rounded-xl bg-[#FFC400] px-4 py-2 font-bold text-black">
                  Gán
                </button>
              </form>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {projectServices.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-5"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#FFC400]">
                        {item.service?.code}
                      </p>
                      <h3 className="font-bold text-white">
                        {item.service?.name}
                      </h3>
                    </div>
                    <span className="text-xs text-zinc-400">{item.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-500">
                    {item.notes ||
                      item.service?.description ||
                      "Không có ghi chú."}
                  </p>
                  {mode === "admin" && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <input
                        defaultValue={item.notes ?? ""}
                        placeholder="Ghi chú nội bộ"
                        onBlur={(event) => {
                          const notes = event.target.value.trim();
                          if (notes === (item.notes ?? "")) return;
                          void projectsApi
                            .updateProjectService(projectId, item.id, {
                              notes: notes || null,
                            })
                            .then(load)
                            .catch((caught) => setError(caught.message));
                        }}
                        className="rounded-lg border border-zinc-800 bg-black px-2 py-1 text-xs"
                      />
                      <select
                        value={item.status}
                        onChange={(event) =>
                          void projectsApi
                            .updateProjectService(projectId, item.id, {
                              status: event.target
                                .value as ProjectServiceStatus,
                            })
                            .then(load)
                            .catch((caught) => setError(caught.message))
                        }
                        className="rounded-lg border border-zinc-800 bg-black px-2 py-1 text-xs"
                      >
                        {[
                          "planned",
                          "active",
                          "paused",
                          "completed",
                          "cancelled",
                        ].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          void projectsApi
                            .removeProjectService(projectId, item.id)
                            .then(load)
                            .catch((caught) => setError(caught.message))
                        }
                        className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-300"
                      >
                        Gỡ
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "tasks" && mode !== "client" && (
          <section className="space-y-4">
            {(mode === "admin" ||
              project.currentProjectRole === "project_manager") && (
              <form
                onSubmit={addTask}
                className="grid gap-3 rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-4 md:grid-cols-[1fr_220px_160px_auto]"
              >
                <input
                  required
                  value={taskForm.title}
                  onChange={(event) =>
                    setTaskForm({ ...taskForm, title: event.target.value })
                  }
                  placeholder="Tên công việc"
                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
                />
                <select
                  value={taskForm.assigneeUserId}
                  onChange={(event) =>
                    setTaskForm({
                      ...taskForm,
                      assigneeUserId: event.target.value,
                    })
                  }
                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
                >
                  <option value="">Chưa giao</option>
                  {members
                    .filter(
                      (member) =>
                        (member.projectRole ?? member.project_role) !==
                        "client_contact",
                    )
                    .map((member) => (
                      <option
                        key={member.id}
                        value={member.userId ?? member.user_id}
                      >
                        {member.profile?.full_name ||
                          member.profile?.email ||
                          member.userId}
                      </option>
                    ))}
                </select>
                <select
                  value={taskForm.priority}
                  onChange={(event) =>
                    setTaskForm({
                      ...taskForm,
                      priority: event.target.value as TaskPriority,
                    })
                  }
                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
                >
                  {["low", "medium", "high", "urgent"].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button className="rounded-xl bg-[#FFC400] px-4 py-2 font-bold text-black">
                  Tạo
                </button>
              </form>
            )}
            <div className="divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-800 bg-[#0E0E0F]">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px]"
                >
                  <div>
                    <p className="font-semibold text-white">{task.title}</p>
                    <p className="text-xs text-zinc-500">
                      {task.assignee?.full_name ||
                        task.assignee?.email ||
                        "Chưa giao"}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">
                    Ưu tiên: {task.priority}
                  </span>
                  {task.canUpdateStatus ? (
                    <select
                      value={task.status}
                      onChange={(event) =>
                        void tasksApi
                          .update(projectId, task.id, {
                            status: event.target.value as TaskStatus,
                          })
                          .then(load)
                          .catch((caught) => setError(caught.message))
                      }
                      className="rounded-lg border border-zinc-800 bg-black px-2 py-1 text-xs"
                    >
                      {taskStatuses.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-zinc-400">{task.status}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-5 border-b border-zinc-900 pb-2">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="text-right text-zinc-300">{value || "—"}</dd>
    </div>
  );
}
