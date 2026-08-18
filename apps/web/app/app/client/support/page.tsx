"use client";

import React from "react";
import Link from "next/link";
import { MessageSquare, AlertCircle } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClientSupportPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Trung tâm Hỗ trợ Khách hàng (Help Desk)"
        description="Trao đổi trực tiếp với Quản lý dự án qua kênh Tin nhắn Nội bộ."
        badge="Kênh hỗ trợ dự án"
      />

      <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
        <span>
          <strong>Kênh trao đổi dự án:</strong> Bạn có thể trao đổi trực tiếp
          với Quản lý dự án và đội ngũ phụ trách qua mục Tin nhắn Nội bộ. Hệ
          thống gửi Ticket tự động chưa được kết nối backend.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="md:col-span-7 p-6 space-y-4">
          <h4 className="text-sm font-bold text-[#24304A]">
            Yêu cầu hỗ trợ & Feedback dự án
          </h4>

          <div>
            <label
              htmlFor="support-subject"
              className="text-xs font-bold text-[#24304A]"
            >
              Tiêu đề nội dung
            </label>
            <input
              type="text"
              id="support-subject"
              disabled
              placeholder="VD: Cần chỉnh sửa thiết kế banner trang chủ..."
              className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="support-priority"
              className="text-xs font-bold text-[#24304A]"
            >
              Mức độ ưu tiên
            </label>
            <select
              id="support-priority"
              disabled
              className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
            >
              <option value="normal">Bình thường (Phản hồi trong 24h)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="support-details"
              className="text-xs font-bold text-[#24304A]"
            >
              Nội dung chi tiết
            </label>
            <textarea
              id="support-details"
              rows={4}
              disabled
              placeholder="Mô tả cụ thể vấn đề hoặc nội dung cần bộ phận hỗ trợ..."
              className="w-full mt-1 p-3 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
            />
          </div>

          <Link href="/app/chat">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<MessageSquare className="w-4 h-4 text-[#5D87FF]" />}
            >
              Mở Tin nhắn Nội bộ để trao đổi
            </Button>
          </Link>
        </Card>

        <Card className="md:col-span-5 p-6 space-y-4 bg-[#F6F8FC]">
          <h4 className="text-sm font-bold text-[#24304A]">
            Thông tin liên hệ hỗ trợ
          </h4>
          <p className="text-xs text-[#7C879D] leading-relaxed">
            Thông tin liên hệ hỗ trợ chưa được cấu hình. Quý khách vui lòng liên
            hệ trực tiếp với quản lý dự án phụ trách thông qua mục Tin nhắn Nội
            bộ để được hỗ trợ nhanh nhất.
          </p>
        </Card>
      </div>
    </div>
  );
}
