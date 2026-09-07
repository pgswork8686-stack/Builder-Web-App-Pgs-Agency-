"use client";

import React, { useEffect, useState } from "react";
import {
  FolderOpen,
  FileText,
  Search,
  Download,
  RefreshCw,
  Eye,
  Tag,
  Calendar,
  Layers,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  getDocumentDownloadUrl,
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

export default function EmployeeDocumentsPage() {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetchDocuments({
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        search: search.trim() || undefined,
        pageSize: 50,
      });
      setDocuments(res.items || []);
    } catch (err) {
      console.error("Failed to fetch documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDocuments();
  };

  const handleDownload = async (doc: CompanyDocument) => {
    try {
      setDownloadingId(doc.id);
      const res = await getDocumentDownloadUrl(doc.id);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank");
      }
    } catch (err: any) {
      alert("Không thể tải tài liệu: " + (err?.message || "Lỗi máy chủ"));
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tài liệu & Quy trình Doanh nghiệp (PGS Library)"
        description="Tra cứu tài liệu quy định công ty, hướng dẫn chế độ phúc lợi và tài liệu đào tạo nội bộ."
        badge={`${documents.length} Tài liệu`}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              categoryFilter === "all"
                ? "bg-[#161827] text-[#E7AE18] shadow-xs"
                : "bg-white border border-[#EDF2F7] text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
          >
            Tất cả
          </button>
          {Object.entries(CATEGORY_MAP).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategoryFilter(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoryFilter === key
                  ? "bg-[#161827] text-[#E7AE18] shadow-xs"
                  : "bg-white border border-[#EDF2F7] text-[#64748B] hover:bg-[#F8FAFC]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 min-w-[280px]"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã tài liệu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#161827] transition-colors"
            />
          </div>
          <Button variant="outline" size="sm" type="submit">
            Tìm
          </Button>
        </form>
      </div>

      {/* Documents Table or Grid */}
      <Card className="overflow-hidden border border-[#EDF2F7]">
        {loading ? (
          <div className="p-12 text-center text-[#64748B]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#161827]" />
            Đang tải tài liệu doanh nghiệp...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-10 text-center">
            <EmptyState
              icon={<FolderOpen className="w-10 h-10 text-[#94A3B8]" />}
              title="Không tìm thấy tài liệu phù hợp"
              description="Chưa có tài liệu nào trong danh mục này hoặc không khớp với từ khóa tìm kiếm."
            />
          </div>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Mã / Tiêu đề</TableHeaderCell>
                  <TableHeaderCell>Danh mục</TableHeaderCell>
                  <TableHeaderCell>Dung lượng</TableHeaderCell>
                  <TableHeaderCell>Phiên bản</TableHeaderCell>
                  <TableHeaderCell>Ngày cập nhật</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Thao tác
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-[#161827] shrink-0" />
                          <span>{doc.title}</span>
                        </div>
                        {doc.document_code && (
                          <span className="text-[11px] font-mono text-[#64748B] block">
                            {doc.document_code}
                          </span>
                        )}
                        {doc.description && (
                          <p className="text-xs text-[#64748B] line-clamp-1">
                            {doc.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="blue" size="sm">
                        {CATEGORY_MAP[doc.category] || doc.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B] font-mono">
                      {formatFileSize(doc.size_bytes)}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium text-[#0F172A]">
                      v{doc.version || "1.0"}
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B]">
                      {new Date(
                        doc.updated_at || doc.created_at,
                      ).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingId === doc.id}
                        onClick={() => handleDownload(doc)}
                        leftIcon={
                          downloadingId === doc.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )
                        }
                      >
                        {downloadingId === doc.id ? "Đang tải..." : "Tải về"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </div>
  );
}
