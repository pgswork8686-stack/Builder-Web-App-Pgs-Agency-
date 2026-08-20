"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  LockKeyhole,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectService } from "@/lib/api/projects";
import {
  workflowsApi,
  type ProjectWorkflow,
  type ProjectWorkflowStage,
  type WorkflowApprovalRequest,
} from "@/lib/api/workflows";

function latestApprovalsForTarget(
  approvals: WorkflowApprovalRequest[],
  target: "stage" | "item",
  targetId: string,
): WorkflowApprovalRequest[] {
  const latestByType = new Map<
    WorkflowApprovalRequest["approval_type"],
    WorkflowApprovalRequest
  >();
  for (const approval of approvals) {
    const matches =
      target === "stage"
        ? approval.project_workflow_stage_id === targetId &&
          !approval.project_workflow_stage_item_id
        : approval.project_workflow_stage_item_id === targetId;
    if (!matches) continue;
    const current = latestByType.get(approval.approval_type);
    if (
      !current ||
      Date.parse(approval.requested_at) >= Date.parse(current.requested_at)
    ) {
      latestByType.set(approval.approval_type, approval);
    }
  }
  return (["internal", "client"] as const).flatMap((type) => {
    const approval = latestByType.get(type);
    return approval ? [approval] : [];
  });
}

function approvalSummary(approvals: WorkflowApprovalRequest[]): string {
  return approvals
    .map(
      (approval) => `Approval ${approval.status} (${approval.approval_type})`,
    )
    .join(" · ");
}

export function ProjectWorkflowPanel({
  projectId,
  projectServices,
  canMutate,
  mode,
}: {
  projectId: string;
  projectServices: ProjectService[];
  canMutate: boolean;
  mode: "admin" | "internal";
}) {
  const [workflows, setWorkflows] = useState<ProjectWorkflow[]>([]);
  const [noDefault, setNoDefault] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkflows(await workflowsApi.getProjectWorkflows(projectId));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tải quy trình.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const workflowServiceIds = useMemo(
    () => new Set(workflows.map((workflow) => workflow.project_service_id)),
    [workflows],
  );

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Thao tác quy trình thất bại.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const instantiate = async (service: ProjectService) => {
    setBusyId(service.id);
    setError(null);
    try {
      const result = await workflowsApi.instantiateProjectServiceWorkflow(
        projectId,
        service.id,
      );
      if (!result.instantiated && result.reason === "no_default_workflow") {
        setNoDefault((current) => new Set(current).add(service.id));
      } else {
        setNoDefault((current) => {
          const next = new Set(current);
          next.delete(service.id);
          return next;
        });
        await load();
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể khởi tạo quy trình.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading)
    return <p className="text-sm text-muted-foreground">Đang tải quy trình…</p>;

  return (
    <div className="space-y-4" data-testid="project-workflow-panel">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      {projectServices
        .filter((service) => !workflowServiceIds.has(service.id))
        .map((service) => (
          <Card key={service.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div>
                <p className="font-semibold">
                  {service.service?.name ?? "Dịch vụ"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {noDefault.has(service.id)
                    ? "Dịch vụ chưa có quy trình mặc định"
                    : "Chưa khởi tạo quy trình"}
                </p>
              </div>
              {canMutate && !noDefault.has(service.id) && (
                <Button
                  disabled={busyId === service.id}
                  onClick={() => void instantiate(service)}
                >
                  <Play className="mr-2 h-4 w-4" /> Khởi tạo quy trình
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

      {workflows.length === 0 && projectServices.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Dự án chưa có dịch vụ để khởi tạo quy trình.
        </Card>
      )}

      {workflows.map((workflow) => (
        <Card key={workflow.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{workflow.name_snapshot}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {workflow.project_workflow_code} · source v
                  {workflow.source_workflow_version ?? "—"}
                </p>
              </div>
              <div className="text-right">
                <Badge
                  variant={workflow.status === "completed" ? "success" : "blue"}
                >
                  {workflow.status}
                </Badge>
                <p className="mt-1 text-xs font-semibold">
                  Tiến độ {workflow.progress?.percent ?? 0}% (
                  {workflow.progress?.completedItems ?? 0}/
                  {workflow.progress?.requiredItems ?? 0})
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {canMutate && workflow.status === "not_started" && (
              <Button
                size="sm"
                disabled={busyId === workflow.id}
                onClick={() =>
                  void run(workflow.id, () =>
                    workflowsApi.startWorkflow(projectId, workflow.id),
                  )
                }
              >
                <Play className="mr-2 h-4 w-4" /> Bắt đầu Workflow
              </Button>
            )}
            {[...(workflow.stages ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((stage) => (
                <WorkflowStageCard
                  key={stage.id}
                  stage={stage}
                  workflow={workflow}
                  projectId={projectId}
                  canMutate={canMutate}
                  busyId={busyId}
                  taskBase={
                    mode === "admin"
                      ? `/app/admin/projects/${projectId}/tasks`
                      : `/app/projects/${projectId}/tasks`
                  }
                  onRun={run}
                />
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WorkflowStageCard({
  stage,
  workflow,
  projectId,
  canMutate,
  busyId,
  taskBase,
  onRun,
}: {
  stage: ProjectWorkflowStage;
  workflow: ProjectWorkflow;
  projectId: string;
  canMutate: boolean;
  busyId: string | null;
  taskBase: string;
  onRun: (id: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  const statusIcon = {
    completed: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    in_progress: <Circle className="h-5 w-5 fill-blue-500 text-blue-500" />,
    ready: <Circle className="h-5 w-5 text-blue-500" />,
    locked: <LockKeyhole className="h-5 w-5 text-slate-400" />,
    skipped: <CheckCircle2 className="h-5 w-5 text-slate-400" />,
  }[stage.status];
  const stageApprovals = latestApprovalsForTarget(
    workflow.approvals ?? [],
    "stage",
    stage.id,
  );

  return (
    <div
      className="rounded-xl border p-4"
      data-testid={`project-stage-${stage.status}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          {statusIcon}
          <div>
            <p className="font-semibold">{stage.name_snapshot}</p>
            <p className="text-xs text-muted-foreground">
              {stage.project_workflow_stage_code} · {stage.status}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canMutate && stage.status === "ready" && (
            <Button
              size="sm"
              disabled={busyId === stage.id}
              onClick={() =>
                void onRun(stage.id, () =>
                  workflowsApi.startStage(projectId, stage.id),
                )
              }
            >
              Bắt đầu Stage
            </Button>
          )}
          {canMutate && stage.status === "in_progress" && (
            <Button
              size="sm"
              disabled={busyId === stage.id}
              onClick={() =>
                void onRun(stage.id, () =>
                  workflowsApi.completeStage(projectId, stage.id),
                )
              }
            >
              Hoàn thành Stage
            </Button>
          )}
        </div>
      </div>

      {stage.status === "locked" && (
        <p className="mt-2 text-xs text-amber-700">
          Bị khóa bởi Stage tiền nhiệm.
        </p>
      )}
      {stage.due_at && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="h-3 w-3" /> SLA due{" "}
          {new Date(stage.due_at).toLocaleString("vi-VN")}
        </p>
      )}
      {stageApprovals.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {approvalSummary(stageApprovals)}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {(stage.items ?? []).map((item) => {
          const approvals = latestApprovalsForTarget(
            workflow.approvals ?? [],
            "item",
            item.id,
          );
          return (
            <div
              key={item.id}
              className="rounded-lg bg-slate-50 p-3 text-xs"
              data-testid={`project-item-${item.id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {item.project_service_item?.name ??
                      item.project_service_item_code}
                  </p>
                  <p className="text-muted-foreground">
                    {item.status}
                    {item.status === "blocked"
                      ? " · Blocked by Item dependency"
                      : ""}
                    {item.due_at
                      ? ` · SLA ${new Date(item.due_at).toLocaleString("vi-VN")}`
                      : ""}
                    {approvals.length > 0
                      ? ` · ${approvalSummary(approvals)}`
                      : ""}
                  </p>
                </div>
                {canMutate &&
                  ["ready", "in_progress"].includes(item.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() =>
                        void onRun(item.id, () =>
                          workflowsApi.completeItem(projectId, item.id),
                        )
                      }
                    >
                      Hoàn thành Item
                    </Button>
                  )}
              </div>
              {(item.task_links ?? []).map((link) => (
                <Link
                  key={link.id}
                  href={`${taskBase}/${link.task_id}`}
                  className="mt-2 flex items-center gap-1 text-blue-600 hover:underline"
                  data-task-id={link.task_id}
                >
                  Task {link.task?.title ?? link.task_id} (
                  {link.task?.status ?? "—"})
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
