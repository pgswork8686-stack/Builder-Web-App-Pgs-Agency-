"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Search, Wrench } from "lucide-react";
import { servicesApi, type ServiceCatalogItem } from "@/lib/api/services";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

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
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        active: form.active,
      };
      if (editingId) {
        await servicesApi.update(editingId, payload);
      } else {
        await servicesApi.create(payload);
      }
      resetForm();
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu dịch vụ. Vui lòng kiểm tra lại mã dịch vụ.",
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
          : "Không thể đổi trạng thái dịch vụ.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Danh mục Dịch vụ"
        description="Quản lý các gói và dịch vụ chuẩn hóa được sử dụng trong hợp đồng và báo giá."
        badge={`${total} Dịch vụ`}
        action={
          <div className="flex items-center gap-3">
            <Link href="/app/admin">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Quay lại
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setShowForm((value) => !value);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Thêm dịch vụ
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-[#EDF2F7] shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Tìm theo mã hoặc tên dịch vụ..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
          />
        </div>
        <select
          value={active}
          onChange={(event) =>
            setActive(event.target.value as "" | "true" | "false")
          }
          className="bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs px-3 py-2 rounded-xl outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          <option value="">-- Mọi trạng thái --</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Đã tắt</option>
        </select>
      </div>

      {showForm && (
        <Card className="p-6">
          <h3 className="font-extrabold text-[#0F172A] text-sm mb-4">
            {editingId ? "Cập nhật dịch vụ" : "Thêm dịch vụ mới"}
          </h3>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">
                Mã dịch vụ *
              </label>
              <input
                required
                minLength={2}
                maxLength={40}
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value.toUpperCase() })
                }
                placeholder="VD: SEO-AUDIT"
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">
                Tên dịch vụ *
              </label>
              <input
                required
                minLength={2}
                maxLength={160}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="VD: Dịch vụ Audit & Tối ưu SEO Onpage"
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#64748B] mb-1">
                Mô tả chi tiết
              </label>
              <textarea
                maxLength={5000}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Mô tả phạm vi thực hiện và deliverable..."
                className="min-h-24 w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] resize-none"
              />
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                id="formServiceActive"
                checked={form.active}
                onChange={(event) =>
                  setForm({ ...form, active: event.target.checked })
                }
                className="w-4 h-4 accent-[#4F75FF] cursor-pointer"
              />
              <label
                htmlFor="formServiceActive"
                className="text-xs text-[#0F172A] cursor-pointer select-none"
              >
                Đang kích hoạt sử dụng
              </label>
            </div>

            <div className="flex justify-end gap-2 md:col-span-2 pt-2 border-t border-[#EDF2F7]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={resetForm}
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
                {editingId ? "Lưu thay đổi" : "Tạo dịch vụ"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <Card className="p-6 space-y-4">
        {loading ? (
          <p className="p-8 text-center text-xs text-[#64748B]">Đang tải…</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Wrench className="w-8 h-8 text-[#4F75FF]" />}
            title="Chưa có dịch vụ phù hợp"
            description="Chưa tìm thấy dịch vụ nào theo tiêu chí lọc."
          />
        ) : (
          <div className="divide-y divide-[#EDF2F7]">
            {items.map((service) => (
              <article
                key={service.id}
                className="grid gap-4 py-4 first:pt-0 last:pb-0 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="flex gap-3">
                  <div className="mt-1 rounded-xl bg-[#EEF2FF] p-2.5 text-[#4F75FF] shrink-0 h-fit">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#4F75FF]">
                        {service.code}
                      </span>
                      <Badge
                        variant={service.active ? "success" : "default"}
                        size="sm"
                      >
                        {service.active ? "Hoạt động" : "Đã tắt"}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-[#0F172A] text-sm mt-0.5">
                      {service.name}
                    </h4>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {service.description || "Chưa có mô tả."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(service)}
                    leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    Sửa
                  </Button>
                  <Button
                    variant={service.active ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => void toggleActive(service)}
                  >
                    {service.active ? "Tắt" : "Bật"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-[#64748B] pt-4 border-t border-[#EDF2F7]">
          <span>{total} dịch vụ</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Trước
            </Button>
            <span className="font-bold text-[#0F172A]">
              Trang {page} / {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
