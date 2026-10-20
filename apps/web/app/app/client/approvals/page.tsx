"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageSquareWarning,
  RefreshCw,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { StateBanner } from "@/components/ui/state-banner";
import {
  workflowsApi,
  type ClientApprovalItem,
  type ClientApprovalPage,
  type ClientApprovalStatus,
} from "@/lib/api/workflows";

type Decision = "approved" | "rejected";

const PAGE_SIZE = 20;
const MIN_REVISION_NOTE = 5;

const TABS: Array<{ key: ClientApprovalStatus; label: string }> = [
  { key: "pending", label: "Chờ phản hồi" },
  { key: "approved", label: "Đã phê duyệt" },
  { key: "rejected", label: "Đã yêu cầu chỉnh sửa" },
];

const NO_COUNTS: ClientApprovalPage["counts"] = {
  pending: 0,
  approved: 0,
  rejected: 0,
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}

export default function ClientApprovalsPage() {
  const [tab, setTab] = useState<ClientApprovalStatus>("pending");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ClientApprovalPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [target, setTarget] = useState<{
    row: ClientApprovalItem;
    decision: Decision;
  } | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workflowsApi.listClientApprovals({
        status: tab,
        page,
        pageSize: PAGE_SIZE,
      });
      // The last row of the last page may have just been answered.
      if (result.items.length === 0 && page > 1 && result.totalPages > 0) {
        setPage(result.totalPages);
        return;
      }
      setData(result);
    } catch (caught) {
      setError(errorMessage(caught, "Không thể tải danh sách nghiệm thu."));
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = data?.counts ?? NO_COUNTS;
  const rows = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  const changeTab = (next: ClientApprovalStatus) => {
    setTab(next);
    setPage(1);
  };

  const openDialog = (row: ClientApprovalItem, decision: Decision) => {
    setTarget({ row, decision });
    setNote("");
    setNoteError(null);
    setSubmitError(null);
  };
  const closeDialog = () => {
    if (!submitting) setTarget(null);
  };

  const submit = async () => {
    if (!target) return;
    const trimmed = note.trim();
    if (target.decision === "rejected" && trimmed.length < MIN_REVISION_NOTE) {
      setNoteError(
        `Vui lòng nhập nội dung cần chỉnh sửa (tối thiểu ${MIN_REVISION_NOTE} ký tự).`,
      );
      return;
    }
    const itemName = target.row.itemName ?? "Sản phẩm bàn giao";
    setSubmitting(true);
    setSubmitError(null);
    try {
      await workflowsApi.respondApproval(
        target.row.projectId,
        target.row.workflowId,
        target.row.id,
        { decision: target.decision, decisionNote: trimmed || null },
      );
      setNotice(
        target.decision === "approved"
          ? `Đã phê duyệt "${itemName}".`
          : `Đã gửi yêu cầu chỉnh sửa cho "${itemName}".`,
      );
      setTarget(null);
      await load();
    } catch (caught) {
      setSubmitError(
        errorMessage(caught, "Không thể gửi phản hồi. Vui lòng thử lại."),
      );
      // The request may have been answered elsewhere; keep the list truthful.
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sản phẩm chờ duyệt"
        description="Xem xét sản phẩm agency gửi, phê duyệt hoặc yêu cầu chỉnh sửa để tiếp tục triển khai và nghiệm thu."
        badge={
          counts.pending > 0 ? `${counts.pending} chờ phản hồi` : "Nghiệm thu"
        }
      />

      {notice && (
        <StateBanner
          type="success"
          message={notice}
          onDismiss={() => setNotice(null)}
        />
      )}
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

      <div
        role="tablist"
        aria-label="Trạng thái nghiệm thu"
        className="flex flex-wrap gap-2 border-b border-[#E2E8F0]"
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => changeTab(item.key)}
            className={`px-4 py-3 text-xs font-bold border-b-2 -mb-px cursor-pointer transition-colors ${
              tab === item.key
                ? "border-[#3453D1] text-[#3453D1]"
                : "border-transparent text-[#5F6E85] hover:text-[#24304A]"
            }`}
          >
            {item.label} ({counts[item.key]})
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Card className="p-10 text-center text-xs text-[#5F6E85]">
          <div role="status">Đang tải danh sách nghiệm thu…</div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<CheckCircle2 className="w-10 h-10 text-[#0A7F6B]" />}
            title={
              tab === "pending"
                ? "Không có sản phẩm nào đang chờ duyệt"
                : "Chưa có mục nào ở trạng thái này"
            }
            description="Khi agency gửi bản thiết kế hoặc sản phẩm bàn giao, thông báo sẽ hiển thị tại đây."
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
                  Hạng mục
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Dự án
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Giai đoạn
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Yêu cầu lúc
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  {tab === "pending" ? "Trạng thái" : "Phản hồi lúc"}
                </th>
                {tab === "pending" && (
                  <th scope="col" className="px-5 py-3 font-bold">
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2F7] text-[#24304A]">
              {rows.map((row) => {
                const itemName = row.itemName ?? "Sản phẩm bàn giao";
                return (
                  <tr key={row.id} data-approval-id={row.id}>
                    <td className="px-5 py-4 font-bold">{itemName}</td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/app/client/projects/${row.projectId}`}
                        className="font-mono font-bold text-[#3453D1] hover:underline"
                        title={row.projectName ?? undefined}
                      >
                        {row.projectCode ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-[#5F6E85]">
                      {row.stageName ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-[#5F6E85]">
                      {formatTime(row.requestedAt)}
                    </td>
                    <td className="px-5 py-4">
                      {tab === "pending" ? (
                        <Badge variant="warning" size="sm">
                          Chờ phản hồi
                        </Badge>
                      ) : (
                        <span className="text-[#5F6E85]">
                          {formatTime(row.respondedAt)}
                        </span>
                      )}
                    </td>
                    {tab === "pending" && (
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => openDialog(row, "approved")}
                            aria-label={`Phê duyệt ${itemName}`}
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          >
                            Phê duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDialog(row, "rejected")}
                            aria-label={`Yêu cầu chỉnh sửa ${itemName}`}
                            leftIcon={
                              <MessageSquareWarning className="w-3.5 h-3.5" />
                            }
                          >
                            Yêu cầu chỉnh sửa
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Phân trang nghiệm thu"
          className="flex items-center justify-between gap-3 text-xs text-[#5F6E85]"
        >
          <span>
            Trang {page} / {totalPages} · {data?.total ?? 0} mục
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

      <Dialog
        isOpen={target !== null}
        onClose={closeDialog}
        maxWidth="md"
        title={
          target?.decision === "approved"
            ? "Phê duyệt sản phẩm"
            : "Yêu cầu chỉnh sửa"
        }
        description={
          target
            ? `${target.row.itemName ?? "Sản phẩm bàn giao"} · ${target.row.projectCode ?? ""}`
            : undefined
        }
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="approval-note"
              className="block text-xs font-semibold text-[#5F6E85] mb-1"
            >
              {target?.decision === "approved"
                ? "Ghi chú (không bắt buộc)"
                : "Nội dung cần chỉnh sửa *"}
            </label>
            <textarea
              id="approval-note"
              rows={4}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteError(null);
              }}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={noteError ? "approval-note-error" : undefined}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2E8F0] bg-white text-[#24304A]"
              placeholder={
                target?.decision === "approved"
                  ? "Ví dụ: Đồng ý bản thiết kế này."
                  : "Mô tả cụ thể phần cần sửa để agency chỉnh nhanh hơn."
              }
            />
            {noteError && (
              <p
                id="approval-note-error"
                role="alert"
                className="mt-1 text-xs font-semibold text-[#B91C1C]"
              >
                {noteError}
              </p>
            )}
          </div>
          {submitError && <StateBanner type="error" message={submitError} />}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={closeDialog}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button
              variant={target?.decision === "rejected" ? "danger" : "primary"}
              onClick={() => void submit()}
              isLoading={submitting}
            >
              {target?.decision === "approved"
                ? "Xác nhận phê duyệt"
                : "Gửi yêu cầu chỉnh sửa"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
