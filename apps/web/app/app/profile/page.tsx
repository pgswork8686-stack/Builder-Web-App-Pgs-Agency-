"use client";

import React, { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { getMe } from "../../../lib/api/auth";
import { peopleApi } from "../../../lib/api/people";

interface UserData {
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
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
    status: string;
  }>;
}

export default function UserProfilePage() {
  const [userProfile, setUserProfile] = useState<UserData | null>(null);
  const [orgContext, setOrgContext] = useState<OrgContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch core user auth info
      const meData = await getMe();
      setUserProfile(meData);

      // Fetch own organization context
      const orgData = await peopleApi.getMyOrganization();
      setOrgContext(orgData);
    } catch (err: any) {
      setError(err.message || "Không thể tải thông tin trang cá nhân");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] p-6 lg:p-12">
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
          <User2 className="w-8 h-8 text-cyan-400" />
          Trang Cá Nhân
        </h1>
      </div>

      {loading ? (
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
          <span className="text-slate-400 text-sm">
            Đang tải thông tin trang cá nhân...
          </span>
        </div>
      ) : error || !userProfile ? (
        <div className="max-w-4xl mx-auto p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div>
            <h4 className="font-bold">Lỗi tải dữ liệu</h4>
            <p className="text-sm mt-1">
              {error || "Không tải được hồ sơ đăng nhập"}
            </p>
            <button
              onClick={fetchProfileData}
              className="mt-3 px-4 py-2 bg-red-500 text-black font-semibold rounded-xl text-xs"
            >
              Thử lại
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Account Profile Card */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center self-start">
            <div className="w-24 h-24 rounded-full bg-slate-850 border border-slate-700 flex items-center justify-center text-slate-500 font-bold overflow-hidden mx-auto mb-4">
              {userProfile.user.avatarUrl ? (
                <img
                  src={userProfile.user.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User2 className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <h3 className="text-xl font-bold text-white mb-1">
              {userProfile.user.fullName || "Chưa cập nhật tên"}
            </h3>
            <p className="text-slate-400 text-xs flex items-center justify-center gap-1.5 mb-6">
              <Mail className="w-3.5 h-3.5" />
              {userProfile.user.email}
            </p>

            <div className="border-t border-slate-800 pt-4 space-y-3 text-left text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  Vai trò
                </span>
                <span className="font-semibold text-cyan-400 uppercase text-xs tracking-wider">
                  {userProfile.account.role}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Tài khoản
                </span>
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400">
                  Đã hoạt động
                </span>
              </div>
              {userProfile.account.approvedAt && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Kích hoạt ngày
                  </span>
                  <span className="text-slate-300 text-xs">
                    {new Date(
                      userProfile.account.approvedAt,
                    ).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Org / Client Membership Details Column */}
          <div className="md:col-span-2">
            {orgContext?.type === "client" ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-cyan-400" />
                  Liên Kết Doanh Nghiệp Khách Hàng
                </h2>

                {!orgContext.companies || orgContext.companies.length === 0 ? (
                  <div className="text-center py-10 bg-slate-950/25 border border-dashed border-slate-850 rounded-xl">
                    <Briefcase className="w-10 h-10 text-slate-750 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">
                      Tài khoản của bạn chưa được liên kết với bất kỳ doanh
                      nghiệp khách hàng nào trong hệ thống.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orgContext.companies.map((comp) => (
                      <div
                        key={comp.id}
                        className="p-5 bg-[#121826]/40 border border-slate-850 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-lg">
                              {comp.name}
                            </h4>
                            {comp.isPrimary && (
                              <span className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase rounded-full">
                                Doanh nghiệp chính
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500 text-xs block mt-1">
                            Mã khách hàng: {comp.code}
                          </span>
                          {comp.title && (
                            <span className="text-slate-400 text-xs block mt-1 italic">
                              Chức vụ đại diện: {comp.title}
                            </span>
                          )}
                        </div>
                        <span
                          className={`self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                            comp.status === "active"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                        >
                          {comp.status === "active"
                            ? "Đang hợp tác"
                            : "Ngừng hợp tác"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-cyan-400" />
                  Thông Tin Hợp Đồng & Vị Trí
                </h2>

                {!orgContext?.employee ? (
                  <div className="text-center py-10 bg-slate-950/25 border border-dashed border-slate-850 rounded-xl">
                    <User2 className="w-10 h-10 text-slate-750 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">
                      Hồ sơ nhân sự của bạn chưa được khởi tạo bởi Quản trị viên
                      hệ thống.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div className="bg-[#121826]/40 p-4 border border-slate-850 rounded-xl">
                      <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                        Mã nhân sự
                      </span>
                      <span className="font-bold text-white">
                        {orgContext.employee.employeeCode}
                      </span>
                    </div>

                    <div className="bg-[#121826]/40 p-4 border border-slate-850 rounded-xl">
                      <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                        Chức danh / Vị trí
                      </span>
                      <span className="font-semibold text-white">
                        {orgContext.employee.jobTitle || "Chưa cập nhật"}
                      </span>
                    </div>

                    <div className="bg-[#121826]/40 p-4 border border-slate-850 rounded-xl">
                      <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        Phòng ban
                      </span>
                      <span className="font-semibold text-white">
                        {orgContext.department
                          ? `${orgContext.department.name} (${orgContext.department.code})`
                          : "Chưa phân bổ"}
                      </span>
                    </div>

                    <div className="bg-[#121826]/40 p-4 border border-slate-850 rounded-xl">
                      <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Users2 className="w-3.5 h-3.5 text-slate-500" />
                        Đội nhóm
                      </span>
                      <span className="font-semibold text-white">
                        {orgContext.team
                          ? `${orgContext.team.name} (${orgContext.team.code})`
                          : "Chưa phân bổ"}
                      </span>
                    </div>

                    <div className="bg-[#121826]/40 p-4 border border-slate-850 rounded-xl">
                      <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                        Quản lý trực tiếp
                      </span>
                      <span className="font-semibold text-white">
                        {orgContext.manager ? (
                          <div>
                            <div>{orgContext.manager.fullName}</div>
                            <span className="text-xs text-slate-500 font-normal">
                              {orgContext.manager.email}
                            </span>
                          </div>
                        ) : (
                          "Không có"
                        )}
                      </span>
                    </div>

                    <div className="bg-[#121826]/40 p-4 border border-slate-850 rounded-xl">
                      <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                        Ngày vào làm
                      </span>
                      <span className="font-semibold text-white">
                        {orgContext.employee.joinedDate
                          ? new Date(
                              orgContext.employee.joinedDate,
                            ).toLocaleDateString("vi-VN")
                          : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
