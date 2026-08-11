"use client";

import React from "react";
import Link from "next/link";
import {
  Building2,
  Users2,
  UserSquare2,
  Briefcase,
  ArrowLeft,
} from "lucide-react";

export default function AdminOrganizationDashboard() {
  const cards = [
    {
      title: "Phòng ban",
      desc: "Quản lý danh sách phòng ban, sơ đồ phòng ban công ty.",
      icon: Building2,
      href: "/app/admin/departments",
      color: "from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30",
      hoverGlow: "group-hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]",
    },
    {
      title: "Đội nhóm",
      desc: "Quản lý đội nhóm nghiệp vụ và phân công trưởng nhóm.",
      icon: Users2,
      href: "/app/admin/teams",
      color:
        "from-purple-500/20 to-pink-500/20 text-pink-400 border-pink-500/30",
      hoverGlow: "group-hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]",
    },
    {
      title: "Nhân sự",
      desc: "Hồ sơ nhân viên, chức danh, quan hệ quản lý trực tiếp.",
      icon: UserSquare2,
      href: "/app/admin/people",
      color:
        "from-emerald-500/20 to-teal-500/20 text-teal-400 border-teal-500/30",
      hoverGlow: "group-hover:shadow-[0_0_20px_rgba(20,184,166,0.15)]",
    },
    {
      title: "Khách hàng",
      desc: "Quản lý doanh nghiệp khách hàng và tài khoản đối tác.",
      icon: Briefcase,
      href: "/app/admin/clients",
      color:
        "from-amber-500/20 to-orange-500/20 text-orange-400 border-orange-500/30",
      hoverGlow: "group-hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] p-6 lg:p-12 selection:bg-cyan-500 selection:text-black">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            PGS Hub • Phase 2
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Cơ Cấu Tổ Chức & Nhân Sự
          </h1>
          <p className="text-slate-400 text-sm md:text-base mt-2">
            Quản trị phòng ban, đội nhóm, hồ sơ nhân sự công ty và thông tin
            khách hàng đối tác.
          </p>
        </div>

        <Link
          href="/app/admin"
          className="flex items-center gap-2 self-start px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl transition duration-300 text-sm text-slate-300 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Quay lại Admin Dashboard
        </Link>
      </div>

      {/* Grid Menu Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className={`group relative overflow-hidden rounded-2xl border bg-slate-900/40 backdrop-blur-md p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-slate-600/50 ${card.hoverGlow}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div>
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} border flex items-center justify-center mb-6`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                  {card.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {card.desc}
                </p>
              </div>
              <div className="mt-8 text-xs text-cyan-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Quản lý chi tiết →
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
