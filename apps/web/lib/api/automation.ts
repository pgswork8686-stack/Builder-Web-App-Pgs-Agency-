import { request } from "./client";

export const automationTriggers = [
  "task.created",
  "task.assigned",
  "task.updated",
  "task.due_soon",
  "project.updated",
  "leave.submitted",
  "leave.approved",
  "leave.rejected",
  "attendance.adjustment_requested",
  "contract.status_changed",
  "invoice.issued",
  "invoice.overdue",
  "invoice.payment_recorded",
  "chat.message",
] as const;

export type AutomationTrigger = (typeof automationTriggers)[number];
export type AutomationAction = "create_notification";
export type AutomationExecutionStatus =
  "running" | "success" | "failed" | "skipped";

export interface AutomationRule {
  id: string;
  name: string;
  triggerType: AutomationTrigger;
  conditions: Record<string, unknown>;
  actionType: AutomationAction;
  actionConfig: Record<string, unknown>;
  isEnabled: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  eventKey: string;
  triggerType: AutomationTrigger;
  actionType: AutomationAction;
  status: AutomationExecutionStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  errorMessage: string | null;
  executedAt: string;
  createdAt: string;
  rule?: { id: string; name: string } | null;
}

export interface PaginatedAutomationRules {
  items: AutomationRule[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedAutomationExecutions {
  items: AutomationExecution[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function paramsFrom(
  values: Record<string, string | number | boolean | undefined>,
) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export const automationApi = {
  listRules(
    query: {
      page?: number;
      pageSize?: number;
      triggerType?: AutomationTrigger;
      enabled?: boolean;
    } = {},
  ) {
    return request<PaginatedAutomationRules>(
      `/automation/rules?${paramsFrom(query)}`,
    );
  },

  createRule(payload: {
    name: string;
    triggerType: AutomationTrigger;
    conditions?: Record<string, unknown>;
    actionType?: AutomationAction;
    actionConfig?: Record<string, unknown>;
    isEnabled?: boolean;
  }) {
    return request<AutomationRule>("/automation/rules", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateRule(
    ruleId: string,
    payload: Partial<{
      name: string;
      triggerType: AutomationTrigger;
      conditions: Record<string, unknown>;
      actionType: AutomationAction;
      actionConfig: Record<string, unknown>;
      isEnabled: boolean;
    }>,
  ) {
    return request<AutomationRule>(`/automation/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  listExecutions(
    query: {
      page?: number;
      pageSize?: number;
      ruleId?: string;
      triggerType?: AutomationTrigger;
      status?: AutomationExecutionStatus;
    } = {},
  ) {
    return request<PaginatedAutomationExecutions>(
      `/automation/executions?${paramsFrom(query)}`,
    );
  },

  runManualEvent(payload: {
    triggerType: AutomationTrigger;
    eventKey: string;
    payload?: Record<string, unknown>;
  }) {
    return request<{ matchedRules: number; executions: unknown[] }>(
      "/automation/events/manual",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  runScheduled() {
    return request<{
      businessDate: string;
      invoiceOverdueScanned: number;
      executions: unknown[];
    }>("/automation/run-scheduled", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
};
