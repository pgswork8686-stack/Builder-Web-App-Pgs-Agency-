"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Search, Wrench } from "lucide-react";
import { servicesApi, type ServiceCatalogItem } from "@/lib/api/services";

const emptyForm = {
  code: "",
  name: "",
  description: "",
  active: true,
};

export function ServiceCatalogView() {
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await servicesApi.list({
        q: q || undefined,
        active: active ? active === "true" : undefined,
        page,
        pageSize: 20,
      });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể tải danh mục dịch vụ.",
      );
    } finally {
      setLoading(false);
    }
  }, [active, page, q]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (service: ServiceCatalogItem) => {
    setEditingId(service.id);
    setForm({
      code: service.code,
      name: service.name,
      description: service.description ?? "",
      active: service.active,
    });
    setShowForm(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        active: form.active,
      };
      if (editingId) {
        await servicesApi.update(editingId, payload);
      } else {
        await servicesApi.create(payload);
      }
      resetForm();
      setPage(1);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể lưu dịch vụ.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (service: ServiceCatalogItem) => {
    setError(null);
    try {
      await servicesApi.update(service.id, { active: !service.active });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật trạng thái dịch vụ.",
      );
    }
  };

  return (
    <main className="min-h-screen bg-[#070707] px-5 py-8 text-[#FFF8E6] lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-6 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FFC400]">
              PGS Hub · Phase 3
            </p>
            <h1 className="text-3xl font-black text-white">Danh mục dịch vụ</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Quản lý các dịch vụ có thể gắn vào dự án.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/app/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600"
            >
              <ArrowLeft className="h-4 w-4" /> Quay lại
            </Link>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setShowForm((value) => !value);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FFC400] px-4 py-2 text-sm font-bold text-black"
            >
              <Plus className="h-4 w-4" /> Thêm dịch vụ
            </button>
          </div>
        </header>

        <section className="grid gap-3 rounded-2xl border border-zinc-800 bg-[#0E0E0F] p-4 md:grid-cols-[1fr_180px_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Tìm theo mã hoặc tên dịch vụ"
              className="w-full rounded-xl border border-zinc-800 bg-black py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#FFC400]"
            />
          </label>
          <select
            value={active}
            onChange={(event) =>
              setActive(event.target.value as "" | "true" | "false")
            }
            className="rounded-xl border border-zinc-800 bg-black px-3 text-sm"
          >
            <option value="">Mọi trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã tắt</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void load();
            }}
            className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold hover:bg-zinc-700"
          >
            Lọc
          </button>
        </section>

        {showForm && (
          <form
            onSubmit={submit}
            className="grid gap-4 rounded-2xl border border-[#FFC400]/30 bg-[#0E0E0F] p-5 md:grid-cols-2"
          >
            <input
              required
              minLength={2}
              maxLength={40}
              value={form.code}
              onChange={(event) =>
                setForm({ ...form, code: event.target.value.toUpperCase() })
              }
              placeholder="Mã dịch vụ"
              className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
            />
            <input
              required
              minLength={2}
              maxLength={160}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="Tên dịch vụ"
              className="rounded-xl border border-zinc-800 bg-black px-3 py-2"
            />
            <textarea
              maxLength={5000}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Mô tả"
              className="min-h-24 rounded-xl border border-zinc-800 bg-black px-3 py-2 md:col-span-2"
            />
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm({ ...form, active: event.target.checked })
                }
              />
              Đang hoạt động
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl px-4 py-2 text-zinc-400"
              >
                Hủy
              </button>
              <button
                disabled={saving}
                className="rounded-xl bg-[#FFC400] px-5 py-2 font-bold text-black disabled:opacity-50"
              >
                {saving
                  ? "Đang lưu…"
                  : editingId
                    ? "Lưu thay đổi"
                    : "Tạo dịch vụ"}
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
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-zinc-500">
              Chưa có dịch vụ phù hợp.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {items.map((service) => (
                <article
                  key={service.id}
                  className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div className="flex gap-3">
                    <span className="mt-1 rounded-lg bg-[#FFC400]/10 p-2 text-[#FFC400]">
                      <Wrench className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold text-[#FFC400]">
                          {service.code}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            service.active
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          {service.active ? "Hoạt động" : "Đã tắt"}
                        </span>
                      </div>
                      <h2 className="font-bold text-white">{service.name}</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {service.description || "Chưa có mô tả."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(service)}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-600"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(service)}
                      className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-600"
                    >
                      {service.active ? "Tắt" : "Bật"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="flex items-center justify-between text-sm text-zinc-500">
          <span>{total} dịch vụ</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 disabled:opacity-30"
            >
              Trước
            </button>
            <span>
              {page}/{Math.max(1, totalPages)}
            </span>
            <button
              disabled={page >= totalPages}
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
