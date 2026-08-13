"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  Calendar,
} from "lucide-react";
import { financeApi, Invoice, Contract } from "@/lib/api/finance";
import { clientsApi } from "@/lib/api/clients";
import { projectsApi, Project } from "@/lib/api/projects";

function InvoicesPageContent() {
  const searchParams = useSearchParams();
  const initContractId = searchParams.get("contractId") || "";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterContract, setFilterContract] = useState(initContractId);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // Metadata dropdowns
  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Modal form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [formInvoiceNumber, setFormInvoiceNumber] = useState("");
  const [formClientCompanyId, setFormClientCompanyId] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formContractId, setFormContractId] = useState("");
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrencyCode, setFormCurrencyCode] = useState("VND");
  const [formNotes, setFormNotes] = useState("");
  const [formClientVisible, setFormClientVisible] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadMetadata = async () => {
    try {
      const clientsRes = await clientsApi.getClientCompanies({ pageSize: 100 });
      setClients(clientsRes.items || []);

      const contractsRes = await financeApi.getContracts({ pageSize: 500 });
      setContracts(contractsRes.items || []);

      const projectsRes = await projectsApi.getAdminProjects({ pageSize: 200 });
      setProjects(projectsRes.items || []);
    } catch (err) {
      console.error("Lỗi lấy siêu dữ liệu hóa đơn:", err);
    }
  };

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const res = await financeApi.getInvoices({
        page,
        pageSize,
        query: searchQuery || undefined,
        status: filterStatus || undefined,
        clientCompanyId: filterClient || undefined,
        contractId: filterContract || undefined,
      });
      setInvoices(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error("Lỗi tải danh sách hóa đơn:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [page, searchQuery, filterStatus, filterClient, filterContract]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (
      !formInvoiceNumber.trim() ||
      !formClientCompanyId ||
      !formIssueDate ||
      !formDueDate ||
      !formAmount
    ) {
      setFormError("Vui lòng nhập đầy đủ các thông tin bắt buộc.");
      return;
    }

    // Auto check if selected contract has conflicting currency
    if (formContractId) {
      const selectedContract = contracts.find((c) => c.id === formContractId);
      if (
        selectedContract &&
        selectedContract.currency_code !== formCurrencyCode
      ) {
        setFormError(
          `Tiền tệ không hợp lệ. Hợp đồng đã chọn sử dụng đơn vị ${selectedContract.currency_code}.`,
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      await financeApi.createInvoice({
        invoiceNumber: formInvoiceNumber.trim(),
        clientCompanyId: formClientCompanyId,
        projectId: formProjectId || null,
        contractId: formContractId || null,
        issueDate: formIssueDate,
        dueDate: formDueDate,
        amount: parseFloat(formAmount),
        currencyCode: formCurrencyCode,
        notes: formNotes || null,
        clientVisible: formClientVisible,
      });

      // Clear form
      setFormInvoiceNumber("");
      setFormClientCompanyId("");
      setFormProjectId("");
      setFormContractId("");
      setFormIssueDate("");
      setFormDueDate("");
      setFormAmount("");
      setFormCurrencyCode("VND");
      setFormNotes("");
      setFormClientVisible(false);
      setShowAddForm(false);

      // Reload
      loadInvoices();
    } catch (err: any) {
      setFormError(err.message || "Tạo hóa đơn thất bại.");
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

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue =
      (status === "issued" || status === "partially_paid") &&
      new Date(dueDate) < new Date();

    if (status === "overdue" || isOverdue) {
      return (
        <span className="px-2 py-1 rounded-full bg-[#FF1744]/10 border border-[#FF1744]/20 text-[#FF1744] text-[10px] font-bold">
          Quá hạn
        </span>
      );
    }

    switch (status) {
      case "draft":
        return (
          <span className="px-2 py-1 rounded-full bg-[#151516] border border-[#FFC400]/20 text-[#FFC400] text-[10px] font-bold">
            Nháp
          </span>
        );
      case "issued":
        return (
          <span className="px-2 py-1 rounded-full bg-[#FFC400]/10 border border-[#FFC400]/20 text-[#FFC400] text-[10px] font-bold">
            Đã phát hành
          </span>
        );
      case "partially_paid":
        return (
          <span className="px-2 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/20 text-[#00E5FF] text-[10px] font-bold">
            Thanh toán một phần
          </span>
        );
      case "paid":
        return (
          <span className="px-2 py-1 rounded-full bg-[#00E676]/10 border border-[#00E676]/20 text-[#00E676] text-[10px] font-bold">
            Đã thanh toán
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

  // Filter projects & contracts based on selected client company
  const filteredProjects = projects.filter(
    (p) => p.clientCompanyId === formClientCompanyId,
  );
  const filteredContracts = contracts.filter(
    (c) =>
      c.client_company_id === formClientCompanyId && c.status !== "cancelled",
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
            <span className="text-[#FFC400] font-normal">| Hóa đơn</span>
          </span>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFC400] text-black font-bold text-sm hover:brightness-110 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo hóa đơn</span>
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
              placeholder="Tìm kiếm theo mã số hóa đơn..."
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
                <option value="" className="bg-[#0e0e0f]">
                  Trạng thái
                </option>
                <option value="draft" className="bg-[#0e0e0f]">
                  Nháp
                </option>
                <option value="issued" className="bg-[#0e0e0f]">
                  Đã phát hành
                </option>
                <option value="partially_paid" className="bg-[#0e0e0f]">
                  Thanh toán một phần
                </option>
                <option value="paid" className="bg-[#0e0e0f]">
                  Đã thanh toán
                </option>
                <option value="overdue" className="bg-[#0e0e0f]">
                  Quá hạn
                </option>
                <option value="cancelled" className="bg-[#0e0e0f]">
                  Đã hủy
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-[#151516] px-3 py-2 rounded-xl border border-[#1f1f22] w-full sm:w-auto">
              <select
                value={filterClient}
                onChange={(e) => {
                  setFilterClient(e.target.value);
                  setFilterContract(""); // Reset contract
                }}
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

            <div className="flex items-center gap-2 bg-[#151516] px-3 py-2 rounded-xl border border-[#1f1f22] w-full sm:w-auto">
              <select
                value={filterContract}
                onChange={(e) => setFilterContract(e.target.value)}
                className="bg-transparent border-none text-[#FFF8E6] text-xs focus:outline-none cursor-pointer max-w-[150px]"
              >
                <option value="" className="bg-[#0e0e0f]">
                  Hợp đồng
                </option>
                {contracts
                  .filter(
                    (c) =>
                      !filterClient || c.client_company_id === filterClient,
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0e0e0f]">
                      {c.contract_number}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        {loading ? (
          <div className="flex items-center justify-center p-12 bg-[#0E0E0F] border border-[#151516] rounded-2xl">
            <Loader2 className="w-6 h-6 text-[#FFC400] animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center p-12 rounded-2xl bg-[#0E0E0F] border border-[#151516] text-[#606060] space-y-3">
            <FileText className="w-12 h-12 text-[#151516] mx-auto" />
            <p className="text-sm">Chưa có hóa đơn nào được tìm thấy.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 rounded-xl bg-[#151516] border border-[#FFC400]/20 text-[#FFC400] hover:bg-[#FFC400]/10 text-xs font-bold transition-all cursor-pointer"
            >
              Tạo hóa đơn đầu tiên
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
                    <th className="px-6 py-4">Hạn thanh toán</th>
                    <th className="px-6 py-4">Tổng tiền</th>
                    <th className="px-6 py-4">Đã trả</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151516] text-sm text-[#FFF8E6]/80">
                  {invoices.map((i) => (
                    <tr
                      key={i.id}
                      className="hover:bg-[#151516]/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-white">
                        {i.invoice_number}
                      </td>
                      <td className="px-6 py-4">
                        {i.client_company?.name || "—"}
                      </td>
                      <td className="px-6 py-4 font-mono">{i.due_date}</td>
                      <td className="px-6 py-4 font-extrabold text-white">
                        {formatCurrency(i.amount, i.currency_code)}
                      </td>
                      <td className="px-6 py-4 font-extrabold text-[#00E676]">
                        {formatCurrency(i.paid_amount, i.currency_code)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(i.status, i.due_date)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/app/admin/finance/invoices/${i.id}`}
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
                  <span className="text-[#FFF8E6]">{invoices.length}</span>/
                  <span className="text-[#FFF8E6]">{total}</span> hóa đơn
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

      {/* Add Invoice Modal Dialog */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0E0E0F] border border-[#151516] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#151516] flex items-center justify-between bg-[#0c0c0d]">
              <h3 className="text-lg font-bold text-white">Tạo hóa đơn mới</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-[#606060] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateInvoice}
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
                    Mã số hóa đơn *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: INV-2026-001"
                    value={formInvoiceNumber}
                    onChange={(e) => setFormInvoiceNumber(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Khách hàng (Công ty) *
                  </label>
                  <select
                    required
                    value={formClientCompanyId}
                    onChange={(e) => {
                      setFormClientCompanyId(e.target.value);
                      setFormProjectId(""); // Reset child dropdowns
                      setFormContractId("");
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Hợp đồng liên kết
                  </label>
                  <select
                    value={formContractId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setFormContractId(cid);
                      // Auto align project and currency with the contract
                      const contract = contracts.find((c) => c.id === cid);
                      if (contract) {
                        if (contract.project_id)
                          setFormProjectId(contract.project_id);
                        setFormCurrencyCode(contract.currency_code);
                      }
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer"
                    disabled={!formClientCompanyId}
                  >
                    <option value="">Không liên kết hợp đồng</option>
                    {filteredContracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.contract_number} — {c.title}
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
                    <option value="">Không liên kết dự án</option>
                    {filteredProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Số tiền hóa đơn *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 15000000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
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
                    Ngày phát hành *
                  </label>
                  <input
                    type="date"
                    required
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                    Hạn thanh toán *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#151516] border border-[#1f1f22] text-[#FFF8E6] text-sm focus:outline-none focus:border-[#FFC400]/40 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#606060] uppercase mb-1.5">
                  Ghi chú hóa đơn
                </label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú thêm thông tin thanh toán..."
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
                  Cho phép khách hàng nhìn thấy hóa đơn này trên cổng thông tin
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
                  <span>Lưu hóa đơn</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminInvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070707] text-[#FFF8E6] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#FFC400] animate-spin" />
          <span className="text-sm text-[#606060]">Đang tải dữ liệu hóa đơn...</span>
        </div>
      }
    >
      <InvoicesPageContent />
    </Suspense>
  );
}
