"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Edit2,
  Edit3,
  Eye,
  Search,
  Building2,
  Mail,
  Phone,
  Globe,
  AlertCircle,
} from "lucide-react";
import { clientsApi } from "../../../../lib/api/clients";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/table";

interface ClientCompany {
  id: string;
  code: string;
  clientCode?: string;
  name: string;
  taxCode: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: "active" | "inactive";
  membersCount: number;
}

export default function AdminClientsPage() {
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit states
  const [editingComp, setEditingComp] = useState<ClientCompany | null>(null);
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientsApi.getClientCompanies({
        q: q || undefined,
        status: (status as any) || undefined,
        page,
        pageSize: 15,
      });
      setCompanies(data.items);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách khách hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [q, status, page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (code.trim().length < 2 || code.trim().length > 30) {
      setFormError("Mã khách hàng phải từ 2 đến 30 ký tự");
      return;
    }
    if (name.trim().length < 2) {
      setFormError("Tên khách hàng phải từ 2 ký tự");
      return;
    }

    try {
      setSubmitting(true);
      await clientsApi.createClientCompany({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        status: "active",
        taxCode: taxCode.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      });

      setShowAddForm(false);
      setCode("");
      setName("");
      setTaxCode("");
      setEmail("");
      setPhone("");
      setWebsite("");
      setAddress("");
      setNotes("");
      fetchClients();
    } catch (err: any) {
      setFormError(err.message || "Không thể tạo khách hàng");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (comp: ClientCompany) => {
    setEditingComp(comp);
    setEditAddress("");
    setEditNotes("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComp) return;

    try {
      setSubmitting(true);
      await clientsApi.updateClientCompany(editingComp.id, {
        address: editAddress.trim() || null,
        notes: editNotes.trim() || null,
      });
      setEditingComp(null);
      fetchClients();
    } catch (err: any) {
      alert(err.message || "Không thể cập nhật");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (comp: ClientCompany) => {
    const newStatus = comp.status === "active" ? "inactive" : "active";
    if (
      !confirm(
        `Bạn có chắc chắn muốn ${newStatus === "active" ? "kích hoạt" : "vô hiệu hóa"} khách hàng "${comp.name}"?`,
      )
    ) {
      return;
    }

    try {
      await clientsApi.updateClientCompany(comp.id, {
        status: newStatus,
      });
      fetchClients();
    } catch (err: any) {
      alert(err.message || "Không thể cập nhật trạng thái");
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <SectionHeader
        title="Quản lý Khách hàng Doanh nghiệp"
        description="Theo dõi danh bạ công ty đối tác, đại diện liên hệ và các dự án hợp tác."
        badge={`${total} Doanh nghiệp`}
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddForm(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Thêm khách hàng
          </Button>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-white border border-[#EDF2F7] shadow-xs">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm theo tên, mã khách hàng, MST, email..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs placeholder-[#94A3B8] outline-none focus:bg-white focus:border-[#4F75FF] transition-colors"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] px-3 py-2.5 outline-none focus:bg-white focus:border-[#4F75FF]"
        >
          <option value="">-- Mọi trạng thái --</option>
          <option value="active">Đang hoạt động (Active)</option>
          <option value="inactive">Tạm dừng (Inactive)</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-8 h-8 text-[#4F75FF]" />}
          title="Không tìm thấy khách hàng"
          description="Chưa có dữ liệu công ty đối tác nào phù hợp."
          actionLabel="Tạo khách hàng mới"
          onAction={() => setShowAddForm(true)}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã KH</TableHeaderCell>
                <TableHeaderCell>Tên Doanh nghiệp</TableHeaderCell>
                <TableHeaderCell>Liên hệ</TableHeaderCell>
                <TableHeaderCell>Mã số thuế</TableHeaderCell>
                <TableHeaderCell>Số đại diện</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  Thao tác
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {companies.map((comp) => (
                <TableRow key={comp.id}>
                  <TableCell className="font-mono text-xs font-bold text-[#5D87FF]">
                    {comp.clientCode || comp.code}
                  </TableCell>

                  <TableCell>
                    <div>
                      <p className="font-bold text-[#0F172A]">{comp.name}</p>
                      {comp.website && (
                        <a
                          href={comp.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#64748B] hover:text-[#4F75FF] flex items-center gap-1 mt-0.5"
                        >
                          <Globe className="w-3 h-3" />
                          <span>
                            {comp.website.replace(/^https?:\/\//, "")}
                          </span>
                        </a>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-[#64748B]">
                    {comp.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-[#94A3B8]" />
                        <span>{comp.email}</span>
                      </div>
                    )}
                    {comp.phone && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-[#94A3B8]" />
                        <span>{comp.phone}</span>
                      </div>
                    )}
                    {!comp.email && !comp.phone && "—"}
                  </TableCell>

                  <TableCell className="font-mono text-xs text-[#64748B]">
                    {comp.taxCode || "—"}
                  </TableCell>

                  <TableCell>
                    <Badge variant="blue" size="sm">
                      {comp.membersCount} đại diện
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <button
                      onClick={() => handleToggleStatus(comp)}
                      className="cursor-pointer"
                      title="Bấm để đổi trạng thái"
                    >
                      <Badge
                        variant={
                          comp.status === "active" ? "success" : "default"
                        }
                        size="sm"
                      >
                        {comp.status === "active" ? "Hoạt động" : "Tạm dừng"}
                      </Badge>
                    </button>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(comp)}
                        title="Chỉnh sửa thông tin"
                        className="text-[#64748B] hover:text-[#0F172A]"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>

                      <Link href={`/app/admin/clients/${comp.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Eye className="w-4 h-4 text-[#FFC400]" />}
                        >
                          Chi tiết
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
        <div className="flex items-center justify-between pt-4 border-t border-[#1C1C1E] text-xs text-[#8E8E93]">
          <span>
            Trang {page} / {totalPages} ({total} khách hàng)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Dialog
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        maxWidth="lg"
        title="Thêm Khách hàng Doanh nghiệp mới"
        description="Điền thông tin pháp nhân để quản trị hợp đồng và dự án hợp tác."
      >
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Mã khách hàng *"
              placeholder="VD: PGS-VNG"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />

            <Input
              label="Tên doanh nghiệp *"
              placeholder="VD: Tập đoàn VNG"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Mã số thuế"
              placeholder="0101234567"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
            />
            <Input
              label="Email liên hệ"
              type="email"
              placeholder="contact@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Số điện thoại"
              placeholder="028 3822 xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <Input
            label="Website doanh nghiệp"
            placeholder="https://company.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />

          <Input
            label="Địa chỉ trụ sở"
            placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-[#1C1C1E]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitting}
            >
              Tạo khách hàng
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Modal */}
      <Dialog
        isOpen={!!editingComp}
        onClose={() => setEditingComp(null)}
        maxWidth="sm"
        title={`Cập nhật thông tin: ${editingComp?.name}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
          <Input
            label="Địa chỉ mới"
            placeholder="Cập nhật địa chỉ..."
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
          />

          <Input
            label="Ghi chú đối tác"
            placeholder="Ghi chú quan trọng..."
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-[#1C1C1E]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditingComp(null)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitting}
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
