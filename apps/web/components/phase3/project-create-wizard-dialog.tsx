"use client";

import React, { useState } from "react";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  FolderPlus,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  Sparkles,
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
    if (!form.clientCompanyId) return "Vui lòng chọn khách hàng doanh nghiệp.";
    if (!form.name.trim()) return "Vui lòng nhập tên dự án.";
    if (!form.projectCode.trim()) return "Vui lòng nhập mã dự án.";
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
      maxWidth="xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] text-[#5D87FF] flex items-center justify-center">
            <FolderPlus className="w-5 h-5" />
          </div>
          <span>Tạo dự án mới (Project Wizard)</span>
        </div>
      }
      description="Quy trình khởi tạo dự án chuẩn 3 bước: Chọn khách hàng &rarr; Thông tin &rarr; Nhân sự kế hoạch."
    >
      <div className="space-y-6 pt-2">
        {/* Wizard Step Indicator */}
        <div className="grid grid-cols-3 gap-2 border-b border-[#EDF2F7] pb-4">
          <div
            className={`flex items-center gap-2 text-xs font-bold ${
              step >= 1 ? "text-[#5D87FF]" : "text-[#7C879D]"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > 1
                  ? "bg-[#13DEB9] text-white"
                  : step === 1
                    ? "border-2 border-[#5D87FF] bg-[#EEF2FF] text-[#5D87FF]"
                    : "border border-[#EDF2F7] bg-[#F6F8FC] text-[#7C879D]"
              }`}
            >
              {step > 1 ? <Check className="w-4 h-4" /> : "1"}
            </div>
            <span className="truncate">1. Khách hàng & Dự án</span>
          </div>

          <div
            className={`flex items-center gap-2 text-xs font-bold ${
              step >= 2 ? "text-[#5D87FF]" : "text-[#7C879D]"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > 2
                  ? "bg-[#13DEB9] text-white"
                  : step === 2
                    ? "border-2 border-[#5D87FF] bg-[#EEF2FF] text-[#5D87FF]"
                    : "border border-[#EDF2F7] bg-[#F6F8FC] text-[#7C879D]"
              }`}
            >
              {step > 2 ? <Check className="w-4 h-4" /> : "2"}
            </div>
            <span className="truncate">2. Nhân sự & Kế hoạch</span>
          </div>

          <div
            className={`flex items-center gap-2 text-xs font-bold ${
              step === 3 ? "text-[#5D87FF]" : "text-[#7C879D]"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 3
                  ? "border-2 border-[#5D87FF] bg-[#EEF2FF] text-[#5D87FF]"
                  : "border border-[#EDF2F7] bg-[#F6F8FC] text-[#7C879D]"
              }`}
            >
              3
            </div>
            <span className="truncate">3. Xác nhận & Kích hoạt</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Client Selection & Basic Info */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Khách hàng được đưa lên ĐẦU TIÊN */}
            <div className="space-y-1.5">
              <Select
                label="Khách hàng Doanh nghiệp *"
                value={form.clientCompanyId}
                onChange={(e) =>
                  setForm({ ...form, clientCompanyId: e.target.value })
                }
              >
                <option value="">-- Chọn công ty khách hàng đối tác --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-[#7C879D]">
                Dự án sẽ được gán trực tiếp cho hồ sơ khách hàng đã chọn để quản
                lý hợp đồng và nghiệm thu.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-4">
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
                  helperText="Mã định danh duy nhất"
                />
              </div>

              <div className="sm:col-span-8">
                <Input
                  label="Tên dự án *"
                  placeholder="VD: Xây dựng hệ thống thương mại điện tử"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  helperText="Tên hiển thị trên toàn hệ thống"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#24304A]">
                Mô tả phạm vi dự án
              </label>
              <textarea
                rows={3}
                className="w-full rounded-2xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#24304A] text-xs p-3.5 outline-none focus:bg-white focus:border-[#5D87FF] transition-all"
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
                <option value="medium">Bình thường (Medium)</option>
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
                label="Hạn chót dự kiến (Due Date) *"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>

            <Select
              label="Trạng thái kích hoạt ban đầu"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ProjectStatus })
              }
            >
              <option value="draft">Bản nháp (Draft)</option>
              <option value="active">Đang thực hiện (Active)</option>
              <option value="on_hold">Tạm dừng (On Hold)</option>
            </Select>
          </div>
        )}

        {/* Step 3: Confirmation Summary */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F6F8FC] border border-[#EDF2F7] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7C879D]">
                Tóm tắt thông tin dự án
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#7C879D]">Mã dự án:</span>{" "}
                  <span className="font-mono font-bold text-[#5D87FF]">
                    {form.projectCode}
                  </span>
                </div>
                <div>
                  <span className="text-[#7C879D]">Khách hàng:</span>{" "}
                  <span className="font-bold text-[#24304A]">
                    {selectedCompany?.name || "Chưa chọn"}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[#7C879D]">Tên dự án:</span>{" "}
                  <span className="font-bold text-[#24304A]">{form.name}</span>
                </div>
                <div>
                  <span className="text-[#7C879D]">Quản lý (PM):</span>{" "}
                  <span className="font-bold text-[#24304A]">
                    {selectedManager?.fullName ||
                      selectedManager?.email ||
                      "Chưa phân công"}
                  </span>
                </div>
                <div>
                  <span className="text-[#7C879D]">Ưu tiên:</span>{" "}
                  <Badge variant="blue" size="sm">
                    {form.priority.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <span className="text-[#7C879D]">Ngày bắt đầu:</span>{" "}
                  <span className="font-medium text-[#24304A]">
                    {form.startDate}
                  </span>
                </div>
                <div>
                  <span className="text-[#7C879D]">Hạn chót:</span>{" "}
                  <span className="font-medium text-[#24304A]">
                    {form.dueDate}
                  </span>
                </div>
              </div>

              {form.description && (
                <div className="pt-2 border-t border-[#EDF2F7]">
                  <span className="text-xs text-[#7C879D] block mb-1">
                    Mô tả:
                  </span>
                  <p className="text-xs text-[#24304A] bg-white p-3 rounded-xl border border-[#EDF2F7]">
                    {form.description}
                  </p>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-[#EEF2FF] border border-[#5D87FF]/20 text-[#5D87FF] text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>
                Sau khi kích hoạt, bạn có thể tạo công việc (Tasks), phân công
                thành viên và thêm dịch vụ vào dự án.
              </span>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7]">
          {step > 1 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleBack}
              disabled={loading}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Quay lại
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              Hủy
            </Button>

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
                leftIcon={<Check className="w-4 h-4" />}
              >
                Tạo dự án ngay
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
