"use client";

import React, { useState } from "react";
import { FileSpreadsheet, Send, CheckCircle2 } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EmployeeReportsPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Báo cáo Công việc Hàng ngày (Daily Report)"
        description="Gửi tóm tắt tiến độ, các khó khăn và kế hoạch ngày tiếp theo cho quản lý trực tiếp."
        badge="Báo cáo ngày"
      />

      <Card className="p-6 space-y-4 max-w-2xl">
        <div>
          <label className="text-xs font-bold text-[#24304A]">
            Công việc đã hoàn thành hôm nay
          </label>
          <textarea
            rows={3}
            placeholder="Liệt kê các đầu việc hoặc task bạn đã xử lý xong..."
            className="w-full mt-1 p-3 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-[#24304A]">
            Khó khăn & đề xuất hỗ trợ
          </label>
          <textarea
            rows={2}
            placeholder="Các vấn đề phát sinh cần cấp trên hoặc đồng đội hỗ trợ..."
            className="w-full mt-1 p-3 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-[#24304A]">
            Kế hoạch ngày mai
          </label>
          <textarea
            rows={2}
            placeholder="Các đầu việc dự kiến hoàn thành vào ngày mai..."
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
          {submitted ? "Đã gửi báo cáo ngày!" : "Gửi báo cáo cho Quản lý"}
        </Button>
      </Card>
    </div>
  );
}
