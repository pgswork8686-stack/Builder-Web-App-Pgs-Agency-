"use client";

import React, { useState } from "react";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  FolderPlus,
  AlertCircle,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  type ProjectPriority,
  type ProjectStatus,
  projectsApi,
} from "@/lib/api/projects";

export interface ProjectCreateWizardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companies: Array<{ id: string; name: string }>;
  people: Array<{ id: string; fullName: string | null; email: string }>;
}

export function ProjectCreateWizardDialog({
  isOpen,
  onClose,
  onSuccess,
  companies,
  people,
}: ProjectCreateWizardDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    projectCode: "",
    name: "",
    clientCompanyId: "",
    description: "",
    projectManagerUserId: "",
    startDate: "",
    dueDate: "",
    priority: "medium" as ProjectPriority,
    status: "active" as ProjectStatus,
  });

  const validateStep1 = () => {
    if (!form.projectCode.trim()) return "Vui lòng nhập mã dự án.";
    if (!form.name.trim()) return "Vui lòng nhập tên dự án.";
    if (!form.clientCompanyId) return "Vui lòng chọn khách hàng.";
    return null;
  };

  const validateStep2 = () => {
    if (!form.startDate) return "Vui lòng chọn ngày bắt đầu.";
    if (!form.dueDate) return "Vui lòng chọn hạn chót.";
    if (new Date(form.dueDate) < new Date(form.startDate)) {
      return "Hạn chót không được trước ngày bắt đầu.";
    }
    return null;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const err = validateStep2();
      if (err) {
        setError(err);
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await projectsApi.createProject({
        projectCode: form.projectCode.trim().toUpperCase(),
        name: form.name.trim(),
        clientCompanyId: form.clientCompanyId,
        description: form.description.trim() || undefined,
        projectManagerUserId: form.projectManagerUserId || undefined,
        startDate: form.startDate,
        dueDate: form.dueDate,
        priority: form.priority,
        status: form.status,
      });
      onSuccess();
      onClose();
      // Reset form
      setForm({
        projectCode: "",
        name: "",
        clientCompanyId: "",
        description: "",
        projectManagerUserId: "",
        startDate: "",
        dueDate: "",
        priority: "medium",
        status: "active",
      });
      setStep(1);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể tạo dự án. Vui lòng kiểm tra lại thông tin.",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedCompany = companies.find((c) => c.id === form.clientCompanyId);
  const selectedManager = people.find(
    (p) => p.id === form.projectManagerUserId,
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <FolderPlus className="w-5 h-5 text-[#4F75FF]" />
          <span>Tạo dự án mới (Project Wizard)</span>
        </div>
      }
      description="Quy trình khởi tạo dự án chuẩn 3 bước theo thiết kế PGS Hub."
    >
      <div className="space-y-6 pt-2">
        {/* Wizard Step Indicator */}
        <div className="grid grid-cols-3 gap-2 border-b border-[#EDF2F7] pb-4">
          <div
            className={`flex items-center gap-2 text-xs font-bold ${
              step >= 1 ? "text-[#4F75FF]" : "text-[#94A3B8]"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step > 1
                  ? "bg-[#4F75FF] text-white"
                  : step === 1
                    ? "border-2 border-[#4F75FF] text-[#4F75FF]"
                    : "border border-[#CBD5E1] text-[#94A3B8]"
              }`}
            >
              {step > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
            </div>
            <span className="hidden sm:inline">1. Thông tin cơ bản</span>
          </div>

          <div
            className={`flex items-center gap-2 text-xs font-bold ${
              step >= 2 ? "text-[#4F75FF]" : "text-[#94A3B8]"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step > 2
                  ? "bg-[#4F75FF] text-white"
                  : step === 2
                    ? "border-2 border-[#4F75FF] text-[#4F75FF]"
                    : "border border-[#CBD5E1] text-[#94A3B8]"
              }`}
            >
              {step > 2 ? <Check className="w-3.5 h-3.5" /> : "2"}
            </div>
            <span className="hidden sm:inline">2. Nhân sự & Kế hoạch</span>
          </div>

          <div
            className={`flex items-center gap-2 text-xs font-bold ${
              step === 3 ? "text-[#4F75FF]" : "text-[#94A3B8]"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === 3
                  ? "border-2 border-[#4F75FF] text-[#4F75FF]"
                  : "border border-[#CBD5E1] text-[#94A3B8]"
              }`}
            >
              3
            </div>
            <span className="hidden sm:inline">3. Xác nhận & Kích hoạt</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Mã dự án (Project Code) *"
                placeholder="VD: PGS-PRJ-2026"
                value={form.projectCode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    projectCode: e.target.value.toUpperCase(),
                  })
                }
                helperText="Mã định danh duy nhất cho dự án"
              />

              <Select
                label="Khách hàng doanh nghiệp *"
                value={form.clientCompanyId}
                onChange={(e) =>
                  setForm({ ...form, clientCompanyId: e.target.value })
                }
              >
                <option value="">-- Chọn công ty khách hàng --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label="Tên dự án *"
              placeholder="VD: Xây dựng hệ thống thương mại điện tử"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569]">
                Mô tả phạm vi dự án
              </label>
              <textarea
                rows={3}
                className="w-full rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-sm p-3 outline-none focus:bg-white focus:border-[#4F75FF] transition-all"
                placeholder="Mô tả mục tiêu, yêu cầu nghiệm thu và phạm vi công việc..."
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </div>
        )}

        {/* Step 2: Assignee & Timeline */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Quản lý dự án (Project Manager)"
                value={form.projectManagerUserId}
                onChange={(e) =>
                  setForm({ ...form, projectManagerUserId: e.target.value })
                }
              >
                <option value="">-- Chưa chỉ định (Tùy chọn) --</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName || p.email} ({p.email})
                  </option>
                ))}
              </Select>

              <Select
                label="Mức độ ưu tiên"
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: e.target.value as ProjectPriority,
                  })
                }
              >
                <option value="low">Thấp (Low)</option>
                <option value="medium">Trung bình (Medium)</option>
                <option value="high">Cao (High)</option>
                <option value="urgent">Khẩn cấp (Urgent)</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Ngày bắt đầu *"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
              />

              <Input
                label="Hạn chót bàn giao (Due Date) *"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirmation */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#EDF2F7]">
                <span className="text-[#64748B]">Mã dự án:</span>
                <span className="font-mono font-bold text-[#4F75FF]">
                  {form.projectCode}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#EDF2F7]">
                <span className="text-[#64748B]">Tên dự án:</span>
                <span className="font-bold text-[#0F172A]">{form.name}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#EDF2F7]">
                <span className="text-[#64748B]">Khách hàng:</span>
                <span className="font-semibold text-[#0F172A]">
                  {selectedCompany?.name || "Chưa chọn"}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#EDF2F7]">
                <span className="text-[#64748B]">Project Manager:</span>
                <span className="text-[#0F172A]">
                  {selectedManager?.fullName ||
                    selectedManager?.email ||
                    "Chưa chỉ định"}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#EDF2F7]">
                <span className="text-[#64748B]">Thời gian thực hiện:</span>
                <span className="text-[#0F172A]">
                  {form.startDate} ➔ {form.dueDate}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Mức ưu tiên:</span>
                <Badge variant="blue" size="sm">
                  {form.priority.toUpperCase()}
                </Badge>
              </div>
            </div>

            <Select
              label="Trạng thái ban đầu sau khi tạo"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ProjectStatus })
              }
            >
              <option value="active">Đang chạy (Active) — Bắt đầu ngay</option>
              <option value="draft">Nháp (Draft) — Lưu tạm</option>
            </Select>
          </div>
        )}

        {/* Wizard Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7]">
          {step > 1 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleBack}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Quay lại
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleNext}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Tiếp tục
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              isLoading={loading}
              rightIcon={<Check className="w-4 h-4" />}
            >
              Xác nhận & Khởi tạo dự án
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
