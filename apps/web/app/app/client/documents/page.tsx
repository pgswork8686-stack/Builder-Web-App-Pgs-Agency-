"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StateBanner } from "@/components/ui/state-banner";
import {
  handoverApi,
  type ClientHandoverFile,
  type ClientHandoverPage,
} from "@/lib/api/files";

const PAGE_SIZE = 20;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}

export default function ClientDocumentsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ClientHandoverPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await handoverApi.listForClient({
        page,
        pageSize: PAGE_SIZE,
      });
      if (result.items.length === 0 && page > 1 && result.totalPages > 0) {
        setPage(result.totalPages);
        return;
      }
      setData(result);
    } catch (caught) {
      setError(errorMessage(caught, "Không thể tải tài liệu bàn giao."));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (file: ClientHandoverFile) => {
    setDownloadError(null);
    setDownloading(file.id);
    try {
      const { signedUrl } = await handoverApi.downloadForClient(file.id);
      window.location.assign(signedUrl);
    } catch (caught) {
      setDownloadError(
        errorMessage(caught, `Không thể tải "${file.originalName}".`),
      );
    } finally {
      setDownloading(null);
    }
  };

  const rows = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tài liệu Bàn giao Dự án"
        description="Tài liệu, thiết kế và biên bản mà agency đã chính thức bàn giao cho doanh nghiệp của bạn."
        badge={data ? `${data.total} tài liệu` : "Tài liệu bàn giao"}
      />

      {error && (
        <StateBanner
          type="error"
          title="Không tải được dữ liệu"
          message={error}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Thử lại
            </Button>
          }
        />
      )}
      {downloadError && (
        <StateBanner
          type="error"
          message={downloadError}
          onDismiss={() => setDownloadError(null)}
        />
      )}

      {loading && !data ? (
        <Card className="p-10 text-center text-xs text-[#5F6E85]">
          <div role="status">Đang tải tài liệu bàn giao…</div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<FolderOpen className="w-10 h-10 text-[#5F6E85]" />}
            title="Chưa có tài liệu bàn giao nào"
            description="Các tài liệu chính thức sẽ xuất hiện tại đây khi agency bàn giao cho bạn."
          />
        </Card>
      ) : (
        <Card
          className={`overflow-x-auto p-0 ${loading ? "opacity-60" : ""}`}
          aria-busy={loading}
        >
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F8FC] text-[#5F6E85] uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-5 py-3 font-bold">
                  Tài liệu
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Dự án
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Kích thước
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Bàn giao lúc
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2F7] text-[#24304A]">
              {rows.map((file) => (
                <tr key={file.id} data-file-id={file.id}>
                  <td className="px-5 py-4 font-bold">{file.originalName}</td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/app/client/projects/${file.projectId}`}
                      className="font-mono font-bold text-[#3453D1] hover:underline"
                      title={file.projectName ?? undefined}
                    >
                      {file.projectCode ?? "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-[#5F6E85]">
                    {formatSize(file.sizeBytes)}
                  </td>
                  <td className="px-5 py-4 text-[#5F6E85]">
                    {formatTime(file.handedOverAt)}
                  </td>
                  <td className="px-5 py-4">
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={downloading === file.id}
                      onClick={() => void download(file)}
                      aria-label={`Tải xuống ${file.originalName}`}
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                    >
                      Tải xuống
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Phân trang tài liệu bàn giao"
          className="flex items-center justify-between gap-3 text-xs text-[#5F6E85]"
        >
          <span>
            Trang {page} / {totalPages} · {data?.total ?? 0} tài liệu
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Trang trước
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Trang sau
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
