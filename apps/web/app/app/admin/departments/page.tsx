"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  ArrowLeft,
  Loader2,
  Edit3,
  AlertTriangle,
} from "lucide-react";
import { organizationApi } from "../../../../lib/api/organization";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

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
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Quản Lý Phòng Ban"
        description="Quản trị cơ cấu phòng ban và mã định danh tổ chức."
        badge={`${departments.length} Phòng ban`}
        action={
          <div className="flex items-center gap-3">
            <Link href="/app/admin/organization">
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Cơ cấu tổ chức
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingDept(null);
                setShowAddForm(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Thêm phòng ban mới
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <Button variant="danger" size="sm" onClick={fetchDepts}>
            Thử lại
          </Button>
        </div>
      ) : null}

      {/* Main Table Card */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#4F75FF] animate-spin mb-3" />
            <span className="text-xs text-[#64748B]">
              Đang tải danh sách phòng ban...
            </span>
          </div>
        ) : departments.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-8 h-8 text-[#4F75FF]" />}
            title="Chưa có phòng ban nào"
            description="Bắt đầu tạo sơ đồ cơ cấu công ty bằng cách thêm phòng ban đầu tiên."
            actionLabel="Thêm phòng ban"
            onAction={() => setShowAddForm(true)}
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Mã phòng ban</TableHeaderCell>
                  <TableHeaderCell>Tên phòng ban</TableHeaderCell>
                  <TableHeaderCell>Mô tả nhiệm vụ</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell>Ngày tạo</TableHeaderCell>
                  <TableHeaderCell className="text-right">Thao tác</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-mono font-bold text-[#4F75FF]">
                      {dept.code}
                    </TableCell>
                    <TableCell className="font-bold text-[#0F172A]">
                      {dept.name}
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B] max-w-xs truncate">
                      {dept.description || "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleUpdateStatus(dept)}
                        className="cursor-pointer"
                      >
                        <Badge
                          variant={dept.is_active ? "success" : "default"}
                          size="sm"
                        >
                          {dept.is_active ? "Đang hoạt động" : "Tạm ngưng"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-[#94A3B8]">
                      {new Date(dept.created_at).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingDept(dept)}
                        leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                      >
                        Sửa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Modal Add Department */}
      {showAddForm && (
        <Dialog
          isOpen={showAddForm}
          onClose={() => setShowAddForm(false)}
          maxWidth="md"
          title="Tạo phòng ban mới"
          description="Thiết lập phòng ban mới vào cơ cấu tổ chức doanh nghiệp."
        >
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mã phòng ban *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: SEO, TECH, HR, MKT"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-mono text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Tên phòng ban *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Phòng Tối ưu hóa Tìm kiếm (SEO)"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mô tả chức năng
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả phạm vi và nhiệm vụ của phòng ban..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] resize-none"
              />
            </div>

            <div className="border-t border-[#EDF2F7] pt-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting}
                isLoading={submitting}
              >
                Khởi tạo phòng ban
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Modal Edit Department */}
      {editingDept && (
        <Dialog
          isOpen={!!editingDept}
          onClose={() => setEditingDept(null)}
          maxWidth="md"
          title="Chỉnh sửa phòng ban"
          description={`Cập nhật thông tin phòng ban: ${editingDept.code}`}
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mã phòng ban (Cố định)
              </label>
              <input
                type="text"
                disabled
                value={editingDept.code}
                className="w-full bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-mono text-[#64748B] cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Tên phòng ban *
              </label>
              <input
                type="text"
                required
                value={editingDept.name}
                onChange={(e) =>
                  setEditingDept({ ...editingDept, name: e.target.value })
                }
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mô tả chức năng
              </label>
              <textarea
                rows={3}
                value={editingDept.description || ""}
                onChange={(e) =>
                  setEditingDept({
                    ...editingDept,
                    description: e.target.value,
                  })
                }
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={editingDept.is_active}
                onChange={(e) =>
                  setEditingDept({
                    ...editingDept,
                    is_active: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-[#4F75FF] cursor-pointer"
              />
              <label
                htmlFor="edit_is_active"
                className="text-xs font-semibold text-[#0F172A] cursor-pointer select-none"
              >
                Phòng ban đang hoạt động
              </label>
            </div>

            <div className="border-t border-[#EDF2F7] pt-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingDept(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting}
                isLoading={submitting}
              >
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
