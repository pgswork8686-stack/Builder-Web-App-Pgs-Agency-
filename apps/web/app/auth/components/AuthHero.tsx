"use client";

import React from "react";
import { Sparkles, ShieldCheck, Zap } from "lucide-react";

export function AuthHero() {
  return (
    <div className="relative hidden md:flex flex-col justify-between w-full md:w-[52%] min-h-screen bg-[#070707] p-8 lg:p-12 overflow-hidden border-r border-[#151516]">
      {/* Background Video or Animated Space Canvas Effect */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Decorative Star Particles Grid & Glowing Orbs */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_30%_30%,#ffc40015,transparent_50%),radial-gradient(circle_at_70%_70%,#9a721615,transparent_50%)] pointer-events-none" />
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#FFC400]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#9A7216]/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Header / Logo */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFC400] to-[#CFA63E] text-black font-black text-xl shadow-[0_0_20px_rgba(255,196,0,0.3)]">
          P
        </div>
        <div>
          <span className="text-xl font-bold tracking-wider text-white">
            PGS <span className="text-[#FFC400]">HUB</span>
          </span>
          <p className="text-[10px] text-[#606060] uppercase tracking-widest font-mono">
            Enterprise Operating System
          </p>
        </div>
      </div>

      {/* Center Content */}
      <div className="relative z-10 my-auto max-w-lg">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#151516] border border-[#FFC400]/30 text-[#FFC400] text-xs font-medium mb-6 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>Hệ thống Quản trị Vận hành Đột phá</span>
        </div>

        <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-4 tracking-tight">
          Nâng tầm vận hành doanh nghiệp với{" "}
          <span className="bg-gradient-to-r from-[#FFC400] via-[#FFE27A] to-[#CFA63E] bg-clip-text text-transparent">
            PGS Hub Space
          </span>
        </h1>

        <p className="text-[#FFF8E6]/70 text-sm leading-relaxed mb-8">
          Tối ưu hóa quy trình làm việc, quản lý nhân sự, tự động hóa báo cáo và
          phân quyền thông minh trong một nền tảng duy nhất.
        </p>

        {/* Feature Pills */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#0E0E0F]/80 border border-[#151516] backdrop-blur-sm text-[#FFF8E6]/90">
            <ShieldCheck className="w-4 h-4 text-[#FFC400]" />
            <span>Bảo mật chuẩn Doanh nghiệp</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#0E0E0F]/80 border border-[#151516] backdrop-blur-sm text-[#FFF8E6]/90">
            <Zap className="w-4 h-4 text-[#FFC400]" />
            <span>Phân quyền 5 vai trò chi tiết</span>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="relative z-10 flex items-center justify-between text-xs text-[#606060] border-t border-[#151516] pt-4">
        <span>© 2026 PGS Agency. Tất cả quyền được bảo lưu.</span>
        <span className="font-mono text-[11px]">v2.4.0-space</span>
      </div>
    </div>
  );
}
