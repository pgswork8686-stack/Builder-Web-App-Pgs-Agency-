"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Plus, Search } from "lucide-react";
import { clientsApi } from "@/lib/api/clients";
import { peopleApi } from "@/lib/api/people";
import {
  type Paginated,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
  projectsApi,
} from "@/lib/api/projects";

type Mode = "admin" | "internal" | "client";

const statusLabels: Record<ProjectStatus, string> = {
  draft: "Nháp",
  active: "Đang chạy",
  on_hold: "Tạm dừng",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const emptyForm = {
  projectCode: "",
  clientCompanyId: "",
  name: "",
  description: "",
  status: "draft" as ProjectStatus,
  priority: "medium" as ProjectPriority,
  projectManagerUserId: "",
  startDate: "",
  dueDate: "",
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
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
        caught instanceof Error ? caught.message : "Không thể tải dự án.",
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

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await projectsApi.createProject({
        ...form,
        description: form.description || null,
        projectManagerUserId: form.projectManagerUserId || null,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
      });
      setForm(emptyForm);
      setShowCreate(false);
      setPage(1);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tạo dự án.",
      );
    }
  };

  const detailBase =
    mode === "admin"
      ? "/app/admin/projects"
      : mode === "client"
        ? "/app/client/projects"
        : "/app/projects";
  const backHref =
    mode === "admin"
      ? "/app/admin"
      : mode === "client"
        ? "/app/client"
        : "/app";
  const heading =
    mode === "admin"
      ? "Quản trị dự án"
      : mode === "client"
        ? "Dự án của doanh nghiệp"
        : "Dự án của tôi";

  return (
    <main className="min-h-screen bg-[#070707] px-5 py-8 text-[#FFF8E6] lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 border-b border-[#202024] pb-6 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FFC400]">
              PGS Hub · Phase 3
            </p>
            <h1 className="text-3xl font-black text-white">{heading}</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Dữ liệu được phân trang và giới hạn theo quyền từ NestJS API.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600"
            >
              <ArrowLeft className="h-4 w-4" /> Quay lại
            </Link>
            {mode === "admin" && (
              <button
                onClick={() => setShowCreate((value) => !value)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FFC400] px-4 py-2 text-sm font-bold text-black"
              >
                <Plus className="h-4 w-4" /> Tạo dự án
              </button>
            )}
          </div>
        </header>

        {mode === "admin" && (
          <section className="grid gap-3 rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-4 md:grid-cols-[1fr_180px_180px_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Tìm mã hoặc tên dự án"
                className="w-full rounded-xl border border-zinc-800 bg-black py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ProjectStatus | "")
              }
              className="rounded-xl border border-zinc-800 bg-black px-3 text-sm"
            >
              <option value="">Mọi trạng thái</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as ProjectPriority | "")
              }
              className="rounded-xl border border-zinc-800 bg-black px-3 text-sm"
            >
              <option value="">Mọi ưu tiên</option>
              {(["low", "medium", "high", "urgent"] as const).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setPage(1);
                void load();
              }}
              className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold hover:bg-zinc-700"
            >
              Lọc
            </button>
          </section>
        )}

        {showCreate && (
          <form
            onSubmit={submitCreate}
            className="grid gap-4 rounded-2xl border border-[#FFC400]/30 bg-[#0E0E0F] p-5 md:grid-cols-2"
          >
            <input
              required
              value={form.projectCode}
              onChange={(event) =>
                setForm({ ...form, projectCode: event.target.value })
              }
              placeholder="Mã dự án (VD: PGS-2026-001)"
              className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
            />
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="Tên dự án"
              className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
            />
            <select
              required
              value={form.clientCompanyId}
              onChange={(event) =>
                setForm({ ...form, clientCompanyId: event.target.value })
              }
              className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
            >
              <option value="">Chọn công ty khách hàng</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.code} · {company.name}
                </option>
              ))}
            </select>
            <select
              value={form.projectManagerUserId}
              onChange={(event) =>
                setForm({ ...form, projectManagerUserId: event.target.value })
              }
              className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
            >
              <option value="">Chưa chỉ định PM</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName || person.email}
                </option>
              ))}
            </select>
            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as ProjectStatus,
                })
              }
              className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(event) =>
                setForm({
                  ...form,
                  priority: event.target.value as ProjectPriority,
                })
              }
              className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
            >
              {(["low", "medium", "high", "urgent"] as const).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm({ ...form, startDate: event.target.value })
              }
              className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
            />
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) =>
                setForm({ ...form, dueDate: event.target.value })
              }
              className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
            />
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Mô tả"
              className="min-h-24 rounded-xl border border-zinc-800 bg-black px-3 py-2 md:col-span-2"
            />
            <div className="flex justify-end gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl px-4 py-2 text-zinc-400"
              >
                Hủy
              </button>
              <button className="rounded-xl bg-[#FFC400] px-5 py-2 font-bold text-black">
                Lưu dự án
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0E0E0F]">
          {loading ? (
            <p className="p-8 text-center text-zinc-500">Đang tải…</p>
          ) : result.items.length === 0 ? (
            <p className="p-8 text-center text-zinc-500">
              Chưa có dự án trong phạm vi truy cập.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {result.items.map((project) => (
                <Link
                  key={project.id}
                  href={`${detailBase}/${project.id}`}
                  className="grid gap-3 p-5 transition hover:bg-zinc-900 md:grid-cols-[1fr_180px_140px] md:items-center"
                >
                  <div className="flex gap-3">
                    <span className="mt-1 rounded-lg bg-[#FFC400]/10 p-2 text-[#FFC400]">
                      <BriefcaseBusiness className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#FFC400]">
                        {project.projectCode}
                      </p>
                      <h2 className="font-bold text-white">{project.name}</h2>
                      <p className="text-xs text-zinc-500">
                        {project.clientCompany?.name ?? "Chưa có khách hàng"}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-zinc-300">
                      {statusLabels[project.status]}
                    </p>
                    <p className="text-xs text-zinc-600">
                      Ưu tiên: {project.priority}
                    </p>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {project.startDate || "—"} → {project.dueDate || "—"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="flex items-center justify-between text-sm text-zinc-500">
          <span>{result.total} dự án</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 disabled:opacity-30"
            >
              Trước
            </button>
            <span className="px-2 py-1.5">
              {page}/{Math.max(1, result.totalPages)}
            </span>
            <button
              disabled={page >= result.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 disabled:opacity-30"
            >
              Sau
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
