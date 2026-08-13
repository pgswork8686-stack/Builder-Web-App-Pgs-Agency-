"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Loader2,
  FileText,
  Eye,
  X,
} from "lucide-react";
import { financeApi, Contract } from "@/lib/api/finance";
import { clientsApi } from "@/lib/api/clients";
import { projectsApi, Project } from "@/lib/api/projects";

export default function AdminContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // Metadata dropdowns
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Modal form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [formContractNumber, setFormContractNumber] = useState("");
  const [formClientCompanyId, setFormClientCompanyId] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formContractValue, setFormContractValue] = useState("");
  const [formCurrencyCode, setFormCurrencyCode] = useState("VND");
  const [formNotes, setFormNotes] = useState("");
  const [formClientVisible, setFormClientVisible] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadMetadata = async () => {
    try {
      const clientsRes = await clientsApi.getClientCompanies({ pageSize: 100 });
      setClients(clientsRes.items || []);

      const projectsRes = await projectsApi.getAdminProjects({ pageSize: 200 });
      setProjects(projectsRes.items || []);
    } catch (err) {
      console.error("Lỗi lấy siêu dữ liệu hợp đồng:", err);
    }
  };

  const loadContracts = async () => {
    try {
      setLoading(true);
      const res = await financeApi.getContracts({
        page,
        pageSize,
        query: searchQuery || undefined,
        status: filterStatus || undefined,
        clientCompanyId: filterClient || undefined,
      });
      setContracts(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error("Lỗi tải danh sách hợp đồng:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadContracts();
  }, [page, searchQuery, filterStatus, filterClient]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (
      !formContractNumber.trim() ||
      !formClientCompanyId ||
      !formTitle.trim() ||
      !formStartDate ||
      !formContractValue
    ) {
      setFormError("Vui lòng nhập đầy đủ các thông tin bắt buộc.");
      return;
    }

    try {
      setSubmitting(true);
      await financeApi.createContract({
        contractNumber: formContractNumber.trim(),
        clientCompanyId: formClientCompanyId,
        projectId: formProjectId || null,
        title: formTitle.trim(),
        startDate: formStartDate,
        endDate: formEndDate || null,
        contractValue: parseFloat(formContractValue),
        currencyCode: formCurrencyCode,
        notes: formNotes || null,
        clientVisible: formClientVisible,
      });

      // Clear form
      setFormContractNumber("");
      setFormClientCompanyId("");
      setFormProjectId("");
      setFormTitle("");
      setFormStartDate("");
      setFormEndDate("");
      setFormContractValue("");
      setFormCurrencyCode("VND");
      setFormNotes("");
      setFormClientVisible(false);
      setShowAddForm(false);

      // Reload
      loadContracts();
    } catch (err: any) {
      setFormError(err.message || "Tạo hợp đồng thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <span className="px-2 py-1 rounded-full bg-[#151516] border border-[#FFC400]/20 text-[#FFC400] text-[10px] font-bold">
            Nháp
          </span>
        );
      case "active":
        return (
          <span className="px-2 py-1 rounded-full bg-[#00E676]/10 border border-[#00E676]/20 text-[#00E676] text-[10px] font-bold">
            Đang hiệu lực
          </span>
        );
      case "completed":
        return (
          <span className="px-2 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/20 text-[#00E5FF] text-[10px] font-bold">
            Hoàn thành
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-1 rounded-full bg-[#FF1744]/10 border border-[#FF1744]/20 text-[#FF1744] text-[10px] font-bold">
            Đã hủy
          </span>
        );
      default:
        return null;
    }
  };

  // Filter projects based on selected client company
  const filteredProjects = projects.filter(
    (p) => p.clientCompanyId === formClientCompanyId,
  );

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-[#151516] bg-[#0E0E0F]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/app/admin/finance"
            className="p-2 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="font-bold text-base tracking-wide text-white">
            Tài chính{" "}
            <span className="text-[#FFC400] font-normal">| Hợp đồng</span>
          </span>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFC400] text-black font-bold text-sm hover:brightness-110 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo hợp đồng</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#0E0E0F] p-4 rounded-2xl border border-[#151516]">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#606060]" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã số hoặc tiêu đề..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            <div className="flex items-center gap-2 bg-[#151516] px-3 py-2 rounded-xl border border-[#1f1f22] w-full sm:w-auto">
              <Filter className="w-4 h-4 text-[#606060]" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent border-none text-[#FFF8E6] text-xs focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[#0e0e0f]">
                  Trạng thái
                </option>
                <option value="draft" className="bg-[#0e0e0f]">
                  Nháp
                </option>
                <option value="active" className="bg-[#0e0e0f]">
                  Đang hiệu lực
                </option>
                <option value="completed" className="bg-[#0e0e0f]">
                  Hoàn thành
                </option>
                <option value="cancelled" className="bg-[#0e0e0f]">
                  Đã hủy
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-[#151516] px-3 py-2 rounded-xl border border-[#1f1f22] w-full sm:w-auto">
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="bg-transparent border-none text-[#FFF8E6] text-xs focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[#0e0e0f]">
                  Khách hàng
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0e0e0f]">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Contracts Table */}
        {loading ? (
          <div className="flex items-center justify-center p-12 bg-[#0E0E0F] border border-[#151516] rounded-2xl">
            <Loader2 className="w-6 h-6 text-[#FFC400] animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center p-12 rounded-2xl bg-[#0E0E0F] border border-[#151516] text-[#606060] space-y-3">
            <FileText className="w-12 h-12 text-[#151516] mx-auto" />
            <p className="text-sm">
              Chưa có hợp đồng nào được tạo trong hệ thống.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 rounded-xl bg-[#151516] border border-[#FFC400]/20 text-[#FFC400] hover:bg-[#FFC400]/10 text-xs font-bold transition-all cursor-pointer"
            >
              Tạo hợp đồng đầu tiên
            </button>
          </div>
        ) : (
          <div className="bg-[#0E0E0F] border border-[#151516] rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#151516] text-[#606060] text-xs font-semibold uppercase tracking-wider bg-[#0c0c0d]">
                    <th className="px-6 py-4">Mã số</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Tiêu đề hợp đồng</th>
                    <th className="px-6 py-4">Giá trị</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151516] text-sm text-[#FFF8E6]/80">
                  {contracts.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-[#151516]/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-white">
                        {c.contract_number}
                      </td>
                      <td className="px-6 py-4">
                        {c.client_company?.name || "—"}
                      </td>
                      <td
                        className="px-6 py-4 max-w-xs truncate"
                        title={c.title}
                      >
                        {c.title}
                      </td>
                      <td className="px-6 py-4 font-extrabold text-white">
                        {formatCurrency(c.contract_value, c.currency_code)}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(c.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/app/admin/finance/contracts/${c.id}`}
                          className="inline-flex p-2 rounded-lg bg-[#151516] text-[#FFC400] hover:brightness-110 border border-[#FFC400]/10"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-[#151516] flex items-center justify-between text-xs text-[#606060] bg-[#0c0c0d]">
                <span>
                  Hiển thị{" "}
                  <span className="text-[#FFF8E6]">{contracts.length}</span>/
                  <span className="text-[#FFF8E6]">{total}</span> hợp đồng
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="p-1.5 rounded-lg bg-[#151516] border border-[#1f1f22] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-[#FFF8E6]">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="p-1.5 rounded-lg bg-[#151516] border border-[#1f1f22] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Contract Modal Dialog */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0E0E0F] border border-[#151516] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#151516] flex items-center justify-between bg-[#0c0c0d]">
              <h3 className="text-lg font-bold text-white">Tạo hợp đồng mới</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-[#606060] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateContract}
              className="p-6 overflow-y-auto space-y-4 flex-1"
            >
              {formError && (
                <div className="p-3.5 rounded-xl bg-[#FF1744]/10 border border-[#FF1744]/20 text-[#FF1744] text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Mã số hợp đồng *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: HD-2026-001"
                    value={formContractNumber}
                    onChange={(e) => setFormContractNumber(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Tiêu đề hợp đồng *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Hợp đồng triển khai Website"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Khách hàng (Công ty) *
                  </label>
                  <select
                    required
                    value={formClientCompanyId}
                    onChange={(e) => {
                      setFormClientCompanyId(e.target.value);
                      setFormProjectId(""); // Clear project when company changes
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer"
                  >
                    <option value="">Chọn công ty khách hàng</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Dự án liên kết
                  </label>
                  <select
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer"
                    disabled={!formClientCompanyId}
                  >
                    <option value="">
                      Không có dự án liên kết / Dự án chung
                    </option>
                    {filteredProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.projectCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Giá trị hợp đồng *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 50000000"
                    value={formContractValue}
                    onChange={(e) => setFormContractValue(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Loại tiền tệ
                  </label>
                  <select
                    value={formCurrencyCode}
                    onChange={(e) => setFormCurrencyCode(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer"
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Ngày bắt đầu hiệu lực *
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Ngày hết hạn
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                  Ghi chú điều khoản hợp đồng
                </label>
                <textarea
                  rows={4}
                  placeholder="Ghi chú chi tiết điều khoản..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="clientVisible"
                  checked={formClientVisible}
                  onChange={(e) => setFormClientVisible(e.target.checked)}
                  className="w-4 h-4 accent-[#FFC400] cursor-pointer"
                />
                <label
                  htmlFor="clientVisible"
                  className="text-xs font-bold text-[#FFF8E6]/80 cursor-pointer select-none"
                >
                  Cho phép khách hàng nhìn thấy hợp đồng này trên cổng thông tin
                </label>
              </div>

              <div className="border-t border-[#151516] pt-4 flex items-center justify-end gap-3 bg-[#0E0E0F]">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl bg-[#151516] text-[#606060] hover:text-white transition-colors cursor-pointer text-xs font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#FFC400] text-black hover:brightness-110 font-bold transition-all disabled:opacity-40 cursor-pointer text-xs flex items-center gap-2"
                >
                  {submitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Lưu hợp đồng</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
