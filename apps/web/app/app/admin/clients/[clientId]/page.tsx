"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Briefcase,
  Plus,
  Trash2,
  Key,
  Star,
  Edit2,
} from "lucide-react";
import { clientsApi } from "../../../../../lib/api/clients";
import { peopleApi } from "../../../../../lib/api/people";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ClientCompany {
  id: string;
  code: string;
  name: string;
  taxCode: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  status: "active" | "inactive";
  notes: string | null;
}

interface Membership {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  accountStatus: string;
  title: string | null;
  isPrimary: boolean;
}

interface ClientUser {
  id: string;
  fullName: string | null;
  email: string | null;
}

export default function AdminClientDetailPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [company, setCompany] = useState<ClientCompany | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Member Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit Company Form states
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTaxCode, setEditTaxCode] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load company profile
      const data = await clientsApi.getClientCompanyById(clientId);
      setCompany(data);

      // Load memberships
      const members = await clientsApi.getMemberships(clientId);
      setMemberships(members);

      // Load all client users for selector
      const usersList = await peopleApi.getPeopleDirectory({
        role: "client",
        pageSize: 100,
      });
      setClientUsers(
        (usersList.items || []).map((u: any) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
        })),
      );
    } catch (err: any) {
      setError(err.message || "Không thể tải chi tiết doanh nghiệp");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clientId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!userId) {
      setFormError("Vui lòng chọn tài khoản người dùng");
      return;
    }

    try {
      setSubmitting(true);
      await clientsApi.createMembership(clientId, {
        userId,
        title: title.trim() || undefined,
        isPrimary,
      });

      setShowAddForm(false);
      setUserId("");
      setTitle("");
      setIsPrimary(true);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Thêm thành viên thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn huỷ liên kết tài khoản này khỏi doanh nghiệp?",
      )
    )
      return;

    try {
      await clientsApi.deleteMembership(clientId, membershipId);
      setMemberships((prev) => prev.filter((m) => m.id !== membershipId));
    } catch (err: any) {
      alert(err.message || "Huỷ liên kết thất bại");
    }
  };

  const handleSetPrimary = async (
    membershipId: string,
    currentPrimary: boolean,
  ) => {
    try {
      await clientsApi.updateMembership(clientId, membershipId, {
        isPrimary: !currentPrimary,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Cập nhật thất bại");
    }
  };

  const handleOpenEditCompany = () => {
    if (!company) return;
    setEditName(company.name || "");
    setEditTaxCode(company.taxCode || "");
    setEditEmail(company.email || "");
    setEditPhone(company.phone || "");
    setEditWebsite(company.website || "");
    setEditAddress(company.address || "");
    setEditStatus(company.status || "active");
    setEditNotes(company.notes || "");
    setEditError(null);
    setShowEditCompany(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!editName.trim()) {
      setEditError("Tên khách hàng không được để trống.");
      return;
    }

    try {
      setEditSubmitting(true);
      setEditError(null);
      await clientsApi.updateClientCompany(clientId, {
        name: editName.trim(),
        taxCode: editTaxCode.trim() || null,
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        website: editWebsite.trim() || null,
        address: editAddress.trim() || null,
        status: editStatus,
        notes: editNotes.trim() || null,
      });
      setShowEditCompany(false);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || "Cập nhật thông tin doanh nghiệp thất bại.");
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title={company ? company.name : "Chi Tiết Doanh Nghiệp"}
        description={`Mã doanh nghiệp: ${company?.code || "—"}`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Edit2 className="w-4 h-4" />}
              onClick={handleOpenEditCompany}
            >
              Chỉnh sửa thông tin
            </Button>
            <Link href="/app/admin/clients">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Danh sách khách hàng
              </Button>
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-[#EDF2F7]">
          <Loader2 className="w-8 h-8 text-[#4F75FF] animate-spin mb-3" />
          <span className="text-xs text-[#64748B]">
            Đang tải dữ liệu doanh nghiệp...
          </span>
        </div>
      ) : error || !company ? (
        <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
            <span>{error || "Không tìm thấy thông tin doanh nghiệp"}</span>
          </div>
          <Button variant="danger" size="sm" onClick={loadData}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Company Profile Detail */}
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FEF9C3] border border-[#FDE047] flex items-center justify-center text-[#CA8A04] shadow-xs">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#0F172A]">
                  {company.name}
                </h3>
                <div className="inline-flex px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-[#4F75FF] text-xs font-bold uppercase mt-1">
                  Mã: {company.code}
                </div>
              </div>

              <div className="space-y-3 text-xs border-t border-[#EDF2F7] pt-4">
                <div>
                  <span className="block text-[#64748B] text-[10px] font-bold uppercase tracking-wider">
                    Mã số thuế
                  </span>
                  <span className="font-mono text-[#0F172A] font-medium">
                    {company.taxCode || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-[#64748B] text-[10px] font-bold uppercase tracking-wider">
                    Điện thoại
                  </span>
                  <span className="text-[#0F172A]">{company.phone || "—"}</span>
                </div>
                <div>
                  <span className="block text-[#64748B] text-[10px] font-bold uppercase tracking-wider">
                    Email nhận tin
                  </span>
                  <span className="text-[#0F172A] font-mono">
                    {company.email || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-[#64748B] text-[10px] font-bold uppercase tracking-wider">
                    Website
                  </span>
                  {company.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#4F75FF] hover:underline"
                    >
                      {company.website}
                    </a>
                  ) : (
                    <span className="text-[#0F172A]">—</span>
                  )}
                </div>
                <div>
                  <span className="block text-[#64748B] text-[10px] font-bold uppercase tracking-wider">
                    Địa chỉ trụ sở
                  </span>
                  <span className="text-[#0F172A]">
                    {company.address || "—"}
                  </span>
                </div>
                {company.notes && (
                  <div>
                    <span className="block text-[#64748B] text-[10px] font-bold uppercase tracking-wider">
                      Ghi chú
                    </span>
                    <span className="text-xs text-[#64748B]">
                      {company.notes}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Portal Accounts Membership Association */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-[#EDF2F7] pb-3">
                <h2 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#4F75FF]" />
                  Tài Khoản Portal Liên Kết ({memberships.length})
                </h2>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowAddForm(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Liên kết tài khoản
                </Button>
              </div>

              {memberships.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#94A3B8]">
                  Chưa có tài khoản nào được liên kết với doanh nghiệp này.
                </div>
              ) : (
                <div className="divide-y divide-[#EDF2F7]">
                  {memberships.map((m) => (
                    <div
                      key={m.id}
                      className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0F172A]">
                            {m.fullName || "Chưa cập nhật tên"}
                          </span>
                          {m.isPrimary && (
                            <Badge variant="blue" size="sm">
                              Chính
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-[#64748B] mt-0.5">
                          {m.email}
                        </div>
                        {m.title && (
                          <div className="text-[11px] text-[#94A3B8] mt-0.5">
                            Chức danh: {m.title}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetPrimary(m.id, m.isPrimary)}
                          title={
                            m.isPrimary ? "Bỏ đặt làm chính" : "Đặt làm chính"
                          }
                        >
                          <Star
                            className={`w-4 h-4 ${m.isPrimary ? "text-[#CA8A04] fill-[#CA8A04]" : "text-[#94A3B8]"}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-red-600 hover:bg-red-50"
                          title="Hủy liên kết"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Modal Add Member */}
      {showAddForm && (
        <Dialog
          isOpen={showAddForm}
          onClose={() => setShowAddForm(false)}
          maxWidth="md"
          title="Liên kết tài khoản mới"
          description="Cấp quyền cho tài khoản khách hàng truy cập thông tin doanh nghiệp."
        >
          <form onSubmit={handleAddMember} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Chọn tài khoản khách hàng *
              </label>
              <select
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              >
                <option value="">-- Chọn tài khoản client --</option>
                {clientUsers.map((cu) => (
                  <option key={cu.id} value={cu.id}>
                    {cu.fullName || "Không tên"} ({cu.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Chức danh / Vai trò đại diện
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Đại diện pháp luật, Giám đốc IT..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_primary_company"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="w-4 h-4 accent-[#4F75FF] cursor-pointer"
              />
              <label
                htmlFor="is_primary_company"
                className="text-xs font-semibold text-[#0F172A] cursor-pointer select-none"
              >
                Đây là công ty chính liên kết với tài khoản này
              </label>
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
                Liên kết tài khoản
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Edit Company Modal */}
      <Dialog
        isOpen={showEditCompany}
        onClose={() => setShowEditCompany(false)}
        maxWidth="lg"
        title={`Chỉnh sửa doanh nghiệp: ${company?.name || ""}`}
        description="Cập nhật chi tiết hồ sơ đối tác, thông tin liên hệ và trạng thái hoạt động."
      >
        <form onSubmit={handleSaveCompany} className="space-y-4 pt-2">
          {editError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
              {editError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Tên doanh nghiệp *"
                placeholder="Nhập tên doanh nghiệp..."
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#24304A] mb-1.5">
                Trạng thái
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as "active" | "inactive")}
                className="w-full rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#24304A] text-xs px-3 py-2.5 outline-none focus:bg-white focus:border-[#5D87FF]"
              >
                <option value="active">Đang hoạt động (Active)</option>
                <option value="inactive">Tạm dừng (Inactive)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Mã số thuế"
              placeholder="0101234567"
              value={editTaxCode}
              onChange={(e) => setEditTaxCode(e.target.value)}
            />
            <Input
              label="Email liên hệ"
              type="email"
              placeholder="contact@company.com"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
            <Input
              label="Số điện thoại"
              placeholder="028 3822 xxxx"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </div>

          <Input
            label="Website doanh nghiệp"
            placeholder="https://company.com"
            value={editWebsite}
            onChange={(e) => setEditWebsite(e.target.value)}
          />

          <Input
            label="Địa chỉ trụ sở"
            placeholder="Cập nhật địa chỉ trụ sở..."
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#24304A]">
              Ghi chú đối tác
            </label>
            <textarea
              rows={2}
              className="w-full rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#24304A] text-xs p-3 outline-none focus:bg-white focus:border-[#5D87FF] transition-all"
              placeholder="Ghi chú quan trọng..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#EDF2F7]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowEditCompany(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={editSubmitting}
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
