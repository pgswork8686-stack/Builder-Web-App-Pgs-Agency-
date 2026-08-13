"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  ArrowLeft,
  Loader2,
  Edit3,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { clientsApi } from "../../../../lib/api/clients";

interface ClientCompany {
  id: string;
  code: string;
  name: string;
  taxCode: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: "active" | "inactive";
  membersCount: number;
}

export default function AdminClientsPage() {
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit states
  const [editingComp, setEditingComp] = useState<ClientCompany | null>(null);
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientsApi.getClientCompanies({
        q: q || undefined,
        status: (status as any) || undefined,
        page,
        pageSize: 15,
      });
      setCompanies(data.items);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách khách hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [q, status, page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (code.trim().length < 2 || code.trim().length > 30) {
      setFormError("Mã khách hàng phải từ 2 đến 30 ký tự");
      return;
    }
    if (name.trim().length < 2) {
      setFormError("Tên khách hàng phải từ 2 ký tự");
      return;
    }

    try {
      setSubmitting(true);
      await clientsApi.createClientCompany({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        taxCode: taxCode.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
        status: "active",
        notes: notes.trim() || null,
      });
      await fetchClients();
      setShowAddForm(false);
      setCode("");
      setName("");
      setTaxCode("");
      setEmail("");
      setPhone("");
      setWebsite("");
      setAddress("");
      setNotes("");
    } catch (err: any) {
      setFormError(err.message || "Tạo khách hàng thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (comp: ClientCompany) => {
    try {
      const updated = await clientsApi.updateClientCompany(comp.id, {
        status: comp.status === "active" ? "inactive" : "active",
      });
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === comp.id ? { ...c, status: updated.status } : c,
        ),
      );
    } catch (err: any) {
      alert(err.message || "Thay đổi trạng thái thất bại");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComp) return;
    setFormError(null);

    if (editingComp.name.trim().length < 2) {
      setFormError("Tên khách hàng phải từ 2 ký tự");
      return;
    }

    try {
      setSubmitting(true);
      await clientsApi.updateClientCompany(editingComp.id, {
        name: editingComp.name.trim(),
        taxCode: editingComp.taxCode?.trim() || null,
        email: editingComp.email?.trim() || null,
        phone: editingComp.phone?.trim() || null,
        website: editingComp.website?.trim() || null,
        address: editAddress.trim() || null,
        status: editingComp.status,
        notes: editNotes.trim() || null,
      });
      await fetchClients();
      setEditingComp(null);
    } catch (err: any) {
      setFormError(err.message || "Cập nhật khách hàng thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] p-6 lg:p-12">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            href="/app/admin/organization"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm mb-3 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Cơ cấu tổ chức
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-cyan-400" />
            Doanh Nghiệp Khách Hàng ({total})
          </h1>
        </div>

        <button
          onClick={() => {
            setEditingComp(null);
            setShowAddForm(!showAddForm);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-black font-semibold rounded-xl transition duration-300 text-sm"
        >
          <Plus className="w-4 h-4" />
          Thêm khách hàng mới
        </button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Filter and Listing */}
        <div
          className={
            showAddForm || editingComp ? "lg:col-span-2" : "lg:col-span-3"
          }
        >
          {/* Filters Bar */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Tìm kiếm
              </label>
              <input
                type="text"
                placeholder="Nhập tên, mã, email, MST..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
              />
            </div>

            <div>
              <label className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Trạng thái hợp tác
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition duration-300"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang hợp tác (active)</option>
                <option value="inactive">Ngừng hợp tác (inactive)</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
              <span className="text-slate-400 text-sm">
                Đang tải danh sách khách hàng...
              </span>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="font-bold">Lỗi tải dữ liệu</h4>
                <p className="text-sm mt-1">{error}</p>
                <button
                  onClick={fetchClients}
                  className="mt-3 px-4 py-2 bg-red-500 text-black font-semibold rounded-xl text-xs"
                >
                  Thử lại
                </button>
              </div>
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-850 rounded-2xl">
              <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-300">
                Chưa có khách hàng nào
              </h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                Khởi tạo danh sách các công ty đối tác để bắt đầu liên kết tài
                khoản portal.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/20 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-4 px-6">Mã</th>
                        <th className="py-4 px-6">Tên công ty</th>
                        <th className="py-4 px-6">MST / Điện thoại</th>
                        <th className="py-4 px-6">Email / Website</th>
                        <th className="py-4 px-6">TK Liên kết</th>
                        <th className="py-4 px-6">Trạng thái</th>
                        <th className="py-4 px-6 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-sm">
                      {companies.map((comp) => (
                        <tr
                          key={comp.id}
                          className="hover:bg-slate-850/20 transition duration-150"
                        >
                          <td className="py-4 px-6 font-bold text-orange-400">
                            {comp.code}
                          </td>
                          <td className="py-4 px-6 font-semibold text-white">
                            {comp.name}
                          </td>
                          <td className="py-4 px-6">
                            <div className="text-slate-300">
                              {comp.taxCode || "—"}
                            </div>
                            <div className="text-slate-500 text-xs">
                              {comp.phone || "—"}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="text-slate-300">
                              {comp.email || "—"}
                            </div>
                            <div className="text-slate-500 text-xs">
                              {comp.website || "—"}
                            </div>
                          </td>
                          <td className="py-4 px-6 font-bold text-cyan-400">
                            {comp.membersCount}
                          </td>
                          <td className="py-4 px-6">
                            <button
                              onClick={() => handleUpdateStatus(comp)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition duration-150 border ${
                                comp.status === "active"
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : "bg-slate-800 border-slate-700 text-slate-400"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${comp.status === "active" ? "bg-emerald-400" : "bg-slate-500"}`}
                              />
                              {comp.status === "active"
                                ? "Hợp tác"
                                : "Tạm dừng"}
                            </button>
                          </td>
                          <td className="py-4 px-6 text-right space-x-1">
                            <Link
                              href={`/app/admin/clients/${comp.id}`}
                              className="inline-flex p-2 hover:bg-slate-800 rounded-xl transition duration-150 text-slate-400 hover:text-cyan-400"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => {
                                setShowAddForm(false);
                                setEditingComp(comp);
                              }}
                              className="p-2 hover:bg-slate-800 rounded-xl transition duration-150 text-slate-400 hover:text-cyan-400"
                              title="Chỉnh sửa"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center bg-slate-900/10 border border-slate-850 p-4 rounded-xl">
                  <span className="text-xs text-slate-500">
                    Hiển thị trang {page} / {totalPages} (Tổng {total} bản ghi)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 text-xs rounded-lg transition"
                    >
                      Trước
                    </button>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 text-xs rounded-lg transition"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Side: Form (Add or Edit) */}
        {(showAddForm || editingComp) && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 self-start">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingComp
                ? "Chỉnh sửa thông tin khách hàng"
                : "Thêm khách hàng mới"}
            </h2>

            <form
              onSubmit={editingComp ? handleEditSubmit : handleCreate}
              className="space-y-4"
            >
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Mã khách hàng (Không đổi)
                </label>
                <input
                  type="text"
                  value={editingComp ? editingComp.code : code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={!!editingComp}
                  placeholder="Ví dụ: VINAMILK, FPT"
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Tên công ty khách hàng
                </label>
                <input
                  type="text"
                  value={editingComp ? editingComp.name : name}
                  onChange={(e) =>
                    editingComp
                      ? setEditingComp({ ...editingComp, name: e.target.value })
                      : setName(e.target.value)
                  }
                  placeholder="Ví dụ: Công ty Cổ phần Sữa Việt Nam"
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Mã số thuế (Tax Code)
                  </label>
                  <input
                    type="text"
                    value={editingComp ? editingComp.taxCode || "" : taxCode}
                    onChange={(e) =>
                      editingComp
                        ? setEditingComp({
                            ...editingComp,
                            taxCode: e.target.value,
                          })
                        : setTaxCode(e.target.value)
                    }
                    placeholder="Nhập MST..."
                    className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={editingComp ? editingComp.phone || "" : phone}
                    onChange={(e) =>
                      editingComp
                        ? setEditingComp({
                            ...editingComp,
                            phone: e.target.value,
                          })
                        : setPhone(e.target.value)
                    }
                    placeholder="Ví dụ: 0283838..."
                    className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Email nhận tin
                  </label>
                  <input
                    type="text"
                    value={editingComp ? editingComp.email || "" : email}
                    onChange={(e) =>
                      editingComp
                        ? setEditingComp({
                            ...editingComp,
                            email: e.target.value,
                          })
                        : setEmail(e.target.value)
                    }
                    placeholder="client@company.com"
                    className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Website URL
                  </label>
                  <input
                    type="text"
                    value={editingComp ? editingComp.website || "" : website}
                    onChange={(e) =>
                      editingComp
                        ? setEditingComp({
                            ...editingComp,
                            website: e.target.value,
                          })
                        : setWebsite(e.target.value)
                    }
                    placeholder="https://company.com"
                    className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Địa chỉ trụ sở
                </label>
                <input
                  type="text"
                  value={editingComp ? editAddress : address}
                  onChange={(e) =>
                    editingComp
                      ? setEditAddress(e.target.value)
                      : setAddress(e.target.value)
                  }
                  placeholder="Nhập địa chỉ đầy đủ..."
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Ghi chú nghiệp vụ
                </label>
                <textarea
                  rows={2}
                  value={editingComp ? editNotes : notes}
                  onChange={(e) =>
                    editingComp
                      ? setEditNotes(e.target.value)
                      : setNotes(e.target.value)
                  }
                  placeholder="Các lưu ý đặc thù về hợp tác..."
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300 resize-none"
                />
              </div>

              {editingComp && (
                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="client_is_active"
                    checked={editingComp.status === "active"}
                    onChange={(e) =>
                      setEditingComp({
                        ...editingComp,
                        status: e.target.checked ? "active" : "inactive",
                      })
                    }
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <label
                    htmlFor="client_is_active"
                    className="text-sm text-slate-300 cursor-pointer"
                  >
                    Doanh nghiệp đang hợp tác hoạt động
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-black font-semibold rounded-xl transition duration-300 text-sm flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingComp ? "Cập nhật" : "Khởi tạo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingComp(null);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl transition duration-300 text-sm"
                >
                  Huỷ
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
