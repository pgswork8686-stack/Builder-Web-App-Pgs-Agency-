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

interface ContractsWorkspaceProps {
  roleBasePath: string;
}

export default function ContractsWorkspace({
  roleBasePath,
}: ContractsWorkspaceProps) {
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
      const clientsRes = await financeApi.getMetaClients({
        page: 1,
        pageSize: 100,
      });
      setClients(clientsRes.items || []);

      const projectsRes = await financeApi.getMetaProjects({
        page: 1,
        pageSize: 100,
      });
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
        return (
          <Badge variant="gold" size="sm">
            Nháp
          </Badge>
        );
      case "active":
        return (
          <Badge variant="success" size="sm">
            Đang hiệu lực
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="blue" size="sm">
            Hoàn thành
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="danger" size="sm">
            Đã hủy
          </Badge>
        );
      default:
        return null;
    }
  };

  const filteredProjects = projects.filter(
    (p) => p.client_company_id === formClientCompanyId,
  );

  return (
    <div className="space-y-6">
      {/* Top Header matching Figma: Hợp đồng.png */}
      <SectionHeader
        title="Hợp đồng và phụ lục"
        description="Quản lý vòng đời hợp đồng, đợt thanh toán và liên kết dự án."
        badge={`${total} Hợp đồng`}
        action={
          <div className="flex items-center gap-3">
            <Link href={`${roleBasePath}/finance`}>
              <Button variant="secondary" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
                Quay lại
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Tạo hợp đồng
            </Button>
          </div>
        }
      />

      {/* 4 Pastel Metric Cards from Hợp đồng.png */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          variant="green"
          title="Đang hiệu lực"
          value={total > 0 ? total.toString().padStart(2, "0") : "24"}
          subtitle="Toàn hệ thống"
        />
        <StatCard
          variant="gold"
          title="Sắp hết hạn"
          value="05"
          subtitle="30 ngày tới"
        />
        <StatCard
          variant="blue"
          title="Chờ ký"
          value="03"
          subtitle="Cần xử lý"
        />
        <StatCard
          variant="purple"
          title="Đã thanh lý"
          value="18"
          subtitle="Lưu trữ"
        />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-[#EDF2F7] shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Tìm kiếm theo số hợp đồng hoặc tiêu đề..."
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
            <option value="active">Đang hiệu lực</option>
            <option value="completed">Hoàn thành</option>
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
        </div>
      </div>

      {/* Contracts Table Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
          <h3 className="text-base font-extrabold text-[#0F172A]">
            Danh sách hợp đồng ({total})
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
            <Button variant="secondary" size="sm" onClick={loadContracts}>
              Thử lại
            </Button>
          </div>
        ) : contracts.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8 text-[#4F75FF]" />}
            title="Không tìm thấy hợp đồng"
            description="Chưa có hợp đồng nào phù hợp với bộ lọc tìm kiếm."
            actionLabel="Tạo hợp đồng mới"
            onAction={openCreateModal}
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Hợp đồng</TableHeaderCell>
                  <TableHeaderCell>Khách hàng</TableHeaderCell>
                  <TableHeaderCell>Tiêu đề</TableHeaderCell>
                  <TableHeaderCell>Giá trị</TableHeaderCell>
                  <TableHeaderCell>Hiệu lực</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell className="text-right">Thao tác</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-bold text-[#4F75FF]">
                      {c.contract_number}
                    </TableCell>
                    <TableCell className="font-bold text-[#0F172A]">
                      {c.client_company?.name || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B] max-w-[200px] truncate">
                      {c.title}
                    </TableCell>
                    <TableCell className="font-extrabold text-[#0F172A] text-xs">
                      {formatCurrency(c.contract_value, c.currency_code)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#64748B]">
                      {c.start_date} {c.end_date ? `➔ ${c.end_date}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.status === "active"
                            ? "success"
                            : c.status === "completed"
                              ? "blue"
                              : c.status === "cancelled"
                                ? "danger"
                                : "gold"
                        }
                        size="sm"
                      >
                        {c.status === "active"
                          ? "Đang hiệu lực"
                          : c.status === "completed"
                            ? "Hoàn thành"
                            : c.status === "cancelled"
                              ? "Đã hủy"
                              : "Nháp"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(c)}
                            title="Sửa hợp đồng"
                            className="text-[#64748B] hover:text-[#0F172A]"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Link href={`${roleBasePath}/finance/contracts/${c.id}`}>
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
              Hiển thị <span className="font-bold text-[#0F172A]">{contracts.length}</span> / {total} hợp đồng
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
          title={editingContract ? `Sửa hợp đồng: ${editingContract.contract_number}` : "Tạo hợp đồng mới"}
          description="Thiết lập thông tin pháp lý, đối tác khách hàng và giá trị hợp đồng."
        >
          <form onSubmit={handleSaveContract} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {formError}
              </div>
            )}

            {editingContract && editingContract.status !== "draft" && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Hợp đồng này đã kích hoạt. Bạn chỉ có thể sửa đổi Ghi chú và Chế độ hiển thị khách hàng.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Mã số hợp đồng *
                </label>
                <input
                  type="text"
                  required
                  disabled={editingContract ? editingContract.status !== "draft" : false}
                  placeholder="VD: HD-2026-001"
                  value={formContractNumber}
                  onChange={(e) => setFormContractNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Khách hàng (Công ty) *
                </label>
                <select
                  required
                  disabled={editingContract ? editingContract.status !== "draft" : false}
                  value={formClientCompanyId}
                  onChange={(e) => {
                    setFormClientCompanyId(e.target.value);
                    setFormProjectId("");
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                Tiêu đề hợp đồng *
              </label>
              <input
                type="text"
                required
                disabled={editingContract ? editingContract.status !== "draft" : false}
                placeholder="VD: Hợp đồng cung cấp dịch vụ Digital Marketing"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Dự án liên kết
                </label>
                <select
                  disabled={editingContract ? editingContract.status !== "draft" : false}
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

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                    Giá trị hợp đồng *
                  </label>
                  <input
                    type="number"
                    required
                    disabled={editingContract ? editingContract.status !== "draft" : false}
                    placeholder="VD: 50000000"
                    value={formContractValue}
                    onChange={(e) => setFormContractValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                    Tiền tệ *
                  </label>
                  <select
                    required
                    disabled={editingContract ? editingContract.status !== "draft" : false}
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Ngày bắt đầu hiệu lực *
                </label>
                <input
                  type="date"
                  required
                  disabled={editingContract ? editingContract.status !== "draft" : false}
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Ngày kết thúc hiệu lực
                </label>
                <input
                  type="date"
                  disabled={editingContract ? editingContract.status !== "draft" : false}
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                Điều khoản & Ghi chú
              </label>
              <textarea
                rows={3}
                placeholder="Nhập ghi chú hoặc điều khoản chính..."
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
                Cho phép khách hàng nhìn thấy hợp đồng này trên cổng thông tin
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
                {editingContract ? "Cập nhật hợp đồng" : "Lưu hợp đồng"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
