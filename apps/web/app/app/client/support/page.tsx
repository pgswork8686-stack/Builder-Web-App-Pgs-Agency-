"use client";

import React from "react";
import { HelpCircle, Mail, Phone, Clock, AlertCircle } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClientSupportPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Trung tâm Hỗ trợ Khách hàng (Help Desk)"
        description="Gửi yêu cầu chỉnh sửa, hỗ trợ kỹ thuật hoặc liên hệ trực tiếp với bộ phận CSKH PGS."
        badge="Thông tin liên hệ"
      />

      <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
        <span>
          <strong>Kênh hỗ trợ trực tiếp:</strong> Bạn có thể trao đổi trực tiếp
          với Quản lý dự án qua mục Tin nhắn Nội bộ hoặc liên hệ Hotline CSKH
          bên dưới. Hệ thống gửi Ticket tự động đang được chuẩn hóa.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="md:col-span-7 p-6 space-y-4">
          <h4 className="text-sm font-bold text-[#24304A]">
            Yêu cầu hỗ trợ & Feedback dự án
          </h4>

          <div>
            <label className="text-xs font-bold text-[#24304A]">
              Tiêu đề nội dung
            </label>
            <input
              type="text"
              disabled
              placeholder="VD: Cần chỉnh sửa thiết kế banner trang chủ..."
              className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#24304A]">
              Mức độ ưu tiên
            </label>
            <select
              disabled
              className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
            >
              <option value="normal">Bình thường (Phản hồi trong 24h)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#24304A]">
              Nội dung chi tiết
            </label>
            <textarea
              rows={4}
              disabled
              placeholder="Mô tả cụ thể vấn đề hoặc nội dung cần bộ phận hỗ trợ..."
              className="w-full mt-1 p-3 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
            />
          </div>

          <Button variant="secondary" size="sm" disabled>
            Gửi qua Chat Nội bộ hoặc Hotline
          </Button>
        </Card>

        <Card className="md:col-span-5 p-6 space-y-4 bg-[#F6F8FC]">
          <h4 className="text-sm font-bold text-[#24304A]">
            Thông tin liên hệ trực tiếp
          </h4>
          <div className="space-y-3 text-xs text-[#7C879D]">
            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-[#5D87FF]" />
              <div>
                <span className="font-bold text-[#24304A]">
                  Hotline hỗ trợ:
                </span>{" "}
                <span>1900 8686</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-[#5D87FF]" />
              <div>
                <span className="font-bold text-[#24304A]">Email CSKH:</span>{" "}
                <span>support@pgsagenci.vn</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#5D87FF]" />
              <div>
                <span className="font-bold text-[#24304A]">Giờ làm việc:</span>{" "}
                <span>Thứ 2 - Thứ 6 (08:30 - 18:00)</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
