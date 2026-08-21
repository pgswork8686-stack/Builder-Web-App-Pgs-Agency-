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
      const res = await fetchDocuments({
        category: selectedCategory || undefined,
        search: searchTerm.trim() || undefined,
      });
      setDocuments(res.items);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
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
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        sizeBytes: selectedFile.size,
      });

      await finalizeDocument({
        title: uploadTitle.trim(),
        description: uploadDescription.trim() || null,
        category: uploadCategory,
        accessLevel: uploadAccess,
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
        title="Thư viện Tài liệu PGS (Documents & Templates)"
        description="Kho tài liệu biểu mẫu, hợp đồng mẫu, quy trình nội bộ và hướng dẫn vận hành chuẩn."
        badge="PGS Library"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => setShowUploadModal(true)}
            className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white font-bold"
          >
            Tải lên tài liệu
          </Button>
        }
      />

      {/* Search & Categories Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-[#EDF2F7] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[280px]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu, quy trình, biểu mẫu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-[#F8FAFC] border border-[#EDF2F7] text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white font-bold"
            >
              Tìm
            </Button>
          </div>
        </form>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
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
        <div className="p-12 text-center text-[#94A3B8] bg-white rounded-2xl border border-[#EDF2F7]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#4F75FF]" />
          Đang tải danh sách tài liệu...
        </div>
      ) : documents.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<FolderOpen className="w-10 h-10 text-[#94A3B8]" />}
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
                <TableHeaderCell>Phân quyền</TableHeaderCell>
                <TableHeaderCell>Kích thước</TableHeaderCell>
                <TableHeaderCell>Người tải lên</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  Hành động
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-mono text-xs font-bold text-[#4F75FF]">
                    {doc.document_code || "TL"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center text-[#4F75FF] shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-[#0F172A]">{doc.title}</p>
                        {doc.description && (
                          <p className="text-[11px] text-[#64748B] line-clamp-1">
                            {doc.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-[#64748B] font-medium">
                    {CATEGORY_MAP[doc.category] || doc.category}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={ACCESS_MAP[doc.access_level]?.variant || "blue"}
                      size="sm"
                    >
                      {ACCESS_MAP[doc.access_level]?.label || doc.access_level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-[#64748B]">
                    {Math.round(doc.size_bytes / 1024)} KB
                  </TableCell>
                  <TableCell className="text-xs text-[#64748B]">
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
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Tên tài liệu *
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Ví dụ: Quy chế thưởng & phạt năm 2026"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                Danh mục *
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
              >
                {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                Phân quyền truy cập *
              </label>
              <select
                value={uploadAccess}
                onChange={(e) => setUploadAccess(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
              >
                <option value="public_company">Toàn công ty & Khách</option>
                <option value="internal_only">Nội bộ PGS</option>
                <option value="management_only">Cấp quản lý</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Chọn tệp tải lên (PDF, DOCX, XLSX, PNG...) *
            </label>
            <input
              type="file"
              required
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-[#64748B] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#EEF2FF] file:text-[#4F75FF] hover:file:bg-[#E0E7FF] cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Mô tả tài liệu (Tùy chọn)
            </label>
            <textarea
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              rows={3}
              placeholder="Ghi chú thêm về phiên bản hoặc hướng dẫn sử dụng..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EDF2F7]">
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
              className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white font-bold"
            >
              Tải lên
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
