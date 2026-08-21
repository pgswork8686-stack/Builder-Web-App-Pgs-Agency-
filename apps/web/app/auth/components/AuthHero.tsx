"use client";

import React from "react";

export function AuthHero() {
  return (
    <div className="relative hidden md:flex flex-col justify-between w-full md:w-[50%] min-h-screen bg-[#4F75FF] p-10 lg:p-14 text-white overflow-hidden select-none">
      {/* Header / Logo */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#FFB800] text-black font-black text-xl shadow-md">
          P
        </div>
        <span className="text-2xl font-black tracking-tight text-white">
          PGS Hub
        </span>
      </div>

      {/* Center Content */}
      <div className="relative z-10 my-auto max-w-md space-y-6">
        <div className="space-y-3">
          <h1 className="text-2xl lg:text-3xl font-black leading-tight text-white tracking-tight">
            Nền tảng vận hành nội bộ PGS Agency
          </h1>
          <p className="text-white/80 text-sm leading-relaxed">
            Quản lý dự án, công việc, nhân sự, tài chính và khách hàng trong một
            hệ thống thống nhất.
          </p>
        </div>

        {/* 3 Translucent Feature Cards from Figma */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-xs text-white shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-white text-[#4F75FF] font-mono font-black text-xs flex items-center justify-center shrink-0">
              01
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                Dự án & công việc
              </h4>
              <p className="text-[11px] text-white/80">
                Theo dõi tiến độ và luồng duyệt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-xs text-white shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-white text-[#4F75FF] font-mono font-black text-xs flex items-center justify-center shrink-0">
              02
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                Nhân sự & chấm công
              </h4>
              <p className="text-[11px] text-white/80">
                Quản lý ngày công và nghỉ phép
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-xs text-white shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-white text-[#4F75FF] font-mono font-black text-xs flex items-center justify-center shrink-0">
              03
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                Tài chính & khách hàng
              </h4>
              <p className="text-[11px] text-white/80">
                Kiểm soát hợp đồng, hóa đơn, công nợ
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-xs text-white/60">
        © 2026 PGS Agency. Nền tảng quản trị doanh nghiệp.
      </div>
    </div>
  );
}
