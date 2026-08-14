"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  ArrowLeft,
  Loader2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { organizationApi } from "../../../../lib/api/organization";

interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit states
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const fetchDepts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await organizationApi.getDepartments();
      setDepartments(data);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách phòng ban");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (code.trim().length < 2 || code.trim().length > 30) {
      setFormError("Mã phòng ban phải từ 2 đến 30 ký tự");
      return;
    }
    if (name.trim().length < 2 || name.trim().length > 120) {
      setFormError("Tên phòng ban phải từ 2 đến 120 ký tự");
      return;
    }

    try {
      setSubmitting(true);
      const newDept = await organizationApi.createDepartment({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setDepartments((prev) => [...prev, newDept]);
      setShowAddForm(false);
      setCode("");
      setName("");
      setDescription("");
    } catch (err: any) {
      setFormError(err.message || "Tạo phòng ban thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (dept: Department) => {
    try {
      const updated = await organizationApi.updateDepartment(dept.id, {
        isActive: !dept.is_active,
      });
      setDepartments((prev) =>
        prev.map((d) =>
          d.id === dept.id ? { ...d, is_active: updated.is_active } : d,
        ),
      );
    } catch (err: any) {
      alert(err.message || "Thay đổi trạng thái thất bại");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setFormError(null);

    if (
      editingDept.name.trim().length < 2 ||
      editingDept.name.trim().length > 120
    ) {
      setFormError("Tên phòng ban phải từ 2 đến 120 ký tự");
      return;
    }

    try {
      setSubmitting(true);
      const updated = await organizationApi.updateDepartment(editingDept.id, {
        name: editingDept.name.trim(),
        description: editingDept.description?.trim() || null,
        isActive: editingDept.is_active,
      });
      setDepartments((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d)),
      );
      setEditingDept(null);
    } catch (err: any) {
      setFormError(err.message || "Cập nhật phòng ban thất bại");
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
            <Building2 className="w-8 h-8 text-cyan-400" />
            Quản Lý Phòng Ban
          </h1>
        </div>

        <button
          onClick={() => {
            setEditingDept(null);
            setShowAddForm(!showAddForm);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-black font-semibold rounded-xl transition duration-300 text-sm"
        >
          <Plus className="w-4 h-4" />
          Thêm phòng ban mới
        </button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Forms column (Add or Edit) */}
        {(showAddForm || editingDept) && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 self-start">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingDept ? "Chỉnh sửa phòng ban" : "Tạo phòng ban mới"}
            </h2>

            <form
              onSubmit={editingDept ? handleEditSubmit : handleCreate}
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
                  Mã phòng ban (Không được đổi)
                </label>
                <input
                  type="text"
                  value={editingDept ? editingDept.code : code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={!!editingDept}
                  placeholder="Ví dụ: SEO, TECH, HR"
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Tên phòng ban
                </label>
                <input
                  type="text"
                  value={editingDept ? editingDept.name : name}
                  onChange={(e) =>
                    editingDept
                      ? setEditingDept({ ...editingDept, name: e.target.value })
                      : setName(e.target.value)
                  }
                  placeholder="Ví dụ: Tối ưu hoá công cụ tìm kiếm"
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Mô tả phòng ban
                </label>
                <textarea
                  rows={4}
                  value={
                    editingDept ? editingDept.description || "" : description
                  }
                  onChange={(e) =>
                    editingDept
                      ? setEditingDept({
                          ...editingDept,
                          description: e.target.value,
                        })
                      : setDescription(e.target.value)
                  }
                  placeholder="Chi tiết về nhiệm vụ chính..."
                  className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300 resize-none"
                />
              </div>

              {editingDept && (
                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editingDept.is_active}
                    onChange={(e) =>
                      setEditingDept({
                        ...editingDept,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <label
                    htmlFor="is_active"
                    className="text-sm text-slate-300 cursor-pointer"
                  >
                    Phòng ban hoạt động
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
                  {editingDept ? "Cập nhật" : "Khởi tạo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingDept(null);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl transition duration-300 text-sm"
                >
                  Huỷ
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Listings column */}
        <div
          className={
            showAddForm || editingDept ? "lg:col-span-2" : "lg:col-span-3"
          }
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
              <span className="text-slate-400 text-sm">
                Đang tải danh sách phòng ban...
              </span>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="font-bold">Lỗi tải dữ liệu</h4>
                <p className="text-sm mt-1">{error}</p>
                <button
                  onClick={fetchDepts}
                  className="mt-3 px-4 py-2 bg-red-500 text-black font-semibold rounded-xl text-xs"
                >
                  Thử lại
                </button>
              </div>
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-850 rounded-2xl">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-300">
                Chưa có phòng ban nào
              </h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                Bắt đầu tạo sơ đồ cơ cấu công ty bằng cách thêm phòng ban đầu
                tiên.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/20 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-4 px-6">Mã</th>
                      <th className="py-4 px-6">Tên phòng ban</th>
                      <th className="py-4 px-6">Mô tả</th>
                      <th className="py-4 px-6">Trạng thái</th>
                      <th className="py-4 px-6">Ngày tạo</th>
                      <th className="py-4 px-6 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-sm">
                    {departments.map((dept) => (
                      <tr
                        key={dept.id}
                        className="hover:bg-slate-850/20 transition duration-150"
                      >
                        <td className="py-4 px-6 font-bold text-cyan-400">
                          {dept.code}
                        </td>
                        <td className="py-4 px-6 font-semibold text-white">
                          {dept.name}
                        </td>
                        <td className="py-4 px-6 text-slate-400 max-w-xs truncate">
                          {dept.description || "—"}
                        </td>
                        <td className="py-4 px-6">
                          <button
                            onClick={() => handleUpdateStatus(dept)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition duration-150 border ${
                              dept.is_active
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${dept.is_active ? "bg-emerald-400" : "bg-slate-500"}`}
                            />
                            {dept.is_active ? "Hoạt động" : "Tắt"}
                          </button>
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs">
                          {new Date(dept.created_at).toLocaleDateString(
                            "vi-VN",
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => {
                              setShowAddForm(false);
                              setEditingDept(dept);
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
          )}
        </div>
      </div>
    </div>
  );
}
