"use client";

import React from "react";
import { Send, AlertCircle } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EmployeeReportsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Báo cáo Công việc Hàng ngày (Daily Report)"
        description="Gửi tóm tắt tiến độ, các khó khăn và kế hoạch ngày tiếp theo cho quản lý trực tiếp."
        badge="Xem trước"
      />

      <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
        <span>
          <strong>Chưa kết nối API báo cáo hàng ngày:</strong> Phân hệ nhật ký
          báo cáo hàng ngày chưa có API lưu trữ backend. Tiến độ công việc thực
          tế được ghi nhận thông qua cập nhật trạng thái tasks trên Kanban và
          bình luận nhiệm vụ.
        </span>
      </div>

      <Card className="p-6 space-y-4 max-w-2xl">
        <div>
          <label className="text-xs font-bold text-[#24304A]">
            Công việc đã hoàn thành hôm nay
          </label>
          <textarea
            rows={3}
            disabled
            placeholder="Liệt kê các đầu việc hoặc task bạn đã xử lý xong..."
            className="w-full mt-1 p-3 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-[#24304A]">
            Khó khăn & đề xuất hỗ trợ
          </label>
          <textarea
            rows={2}
            disabled
            placeholder="Các vấn đề phát sinh cần cấp trên hoặc đồng đội hỗ trợ..."
            className="w-full mt-1 p-3 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-[#24304A]">
            Kế hoạch ngày mai
          </label>
          <textarea
            rows={2}
            disabled
            placeholder="Các đầu việc dự kiến hoàn thành vào ngày mai..."
            className="w-full mt-1 p-3 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
          />
        </div>

        <Button
          variant="secondary"
          size="sm"
          disabled
          leftIcon={<Send className="w-4 h-4" />}
        >
          Chưa hỗ trợ gửi trực tuyến
        </Button>
      </Card>
    </div>
  );
}
