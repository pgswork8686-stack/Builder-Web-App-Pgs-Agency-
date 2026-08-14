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
    skipped: "bg-[#151516] text-[#606060]",
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
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6]">
      <header className="sticky top-0 z-20 border-b border-[#151516] bg-[#0E0E0F]/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFC400]">
              Phase 7 · Admin
            </div>
            <h1 className="mt-1 text-2xl font-black text-white">
              Automation console
            </h1>
            <p className="mt-1 text-sm text-[#606060]">
              Rule nội bộ an toàn: trigger registry cố định, action hiện tại chỉ
              tạo notification, không webhook/shell/JS/SQL/HTTP.
            </p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[26rem_1fr] lg:p-8">
        <aside className="space-y-6">
          <section className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFC400] text-black">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-white">Tạo rule mới</h2>
                <p className="text-xs text-[#606060]">
                  Form chỉ tạo `create_notification`.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-[#FFC400]">
                  Tên rule
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Nhắc assignee khi task được giao"
                  className="mt-2 w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 text-sm text-white outline-none placeholder:text-[#606060] focus:border-[#FFC400]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-[#FFC400]">
                  Trigger
                </span>
                <select
                  value={triggerType}
                  onChange={(event) =>
                    setTriggerType(event.target.value as AutomationTrigger)
                  }
                  className="mt-2 w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 text-sm text-white outline-none focus:border-[#FFC400]"
                >
                  {automationTriggers.map((trigger) => (
                    <option key={trigger} value={trigger}>
                      {triggerLabels[trigger]} · {trigger}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-[#FFC400]">
                  Điều kiện JSON
                </span>
                <textarea
                  value={conditionsText}
                  onChange={(event) => setConditionsText(event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 font-mono text-xs text-white outline-none focus:border-[#FFC400]"
                />
                <span className="mt-1 block text-[11px] text-[#606060]">
                  Chỉ so khớp key/value trong payload; không chạy code.
                </span>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-[#FFC400]">
                  Người nhận
                </span>
                <select
                  value={recipientMode}
                  onChange={(event) =>
                    setRecipientMode(event.target.value as RecipientMode)
                  }
                  className="mt-2 w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 text-sm text-white outline-none focus:border-[#FFC400]"
                >
                  {recipientModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-[#FFC400]">
                  Tiêu đề notification
                </span>
                <input
                  value={actionTitle}
                  onChange={(event) => setActionTitle(event.target.value)}
                  placeholder="Để trống sẽ dùng tên rule/event"
                  className="mt-2 w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 text-sm text-white outline-none placeholder:text-[#606060] focus:border-[#FFC400]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-[#FFC400]">
                  Nội dung notification
                </span>
                <textarea
                  value={actionMessage}
                  onChange={(event) => setActionMessage(event.target.value)}
                  placeholder="Để trống sẽ dùng nội dung event mặc định"
                  className="mt-2 min-h-20 w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 text-sm text-white outline-none placeholder:text-[#606060] focus:border-[#FFC400]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-[#FFC400]">
                  Internal action URL
                </span>
                <input
                  value={actionUrl}
                  onChange={(event) => setActionUrl(event.target.value)}
                  placeholder="/app/tasks hoặc /app/chat"
                  className="mt-2 w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 text-sm text-white outline-none placeholder:text-[#606060] focus:border-[#FFC400]"
                />
              </label>

              <button
                type="button"
                disabled={working === "create" || name.trim().length < 2}
                onClick={createRule}
                className="w-full rounded-xl bg-[#FFC400] px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working === "create" ? "Đang tạo..." : "Tạo rule an toàn"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-5">
            <div className="flex items-center gap-3">
              <Play className="h-5 w-5 text-[#FFC400]" />
              <h2 className="font-bold text-white">Chạy automation</h2>
            </div>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                disabled={working === "scheduled"}
                onClick={runScheduled}
                className="w-full rounded-xl border border-[#FFC400]/20 px-4 py-3 text-sm font-bold text-[#FFC400] disabled:opacity-50"
              >
                {working === "scheduled"
                  ? "Đang quét lịch..."
                  : "Quét lịch: invoice overdue"}
              </button>

              <input
                value={manualEventKey}
                onChange={(event) => setManualEventKey(event.target.value)}
                placeholder="Manual event key, tối thiểu 8 ký tự"
                className="w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 text-sm text-white outline-none placeholder:text-[#606060] focus:border-[#FFC400]"
              />
              <textarea
                value={manualPayloadText}
                onChange={(event) => setManualPayloadText(event.target.value)}
                className="min-h-24 w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 font-mono text-xs text-white outline-none focus:border-[#FFC400]"
              />
              <button
                type="button"
                disabled={
                  working === "manual" || manualEventKey.trim().length < 8
                }
                onClick={runManual}
                className="w-full rounded-xl bg-[#151516] px-4 py-3 text-sm font-bold text-[#FFC400] disabled:opacity-50"
              >
                {working === "manual" ? "Đang chạy..." : "Chạy manual event"}
              </button>
            </div>
          </section>
        </aside>

        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-5">
              <div className="flex items-center justify-between text-[#606060]">
                <span className="text-xs font-bold uppercase">Rules</span>
                <Bot className="h-4 w-4 text-[#FFC400]" />
              </div>
              <div className="mt-3 text-3xl font-black text-white">
                {rules.length}
              </div>
              <div className="mt-1 text-xs text-emerald-400">
                {enabledCount} đang bật
              </div>
            </div>
            <div className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-5">
              <div className="flex items-center justify-between text-[#606060]">
                <span className="text-xs font-bold uppercase">Executions</span>
                <CheckCircle2 className="h-4 w-4 text-[#FFC400]" />
              </div>
              <div className="mt-3 text-3xl font-black text-white">
                {executions.length}
              </div>
              <div className="mt-1 text-xs text-[#606060]">
                30 lần chạy gần nhất
              </div>
            </div>
            <div className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-5">
              <div className="flex items-center justify-between text-[#606060]">
                <span className="text-xs font-bold uppercase">Security</span>
                <ShieldCheck className="h-4 w-4 text-[#FFC400]" />
              </div>
              <div className="mt-3 text-2xl font-black text-white">
                Controlled
              </div>
              <div className="mt-1 text-xs text-[#606060]">
                Không có arbitrary execution
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                {error}
              </div>
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {notice}
              </div>
            </div>
          ) : null}

          <section className="rounded-3xl border border-[#151516] bg-[#0E0E0F]">
            <div className="flex items-center justify-between border-b border-[#151516] p-5">
              <div>
                <h2 className="font-bold text-white">Automation rules</h2>
                <p className="mt-1 text-xs text-[#606060]">
                  Idempotency và failure isolation nằm ở database/service.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-xl border border-[#FFC400]/20 px-3 py-2 text-xs font-bold text-[#FFC400]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tải lại
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-[#606060]">
                <Loader2 className="h-4 w-4 animate-spin text-[#FFC400]" />
                Đang tải automation...
              </div>
            ) : rules.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-lg font-bold text-white">
                  Chưa có rule nào
                </div>
                <p className="mt-2 text-sm text-[#606060]">
                  Tạo rule đầu tiên ở form bên trái để bắt đầu automation nội
                  bộ.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#151516]">
                {rules.map((rule) => (
                  <article key={rule.id} className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-bold text-white">{rule.name}</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#151516] px-3 py-1 text-[11px] font-bold text-[#FFC400]">
                            {rule.triggerType}
                          </span>
                          <span className="rounded-full bg-[#151516] px-3 py-1 text-[11px] text-[#606060]">
                            {rule.actionType}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-black ${
                              rule.isEnabled
                                ? "bg-emerald-400 text-black"
                                : "bg-[#151516] text-[#606060]"
                            }`}
                          >
                            {rule.isEnabled ? "Đang bật" : "Đang tắt"}
                          </span>
                        </div>
                        <pre className="mt-3 max-w-full overflow-x-auto rounded-2xl bg-[#070707] p-3 text-[11px] text-[#FFF8E6]/70">
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
                      <button
                        type="button"
                        disabled={working === rule.id}
                        onClick={() => void toggleRule(rule)}
                        className="rounded-xl border border-[#FFC400]/20 px-4 py-2 text-xs font-bold text-[#FFC400] disabled:opacity-50"
                      >
                        {working === rule.id
                          ? "Đang lưu..."
                          : rule.isEnabled
                            ? "Tắt rule"
                            : "Bật rule"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[#151516] bg-[#0E0E0F]">
            <div className="border-b border-[#151516] p-5">
              <h2 className="font-bold text-white">Lịch sử execution</h2>
              <p className="mt-1 text-xs text-[#606060]">
                Các lỗi action được ghi nhận riêng để không làm vỡ luồng chính.
              </p>
            </div>
            <div className="divide-y divide-[#151516]">
              {executions.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#606060]">
                  Chưa có execution nào.
                </div>
              ) : (
                executions.map((execution) => (
                  <article key={execution.id} className="p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-bold text-white">
                          {execution.rule?.name ?? execution.triggerType}
                        </div>
                        <div className="mt-1 text-xs text-[#606060]">
                          {execution.eventKey}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-black ${statusClasses(execution.status)}`}
                        >
                          {execution.status}
                        </span>
                        <span className="text-xs text-[#606060]">
                          {formatDateTime(execution.createdAt)}
                        </span>
                      </div>
                    </div>
                    {execution.errorMessage ? (
                      <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                        {execution.errorMessage}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
