"use client";

import React, { useState } from "react";
import { Settings, Shield, Bell, Database, Globe, Save } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Cài đặt Hệ thống (System Settings)"
        description="Cấu hình thông số tổ chức, bảo mật phiên làm việc và tùy chọn thông báo toàn agency."
        badge="Settings"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Save className="w-4 h-4" />}
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
          >
            {saved ? "Đã lưu cài đặt" : "Lưu thay đổi"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#5D87FF] flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#24304A]">
                Thông tin Tổ chức
              </h4>
              <p className="text-xs text-[#7C879D]">
                Tên và thông tin nhận diện doanh nghiệp
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-[#24304A]">
                Tên tổ chức
              </label>
              <input
                type="text"
                defaultValue="PGS Agency"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#24304A]">
                Múi giờ làm việc
              </label>
              <input
                type="text"
                defaultValue="GMT+7 (Asia/Ho_Chi_Minh)"
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus:outline-none"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E6FBF5] text-[#13DEB9] flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#24304A]">
                Bảo mật & Phân quyền
              </h4>
              <p className="text-xs text-[#7C879D]">
                Kiểm soát phiên và quyền truy cập API
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F6F8FC]">
              <div>
                <p className="text-xs font-bold text-[#24304A]">
                  Xác thực 2 lớp (2FA)
                </p>
                <p className="text-[11px] text-[#7C879D]">
                  Bắt buộc cho tài khoản Admin & Kế toán
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6FBF5] text-[#13DEB9]">
                Bật
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F6F8FC]">
              <div>
                <p className="text-xs font-bold text-[#24304A]">
                  Tự động khóa tài khoản
                </p>
                <p className="text-[11px] text-[#7C879D]">
                  Khi phát hiện đăng nhập bất thường
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6FBF5] text-[#13DEB9]">
                Bật
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
