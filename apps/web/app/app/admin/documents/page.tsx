"use client";

import React, { useEffect, useState } from "react";
import {
  FolderOpen,
  FileText,
  Upload,
  Search,
  Download,
  Trash2,
  RefreshCw,
  Eye,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
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
import {
  fetchDocuments,
  createDocumentUploadSession,
  finalizeDocument,
  getDocumentDownloadUrl,
  deleteDocument,
  CompanyDocument,
} from "@/lib/api/documents";
import { organizationApi, type Department } from "@/lib/api/organization";

const CATEGORY_MAP: Record<string, string> = {
  policy_procedure: "Quy trình & Chính sách",
  contract_template: "Hợp đồng mẫu",
  marketing_asset: "Tài nguyên Marketing",
  brand_guidelines: "Bộ nhận diện thương hiệu",
  financial_report: "Báo cáo tài chính",
  general: "Tài liệu chung",
};

const ACCESS_MAP: Record<
  string,
  { label: string; variant: "success" | "blue" | "gold" }
> = {
  public_company: { label: "Toàn công ty & Khách", variant: "success" },
  internal_only: { label: "Nội bộ PGS", variant: "blue" },
  management_only: { label: "Cấp quản lý", variant: "gold" },
};

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [uploadDept, setUploadDept] = useState("");

  // Modal Upload
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [uploadAccess, setUploadAccess] = useState("public_company");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchDocuments({ pageSize: 200 });
      setDocuments(res.items);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    organizationApi.getDepartments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const q = searchTerm.trim().toLowerCase();
  const visible = documents.filter(
    (d) =>
      (!selectedCategory || d.category === selectedCategory) &&
      (!selectedDept || d.department_id === selectedDept) &&
      (!q || `${d.title} ${d.document_code ?? ""}`.toLowerCase().includes(q)),
  );
  const countByDept = (id: string) => documents.filter((d) => d.department_id === id).length;
  const deptLabel = (d: CompanyDocument) => d.department?.name || d.department_code || "Toàn công ty";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !selectedFile) return;

    try {
      setUploading(true);
      const session = await createDocumentUploadSession({
        title: uploadTitle.trim(),
        description: uploadDescription.trim() || null,
        category: uploadCategory,
        accessLevel: uploadAccess,
        departmentId: uploadDept || null,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        sizeBytes: selectedFile.size,
      });

      await finalizeDocument({
        title: uploadTitle.trim(),
        description: uploadDescription.trim() || null,
        category: uploadCategory,
        accessLevel: uploadAccess,
        departmentId: uploadDept || null,
        storagePath: session.storagePath,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        sizeBytes: selectedFile.size,
      });

      setShowUploadModal(false);
      setUploadTitle("");
      setUploadDescription("");
      setSelectedFile(null);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Không thể tải lên tài liệu.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const { downloadUrl } = await getDocumentDownloadUrl(id);
      window.open(downloadUrl, "_blank");
    } catch (err: any) {
      alert(err?.message || "Không thể tải tài liệu.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xác nhận xóa tài liệu này khỏi thư viện?")) return;
    try {
      await deleteDocument(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Không thể xóa tài liệu.");
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tài liệu PGS"
        description="Kho tài liệu biểu mẫu, hợp đồng mẫu, quy trình nội bộ và hướng dẫn vận hành — phân loại theo phòng ban."
        badge="Thư viện PGS"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => setShowUploadModal(true)}
            className="bg-[#7257F5] hover:bg-[#6044E8] text-white font-bold"
          >
            Tải lên tài liệu mới
          </Button>
        }
      />

      <div className="grid lg:grid-cols-[270px_1fr] gap-6 items-start">
        <aside className="bg-white rounded-xl border border-[#E7E9F0] p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#202333] mb-3">
            <FolderOpen className="w-4 h-4 text-[#5B3FD6]" /> Phòng ban
          </h2>
          <ul className="space-y-1">
            {[{ id: "", name: "Tất cả phòng ban", n: documents.length }, ...departments.map((d) => ({ id: d.id, name: `${d.departmentCode ?? d.code ?? ""} · ${d.name}`.replace(/^ · /, ""), n: countByDept(d.id) }))].map((d) => (
              <li key={d.id || "all"}>
                <button
                  type="button"
                  onClick={() => setSelectedDept(d.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-[13px] transition-colors ${selectedDept === d.id ? "bg-[#F2EEFF] text-[#5B3FD6] font-bold border-l-[3px] border-[#7257F5]" : "text-[#475569] hover:bg-[#F2EEFF]"}`}
                >
                  <span className="truncate">{d.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#F4F2FD] text-xs font-bold text-[#475569]">{d.n}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="space-y-4 min-w-0">
      {/* Search & Categories Filter Bar */}
      <div className="p-4 rounded-xl bg-white border border-[#E7E9F0] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[280px]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu, quy trình, biểu mẫu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-[#F8F9FC] border border-[#E7E9F0] text-[#202333] placeholder:text-[#64748B] focus:bg-white focus:border-[#6044E8] outline-none transition-all"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-[#7257F5] hover:bg-[#6044E8] text-white font-bold"
            >
              Tìm
            </Button>
          </div>
        </form>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#E7E9F0] bg-[#F8F9FC] text-[#202333] focus:bg-white focus:border-[#6044E8] outline-none transition-all"
        >
          <option value="">Tất cả danh mục</option>
          {Object.entries(CATEGORY_MAP).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Documents Grid / Table */}
      {loading ? (
        <div className="p-12 text-center text-[#64748B] bg-white rounded-xl border border-[#E7E9F0]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#6044E8]" />
          Đang tải danh sách tài liệu...
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<FolderOpen className="w-10 h-10 text-[#64748B]" />}
            title="Thư viện chưa có tài liệu"
            description="Tải lên tài liệu đầu tiên để chia sẻ trong nội bộ PGS Agency."
          />
        </Card>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã tài liệu</TableHeaderCell>
                <TableHeaderCell>Tên tài liệu</TableHeaderCell>
                <TableHeaderCell>Danh mục</TableHeaderCell>
                <TableHeaderCell>Phòng ban</TableHeaderCell>
                <TableHeaderCell>Phân quyền</TableHeaderCell>
                <TableHeaderCell>Kích thước</TableHeaderCell>
                <TableHeaderCell>Người tải lên</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  Hành động
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-mono text-xs font-bold text-[#6044E8]">
                    {doc.document_code || "TL"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#F2EEFF] flex items-center justify-center text-[#6044E8] shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-[#202333]">{doc.title}</p>
                        {doc.description && (
                          <p className="text-xs text-[#475569] line-clamp-1">
                            {doc.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-[#475569] font-medium">
                    {CATEGORY_MAP[doc.category] || doc.category}
                  </TableCell>
                  <TableCell className="text-xs text-[#475569] font-medium">{deptLabel(doc)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={ACCESS_MAP[doc.access_level]?.variant || "blue"}
                      size="sm"
                    >
                      {ACCESS_MAP[doc.access_level]?.label || doc.access_level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-[#475569]">
                    {Math.round(doc.size_bytes / 1024)} KB
                  </TableCell>
                  <TableCell className="text-xs text-[#475569]">
                    {doc.uploaded_by?.full_name || "Quản trị viên"}
                  </TableCell>
                  <TableCell className="text-right space-x-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                      onClick={() => handleDownload(doc.id)}
                    >
                      Tải về
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

        </div>
      </div>

      {/* Upload Modal */}
      <Dialog
        isOpen={showUploadModal}
        onClose={() => !uploading && setShowUploadModal(false)}
        maxWidth="md"
        title="Tải lên tài liệu mới vào thư viện"
        description="Đăng tải quy trình, hợp đồng mẫu hoặc tài liệu nội bộ dùng chung."
      >
        <form onSubmit={handleUpload} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-[#202333] mb-1.5">
              Tên tài liệu *
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Ví dụ: Quy chế thưởng & phạt năm 2026"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9F0] bg-[#F8F9FC] text-xs font-semibold text-[#202333] focus:bg-white focus:border-[#6044E8] outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#202333] mb-1.5">
                Danh mục *
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9F0] bg-[#F8F9FC] text-xs font-semibold text-[#202333] focus:bg-white focus:border-[#6044E8] outline-none transition-all"
              >
                {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#202333] mb-1.5">
                Phân quyền truy cập *
              </label>
              <select
                value={uploadAccess}
                onChange={(e) => setUploadAccess(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9F0] bg-[#F8F9FC] text-xs font-semibold text-[#202333] focus:bg-white focus:border-[#6044E8] outline-none transition-all"
              >
                <option value="public_company">Toàn công ty & Khách</option>
                <option value="internal_only">Nội bộ PGS</option>
                <option value="management_only">Cấp quản lý</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#202333] mb-1.5">
              Chọn tệp tải lên (PDF, DOCX, XLSX, PNG...) *
            </label>
            <input
              type="file"
              required
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-[#475569] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#F2EEFF] file:text-[#6044E8] hover:file:bg-[#E0E7FF] cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#475569] mb-1.5">Phòng ban</label>
            <select
              value={uploadDept}
              onChange={(e) => setUploadDept(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DDDFEA] bg-[#F8F9FC] text-[#202333] focus:bg-white focus:border-[#6044E8] outline-none"
            >
              <option value="">Toàn công ty (không thuộc phòng ban)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#202333] mb-1.5">
              Mô tả tài liệu (Tùy chọn)
            </label>
            <textarea
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              rows={3}
              placeholder="Ghi chú thêm về phiên bản hoặc hướng dẫn sử dụng..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9F0] bg-[#F8F9FC] text-xs text-[#202333] focus:bg-white focus:border-[#6044E8] outline-none transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E9F0]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => setShowUploadModal(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={uploading}
              className="bg-[#7257F5] hover:bg-[#6044E8] text-white font-bold"
            >
              Tải lên
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
