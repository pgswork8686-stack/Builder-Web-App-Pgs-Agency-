"use client";

import React, { useEffect, useState } from "react";
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
  Edit2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { financeApi, Invoice } from "@/lib/api/finance";
import { isInvoiceOverdue } from "@/lib/finance-date";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

interface InvoicesWorkspaceProps {
  roleBasePath: string;
}

export default function InvoicesWorkspace({
  roleBasePath,
}: InvoicesWorkspaceProps) {
  const searchParams = useSearchParams();
  const initContractId = searchParams.get("contractId") || "";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterContract, setFilterContract] = useState(initContractId);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // Metadata dropdowns
  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  // Modal form states
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const [formInvoiceNumber, setFormInvoiceNumber] = useState("");
  const [formClientCompanyId, setFormClientCompanyId] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formContractId, setFormContractId] = useState("");
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
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
  }, [filterStatus, filterClient, filterContract]);

  const loadMetadata = async () => {
    try {
      const clientsRes = await financeApi.getMetaClients({
        page: 1,
        pageSize: 100,
      });
      setClients(clientsRes.items || []);

      const contractsRes = await financeApi.getMetaContracts({
        page: 1,
        pageSize: 100,
      });
      setContracts(contractsRes.items || []);

      const projectsRes = await financeApi.getMetaProjects({
        page: 1,
        pageSize: 100,
      });
      setProjects(projectsRes.items || []);
    } catch (err) {
      console.error("Lỗi lấy siêu dữ liệu hóa đơn:", err);
    }
  };

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await financeApi.getInvoices({
        page,
        pageSize,
        query: debouncedSearch || undefined,
        status: filterStatus || undefined,
        clientCompanyId: filterClient || undefined,
        contractId: filterContract || undefined,
      });
      setInvoices(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error("Lỗi tải danh sách hóa đơn:", err);
      setError("Không thể tải danh sách hóa đơn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [page, debouncedSearch, filterStatus, filterClient, filterContract]);

  const openCreateModal = () => {
    setEditingInvoice(null);
    setFormInvoiceNumber("");
    setFormClientCompanyId("");
    setFormProjectId("");
    setFormContractId("");
    setFormIssueDate("");
    setFormDueDate("");
    setFormAmount("");
    setFormCurrencyCode("");
    setFormNotes("");
    setFormClientVisible(false);
    setFormError(null);
    setShowForm(true);
  };

  const openEditModal = (inv: Invoice) => {
    setEditingInvoice(inv);
    setFormInvoiceNumber(inv.invoice_number);
    setFormClientCompanyId(inv.client_company_id);
    setFormProjectId(inv.project_id || "");
    setFormContractId(inv.contract_id || "");
    setFormIssueDate(inv.issue_date);
    setFormDueDate(inv.due_date);
    setFormAmount(inv.amount.toString());
    setFormCurrencyCode(inv.currency_code);
    setFormNotes(inv.notes || "");
    setFormClientVisible(inv.client_visible);
    setFormError(null);
    setShowForm(true);
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (editingInvoice) {
      // Edit mode
      if (editingInvoice.status === "draft") {
        if (
          !formInvoiceNumber.trim() ||
          !formClientCompanyId ||
          !formIssueDate ||
          !formDueDate ||
          !formAmount ||
          !formCurrencyCode
        ) {
          setFormError("Vui lòng điền đầy đủ các trường thông tin bắt buộc.");
          return;
        }
        if (formDueDate < formIssueDate) {
          setFormError("Hạn thanh toán không thể nhỏ hơn ngày phát hành.");
          return;
        }
      }
    } else {
      // Create mode
      if (
        !formInvoiceNumber.trim() ||
        !formClientCompanyId ||
        !formIssueDate ||
        !formDueDate ||
        !formAmount ||
        !formCurrencyCode
      ) {
        setFormError("Vui lòng điền đầy đủ các trường thông tin bắt buộc.");
        return;
      }
      if (formDueDate < formIssueDate) {
        setFormError("Hạn thanh toán không thể nhỏ hơn ngày phát hành.");
        return;
      }
    }

    try {
      setSubmitting(true);
      if (editingInvoice) {
        // Build payload based on status permissions
        const payload: any = {
          notes: formNotes || null,
          clientVisible: formClientVisible,
        };

        if (editingInvoice.status === "draft") {
          payload.invoiceNumber = formInvoiceNumber.trim();
          payload.clientCompanyId = formClientCompanyId;
          payload.projectId = formProjectId || null;
          payload.contractId = formContractId || null;
          payload.issueDate = formIssueDate;
          payload.dueDate = formDueDate;
          payload.amount = parseFloat(formAmount);
          payload.currencyCode = formCurrencyCode;
        }

        await financeApi.updateInvoice(editingInvoice.id, payload);
      } else {
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
      }

      setShowForm(false);
      loadInvoices();
    } catch (err: any) {
      setFormError(err.message || "Không thể lưu hóa đơn.");
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
    if (isInvoiceOverdue(status, dueDate)) {
      return (
        <span className="px-2 py-0.5 rounded bg-[#FF1744]/10 text-[#FF1744] text-[10px] font-bold">
          {status === "partially_paid"
            ? "Quá hạn · Thanh toán một phần"
            : "Quá hạn"}
        </span>
      );
    }

    switch (status) {
      case "draft":
        return (
          <Badge variant="gold" size="sm">
            Nháp
          </Badge>
        );
      case "issued":
        return (
          <Badge variant="blue" size="sm">
            Đã phát hành
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge variant="warning" size="sm">
            Thanh toán một phần
          </Badge>
        );
      case "paid":
        return (
          <Badge variant="success" size="sm">
            Đã thanh toán
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="default" size="sm">
            Đã hủy
          </Badge>
        );
      default:
        return null;
    }
  };

  const filteredContracts = contracts.filter(
    (c) => c.client_company_id === formClientCompanyId,
  );
  const filteredProjects = projects.filter(
    (p) => p.client_company_id === formClientCompanyId,
  );

  return (
    <div className="space-y-6">
      {/* Top Header matching Figma: Hóa đơn và công nợ.png */}
      <SectionHeader
        title="Tài chính dự án"
        description="Quản lý hợp đồng, hóa đơn, thanh toán, chi phí và công nợ."
        badge={`${total} Hóa đơn`}
        action={
          <div className="flex items-center gap-3">
            <Link href={`${roleBasePath}/finance`}>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Quay lại
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Tạo hóa đơn
            </Button>
          </div>
        }
      />

      {/* 4 Pastel Metric Cards from Hóa đơn và công nợ.png */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          variant="green"
          title="Doanh thu"
          value="842M"
          subtitle="Tháng này"
        />
        <StatCard
          variant="blue"
          title="Phải thu"
          value="216M"
          subtitle="9 khoản"
        />
        <StatCard
          variant="rose"
          title="Quá hạn"
          value="78M"
          subtitle="3 hóa đơn"
        />
        <StatCard
          variant="gold"
          title="Chi phí"
          value="327M"
          subtitle="Tháng này"
        />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-[#EDF2F7] shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Tìm kiếm theo số hóa đơn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto shrink-0">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs px-3 py-2 rounded-xl outline-none focus:bg-white focus:border-[#4F75FF]"
          >
            <option value="">-- Mọi trạng thái --</option>
            <option value="draft">Nháp</option>
            <option value="issued">Đã phát hành</option>
            <option value="partially_paid">Thanh toán một phần</option>
            <option value="paid">Đã thanh toán</option>
            <option value="overdue">Quá hạn</option>
            <option value="cancelled">Đã hủy</option>
          </select>

          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs px-3 py-2 rounded-xl outline-none focus:bg-white focus:border-[#4F75FF] max-w-[200px]"
          >
            <option value="">-- Mọi khách hàng --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterContract}
            onChange={(e) => setFilterContract(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs px-3 py-2 rounded-xl outline-none focus:bg-white focus:border-[#4F75FF] max-w-[200px]"
          >
            <option value="">-- Mọi hợp đồng --</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contract_number}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Invoices Table Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
          <h3 className="text-base font-extrabold text-[#0F172A]">
            Danh sách hóa đơn ({total})
          </h3>
          <span className="text-xs text-[#64748B]">
            Trang {page} / {totalPages || 1}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center p-8 space-y-3">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
            <p className="text-xs text-[#64748B]">{error}</p>
            <Button variant="secondary" size="sm" onClick={loadInvoices}>
              Thử lại
            </Button>
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8 text-[#4F75FF]" />}
            title="Không tìm thấy hóa đơn"
            description="Chưa có hóa đơn nào phù hợp với bộ lọc tìm kiếm."
            actionLabel="Tạo hóa đơn mới"
            onAction={openCreateModal}
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Hóa đơn</TableHeaderCell>
                  <TableHeaderCell>Khách hàng</TableHeaderCell>
                  <TableHeaderCell>Dự án</TableHeaderCell>
                  <TableHeaderCell>Giá trị</TableHeaderCell>
                  <TableHeaderCell>Hạn thanh toán</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Thao tác
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-bold text-[#4F75FF]">
                      {inv.invoice_number}
                    </TableCell>
                    <TableCell className="font-bold text-[#0F172A]">
                      {inv.client_company?.name || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B] max-w-[180px] truncate">
                      {inv.project?.name || "—"}
                    </TableCell>
                    <TableCell className="font-extrabold text-[#0F172A] text-xs">
                      {formatCurrency(inv.amount, inv.currency_code)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#64748B]">
                      {inv.due_date}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inv.status === "paid"
                            ? "success"
                            : isInvoiceOverdue(inv.status, inv.due_date)
                              ? "danger"
                              : inv.status === "issued"
                                ? "blue"
                                : "gold"
                        }
                        size="sm"
                      >
                        {isInvoiceOverdue(inv.status, inv.due_date)
                          ? "Quá hạn"
                          : inv.status === "paid"
                            ? "Đã thanh toán"
                            : inv.status === "issued"
                              ? "Đã phát hành"
                              : inv.status === "partially_paid"
                                ? "Một phần"
                                : inv.status === "cancelled"
                                  ? "Đã hủy"
                                  : "Nháp"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(inv)}
                            title="Sửa hóa đơn"
                            className="text-[#64748B] hover:text-[#0F172A]"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Link
                          href={`${roleBasePath}/finance/invoices/${inv.id}`}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#4F75FF] hover:bg-[#EEF2FF]"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7] text-xs text-[#64748B]">
            <span>
              Hiển thị{" "}
              <span className="font-bold text-[#0F172A]">
                {invoices.length}
              </span>{" "}
              / {total} hóa đơn
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-bold text-[#0F172A]">
                Trang {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add / Edit Form Modal */}
      {showForm && (
        <Dialog
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          maxWidth="lg"
          title={
            editingInvoice
              ? `Sửa hóa đơn: ${editingInvoice.invoice_number}`
              : "Tạo hóa đơn mới"
          }
          description="Thiết lập hạn thanh toán, đợt thu và số tiền yêu cầu thanh toán."
        >
          <form onSubmit={handleSaveInvoice} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {formError}
              </div>
            )}

            {editingInvoice && editingInvoice.status !== "draft" && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Hóa đơn này đã phát hành. Bạn chỉ có thể sửa đổi Ghi chú và Chế
                độ hiển thị khách hàng.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Số hóa đơn *
                </label>
                <input
                  type="text"
                  required
                  disabled={
                    editingInvoice ? editingInvoice.status !== "draft" : false
                  }
                  placeholder="VD: INV-2026-001"
                  value={formInvoiceNumber}
                  onChange={(e) => setFormInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Khách hàng (Công ty) *
                </label>
                <select
                  required
                  disabled={
                    editingInvoice ? editingInvoice.status !== "draft" : false
                  }
                  value={formClientCompanyId}
                  onChange={(e) => {
                    setFormClientCompanyId(e.target.value);
                    setFormProjectId("");
                    setFormContractId("");
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Hợp đồng liên kết
                </label>
                <select
                  disabled={
                    editingInvoice ? editingInvoice.status !== "draft" : false
                  }
                  value={formContractId}
                  onChange={(e) => setFormContractId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                >
                  <option value="">Chọn hợp đồng (Không bắt buộc)</option>
                  {filteredContracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contract_number} - {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Dự án liên kết
                </label>
                <select
                  disabled={
                    editingInvoice ? editingInvoice.status !== "draft" : false
                  }
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                >
                  <option value="">Chọn dự án (Không bắt buộc)</option>
                  {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Ngày phát hành *
                </label>
                <input
                  type="date"
                  required
                  disabled={
                    editingInvoice ? editingInvoice.status !== "draft" : false
                  }
                  value={formIssueDate}
                  onChange={(e) => setFormIssueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Hạn thanh toán *
                </label>
                <input
                  type="date"
                  required
                  disabled={
                    editingInvoice ? editingInvoice.status !== "draft" : false
                  }
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Tổng số tiền *
                </label>
                <input
                  type="number"
                  required
                  disabled={
                    editingInvoice ? editingInvoice.status !== "draft" : false
                  }
                  placeholder="VD: 10000000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Loại tiền *
                </label>
                <select
                  required
                  disabled={
                    editingInvoice ? editingInvoice.status !== "draft" : false
                  }
                  value={formCurrencyCode}
                  onChange={(e) => setFormCurrencyCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                >
                  <option value="">Chọn</option>
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                Ghi chú hóa đơn
              </label>
              <textarea
                rows={3}
                placeholder="Ghi chú thanh toán, số tài khoản nhận tiền..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="formClientVisible"
                checked={formClientVisible}
                onChange={(e) => setFormClientVisible(e.target.checked)}
                className="w-4 h-4 accent-[#4F75FF] cursor-pointer"
              />
              <label
                htmlFor="formClientVisible"
                className="text-xs text-[#64748B] cursor-pointer select-none"
              >
                Cho phép khách hàng nhìn thấy hóa đơn này trên cổng thông tin
              </label>
            </div>

            <div className="border-t border-[#EDF2F7] pt-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting}
                isLoading={submitting}
              >
                Tạo hóa đơn
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
