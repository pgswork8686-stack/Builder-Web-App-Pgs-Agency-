"use client";

import React from "react";
import { Download, AlertCircle, Lock } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Báo cáo Tổng hợp (Executive Reports)"
        description="Tổng quan hiệu suất công việc, chỉ số tài chính, chấm công và tình hình dự án."
        badge="Xem trước"
        action={
          <Button
            variant="secondary"
            size="sm"
            disabled
            leftIcon={<Lock className="w-4 h-4" />}
          >
            Xuất báo cáo (Chưa hỗ trợ)
          </Button>
        }
      />

      <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
        <span>
          <strong>Thông tin tính năng:</strong> Chức năng kết xuất file tổng hợp
          (Excel/PDF) và lọc thống kê động đang trong lộ trình phát triển. Dữ
          liệu chi tiết có thể tra cứu trực tiếp tại từng phân hệ Dự án, Tài
          chính và Chấm công.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 space-y-2">
          <span className="text-xs font-bold text-[#7C879D]">
            Báo cáo Dự án
          </span>
          <h4 className="text-base font-extrabold text-[#24304A]">
            Tiến độ & Hiệu suất
          </h4>
          <p className="text-xs text-[#7C879D]">
            Tỷ lệ hoàn thành công việc theo từng team và dự án.
          </p>
        </Card>

        <Card className="p-5 space-y-2">
          <span className="text-xs font-bold text-[#7C879D]">
            Báo cáo Tài chính
          </span>
          <h4 className="text-base font-extrabold text-[#24304A]">
            Dòng tiền & Công nợ
          </h4>
          <p className="text-xs text-[#7C879D]">
            Tổng thu, tổng chi và các khoản nợ cần thu hồi.
          </p>
        </Card>

        <Card className="p-5 space-y-2">
          <span className="text-xs font-bold text-[#7C879D]">
            Báo cáo Nhân sự
          </span>
          <h4 className="text-base font-extrabold text-[#24304A]">
            Chấm công & Phép
          </h4>
          <p className="text-xs text-[#7C879D]">
            Thống kê ngày công chuẩn, đi muộn và nghỉ phép.
          </p>
        </Card>
      </div>

      <Card className="p-6 space-y-4">
        <h4 className="text-sm font-bold text-[#24304A]">
          Bộ lọc khoảng thời gian
        </h4>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#EEF2FF] text-[#5D87FF] border border-[#5D87FF]/20">
            Tháng hiện tại
          </span>
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-white text-[#7C879D] border border-[#EDF2F7] opacity-60 cursor-not-allowed">
            Quý này
          </span>
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-white text-[#7C879D] border border-[#EDF2F7] opacity-60 cursor-not-allowed">
            Năm nay
          </span>
        </div>
      </Card>
    </div>
  );
}
