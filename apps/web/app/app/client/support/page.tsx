"use client";

import React, { useState } from "react";
import { HelpCircle, Send, CheckCircle2 } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClientSupportPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Trung tâm Hỗ trợ Khách hàng (Help Desk)"
        description="Gửi yêu cầu chỉnh sửa, hỗ trợ kỹ thuật hoặc liên hệ trực tiếp với bộ phận CSKH PGS."
        badge="Ticket hỗ trợ"
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="md:col-span-7 p-6 space-y-4">
          <h4 className="text-sm font-bold text-[#24304A]">
            Tạo yêu cầu hỗ trợ mới
          </h4>

          <div>
            <label className="text-xs font-bold text-[#24304A]">
              Tiêu đề yêu cầu
            </label>
            <input
              type="text"
              placeholder="VD: Cần chỉnh sửa thiết kế banner trang chủ..."
              className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#24304A]">
              Mức độ ưu tiên
            </label>
            <select className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus:outline-none">
              <option value="normal">Bình thường (Phản hồi trong 24h)</option>
              <option value="high">Ưu tiên cao (Phản hồi trong 4h)</option>
              <option value="urgent">Khẩn cấp (Sự cố hệ thống)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#24304A]">
              Nội dung chi tiết
            </label>
            <textarea
              rows={4}
              placeholder="Mô tả cụ thể vấn đề hoặc nội dung cần bộ phận hỗ trợ..."
              className="w-full mt-1 p-3 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus:outline-none"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Send className="w-4 h-4" />}
            onClick={() => {
              setSubmitted(true);
              setTimeout(() => setSubmitted(false), 3000);
            }}
          >
            {submitted ? "Đã gửi yêu cầu thành công!" : "Gửi yêu cầu hỗ trợ"}
          </Button>
        </Card>

        <Card className="md:col-span-5 p-6 space-y-4 bg-[#F6F8FC]">
          <h4 className="text-sm font-bold text-[#24304A]">
            Thông tin liên hệ trực tiếp
          </h4>
          <div className="space-y-3 text-xs text-[#7C879D]">
            <p>
              <strong className="text-[#24304A]">Hotline hỗ trợ:</strong> 1900
              8686
            </p>
            <p>
              <strong className="text-[#24304A]">Email kỹ thuật:</strong>{" "}
              support@pgsagenci.vn
            </p>
            <p>
              <strong className="text-[#24304A]">Giờ làm việc:</strong> Thứ 2 -
              Thứ 6 (08:30 - 18:00)
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
