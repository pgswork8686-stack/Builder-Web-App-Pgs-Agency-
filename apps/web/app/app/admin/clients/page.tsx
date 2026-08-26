"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Edit2,
  Eye,
  Search,
  Building2,
  Mail,
  Phone,
  Globe,
  AlertCircle,
  Trash2,
  MessageCircle,
  Share2,
} from "lucide-react";
import { clientsApi, ClientCompany } from "../../../../lib/api/clients";
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
  const [zalo, setZalo] = useState("");
  const [messenger, setMessenger] = useState("");
  const [facebook, setFacebook] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit states
  const [editingComp, setEditingComp] = useState<ClientCompany | null>(null);
  const [editName, setEditName] = useState("");
  const [editTaxCode, setEditTaxCode] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editZalo, setEditZalo] = useState("");
  const [editMessenger, setEditMessenger] = useState("");
  const [editFacebook, setEditFacebook] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Delete states
  const [deletingComp, setDeletingComp] = useState<ClientCompany | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data: any = await clientsApi.getClientCompanies({
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

    if (name.trim().length < 2) {
      setFormError("Tên khách hàng phải từ 2 ký tự trở lên.");
      return;
    }
    if (code.trim() && !/^[A-Z0-9_-]{2,30}$/i.test(code.trim())) {
      setFormError(
        "Mã khách hàng phải từ 2-30 ký tự (ví dụ: KH_01 hoặc PGS-VNG).",
      );
      return;
    }

    try {
      setSubmitting(true);
      await clientsApi.createClientCompany({
        code: code.trim()
          ? code.trim().toUpperCase()
          : `KH_${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        status: "active",
        taxCode: taxCode.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        zalo: zalo.trim() || null,
        messenger: messenger.trim() || null,
        facebook: facebook.trim() || null,
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
      setZalo("");
      setMessenger("");
      setFacebook("");
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
    setEditName(comp.name || "");
    setEditTaxCode(comp.taxCode || "");
    setEditEmail(comp.email || "");
    setEditPhone(comp.phone || "");
    setEditWebsite(comp.website || "");
    setEditZalo(comp.zalo || "");
    setEditMessenger(comp.messenger || "");
    setEditFacebook(comp.facebook || "");
    setEditAddress(comp.address || "");
    setEditStatus(comp.status || "active");
    setEditNotes(comp.notes || "");
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComp) return;

    if (!editName.trim()) {
      setEditError("Tên khách hàng không được để trống.");
      return;
    }

    try {
      setSubmitting(true);
      setEditError(null);
      await clientsApi.updateClientCompany(editingComp.id, {
        name: editName.trim(),
        taxCode: editTaxCode.trim() || null,
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        website: editWebsite.trim() || null,
        zalo: editZalo.trim() || null,
        messenger: editMessenger.trim() || null,
        facebook: editFacebook.trim() || null,
        address: editAddress.trim() || null,
        status: editStatus,
        notes: editNotes.trim() || null,
      });
      setEditingComp(null);
      fetchClients();
    } catch (err: any) {
      setEditError(err.message || "Không thể cập nhật thông tin khách hàng");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!deletingComp) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await clientsApi.deleteClientCompany(deletingComp.id);
      setDeletingComp(null);
      fetchClients();
    } catch (err: any) {
      setDeleteError(
        err.message || "Không thể ngừng hoạt động khách hàng lúc này.",
      );
    } finally {
      setDeleting(false);
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

  const formatZaloUrl = (val: string) => {
    if (!val) return "";
    if (val.startsWith("http")) return val;
    const cleanPhone = val.replace(/[^0-9]/g, "");
    return `https://zalo.me/${cleanPhone || val}`;
  };

  const formatMessengerUrl = (val: string) => {
    if (!val) return "";
    if (val.startsWith("http")) return val;
    return `https://m.me/${val.replace(/^@/, "")}`;
  };

  const formatFacebookUrl = (val: string) => {
    if (!val) return "";
    if (val.startsWith("http")) return val;
    return `https://facebook.com/${val.replace(/^@/, "")}`;
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <SectionHeader
        title="Quản lý Khách hàng Doanh nghiệp"
        description="Theo dõi danh bạ công ty đối tác, kênh liên lạc (Zalo, Messenger, Facebook) và các dự án hợp tác."
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
            placeholder="Tìm theo tên, mã khách hàng, MST, email, số điện thoại..."
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
                <TableHeaderCell>Mạng xã hội / Kênh chat</TableHeaderCell>
                <TableHeaderCell>Mã số thuế</TableHeaderCell>
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
                          href={comp.website.startsWith("http") ? comp.website : `https://${comp.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#64748B] hover:text-[#4F75FF] flex items-center gap-1 mt-0.5"
                        >
                          <Globe className="w-3 h-3 text-blue-500" />
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

                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {comp.zalo && (
                        <a
                          href={formatZaloUrl(comp.zalo)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold transition-colors"
                          title={`Zalo: ${comp.zalo}`}
                        >
                          <span className="font-bold text-[10px]">Zalo</span>
                        </a>
                      )}
                      {comp.messenger && (
                        <a
                          href={formatMessengerUrl(comp.messenger)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[11px] font-semibold transition-colors"
                          title={`Messenger: ${comp.messenger}`}
                        >
                          <MessageCircle className="w-3 h-3 text-indigo-600" />
                          <span>Mess</span>
                        </a>
                      )}
                      {comp.facebook && (
                        <a
                          href={formatFacebookUrl(comp.facebook)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 text-[11px] font-semibold transition-colors"
                          title={`Facebook: ${comp.facebook}`}
                        >
                          <Share2 className="w-3 h-3 text-sky-600" />
                          <span>FB</span>
                        </a>
                      )}
                      {!comp.zalo && !comp.messenger && !comp.facebook && (
                        <span className="text-xs text-[#94A3B8]">—</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="font-mono text-xs text-[#64748B]">
                    {comp.taxCode || "—"}
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
                    <div className="flex items-center justify-end gap-1.5">
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

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingComp(comp)}
                        title="Xóa khách hàng"
                        className="text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
        description="Điền thông tin pháp nhân và các kênh liên hệ mạng xã hội của đối tác."
      >
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Mã khách hàng (Tùy chọn: KH_XX)"
              placeholder="VD: KH_01 (để trống tự sinh)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              helperText="Định dạng KH_XX hoặc để trống để tự sinh mã"
            />

            <Input
              label="Tên doanh nghiệp *"
              placeholder="VD: Công ty TNHH Giải Pháp ABC"
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
              placeholder="0988xxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Zalo (SĐT hoặc Link)"
              placeholder="0988xxxxxx hoặc zalo.me/..."
              value={zalo}
              onChange={(e) => setZalo(e.target.value)}
            />
            <Input
              label="Messenger (Username/Link)"
              placeholder="m.me/username"
              value={messenger}
              onChange={(e) => setMessenger(e.target.value)}
            />
            <Input
              label="Facebook URL"
              placeholder="https://facebook.com/..."
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
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

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#24304A]">
              Ghi chú đối tác
            </label>
            <textarea
              rows={2}
              className="w-full rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#24304A] text-xs p-3 outline-none focus:bg-white focus:border-[#5D87FF] transition-all"
              placeholder="Ghi chú về khách hàng, yêu cầu đặc thù..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#EDF2F7]">
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
        maxWidth="lg"
        title={`Cập nhật thông tin khách hàng: ${editingComp?.name}`}
        description="Chỉnh sửa chi tiết thông tin pháp nhân và kênh liên hệ mạng xã hội."
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
          {editError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
              {editError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Tên doanh nghiệp *"
                placeholder="Nhập tên doanh nghiệp..."
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#24304A] mb-1.5">
                Trạng thái
              </label>
              <select
                value={editStatus}
                onChange={(e) =>
                  setEditStatus(e.target.value as "active" | "inactive")
                }
                className="w-full rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#24304A] text-xs px-3 py-2.5 outline-none focus:bg-white focus:border-[#5D87FF]"
              >
                <option value="active">Đang hoạt động (Active)</option>
                <option value="inactive">Tạm dừng (Inactive)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Mã số thuế"
              placeholder="0101234567"
              value={editTaxCode}
              onChange={(e) => setEditTaxCode(e.target.value)}
            />
            <Input
              label="Email liên hệ"
              type="email"
              placeholder="contact@company.com"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
            <Input
              label="Số điện thoại"
              placeholder="0988xxxxxx"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Zalo (SĐT hoặc Link)"
              placeholder="0988xxxxxx hoặc zalo.me/..."
              value={editZalo}
              onChange={(e) => setEditZalo(e.target.value)}
            />
            <Input
              label="Messenger (Username/Link)"
              placeholder="m.me/username"
              value={editMessenger}
              onChange={(e) => setEditMessenger(e.target.value)}
            />
            <Input
              label="Facebook URL"
              placeholder="https://facebook.com/..."
              value={editFacebook}
              onChange={(e) => setEditFacebook(e.target.value)}
            />
          </div>

          <Input
            label="Website doanh nghiệp"
            placeholder="https://company.com"
            value={editWebsite}
            onChange={(e) => setEditWebsite(e.target.value)}
          />

          <Input
            label="Địa chỉ trụ sở"
            placeholder="Cập nhật địa chỉ trụ sở..."
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#24304A]">
              Ghi chú đối tác
            </label>
            <textarea
              rows={2}
              className="w-full rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#24304A] text-xs p-3 outline-none focus:bg-white focus:border-[#5D87FF] transition-all"
              placeholder="Ghi chú quan trọng..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#EDF2F7]">
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

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={!!deletingComp}
        onClose={() => setDeletingComp(null)}
        maxWidth="md"
        title="Xác nhận ngừng hoạt động khách hàng"
        description={`Bạn có chắc chắn muốn chuyển khách hàng "${deletingComp?.name}" (${deletingComp?.code}) sang trạng thái ngừng hoạt động?`}
      >
        <div className="space-y-4 pt-2">
          {deleteError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <p className="text-xs text-[#64748B] leading-relaxed">
            Hồ sơ doanh nghiệp, tài khoản liên kết và toàn bộ dự án vẫn được giữ nguyên để bảo toàn lịch sử vận hành.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#EDF2F7]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => setDeletingComp(null)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={deleting}
              onClick={handleDeleteClient}
            >
              Ngừng hoạt động
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
