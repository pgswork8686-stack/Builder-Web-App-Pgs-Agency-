"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  User2,
  Building2,
  Users2,
  Shield,
  Mail,
  Calendar,
  Loader2,
  AlertTriangle,
  Briefcase,
  Award,
  CheckCircle,
  Pencil,
  Phone,
  Camera,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { getMe } from "../../../lib/api/auth";
import { peopleApi } from "../../../lib/api/people";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";

interface UserData {
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    phone?: string | null;
  };
  account: {
    status: string;
    role: string | null;
    approvedAt: string | null;
  };
}

interface OrgContext {
  type: "internal" | "client";
  employee?: {
    employeeCode: string;
    jobTitle: string | null;
    employmentStatus: string;
    joinedDate: string | null;
  } | null;
  department?: {
    code: string;
    name: string;
  } | null;
  team?: {
    code: string;
    name: string;
  } | null;
  manager?: {
    fullName: string | null;
    email: string | null;
  } | null;
  companies?: Array<{
    id: string;
    code: string;
    name: string;
    title: string | null;
    isPrimary: boolean;
  }>;
}

export default function UserProfilePage() {
  const [userProfile, setUserProfile] = useState<UserData | null>(null);
  const [orgContext, setOrgContext] = useState<OrgContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSaveError("Vui lòng chọn file hình ảnh (JPG, PNG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveError("Kích thước ảnh tối đa 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setEditAvatarUrl(compressedDataUrl);
          setSaveError(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const me = await getMe();
      setUserProfile(me);

      const context = await peopleApi.getMyOrganization();
      setOrgContext(context);
    } catch (err: any) {
      setError(err.message || "Không thể tải thông tin hồ sơ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleOpenEdit = () => {
    if (!userProfile) return;
    setEditFullName(userProfile.user.fullName || "");
    setEditAvatarUrl(userProfile.user.avatarUrl || "");
    setEditPhone(userProfile.user.phone || "");
    setSaveError(null);
    setEditOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim()) return;

    try {
      setSaving(true);
      setSaveError(null);

      await peopleApi.updateMyProfile({
        fullName: editFullName.trim(),
        avatarUrl: editAvatarUrl.trim() || null,
        phone: editPhone.trim() || null,
      });

      setSuccessMsg("Cập nhật thông tin hồ sơ cá nhân thành công!");
      setTimeout(() => setSuccessMsg(null), 4000);
      setEditOpen(false);
      await fetchProfile();
    } catch (err: any) {
      setSaveError(err.message || "Không thể cập nhật hồ sơ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Hồ Sơ Cá Nhân"
        description="Thông tin tài khoản, vai trò hệ thống và thông tin nhân sự / doanh nghiệp liên kết."
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Pencil className="w-4 h-4" />}
            onClick={handleOpenEdit}
            className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white font-bold"
          >
            Chỉnh sửa hồ sơ
          </Button>
        }
      />

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-[#EDF2F7]">
          <Loader2 className="w-8 h-8 text-[#4F75FF] animate-spin mb-3" />
          <span className="text-xs text-[#64748B]">
            Đang tải thông tin hồ sơ của bạn...
          </span>
        </div>
      ) : error || !userProfile ? (
        <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
            <span>{error || "Không thể tải hồ sơ"}</span>
          </div>
          <Button variant="danger" size="sm" onClick={fetchProfile}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Account Profile Card */}
          <Card className="p-6 text-center self-start space-y-4 relative">
            <div className="relative inline-block mx-auto">
              <Avatar
                src={userProfile.user.avatarUrl}
                name={userProfile.user.fullName || userProfile.user.email}
                size="xl"
                className="ring-4 ring-[#EEF2FF] shadow-sm"
              />
              <button
                type="button"
                onClick={handleOpenEdit}
                title="Thay đổi ảnh đại diện"
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#4F75FF] text-white hover:bg-[#3D61E6] shadow-md transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                {userProfile.user.fullName || "Chưa cập nhật tên"}
              </h3>
              <p className="text-xs text-[#64748B] flex items-center justify-center gap-1.5 mt-0.5 font-mono">
                <Mail className="w-3 h-3 text-[#94A3B8]" />
                {userProfile.user.email}
              </p>
              {userProfile.user.phone && (
                <p className="text-xs text-[#64748B] flex items-center justify-center gap-1.5 mt-1">
                  <Phone className="w-3 h-3 text-[#94A3B8]" />
                  {userProfile.user.phone}
                </p>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Pencil className="w-3.5 h-3.5" />}
              onClick={handleOpenEdit}
              className="w-full text-xs font-semibold text-[#0F172A]"
            >
              Chỉnh sửa thông tin
            </Button>

            <div className="border-t border-[#EDF2F7] pt-4 space-y-2.5 text-left text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#64748B] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#94A3B8]" />
                  Vai trò
                </span>
                <Badge variant="blue" size="sm">
                  {userProfile.account.role?.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B] flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#94A3B8]" />
                  Tài khoản
                </span>
                <Badge variant="success" size="sm">
                  Đã hoạt động
                </Badge>
              </div>
              {userProfile.account.approvedAt && (
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                    Kích hoạt ngày
                  </span>
                  <span className="font-mono text-[#0F172A] text-xs">
                    {new Date(
                      userProfile.account.approvedAt,
                    ).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Org / Client Membership Details Column */}
          <div className="md:col-span-2 space-y-6">
            {orgContext?.type === "client" ? (
              <Card className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#EDF2F7] pb-3">
                  <Briefcase className="w-5 h-5 text-[#CA8A04]" />
                  <h2 className="text-sm font-extrabold text-[#0F172A]">
                    Liên Kết Doanh Nghiệp Khách Hàng
                  </h2>
                </div>

                {!orgContext.companies || orgContext.companies.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#94A3B8]">
                    Tài khoản của bạn chưa được liên kết với doanh nghiệp khách
                    hàng nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {orgContext.companies.map((comp) => (
                      <div
                        key={comp.id}
                        className="bg-[#F8FAFC] border border-[#EDF2F7] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-[#0F172A]">
                              {comp.name}
                            </h4>
                            {comp.isPrimary && (
                              <Badge variant="blue" size="sm">
                                Doanh nghiệp chính
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#64748B] mt-1 font-mono">
                            <span>Mã: {comp.code}</span>
                            {comp.title && (
                              <span className="text-[#0F172A] font-sans font-medium">
                                • {comp.title}
                              </span>
                            )}
                          </div>
                        </div>

                        <Link href="/app/client/projects">
                          <Button variant="outline" size="sm">
                            Xem dự án
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-[#EDF2F7] pb-3">
                  <Award className="w-5 h-5 text-[#4F75FF]" />
                  <h2 className="text-sm font-extrabold text-[#0F172A]">
                    Thông Tin Hồ Sơ Nhân Sự
                  </h2>
                </div>

                {!orgContext?.employee ? (
                  <div className="text-center py-8 text-xs text-[#94A3B8]">
                    Chưa có hồ sơ nhân sự (employee profile). Vui lòng liên hệ
                    Quản trị viên để khởi tạo mã nhân sự.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#F8FAFC] border border-[#EDF2F7] p-3.5 rounded-xl">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
                        Mã nhân sự
                      </span>
                      <span className="text-sm font-bold font-mono text-[#4F75FF]">
                        {orgContext.employee.employeeCode}
                      </span>
                    </div>

                    <div className="bg-[#F8FAFC] border border-[#EDF2F7] p-3.5 rounded-xl">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
                        Chức danh công việc
                      </span>
                      <span className="text-sm font-bold text-[#0F172A]">
                        {orgContext.employee.jobTitle || "Chưa cập nhật"}
                      </span>
                    </div>

                    <div className="bg-[#F8FAFC] border border-[#EDF2F7] p-3.5 rounded-xl">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
                        Phòng ban trực thuộc
                      </span>
                      <span className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#64748B]" />
                        {orgContext.department?.name || "Chưa phân bổ"}
                      </span>
                    </div>

                    <div className="bg-[#F8FAFC] border border-[#EDF2F7] p-3.5 rounded-xl">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
                        Đội nhóm trực thuộc
                      </span>
                      <span className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                        <Users2 className="w-3.5 h-3.5 text-[#64748B]" />
                        {orgContext.team?.name || "Chưa phân bổ"}
                      </span>
                    </div>

                    <div className="bg-[#F8FAFC] border border-[#EDF2F7] p-3.5 rounded-xl">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
                        Người quản lý trực tiếp
                      </span>
                      <span className="text-xs text-[#0F172A]">
                        {orgContext.manager?.fullName ? (
                          <span className="font-semibold">
                            {orgContext.manager.fullName}{" "}
                            <span className="font-mono text-[11px] text-[#64748B]">
                              ({orgContext.manager.email})
                            </span>
                          </span>
                        ) : (
                          "Không có"
                        )}
                      </span>
                    </div>

                    <div className="bg-[#F8FAFC] border border-[#EDF2F7] p-3.5 rounded-xl">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
                        Trạng thái làm việc
                      </span>
                      <Badge
                        variant={
                          orgContext.employee.employmentStatus === "active"
                            ? "success"
                            : orgContext.employee.employmentStatus ===
                                "probation"
                              ? "gold"
                              : "default"
                        }
                        size="sm"
                      >
                        {orgContext.employee.employmentStatus === "active"
                          ? "Chính thức"
                          : orgContext.employee.employmentStatus === "probation"
                            ? "Thử việc"
                            : orgContext.employee.employmentStatus ===
                                "on_leave"
                              ? "Nghỉ phép"
                              : "Nghỉ việc"}
                      </Badge>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Dialog */}
      <Dialog
        isOpen={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        maxWidth="md"
        title="Chỉnh sửa thông tin cá nhân"
        description="Cập nhật họ và tên hiển thị, ảnh đại diện và số điện thoại liên hệ của bạn."
      >
        <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
          {saveError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {saveError}
            </div>
          )}

          {/* Hidden File Input for Computer Image Upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
          />

          {/* Avatar Preview & Upload Options */}
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#EDF2F7] space-y-3">
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                <Avatar
                  src={editAvatarUrl.trim() || undefined}
                  name={editFullName || userProfile?.user.email || "Avatar"}
                  size="xl"
                  className="ring-2 ring-[#4F75FF]/40 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Chọn ảnh từ máy tính"
                  className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A]">
                    Ảnh đại diện
                  </label>
                  <p className="text-[11px] text-[#64748B]">
                    Tải trực tiếp ảnh từ máy tính hoặc dán URL ảnh có sẵn.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                    className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white text-xs font-bold"
                  >
                    Tải ảnh từ máy tính
                  </Button>
                  {editAvatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditAvatarUrl("")}
                      className="text-xs text-red-600 hover:bg-red-50"
                    >
                      Xóa ảnh
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#EDF2F7]">
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                Hoặc dán đường dẫn ảnh (URL):
              </label>
              <input
                type="text"
                value={
                  editAvatarUrl.startsWith("data:")
                    ? "(Ảnh đã tải từ máy tính)"
                    : editAvatarUrl
                }
                disabled={editAvatarUrl.startsWith("data:")}
                onChange={(e) => setEditAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-3.5 py-1.5 rounded-xl border border-[#EDF2F7] bg-white text-xs text-[#0F172A] focus:border-[#4F75FF] outline-none transition-all disabled:bg-slate-100 disabled:text-[#64748B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Họ và tên đầy đủ *
            </label>
            <input
              type="text"
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              placeholder="Nhập họ và tên đầy đủ..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Số điện thoại
            </label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="0988xxxxxx"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EDF2F7]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => setEditOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={saving}
              className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white font-bold"
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
