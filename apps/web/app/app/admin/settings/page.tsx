"use client";

import React from "react";
import { Settings, Shield, Bell, Globe, AlertCircle, Lock } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Cài đặt Hệ thống (System Settings)"
        description="Cấu hình thông số tổ chức, bảo mật phiên làm việc và tùy chọn thông báo toàn agency."
        badge="Chưa kết nối cấu hình"
        action={
          <Button
            variant="secondary"
            size="sm"
            disabled
            leftIcon={<Lock className="w-4 h-4" />}
          >
            Chưa hỗ trợ lưu
          </Button>
        }
      />

      <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
        <span>
          <strong>Chưa kết nối cấu hình hệ thống:</strong> Các trường cài đặt
          dưới đây đang ở chế độ xem trước (read-only). Backend API chưa hỗ trợ
          lưu tùy biến cài đặt thời gian thực.
        </span>
      </div>

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
                disabled
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#24304A]">
                Múi giờ làm việc
              </label>
              <input
                type="text"
                defaultValue="GMT+7 (Asia/Ho_Chi_Minh)"
                disabled
                className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#7C879D] cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#5D87FF] flex items-center justify-center">
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
                  Chính sách xác thực
                </p>
                <p className="text-[11px] text-[#7C879D]">
                  Supabase Auth & JWT Session Token
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#5D87FF]">
                Mặc định
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F6F8FC]">
              <div>
                <p className="text-xs font-bold text-[#24304A]">
                  Phân quyền theo vai trò (RBAC)
                </p>
                <p className="text-[11px] text-[#7C879D]">
                  5 vai trò: Admin, Trưởng nhóm, Nhân viên, Kế toán, Khách hàng
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6FBF5] text-[#13DEB9]">
                Kích hoạt
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
