"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  User2,
  Mail,
  HelpCircle,
  Save,
} from "lucide-react";
import { peopleApi } from "../../../../../lib/api/people";
import { organizationApi } from "../../../../../lib/api/organization";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  department_id: string;
}

interface Manager {
  id: string;
  fullName: string | null;
  email: string | null;
}

interface PersonDetail {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  accountStatus: string;
  employeeProfile: {
    employeeCode: string;
    departmentId: string | null;
    departmentName: string | null;
    teamId: string | null;
    teamName: string | null;
    jobTitle: string | null;
    reportsToUserId: string | null;
    reportsToFullName: string | null;
    employmentStatus: "probation" | "active" | "on_leave" | "terminated";
    joinedDate: string | null;
    leftDate: string | null;
  } | null;
}

export default function AdminPersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [employeeCode, setEmployeeCode] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [reportsToUserId, setReportsToUserId] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<
    "probation" | "active" | "on_leave" | "terminated"
  >("active");
  const [joinedDate, setJoinedDate] = useState("");
  const [leftDate, setLeftDate] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load person info
      const data = await peopleApi.getPersonByUserId(userId);
      setPerson(data);

      if (data.employeeProfile) {
        setEmployeeCode(data.employeeProfile.employeeCode);
        setDepartmentId(data.employeeProfile.departmentId || "");
        setTeamId(data.employeeProfile.teamId || "");
        setJobTitle(data.employeeProfile.jobTitle || "");
        setReportsToUserId(data.employeeProfile.reportsToUserId || "");
        setEmploymentStatus(data.employeeProfile.employmentStatus);
        setJoinedDate(data.employeeProfile.joinedDate || "");
        setLeftDate(data.employeeProfile.leftDate || "");
      }

      // Load depts & teams for selectors
      const deptsData = await organizationApi.getDepartments();
      setDepartments(deptsData.filter((d: any) => d.is_active));

      const teamsData = await organizationApi.getTeams();
      setTeams(teamsData.filter((t: any) => t.is_active));

      // Load directory to find potential managers (excluding current user)
      const peopleList = await peopleApi.getPeopleDirectory({ pageSize: 100 });
      setManagers(
        (peopleList.items || [])
          .filter((item: any) => item.id !== userId && item.role !== "client")
          .map((item: any) => ({
            id: item.id,
            fullName: item.fullName,
            email: item.email,
          })),
      );
    } catch (err: any) {
      setError(err.message || "Không thể tải chi tiết hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    // Basic Validations
    if (
      !person?.employeeProfile &&
      (employeeCode.trim().length < 2 || employeeCode.trim().length > 30)
    ) {
      setFormError("Mã nhân sự phải từ 2 đến 30 ký tự");
      return;
    }

    try {
      setSubmitting(true);

      if (!person?.employeeProfile) {
        // Create new employment profile
        await peopleApi.createEmploymentProfile(userId, {
          employeeCode: employeeCode.trim().toUpperCase(),
          departmentId: departmentId || null,
          teamId: teamId || null,
          jobTitle: jobTitle.trim() || null,
          reportsToUserId: reportsToUserId || null,
          employmentStatus,
          joinedDate: joinedDate || null,
        });
        setSuccessMsg("Khởi tạo hồ sơ nhân sự thành công!");
      } else {
        // Update existing employment profile
        await peopleApi.updateEmploymentProfile(userId, {
          departmentId: departmentId || null,
          teamId: teamId || null,
          jobTitle: jobTitle.trim() || null,
          reportsToUserId: reportsToUserId || null,
          employmentStatus,
          joinedDate: joinedDate || null,
          leftDate: leftDate || null,
        });
        setSuccessMsg("Cập nhật hồ sơ nhân sự thành công!");
      }

      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Thao tác lưu hồ sơ thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter teams list based on selected departmentId
  const availableTeams = teams.filter(
    (t) => !departmentId || t.department_id === departmentId,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Chi Tiết Hồ Sơ Nhân Sự"
        description="Quản lý hồ sơ việc làm, chức danh, phòng ban và cấp quản lý trực tiếp."
        action={
          <Link href="/app/admin/people">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Danh bạ nhân sự
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-[#EDF2F7]">
          <Loader2 className="w-8 h-8 text-[#4F75FF] animate-spin mb-3" />
          <span className="text-xs text-[#64748B]">
            Đang tải dữ liệu hồ sơ nhân sự...
          </span>
        </div>
      ) : error || !person ? (
        <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
            <span>{error || "Không tìm thấy tài khoản người dùng"}</span>
          </div>
          <Button variant="danger" size="sm" onClick={loadData}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Account Profile Meta */}
          <div className="space-y-6">
            <Card className="p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-[#EEF2FF] border border-[#CBD5E1] mx-auto flex items-center justify-center text-[#4F75FF] font-bold overflow-hidden shadow-xs">
                {person.avatarUrl ? (
                  <img
                    src={person.avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User2 className="w-8 h-8 text-[#4F75FF]" />
                )}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#0F172A]">
                  {person.fullName || "Chưa cập nhật tên"}
                </h3>
                <p className="text-xs text-[#64748B] flex items-center justify-center gap-1.5 mt-0.5 font-mono">
                  <Mail className="w-3 h-3 text-[#94A3B8]" />
                  {person.email}
                </p>
              </div>

              <div className="border-t border-[#EDF2F7] pt-4 space-y-2.5 text-left text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Vai trò hệ thống</span>
                  <Badge variant="blue" size="sm">
                    {person.role ? person.role.toUpperCase() : "CHƯA GÁN"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Trạng thái tài khoản</span>
                  <Badge
                    variant={
                      person.accountStatus === "active"
                        ? "success"
                        : person.accountStatus === "pending"
                          ? "gold"
                          : "danger"
                    }
                    size="sm"
                  >
                    {person.accountStatus === "active"
                      ? "Đã kích hoạt"
                      : person.accountStatus === "pending"
                        ? "Chờ duyệt"
                        : "Từ chối"}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Employment Profile Settings */}
          <div className="lg:col-span-2">
            {person.role === "client" ? (
              <Card className="p-8 text-center space-y-3">
                <HelpCircle className="w-10 h-10 text-[#94A3B8] mx-auto" />
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Tài khoản Khách hàng
                </h3>
                <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                  Tài khoản vai trò **client** không có hồ sơ nhân sự nội bộ trực thuộc công ty. Vui lòng quản lý liên kết khách hàng trong danh mục **Khách hàng**.
                </p>
              </Card>
            ) : (
              <Card className="p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-[#EDF2F7] pb-3">
                  <ShieldCheck className="w-5 h-5 text-[#4F75FF]" />
                  <h2 className="font-extrabold text-sm text-[#0F172A]">
                    {person.employeeProfile
                      ? "Thông Tin Hồ Sơ Nhân Sự"
                      : "Khởi Tạo Hồ Sơ Nhân Sự"}
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                        Mã nhân sự (Không được đổi)
                      </label>
                      <input
                        type="text"
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value)}
                        disabled={!!person.employeeProfile}
                        placeholder="Ví dụ: PGS0102"
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-mono text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                        Chức danh (Job Title)
                      </label>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Ví dụ: Chuyên viên SEO"
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                        Phòng ban trực thuộc
                      </label>
                      <select
                        value={departmentId}
                        onChange={(e) => {
                          setDepartmentId(e.target.value);
                          setTeamId("");
                        }}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                      >
                        <option value="">-- Chưa phân bổ phòng ban --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                        Đội nhóm trực thuộc
                      </label>
                      <select
                        value={teamId}
                        onChange={(e) => setTeamId(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                      >
                        <option value="">-- Chưa phân bổ đội nhóm --</option>
                        {availableTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                      Người quản lý trực tiếp (Reports To)
                    </label>
                    <select
                      value={reportsToUserId}
                      onChange={(e) => setReportsToUserId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                    >
                      <option value="">-- Không có người quản lý --</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName || "Không tên"} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                        Trạng thái làm việc
                      </label>
                      <select
                        value={employmentStatus}
                        onChange={(e) =>
                          setEmploymentStatus(e.target.value as any)
                        }
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                      >
                        <option value="probation">Thử việc (probation)</option>
                        <option value="active">Chính thức (active)</option>
                        <option value="on_leave">Nghỉ phép (on_leave)</option>
                        <option value="terminated">Đã nghỉ việc (terminated)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                        Ngày vào làm
                      </label>
                      <input
                        type="date"
                        value={joinedDate}
                        onChange={(e) => setJoinedDate(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                        Ngày nghỉ việc
                      </label>
                      <input
                        type="date"
                        value={leftDate}
                        onChange={(e) => setLeftDate(e.target.value)}
                        disabled={employmentStatus !== "terminated"}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#EDF2F7] flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={submitting}
                      isLoading={submitting}
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      Lưu thông tin hồ sơ
                    </Button>
                  </div>
                </form>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
