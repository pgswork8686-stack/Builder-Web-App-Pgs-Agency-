"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, MessageSquareWarning, RefreshCw } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { StateBanner } from "@/components/ui/state-banner";
import { projectsApi } from "@/lib/api/projects";
import { workflowsApi } from "@/lib/api/workflows";

type Decision = "approved" | "rejected";
type TabKey = "pending" | "approved" | "rejected";

interface ApprovalRow {
  id: string;
  status: string;
  requestedAt: string;
  respondedAt: string | null;
  projectId: string;
  projectCode: string;
  projectName: string;
  workflowId: string;
  stageName: string;
  itemName: string;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "pending", label: "Chờ phản hồi" },
  { key: "approved", label: "Đã phê duyệt" },
  { key: "rejected", label: "Đã yêu cầu chỉnh sửa" },
];

const MIN_REVISION_NOTE = 5;

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

async function loadApprovalRows(): Promise<ApprovalRow[]> {
  const projects = await projectsApi.getClientProjects(1, 100);
  const perProject = await Promise.all(
    projects.items.map(async (project) => {
      const workflows = await workflowsApi.getProjectWorkflows(project.id);
      return workflows.flatMap((workflow) => {
        const stages = workflow.stages ?? [];
        const items = stages.flatMap((stage) => stage.items ?? []);
        return (workflow.approvals ?? [])
          .filter((approval) => approval.approval_type === "client")
          .map((approval): ApprovalRow => {
            const item = items.find(
              (candidate) =>
                candidate.id === approval.project_workflow_stage_item_id,
            );
            const stage = stages.find(
              (candidate) =>
                candidate.id ===
                (item?.project_workflow_stage_id ??
                  approval.project_workflow_stage_id),
            );
            const snapshot = item?.project_service_item;
            const serviceItem = Array.isArray(snapshot)
              ? snapshot[0]
              : snapshot;
            return {
              id: approval.id,
              status: approval.status,
              requestedAt: approval.requested_at,
              respondedAt: approval.responded_at ?? null,
              projectId: project.id,
              projectCode: project.projectCode,
              projectName: project.name,
              workflowId: workflow.id,
              stageName: stage?.name_snapshot ?? "—",
              itemName: serviceItem?.name ?? "Sản phẩm bàn giao",
            };
          });
      });
    }),
  );
  return perProject
    .flat()
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export default function ClientApprovalsPage() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("pending");
  const [target, setTarget] = useState<{
    row: ApprovalRow;
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
      setRows(await loadApprovalRows());
    } catch (caught) {
      setError(errorMessage(caught, "Không thể tải danh sách nghiệm thu."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      pending: rows.filter((row) => row.status === "pending").length,
      approved: rows.filter((row) => row.status === "approved").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
    }),
    [rows],
  );
  const visible = rows.filter((row) => row.status === tab);

  const openDialog = (row: ApprovalRow, decision: Decision) => {
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
          ? `Đã phê duyệt "${target.row.itemName}".`
          : `Đã gửi yêu cầu chỉnh sửa cho "${target.row.itemName}".`,
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
            onClick={() => setTab(item.key)}
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

      {loading ? (
        <Card className="p-10 text-center text-xs text-[#5F6E85]">
          <div role="status">Đang tải danh sách nghiệm thu…</div>
        </Card>
      ) : visible.length === 0 ? (
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
        <Card className="overflow-x-auto p-0">
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
              {visible.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 font-bold">{row.itemName}</td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/app/client/projects/${row.projectId}`}
                      className="font-mono font-bold text-[#3453D1] hover:underline"
                      title={row.projectName}
                    >
                      {row.projectCode}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-[#5F6E85]">{row.stageName}</td>
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
                          aria-label={`Phê duyệt ${row.itemName}`}
                          leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        >
                          Phê duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDialog(row, "rejected")}
                          aria-label={`Yêu cầu chỉnh sửa ${row.itemName}`}
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
              ))}
            </tbody>
          </table>
        </Card>
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
            ? `${target.row.itemName} · ${target.row.projectCode}`
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
