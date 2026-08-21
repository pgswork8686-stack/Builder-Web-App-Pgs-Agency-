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
import { Input } from "@/components/ui/input";
import type { ProjectService } from "@/lib/api/projects";
import {
  workflowsApi,
  type ProjectWorkflow,
  type ProjectWorkflowItemDependency,
  type ProjectWorkflowStage,
  type ProjectWorkflowStageDependency,
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

function dependencyEligibleAt(
  dependency: ProjectWorkflowStageDependency | ProjectWorkflowItemDependency,
  predecessorCompletedAt?: string | null,
): string | null {
  if (dependency.eligible_at) return dependency.eligible_at;
  if (!predecessorCompletedAt) return null;
  const completedAt = Date.parse(predecessorCompletedAt);
  if (Number.isNaN(completedAt)) return null;
  return new Date(
    completedAt + dependency.lag_hours * 60 * 60 * 1000,
  ).toISOString();
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

  const run = async (
    id: string,
    action: () => Promise<unknown>,
  ): Promise<boolean> => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Thao tác quy trình thất bại.",
      );
      return false;
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
  onRun: (id: string, action: () => Promise<unknown>) => Promise<boolean>;
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
  const incomingStageDependencies = (workflow.stage_dependencies ?? []).filter(
    (dependency) => dependency.successor_stage_id === stage.id,
  );
  const workflowItems = (workflow.stages ?? []).flatMap(
    (workflowStage) => workflowStage.items ?? [],
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

      {stage.status === "locked" && incomingStageDependencies.length === 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Bị khóa bởi Stage tiền nhiệm.
        </p>
      )}
      {stage.status === "locked" &&
        incomingStageDependencies.map((dependency) => {
          const predecessor = (workflow.stages ?? []).find(
            (candidate) => candidate.id === dependency.predecessor_stage_id,
          );
          return (
            <DependencyReason
              key={dependency.id}
              dependency={dependency}
              predecessorName={
                predecessor?.name_snapshot ?? dependency.predecessor_stage_id
              }
              predecessorStatus={predecessor?.status}
              eligibleAt={dependencyEligibleAt(
                dependency,
                predecessor?.completed_at,
              )}
              canMutate={canMutate}
              busyId={busyId}
              onRun={onRun}
              projectId={projectId}
            />
          );
        })}
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
      <ApprovalRequestControls
        approvals={stageApprovals}
        target="stage"
        targetId={stage.id}
        targetLabel={stage.name_snapshot}
        workflowId={workflow.id}
        projectId={projectId}
        canMutate={canMutate}
        busyId={busyId}
        onRun={onRun}
      />

      <div className="mt-3 space-y-2">
        {(stage.items ?? []).map((item) => {
          const approvals = latestApprovalsForTarget(
            workflow.approvals ?? [],
            "item",
            item.id,
          );
          const incomingItemDependencies = (
            workflow.item_dependencies ?? []
          ).filter(
            (dependency) => dependency.successor_stage_item_id === item.id,
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
                    {item.status === "blocked" &&
                    incomingItemDependencies.length === 0
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
              {item.status === "blocked" &&
                incomingItemDependencies.map((dependency) => {
                  const predecessor = workflowItems.find(
                    (candidate) =>
                      candidate.id === dependency.predecessor_stage_item_id,
                  );
                  return (
                    <DependencyReason
                      key={dependency.id}
                      dependency={dependency}
                      predecessorName={
                        predecessor?.project_service_item?.name ??
                        predecessor?.project_service_item_code ??
                        dependency.predecessor_stage_item_id
                      }
                      predecessorStatus={predecessor?.status}
                      eligibleAt={dependencyEligibleAt(
                        dependency,
                        predecessor?.completed_at,
                      )}
                      canMutate={canMutate}
                      busyId={busyId}
                      onRun={onRun}
                      projectId={projectId}
                    />
                  );
                })}
              <ApprovalRequestControls
                approvals={approvals}
                target="item"
                targetId={item.id}
                targetLabel={
                  item.project_service_item?.name ??
                  item.project_service_item_code ??
                  item.id
                }
                workflowId={workflow.id}
                projectId={projectId}
                canMutate={canMutate}
                busyId={busyId}
                onRun={onRun}
              />
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

function DependencyReason({
  dependency,
  predecessorName,
  predecessorStatus,
  eligibleAt,
  canMutate,
  busyId,
  onRun,
  projectId,
}: {
  dependency: ProjectWorkflowStageDependency | ProjectWorkflowItemDependency;
  predecessorName: string;
  predecessorStatus?: string;
  eligibleAt: string | null;
  canMutate: boolean;
  busyId: string | null;
  onRun: (id: string, action: () => Promise<unknown>) => Promise<boolean>;
  projectId: string;
}) {
  const [reason, setReason] = useState("");
  const actionId = `dependency:${dependency.id}`;
  const actionBusy = busyId !== null;

  return (
    <div
      className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
      data-testid={`dependency-reason-${dependency.id}`}
      data-eligible-at={eligibleAt ?? undefined}
    >
      {dependency.overridden_at ? (
        <p>
          Đã bỏ qua phụ thuộc từ {predecessorName}
          {dependency.override_reason ? `: ${dependency.override_reason}` : "."}
        </p>
      ) : (
        <p>
          Chờ {predecessorName}
          {predecessorStatus ? ` (${predecessorStatus})` : ""}. Độ trễ:{" "}
          {dependency.lag_hours}h
          {eligibleAt
            ? ` · Đủ điều kiện: ${new Date(eligibleAt).toLocaleString("vi-VN")}`
            : ""}
        </p>
      )}
      {canMutate && !dependency.overridden_at && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            aria-label={`Override reason ${dependency.id}`}
            className="h-8 min-w-56 flex-1 bg-white"
            placeholder="Lý do bỏ qua phụ thuộc"
            value={reason}
            disabled={actionBusy}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            aria-label={`Override dependency ${dependency.id}`}
            size="sm"
            variant="outline"
            disabled={reason.trim().length < 3 || actionBusy}
            onClick={() => {
              const nextReason = reason.trim();
              void onRun(actionId, () =>
                workflowsApi.overrideDependency(
                  projectId,
                  dependency.id,
                  nextReason,
                ),
              ).then((succeeded) => {
                if (succeeded) setReason("");
              });
            }}
          >
            Bỏ qua phụ thuộc
          </Button>
        </div>
      )}
    </div>
  );
}

function ApprovalRequestControls({
  approvals,
  target,
  targetId,
  targetLabel,
  workflowId,
  projectId,
  canMutate,
  busyId,
  onRun,
}: {
  approvals: WorkflowApprovalRequest[];
  target: "stage" | "item";
  targetId: string;
  targetLabel: string;
  workflowId: string;
  projectId: string;
  canMutate: boolean;
  busyId: string | null;
  onRun: (id: string, action: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [requestNote, setRequestNote] = useState("");
  if (!canMutate) return null;

  const actionBusy = busyId !== null;
  const pendingTypes = new Set(
    approvals
      .filter((approval) => approval.status === "pending")
      .map((approval) => approval.approval_type),
  );
  const request = async (approvalType: "internal" | "client") => {
    const succeeded = await onRun(`approval:${targetId}:${approvalType}`, () =>
      workflowsApi.requestApproval(projectId, workflowId, {
        ...(target === "stage"
          ? { stageId: targetId }
          : { stageItemId: targetId }),
        approvalType,
        requestNote: requestNote.trim() || undefined,
      }),
    );
    if (succeeded) setRequestNote("");
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2 rounded-lg border bg-white p-2">
      <Input
        aria-label={`Approval note ${targetId}`}
        className="h-8 min-w-56 flex-1"
        placeholder="Ghi chú yêu cầu duyệt"
        value={requestNote}
        disabled={actionBusy}
        onChange={(event) => setRequestNote(event.target.value)}
      />
      <Button
        aria-label={`Request internal approval for ${targetLabel}`}
        size="sm"
        variant="outline"
        disabled={pendingTypes.has("internal") || actionBusy}
        onClick={() => void request("internal")}
      >
        {pendingTypes.has("internal")
          ? "Đang chờ duyệt nội bộ"
          : "Yêu cầu duyệt nội bộ"}
      </Button>
      <Button
        aria-label={`Request client approval for ${targetLabel}`}
        size="sm"
        variant="outline"
        disabled={pendingTypes.has("client") || actionBusy}
        onClick={() => void request("client")}
      >
        {pendingTypes.has("client")
          ? "Đang chờ duyệt khách hàng"
          : "Yêu cầu duyệt khách hàng"}
      </Button>
    </div>
  );
}
