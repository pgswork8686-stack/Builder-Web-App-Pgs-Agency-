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
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  }>;
}

export default function UserProfilePage() {
  const [userProfile, setUserProfile] = useState<UserData | null>(null);
  const [orgContext, setOrgContext] = useState<OrgContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Hồ Sơ Cá Nhân"
        description="Thông tin tài khoản, vai trò hệ thống và thông tin nhân sự / doanh nghiệp liên kết."
      />

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
          <Card className="p-6 text-center self-start space-y-4">
            <div className="w-20 h-20 rounded-full bg-[#EEF2FF] border border-[#CBD5E1] flex items-center justify-center text-[#4F75FF] font-bold overflow-hidden mx-auto shadow-xs">
              {userProfile.user.avatarUrl ? (
                <img
                  src={userProfile.user.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User2 className="w-8 h-8 text-[#4F75FF]" />
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                {userProfile.user.fullName || "Chưa cập nhật tên"}
              </h3>
              <p className="text-xs text-[#64748B] flex items-center justify-center gap-1.5 mt-0.5 font-mono">
                <Mail className="w-3 h-3 text-[#94A3B8]" />
                {userProfile.user.email}
              </p>
            </div>

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
                    Tài khoản của bạn chưa được liên kết với doanh nghiệp khách hàng nào.
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
                    Chưa có hồ sơ nhân sự (employee profile). Vui lòng liên hệ Quản trị viên để khởi tạo mã nhân sự.
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
                            : orgContext.employee.employmentStatus === "probation"
                              ? "gold"
                              : "default"
                        }
                        size="sm"
                      >
                        {orgContext.employee.employmentStatus === "active"
                          ? "Chính thức"
                          : orgContext.employee.employmentStatus === "probation"
                            ? "Thử việc"
                            : orgContext.employee.employmentStatus === "on_leave"
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
    </div>
  );
}
