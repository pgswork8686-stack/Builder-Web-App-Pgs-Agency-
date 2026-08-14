"use client";

import React from "react";
import Link from "next/link";
import {
  Building2,
  Users2,
  UserSquare2,
  Briefcase,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminOrganizationDashboard() {
  const cards = [
    {
      title: "Phòng ban",
      desc: "Quản lý danh sách phòng ban, sơ đồ phòng ban và mã định danh.",
      icon: Building2,
      href: "/app/admin/departments",
      color: "bg-[#EEF2FF] text-[#4F75FF]",
      border: "border-[#EDF2F7]",
    },
    {
      title: "Đội nhóm",
      desc: "Quản lý đội nhóm nghiệp vụ và phân công trưởng nhóm quản lý.",
      icon: Users2,
      href: "/app/admin/teams",
      color: "bg-[#F3E8FF] text-[#9333EA]",
      border: "border-[#EDF2F7]",
    },
    {
      title: "Nhân sự",
      desc: "Hồ sơ nhân viên, chức danh, mã nhân sự và quản lý trực tiếp.",
      icon: UserSquare2,
      href: "/app/admin/people",
      color: "bg-[#E6FBF5] text-[#059669]",
      border: "border-[#EDF2F7]",
    },
    {
      title: "Khách hàng",
      desc: "Quản lý doanh nghiệp khách hàng và các tài khoản đối tác.",
      icon: Briefcase,
      href: "/app/admin/clients",
      color: "bg-[#FEF9C3] text-[#CA8A04]",
      border: "border-[#EDF2F7]",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Cơ cấu Tổ chức & Nhân sự"
        description="Quản trị phòng ban, đội nhóm, hồ sơ nhân sự công ty và thông tin khách hàng đối tác."
        action={
          <Link href="/app/admin">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Quay lại Dashboard
            </Button>
          </Link>
        }
      />

      {/* Grid Menu Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group block">
              <Card className="p-6 h-full flex flex-col justify-between hover:border-[#4F75FF]/40 hover:shadow-md transition-all">
                <div className="space-y-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.color} shadow-xs`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[#0F172A] group-hover:text-[#4F75FF] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#EDF2F7] flex items-center justify-between text-xs font-bold text-[#4F75FF] group-hover:translate-x-0.5 transition-transform">
                  <span>Truy cập quản lý</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
