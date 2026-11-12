"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Plus, Search } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { clientsApi } from "@/lib/api/clients";

interface ClientCompany {
  id: string;
  code: string;
  name: string;
  taxCode?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: "active" | "inactive";
}

const EMPTY = { name: "", code: "", taxCode: "", email: "", phone: "", address: "", notes: "" };

/** Trưởng phòng xem và tạo khách hàng để mở dự án. Sửa/xóa khách hàng do Admin quản lý. */
export default function TeamLeaderClientsPage() {
  const [items, setItems] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async (query = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await clientsApi.getClientCompanies({ q: query || undefined, pageSize: 100 });
      setItems(res?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách khách hàng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setFormError("Vui lòng nhập tên khách hàng.");
    setSaving(true);
    setFormError(null);
    try {
      const created = await clientsApi.createClientCompany({
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        taxCode: form.taxCode.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        status: "active",
      });
      setOpen(false);
      setForm(EMPTY);
      setNotice(`Đã tạo khách hàng ${created?.name ?? form.name}. Bạn có thể mở dự án cho khách ở mục "Dự án của tôi".`);
      await load(q);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không tạo được khách hàng.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Khách hàng"
        description="Danh sách doanh nghiệp khách hàng. Trưởng phòng tạo khách hàng mới để mở dự án."
        badge={`${items.length} khách hàng`}
        badgeVariant="gold"
        action={
          <Button onClick={() => { setForm(EMPTY); setFormError(null); setOpen(true); }} leftIcon={<Plus className="w-4 h-4" />}>
            Thêm khách hàng
          </Button>
        }
      />

      {notice && (
        <div role="status" className="rounded-xl border border-[#A7F3D0] bg-[#E6FBF5] text-[#047857] text-sm px-4 py-3">{notice}</div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-sm px-4 py-3">{error}</div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); void load(q); }}
        className="bg-white rounded-xl border border-[#E7E9F0] p-4 flex gap-3"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm khách hàng"
            placeholder="Tìm theo tên, mã hoặc mã số thuế…"
            className="w-full min-h-11 pl-10 pr-4 rounded-xl bg-[#F8F9FC] border border-[#DDDFEA] text-sm text-[#202333] placeholder:text-[#64748B] outline-none focus:bg-white focus:border-[#6044E8]"
          />
        </div>
        <Button type="submit" variant="secondary">Tìm</Button>
      </form>

      <section className="bg-white rounded-xl border border-[#E7E9F0] p-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-[#475569]"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Đang tải khách hàng…</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-8 h-8" />}
            title="Chưa có khách hàng"
            description="Bấm “Thêm khách hàng” để tạo khách hàng đầu tiên."
          />
        ) : (
          <ul className="divide-y divide-[#E7E9F0]">
            {items.map((c) => (
              <li key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#202333] truncate">
                    <span className="font-mono text-xs text-[#5B3FD6] mr-2">{c.code}</span>
                    {c.name}
                  </span>
                  <span className="block text-xs text-[#475569] truncate">
                    {[c.taxCode && `MST ${c.taxCode}`, c.phone, c.email].filter(Boolean).join(" · ") || "Chưa có thông tin liên hệ"}
                  </span>
                </span>
                <span
                  className={`self-start sm:self-auto px-3 py-1 rounded-full border text-xs font-bold ${
                    c.status === "active"
                      ? "bg-[#E6FBF5] border-[#A7F3D0] text-[#047857]"
                      : "bg-[#F4F2FD] border-[#DDDFEA] text-[#475569]"
                  }`}
                >
                  {c.status === "active" ? "Đang hợp tác" : "Ngừng hợp tác"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Thêm khách hàng"
        description="Mã khách hàng để trống sẽ được tạo tự động."
        maxWidth="lg"
      >
        <form onSubmit={submit} className="space-y-4">
          <Input id="client-name" label="Tên doanh nghiệp *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Công ty TNHH ABC" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="client-code" label="Mã khách hàng" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ví dụ: KH_ABC" />
            <Input id="client-tax" label="Mã số thuế" value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
            <Input id="client-phone" label="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input id="client-email" type="email" label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <Input id="client-address" label="Địa chỉ" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input id="client-notes" label="Ghi chú" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {formError && <p role="alert" className="text-sm text-[#B91C1C]">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tạo khách hàng"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
