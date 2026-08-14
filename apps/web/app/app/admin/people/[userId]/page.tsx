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
  Calendar,
  HelpCircle,
  Save,
} from "lucide-react";
import { peopleApi } from "../../../../../lib/api/people";
import { organizationApi } from "../../../../../lib/api/organization";

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
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

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
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] p-6 lg:p-12">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <Link
          href="/app/admin/people"
          className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm mb-3 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Danh bạ nhân sự
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          Chi Tiết Hồ Sơ Nhân Sự
        </h1>
      </div>

      {loading ? (
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
          <span className="text-slate-400 text-sm">
            Đang tải dữ liệu hồ sơ nhân sự...
          </span>
        </div>
      ) : error || !person ? (
        <div className="max-w-4xl mx-auto p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div>
            <h4 className="font-bold">Lỗi tải dữ liệu</h4>
            <p className="text-sm mt-1">
              {error || "Không tìm thấy tài khoản người dùng"}
            </p>
            <button
              onClick={loadData}
              className="mt-3 px-4 py-2 bg-red-500 text-black font-semibold rounded-xl text-xs"
            >
              Thử lại
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Account Profile Meta */}
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center">
              <div className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700 mx-auto mb-4 flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                {person.avatarUrl ? (
                  <img
                    src={person.avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User2 className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <h3 className="text-xl font-bold text-white mb-1">
                {person.fullName || "Chưa cập nhật tên"}
              </h3>
              <p className="text-slate-400 text-xs flex items-center justify-center gap-1.5 mb-4">
                <Mail className="w-3.5 h-3.5" />
                {person.email}
              </p>

              <div className="border-t border-slate-800 pt-4 space-y-3 text-left text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Vai trò hệ thống</span>
                  <span className="font-semibold text-cyan-400 uppercase text-xs tracking-wider">
                    {person.role}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Trạng thái tài khoản</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                      person.accountStatus === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : person.accountStatus === "pending"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {person.accountStatus === "active"
                      ? "Đã kích hoạt"
                      : person.accountStatus === "pending"
                        ? "Chờ duyệt"
                        : "Từ chối"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Employment Profile Settings */}
          <div className="lg:col-span-2">
            {person.role === "client" ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center">
                <HelpCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white">
                  Tài khoản Khách hàng
                </h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  Tài khoản vai trò **client** không có hồ sơ nhân sự
                  (employee_profile) trực thuộc công ty. Vui lòng quản lý liên
                  kết khách hàng trong danh mục **Khách hàng** bên ngoài.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  {person.employeeProfile
                    ? "Thông Tin Nhân Sự"
                    : "Khởi Tạo Hồ Sơ Nhân Sự"}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {successMsg && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Mã nhân sự (Không được đổi)
                      </label>
                      <input
                        type="text"
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value)}
                        disabled={!!person.employeeProfile}
                        placeholder="Ví dụ: PGS0102"
                        className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300 disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Chức danh (Job Title)
                      </label>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Ví dụ: Chuyên viên SEO"
                        className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition duration-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Phòng ban trực thuộc
                      </label>
                      <select
                        value={departmentId}
                        onChange={(e) => {
                          setDepartmentId(e.target.value);
                          setTeamId(""); // reset team
                        }}
                        className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition duration-300"
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
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Đội nhóm trực thuộc
                      </label>
                      <select
                        value={teamId}
                        onChange={(e) => setTeamId(e.target.value)}
                        className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition duration-300"
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
                    <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                      Người quản lý trực tiếp (Reports To)
                    </label>
                    <select
                      value={reportsToUserId}
                      onChange={(e) => setReportsToUserId(e.target.value)}
                      className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition duration-300"
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
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Trạng thái làm việc
                      </label>
                      <select
                        value={employmentStatus}
                        onChange={(e) =>
                          setEmploymentStatus(e.target.value as any)
                        }
                        className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition duration-300"
                      >
                        <option value="probation">Thử việc (probation)</option>
                        <option value="active">Chính thức (active)</option>
                        <option value="on_leave">Nghỉ phép (on_leave)</option>
                        <option value="terminated">
                          Đã nghỉ việc (terminated)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Ngày vào làm
                      </label>
                      <input
                        type="date"
                        value={joinedDate}
                        onChange={(e) => setJoinedDate(e.target.value)}
                        className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition duration-300"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Ngày nghỉ việc
                      </label>
                      <input
                        type="date"
                        value={leftDate}
                        onChange={(e) => setLeftDate(e.target.value)}
                        disabled={employmentStatus !== "terminated"}
                        className="w-full bg-[#161D30] border border-slate-700/60 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition duration-300 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-black font-bold rounded-xl transition duration-300 text-sm flex items-center gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Lưu thông tin hồ sơ
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
