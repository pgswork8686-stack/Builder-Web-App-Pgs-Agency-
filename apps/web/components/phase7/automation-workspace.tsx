"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  automationApi,
  automationTriggers,
  type AutomationExecution,
  type AutomationExecutionStatus,
  type AutomationRule,
  type AutomationTrigger,
} from "@/lib/api/automation";
import { NotificationBell } from "./notification-bell";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";

type RecipientMode =
  | "default"
  | "assignee"
  | "requester"
  | "project_members"
  | "client_company_members"
  | "role_admin"
  | "role_accountant"
  | "role_team_leader"
  | "role_employee";

const recipientModes: Array<{ value: RecipientMode; label: string }> = [
  { value: "default", label: "Người nhận mặc định từ event" },
  { value: "assignee", label: "Assignee từ payload" },
  { value: "requester", label: "Requester từ payload" },
  {
    value: "project_members",
    label: "Thành viên project từ payload.projectId",
  },
  {
    value: "client_company_members",
    label: "Client company từ payload.clientCompanyId",
  },
  { value: "role_admin", label: "Tất cả admin active" },
  { value: "role_accountant", label: "Tất cả accountant active" },
  { value: "role_team_leader", label: "Tất cả team leader active" },
  { value: "role_employee", label: "Tất cả employee active" },
];

const triggerLabels: Record<AutomationTrigger, string> = {
  "task.created": "Task được tạo",
  "task.assigned": "Task được giao",
  "task.updated": "Task cập nhật",
  "task.due_soon": "Task sắp đến hạn",
  "project.updated": "Dự án cập nhật",
  "leave.submitted": "Nghỉ phép được gửi",
  "leave.approved": "Nghỉ phép được duyệt",
  "leave.rejected": "Nghỉ phép bị từ chối",
  "attendance.adjustment_requested": "Điều chỉnh chấm công",
  "contract.status_changed": "Hợp đồng đổi trạng thái",
  "invoice.issued": "Hóa đơn phát hành",
  "invoice.overdue": "Hóa đơn quá hạn",
  "invoice.payment_recorded": "Thanh toán được ghi nhận",
  "chat.message": "Có tin nhắn chat",
};

function parseJsonObject(
  value: string,
  label: string,
): Record<string, unknown> {
  const parsed = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} phải là JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function roleFromMode(mode: RecipientMode) {
  const roles: Partial<Record<RecipientMode, string>> = {
    role_admin: "admin",
    role_accountant: "accountant",
    role_team_leader: "team_leader",
    role_employee: "employee",
  };
  return roles[mode];
}

function buildActionConfig(input: {
  mode: RecipientMode;
  title: string;
  message: string;
  actionUrl: string;
}) {
  const actionConfig: Record<string, unknown> = {};
  const title = input.title.trim();
  const message = input.message.trim();
  const actionUrl = input.actionUrl.trim();

  if (title) actionConfig.title = title;
  if (message) actionConfig.message = message;
  if (actionUrl) {
    if (!actionUrl.startsWith("/app/")) {
      throw new Error("Action URL phải là internal URL bắt đầu bằng /app/.");
    }
    actionConfig.actionUrl = actionUrl;
  }

  if (input.mode === "assignee") {
    actionConfig.recipientFromPayload = "assigneeUserId";
  } else if (input.mode === "requester") {
    actionConfig.recipientFromPayload = "requesterUserId";
  } else if (input.mode === "project_members") {
    actionConfig.projectMembersFromPayload = "projectId";
  } else if (input.mode === "client_company_members") {
    actionConfig.clientCompanyMembersFromPayload = "clientCompanyId";
  } else {
    const role = roleFromMode(input.mode);
    if (role) actionConfig.recipientRole = role;
  }

  return actionConfig;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function statusClasses(status: AutomationExecutionStatus) {
  const classes: Record<AutomationExecutionStatus, string> = {
    running: "bg-amber-400 text-black",
    success: "bg-emerald-400 text-black",
    failed: "bg-red-500 text-white",
    skipped: "bg-[#F1F5F9] text-[#64748B]",
  };
  return classes[status];
}

export function AutomationWorkspace() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] =
    useState<AutomationTrigger>("task.assigned");
  const [conditionsText, setConditionsText] = useState("{}");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("assignee");
  const [actionTitle, setActionTitle] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [manualEventKey, setManualEventKey] = useState("");
  const [manualPayloadText, setManualPayloadText] = useState("{}");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const enabledCount = useMemo(
    () => rules.filter((rule) => rule.isEnabled).length,
    [rules],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesResult, executionsResult] = await Promise.all([
        automationApi.listRules({ page: 1, pageSize: 100 }),
        automationApi.listExecutions({ page: 1, pageSize: 30 }),
      ]);
      setRules(rulesResult.items);
      setExecutions(executionsResult.items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tải được automation console.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createRule = async () => {
    setWorking("create");
    setError(null);
    setNotice(null);
    try {
      const conditions = parseJsonObject(conditionsText, "Conditions");
      const actionConfig = buildActionConfig({
        mode: recipientMode,
        title: actionTitle,
        message: actionMessage,
        actionUrl,
      });
      await automationApi.createRule({
        name,
        triggerType,
        conditions,
        actionType: "create_notification",
        actionConfig,
        isEnabled: true,
      });
      setName("");
      setActionTitle("");
      setActionMessage("");
      setActionUrl("");
      setNotice("Đã tạo automation rule an toàn.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tạo được automation rule.",
      );
    } finally {
      setWorking(null);
    }
  };

  const toggleRule = async (rule: AutomationRule) => {
    setWorking(rule.id);
    setError(null);
    setNotice(null);
    try {
      await automationApi.updateRule(rule.id, { isEnabled: !rule.isEnabled });
      setNotice(rule.isEnabled ? "Đã tắt rule." : "Đã bật rule.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không cập nhật được rule.",
      );
    } finally {
      setWorking(null);
    }
  };

  const runScheduled = async () => {
    setWorking("scheduled");
    setError(null);
    setNotice(null);
    try {
      const result = await automationApi.runScheduled();
      setNotice(
        `Đã quét lịch ${result.businessDate}: ${result.invoiceOverdueScanned} hóa đơn quá hạn.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chạy được lịch.");
    } finally {
      setWorking(null);
    }
  };

  const runManual = async () => {
    setWorking("manual");
    setError(null);
    setNotice(null);
    try {
      const payload = parseJsonObject(manualPayloadText, "Manual payload");
      const result = await automationApi.runManualEvent({
        triggerType,
        eventKey: manualEventKey.trim(),
        payload,
      });
      setNotice(`Manual event khớp ${result.matchedRules} rule.`);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không chạy được manual event.",
      );
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Trung tâm Tự động hóa"
        description="Rule nội bộ an toàn: trigger registry cố định, action tạo notification trực tiếp trong hệ thống."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Tải lại
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[26rem_1fr]">
        <aside className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4F75FF]">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-[#0F172A] text-sm">
                  Tạo quy tắc mới
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Hành động chuẩn hóa: `create_notification`.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="block">
                <span className="text-xs font-semibold text-[#64748B]">
                  Tên quy tắc *
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Nhắc nhở khi giao task mới"
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#64748B]">
                  Trigger sự kiện *
                </span>
                <select
                  value={triggerType}
                  onChange={(event) =>
                    setTriggerType(event.target.value as AutomationTrigger)
                  }
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                >
                  {automationTriggers.map((trigger) => (
                    <option key={trigger} value={trigger}>
                      {triggerLabels[trigger]} · {trigger}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#64748B]">
                  Điều kiện so khớp JSON
                </span>
                <textarea
                  value={conditionsText}
                  onChange={(event) => setConditionsText(event.target.value)}
                  className="mt-1 min-h-20 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 font-mono text-[11px] text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                />
                <span className="mt-0.5 block text-[10px] text-[#94A3B8]">
                  So khớp payload key/value an toàn.
                </span>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#64748B]">
                  Đối tượng nhận thông báo *
                </span>
                <select
                  value={recipientMode}
                  onChange={(event) =>
                    setRecipientMode(event.target.value as RecipientMode)
                  }
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                >
                  {recipientModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#64748B]">
                  Tiêu đề thông báo
                </span>
                <input
                  value={actionTitle}
                  onChange={(event) => setActionTitle(event.target.value)}
                  placeholder="Để trống sẽ dùng tên mặc định"
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#64748B]">
                  Nội dung thông báo
                </span>
                <textarea
                  value={actionMessage}
                  onChange={(event) => setActionMessage(event.target.value)}
                  placeholder="Để trống sẽ dùng nội dung event mặc định"
                  className="mt-1 min-h-16 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#64748B]">
                  Internal Action URL
                </span>
                <input
                  value={actionUrl}
                  onChange={(event) => setActionUrl(event.target.value)}
                  placeholder="/app/tasks hoặc /app/chat"
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                />
              </label>

              <Button
                variant="primary"
                size="sm"
                className="w-full mt-2"
                disabled={working === "create" || name.trim().length < 2}
                onClick={createRule}
              >
                {working === "create"
                  ? "Đang tạo quy tắc..."
                  : "Tạo quy tắc mới"}
              </Button>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <Play className="h-4 w-4 text-[#4F75FF]" />
              <h2 className="font-bold text-[#0F172A] text-sm">
                Chạy thử nghiệm
              </h2>
            </div>
            <div className="space-y-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={working === "scheduled"}
                onClick={runScheduled}
              >
                {working === "scheduled"
                  ? "Đang quét lịch..."
                  : "Quét lịch: Invoice quá hạn"}
              </Button>

              <input
                value={manualEventKey}
                onChange={(event) => setManualEventKey(event.target.value)}
                placeholder="Nhập Event Key (>= 8 ký tự)..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
              <textarea
                value={manualPayloadText}
                onChange={(event) => setManualPayloadText(event.target.value)}
                className="min-h-16 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 font-mono text-[11px] text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={
                  working === "manual" || manualEventKey.trim().length < 8
                }
                onClick={runManual}
              >
                {working === "manual" ? "Đang chạy..." : "Chạy manual event"}
              </Button>
            </div>
          </Card>
        </aside>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              variant="blue"
              title="Quy tắc tự động"
              value={rules.length.toString()}
              subtitle={`${enabledCount} đang kích hoạt`}
              icon={<Bot className="h-4 w-4" />}
            />
            <StatCard
              variant="green"
              title="Lượt thực thi"
              value={executions.length.toString()}
              subtitle="30 lượt chạy gần nhất"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              variant="default"
              title="Bảo mật & Phân quyền"
              value="Được kiểm soát"
              subtitle="Sandbox an toàn tuyệt đối"
              icon={<ShieldCheck className="h-4 w-4" />}
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-center gap-2">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          ) : null}

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
              <div>
                <h2 className="font-extrabold text-[#0F172A] text-sm">
                  Danh sách quy tắc
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Đảm bảo Idempotency và cách ly lỗi an toàn.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-xs text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin text-[#4F75FF]" />
                Đang tải danh sách quy tắc...
              </div>
            ) : rules.length === 0 ? (
              <EmptyState
                icon={<Bot className="w-8 h-8 text-[#4F75FF]" />}
                title="Chưa có quy tắc nào"
                description="Tạo quy tắc tự động hóa đầu tiên bằng biểu mẫu bên trái."
              />
            ) : (
              <div className="divide-y divide-[#EDF2F7]">
                {rules.map((rule) => (
                  <article key={rule.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-[#0F172A]">
                          {rule.name}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <Badge variant="blue" size="sm">
                            {rule.triggerType}
                          </Badge>
                          <Badge variant="default" size="sm">
                            {rule.actionType}
                          </Badge>
                          <Badge
                            variant={rule.isEnabled ? "success" : "default"}
                            size="sm"
                          >
                            {rule.isEnabled ? "Đang bật" : "Đang tắt"}
                          </Badge>
                        </div>
                        <pre className="mt-3 max-w-full overflow-x-auto rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 text-[11px] font-mono text-[#64748B]">
                          {JSON.stringify(
                            {
                              conditions: rule.conditions,
                              actionConfig: rule.actionConfig,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                      <Button
                        variant={rule.isEnabled ? "secondary" : "primary"}
                        size="sm"
                        disabled={working === rule.id}
                        onClick={() => void toggleRule(rule)}
                      >
                        {working === rule.id
                          ? "Đang lưu..."
                          : rule.isEnabled
                            ? "Tắt rule"
                            : "Bật rule"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <div className="border-b border-[#EDF2F7] pb-3">
              <h2 className="font-extrabold text-[#0F172A] text-sm">
                Lịch sử thực thi
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Ghi nhận chi tiết kết quả chạy tự động.
              </p>
            </div>
            <div className="divide-y divide-[#EDF2F7]">
              {executions.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#94A3B8]">
                  Chưa có lượt thực thi nào được ghi nhận.
                </div>
              ) : (
                executions.map((execution) => (
                  <article
                    key={execution.id}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-bold text-xs text-[#0F172A]">
                          {execution.rule?.name ?? execution.triggerType}
                        </div>
                        <div className="text-[11px] text-[#94A3B8] font-mono">
                          {execution.eventKey}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            execution.status === "success"
                              ? "success"
                              : execution.status === "failed"
                                ? "danger"
                                : "default"
                          }
                          size="sm"
                        >
                          {execution.status}
                        </Badge>
                        <span className="text-[11px] text-[#94A3B8] font-mono">
                          {formatDateTime(execution.createdAt)}
                        </span>
                      </div>
                    </div>
                    {execution.errorMessage ? (
                      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                        {execution.errorMessage}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
