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
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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
  { label: string; variant: "success" | "blue" | "warning" }
> = {
  public_company: { label: "Toàn công ty & Khách", variant: "success" },
  internal_only: { label: "Nội bộ PGS", variant: "blue" },
  management_only: { label: "Cấp quản lý", variant: "warning" },
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
          >
            Tải lên tài liệu
          </Button>
        }
      />

      {/* Search & Categories */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[280px]">
          <div className="p-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EAEFF4] dark:border-[#334155] flex items-center gap-3 shadow-xs">
            <Search className="w-4 h-4 text-[#7C879D]" />
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu, quy trình, biểu mẫu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm text-[#2A3547] dark:text-white bg-transparent border-none outline-none placeholder:text-[#7C879D]"
            />
            <Button type="submit" variant="outline" size="sm">
              Tìm
            </Button>
          </div>
        </form>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-xl border border-[#EAEFF4] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#2A3547] dark:text-white"
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
      <Card className="overflow-hidden border border-[#EAEFF4] dark:border-[#334155]">
        {loading ? (
          <div className="p-12 text-center text-[#7C879D]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Đang tải danh sách tài liệu...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-10 text-center">
            <EmptyState
              icon={<FolderOpen className="w-10 h-10 text-[#7C879D]" />}
              title="Thư viện chưa có tài liệu"
              description="Tải lên tài liệu đầu tiên để chia sẻ trong nội bộ PGS Agency."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F9FC] dark:bg-[#0F172A] border-b border-[#EAEFF4] dark:border-[#334155] text-xs font-semibold text-[#7C879D] uppercase">
                <tr>
                  <th className="px-4 py-3">Mã tài liệu</th>
                  <th className="px-4 py-3">Tên tài liệu</th>
                  <th className="px-4 py-3">Danh mục</th>
                  <th className="px-4 py-3">Phân quyền</th>
                  <th className="px-4 py-3">Kích thước</th>
                  <th className="px-4 py-3">Người tải lên</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEFF4] dark:divide-[#334155]">
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-[#5D87FF]">
                      {doc.document_code || "TL"}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#2A3547] dark:text-white">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#5D87FF]" />
                        <span>{doc.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7C879D]">
                      {CATEGORY_MAP[doc.category] || doc.category}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          ACCESS_MAP[doc.access_level]?.variant || "info"
                        }
                        size="sm"
                      >
                        {ACCESS_MAP[doc.access_level]?.label ||
                          doc.access_level}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7C879D]">
                      {Math.round(doc.size_bytes / 1024)} KB
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7C879D]">
                      {doc.uploaded_by?.full_name || "Quản trị viên"}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
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
                        className="text-[#FA896B] hover:bg-red-50"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#EAEFF4] dark:border-[#334155]">
            <h3 className="text-lg font-bold text-[#2A3547] dark:text-white mb-4">
              Tải lên tài liệu mới
            </h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                  Tên tài liệu *
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Ví dụ: Quy chế thưởng & phạt năm 2026"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                    Danh mục *
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                  >
                    {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                    Phân quyền truy cập *
                  </label>
                  <select
                    value={uploadAccess}
                    onChange={(e) => setUploadAccess(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                  >
                    <option value="public_company">Toàn công ty & Khách</option>
                    <option value="internal_only">Nội bộ PGS</option>
                    <option value="management_only">Cấp quản lý</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                  Chọn tệp tải lên (PDF, DOCX, XLSX, PNG...) *
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#7C879D] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#ECF2FF] file:text-[#5D87FF] hover:file:bg-[#DCE7FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                  Mô tả tài liệu
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  placeholder="Ghi chú thêm về phiên bản hoặc hướng dẫn sử dụng..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUploadModal(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={uploading}
                >
                  {uploading ? "Đang tải lên..." : "Tải lên"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
