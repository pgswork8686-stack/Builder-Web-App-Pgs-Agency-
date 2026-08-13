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
  Edit2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { financeApi, Contract } from "@/lib/api/finance";

interface ContractsWorkspaceProps {
  roleBasePath: string;
}

export default function ContractsWorkspace({ roleBasePath }: ContractsWorkspaceProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // Metadata dropdowns
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  // Modal form states
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const [formContractNumber, setFormContractNumber] = useState("");
  const [formClientCompanyId, setFormClientCompanyId] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formContractValue, setFormContractValue] = useState("");
  const [formCurrencyCode, setFormCurrencyCode] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formClientVisible, setFormClientVisible] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Search debounce handler
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset page on query change
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterClient]);

  const loadMetadata = async () => {
    try {
      const clientsRes = await financeApi.getMetaClients({ page: 1, pageSize: 100 });
      setClients(clientsRes.items || []);

      const projectsRes = await financeApi.getMetaProjects({ page: 1, pageSize: 100 });
      setProjects(projectsRes.items || []);
    } catch (err) {
      console.error("Lỗi lấy siêu dữ liệu hợp đồng:", err);
    }
  };

  const loadContracts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await financeApi.getContracts({
        page,
        pageSize,
        query: debouncedSearch || undefined,
        status: filterStatus || undefined,
        clientCompanyId: filterClient || undefined,
      });
      setContracts(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error("Lỗi tải danh sách hợp đồng:", err);
      setError("Không thể tải danh sách hợp đồng. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadContracts();
  }, [page, debouncedSearch, filterStatus, filterClient]);

  const openCreateModal = () => {
    setEditingContract(null);
    setFormContractNumber("");
    setFormClientCompanyId("");
    setFormProjectId("");
    setFormTitle("");
    setFormStartDate("");
    setFormEndDate("");
    setFormContractValue("");
    setFormCurrencyCode("");
    setFormNotes("");
    setFormClientVisible(false);
    setFormError(null);
    setShowForm(true);
  };

  const openEditModal = (c: Contract) => {
    setEditingContract(c);
    setFormContractNumber(c.contract_number);
    setFormClientCompanyId(c.client_company_id);
    setFormProjectId(c.project_id || "");
    setFormTitle(c.title);
    setFormStartDate(c.start_date);
    setFormEndDate(c.end_date || "");
    setFormContractValue(c.contract_value.toString());
    setFormCurrencyCode(c.currency_code);
    setFormNotes(c.notes || "");
    setFormClientVisible(c.client_visible);
    setFormError(null);
    setShowForm(true);
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (editingContract) {
      // Edit mode
      if (editingContract.status === "draft") {
        if (
          !formContractNumber.trim() ||
          !formClientCompanyId ||
          !formTitle.trim() ||
          !formStartDate ||
          !formContractValue ||
          !formCurrencyCode
        ) {
          setFormError("Vui lòng nhập đầy đủ các thông tin bắt buộc.");
          return;
        }
        if (formEndDate && formEndDate < formStartDate) {
          setFormError("Ngày kết thúc không thể nhỏ hơn ngày bắt đầu.");
          return;
        }
      }
    } else {
      // Create mode
      if (
        !formContractNumber.trim() ||
        !formClientCompanyId ||
        !formTitle.trim() ||
        !formStartDate ||
        !formContractValue ||
        !formCurrencyCode
      ) {
        setFormError("Vui lòng nhập đầy đủ các thông tin bắt buộc.");
        return;
      }
      if (formEndDate && formEndDate < formStartDate) {
        setFormError("Ngày kết thúc không thể nhỏ hơn ngày bắt đầu.");
        return;
      }
    }

    try {
      setSubmitting(true);
      if (editingContract) {
        // Build payload based on status permissions
        const payload: any = {
          notes: formNotes || null,
          clientVisible: formClientVisible,
        };

        if (editingContract.status === "draft") {
          payload.contractNumber = formContractNumber.trim();
          payload.clientCompanyId = formClientCompanyId;
          payload.projectId = formProjectId || null;
          payload.title = formTitle.trim();
          payload.startDate = formStartDate;
          payload.endDate = formEndDate || null;
          payload.contractValue = parseFloat(formContractValue);
          payload.currencyCode = formCurrencyCode;
        }

        await financeApi.updateContract(editingContract.id, payload);
      } else {
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
      }

      setShowForm(false);
      loadContracts();
    } catch (err: any) {
      setFormError(err.message || "Không thể lưu hợp đồng.");
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
        return <span className="px-2 py-0.5 rounded bg-[#151516] text-[#FFC400] text-[10px] font-bold">Nháp</span>;
      case "active":
        return <span className="px-2 py-0.5 rounded bg-[#00E676]/10 text-[#00E676] text-[10px] font-bold">Đang hiệu lực</span>;
      case "completed":
        return <span className="px-2 py-0.5 rounded bg-[#00E5FF]/10 text-[#00E5FF] text-[10px] font-bold">Hoàn thành</span>;
      case "cancelled":
        return <span className="px-2 py-0.5 rounded bg-[#FF1744]/10 text-[#FF1744] text-[10px] font-bold">Đã hủy</span>;
      default:
        return null;
    }
  };

  const filteredProjects = projects.filter((p) => p.client_company_id === formClientCompanyId);

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-[#151516] bg-[#0E0E0F]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href={`${roleBasePath}/finance`}
            className="p-2 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="font-bold text-base tracking-wide text-white">
            Tài chính <span className="text-[#FFC400] font-normal">| Hợp đồng</span>
          </span>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFC400] text-black font-bold text-sm hover:brightness-110 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo hợp đồng</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row items-center gap-4 bg-[#0E0E0F] p-4 rounded-2xl border border-[#151516]">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#606060]" />
            <input
              type="text"
              placeholder="Tìm kiếm theo số hợp đồng hoặc tiêu đề..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
            <div className="flex items-center gap-2 bg-[#151516] px-3 py-2 rounded-xl border border-[#1f1f22] w-full sm:w-auto">
              <Filter className="w-4 h-4 text-[#606060]" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent border-none text-[#FFF8E6] text-xs focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[#0e0e0f]">Trạng thái</option>
                <option value="draft" className="bg-[#0e0e0f]">Nháp</option>
                <option value="active" className="bg-[#0e0e0f]">Đang hiệu lực</option>
                <option value="completed" className="bg-[#0e0e0f]">Hoàn thành</option>
                <option value="cancelled" className="bg-[#0e0e0f]">Đã hủy</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-[#151516] px-3 py-2 rounded-xl border border-[#1f1f22] w-full sm:w-auto">
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="bg-transparent border-none text-[#FFF8E6] text-xs focus:outline-none cursor-pointer max-w-[200px]"
              >
                <option value="" className="bg-[#0e0e0f]">Khách hàng</option>
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
        ) : error ? (
          <div className="text-center p-12 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
            <AlertTriangle className="w-12 h-12 text-[#FF1744] mx-auto" />
            <p className="text-sm text-[#606060]">{error}</p>
            <button
              onClick={loadContracts}
              className="px-4 py-2 rounded-xl bg-[#151516] border border-[#FFC400]/25 text-[#FFC400] hover:bg-[#FFC400]/10 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center p-12 rounded-2xl bg-[#0E0E0F] border border-[#151516] text-[#606060] space-y-3">
            <FileText className="w-12 h-12 text-[#151516] mx-auto" />
            <p className="text-sm">Chưa có hợp đồng nào được tìm thấy.</p>
          </div>
        ) : (
          <div className="bg-[#0E0E0F] border border-[#151516] rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#151516] text-[#606060] text-xs font-semibold uppercase tracking-wider bg-[#0c0c0d]">
                    <th className="px-6 py-4">Mã số</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Tiêu đề</th>
                    <th className="px-6 py-4">Hiệu lực</th>
                    <th className="px-6 py-4">Đơn giá trị</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151516] text-sm text-[#FFF8E6]/80">
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-[#151516]/40 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-white">{c.contract_number}</td>
                      <td className="px-6 py-4">{c.client_company?.name || "—"}</td>
                      <td className="px-6 py-4 truncate max-w-[200px]">{c.title}</td>
                      <td className="px-6 py-4 font-mono text-xs">{c.start_date}</td>
                      <td className="px-6 py-4 font-extrabold text-white">
                        {formatCurrency(c.contract_value, c.currency_code)}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(c.status)}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        {c.status === "draft" && (
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-lg bg-[#151516] text-[#FFC400] hover:brightness-110 border border-[#FFC400]/10 cursor-pointer"
                            title="Sửa hợp đồng"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Link
                          href={`${roleBasePath}/finance/contracts/${c.id}`}
                          className="p-1.5 rounded-lg bg-[#151516] text-[#FFC400] hover:brightness-110 border border-[#FFC400]/10"
                        >
                          <Eye className="w-3.5 h-3.5" />
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
                  Hiển thị <span className="text-[#FFF8E6]">{contracts.length}</span>/
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

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0E0E0F] border border-[#151516] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#151516] flex items-center justify-between bg-[#0c0c0d]">
              <h3 className="text-lg font-bold text-white">
                {editingContract ? `Sửa hợp đồng: ${editingContract.contract_number}` : "Tạo hợp đồng mới"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-[#606060] hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3.5 rounded-xl bg-[#FF1744]/10 border border-[#FF1744]/20 text-[#FF1744] text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Warn if editing active/immutable contract */}
              {editingContract && editingContract.status !== "draft" && (
                <div className="p-3.5 rounded-xl bg-[#FFC400]/10 border border-[#FFC400]/25 text-[#FFC400] text-xs">
                  Hợp đồng này đã kích hoạt. Bạn chỉ có thể sửa đổi Ghi chú và Chế độ hiển thị khách hàng.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">Mã số hợp đồng *</label>
                  <input
                    type="text"
                    required
                    disabled={editingContract ? editingContract.status !== "draft" : false}
                    placeholder="VD: HD-2026-001"
                    value={formContractNumber}
                    onChange={(e) => setFormContractNumber(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">Khách hàng (Công ty) *</label>
                  <select
                    required
                    disabled={editingContract ? editingContract.status !== "draft" : false}
                    value={formClientCompanyId}
                    onChange={(e) => {
                      setFormClientCompanyId(e.target.value);
                      setFormProjectId("");
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer disabled:opacity-50"
                  >
                    <option value="">Chọn công ty khách hàng</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">Tiêu đề hợp đồng *</label>
                <input
                  type="text"
                  required
                  disabled={editingContract ? editingContract.status !== "draft" : false}
                  placeholder="VD: Hợp đồng cung cấp nhân sự Phase 6"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">Dự án liên kết</label>
                  <select
                    disabled={editingContract ? editingContract.status !== "draft" : false}
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer disabled:opacity-50"
                  >
                    <option value="">Chọn dự án (Không bắt buộc)</option>
                    {filteredProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">Giá trị hợp đồng *</label>
                    <input
                      type="number"
                      required
                      disabled={editingContract ? editingContract.status !== "draft" : false}
                      placeholder="VD: 50000000"
                      value={formContractValue}
                      onChange={(e) => setFormContractValue(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">Tiền tệ *</label>
                    <select
                      required
                      disabled={editingContract ? editingContract.status !== "draft" : false}
                      value={formCurrencyCode}
                      onChange={(e) => setFormCurrencyCode(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer disabled:opacity-50"
                    >
                      <option value="">Chọn</option>
                      <option value="VND">VND</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">Ngày bắt đầu hiệu lực *</label>
                  <input
                    type="date"
                    required
                    disabled={editingContract ? editingContract.status !== "draft" : false}
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">Ngày kết thúc hiệu lực</label>
                  <input
                    type="date"
                    disabled={editingContract ? editingContract.status !== "draft" : false}
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">Điều khoản & Ghi chú</label>
                <textarea
                  rows={3}
                  placeholder="Nhập ghi chú hoặc điều khoản chính..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="formClientVisible"
                  checked={formClientVisible}
                  onChange={(e) => setFormClientVisible(e.target.checked)}
                  className="w-4 h-4 accent-[#FFC400] cursor-pointer"
                />
                <label htmlFor="formClientVisible" className="text-xs font-bold text-[#FFF8E6]/80 cursor-pointer select-none">
                  Cho phép khách hàng nhìn thấy hợp đồng này trên cổng thông tin
                </label>
              </div>

              <div className="border-t border-[#151516] pt-4 flex items-center justify-end gap-3 bg-[#0E0E0F]">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl bg-[#151516] text-[#606060] hover:text-white transition-colors cursor-pointer text-xs font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#FFC400] text-black hover:brightness-110 font-bold transition-all disabled:opacity-40 cursor-pointer text-xs flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingContract ? "Cập nhật hợp đồng" : "Lưu hợp đồng"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
