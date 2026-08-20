"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  CheckCircle2,
  Copy,
  GitBranch,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  servicesApi,
  type ServiceCatalogItem,
  type ServiceDeliveryItem,
} from "@/lib/api/services";
import {
  workflowsApi,
  type WorkflowApprovalScope,
  type WorkflowCompletionMode,
  type WorkflowTemplate,
  type WorkflowTemplateStage,
  type WorkflowTemplateStageItem,
  type WorkflowValidationResult,
} from "@/lib/api/workflows";

const emptyValidation: WorkflowValidationResult = {
  errors: [],
  warnings: [],
  stats: {
    stages: 0,
    requiredItems: 0,
    mappedRequiredItems: 0,
    optionalItems: 0,
    mappedOptionalItems: 0,
  },
};

export function WorkflowBuilder() {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [deliveryItems, setDeliveryItems] = useState<ServiceDeliveryItem[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [validation, setValidation] =
    useState<WorkflowValidationResult>(emptyValidation);
  const [draftName, setDraftName] = useState("");
  const [stageName, setStageName] = useState("");
  const [stageSla, setStageSla] = useState("");
  const [predecessorStageId, setPredecessorStageId] = useState("");
  const [successorStageId, setSuccessorStageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingService, setLoadingService] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceRequestId = useRef(0);
  const templateRequestId = useRef(0);

  useEffect(() => {
    void servicesApi
      .list({ active: true, page: 1, pageSize: 100 })
      .then((result) => setServices(result.items))
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Không thể tải dịch vụ.",
        ),
      )
      .finally(() => setLoadingServices(false));
  }, []);

  const openTemplate = useCallback(async (id: string) => {
    const requestId = ++templateRequestId.current;
    setLoadingTemplate(true);
    setError(null);
    try {
      const [detail, preview] = await Promise.all([
        workflowsApi.getTemplate(id),
        workflowsApi.validateTemplate(id),
      ]);
      if (requestId !== templateRequestId.current) return;
      setTemplate(detail);
      setValidation(preview);
    } catch (caught) {
      if (requestId !== templateRequestId.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể tải phiên bản quy trình.",
      );
    } finally {
      if (requestId === templateRequestId.current) setLoadingTemplate(false);
    }
  }, []);

  const loadService = useCallback(
    async (nextServiceId: string, preferredTemplateId?: string) => {
      const requestId = ++serviceRequestId.current;
      ++templateRequestId.current;
      setLoadingTemplate(false);
      setLoadingService(Boolean(nextServiceId));
      setError(null);
      setTemplates([]);
      setTemplate(null);
      setDeliveryItems([]);
      setValidation(emptyValidation);
      if (!nextServiceId) {
        setLoadingService(false);
        return;
      }
      try {
        const [versions, items] = await Promise.all([
          workflowsApi.listTemplates(nextServiceId),
          servicesApi.listDeliveryItems(nextServiceId),
        ]);
        if (requestId !== serviceRequestId.current) return;
        setTemplates(versions);
        setDeliveryItems(items.filter((item) => item.active !== false));
        const nextId =
          preferredTemplateId &&
          versions.some((item) => item.id === preferredTemplateId)
            ? preferredTemplateId
            : versions[0]?.id;
        if (nextId) await openTemplate(nextId);
      } catch (caught) {
        if (requestId !== serviceRequestId.current) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Không thể tải quy trình của dịch vụ.",
        );
      } finally {
        if (requestId === serviceRequestId.current) setLoadingService(false);
      }
    },
    [openTemplate],
  );

  const mutate = async (
    action: () => Promise<unknown>,
    preferredId?: string,
  ): Promise<boolean> => {
    if (!serviceId) return false;
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      const returnedId =
        result && typeof result === "object" && "id" in result
          ? String(result.id)
          : preferredId;
      await loadService(serviceId, returnedId ?? template?.id);
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Thao tác quy trình thất bại.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!serviceId || !draftName.trim()) return;
    const succeeded = await mutate(
      () =>
        workflowsApi.createTemplate({
          serviceId,
          name: draftName.trim(),
        }),
      undefined,
    );
    if (succeeded) setDraftName("");
  };

  const addStage = async (event: FormEvent) => {
    event.preventDefault();
    if (!template || !stageName.trim()) return;
    const succeeded = await mutate(
      () =>
        workflowsApi.createStage(template.id, {
          name: stageName.trim(),
          sortOrder:
            Math.max(
              0,
              ...(template.stages ?? []).map((stage) => stage.sort_order),
            ) + 1,
          isRequired: true,
          slaHours: stageSla ? Number(stageSla) : null,
        }),
      template.id,
    );
    if (succeeded) {
      setStageName("");
      setStageSla("");
    }
  };

  const publish = async () => {
    if (!template) return;
    setBusy(true);
    setError(null);
    try {
      const preview = await workflowsApi.validateTemplate(template.id);
      setValidation(preview);
      if (preview.errors.length > 0) return;
      const published = await workflowsApi.publishTemplate(template.id);
      await loadService(serviceId, published.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể xuất bản quy trình.",
      );
    } finally {
      setBusy(false);
    }
  };

  const stages = useMemo(
    () =>
      [...(template?.stages ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [template?.stages],
  );
  const editable = template?.status === "draft";
  const interactionBusy = busy || loadingService || loadingTemplate;

  return (
    <div className="space-y-6 p-6" data-testid="workflow-builder">
      <div>
        <h1 className="text-2xl font-bold">Trình dựng quy trình dịch vụ</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý phiên bản, giai đoạn, hạng mục bàn giao, SLA, phê duyệt và phụ
          thuộc.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-[minmax(220px,1fr)_2fr]">
          <Select
            aria-label="Dịch vụ"
            value={serviceId}
            disabled={loadingServices || busy}
            onChange={(event) => {
              const next = event.target.value;
              setServiceId(next);
              void loadService(next);
            }}
          >
            <option value="">Chọn dịch vụ</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.code} — {service.name}
              </option>
            ))}
          </Select>
          <form onSubmit={createDraft} className="flex gap-2">
            <Input
              aria-label="Tên bản nháp"
              placeholder="Tên quy trình mới"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              disabled={!serviceId || interactionBusy}
            />
            <Button
              type="submit"
              disabled={!serviceId || !draftName.trim() || interactionBusy}
            >
              <Plus className="mr-2 h-4 w-4" /> Tạo Draft
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Phiên bản Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(loadingService || loadingTemplate) && (
              <p role="status" className="text-sm text-muted-foreground">
                Đang tải quy trình…
              </p>
            )}
            {!loadingService && templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có phiên bản.
              </p>
            ) : (
              templates.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  disabled={interactionBusy}
                  onClick={() => void openTemplate(version.id)}
                  className={`w-full rounded-lg border p-3 text-left ${
                    template?.id === version.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">
                      {version.workflow_code}
                    </span>
                    <span className="text-xs font-semibold">
                      v{version.version}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold">{version.name}</p>
                  <div className="mt-2 flex gap-1">
                    <Badge
                      variant={
                        version.status === "published" ? "default" : "outline"
                      }
                    >
                      {version.status}
                    </Badge>
                    {version.is_default && (
                      <Badge variant="outline">Mặc định</Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {!template ? (
          <Card className="p-10 text-center text-muted-foreground">
            Chọn dịch vụ và phiên bản để bắt đầu.
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{template.name}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {template.workflow_code} · v{template.version}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={interactionBusy}
                      onClick={() =>
                        void mutate(() =>
                          workflowsApi.cloneTemplate(template.id),
                        )
                      }
                    >
                      <Copy className="mr-2 h-4 w-4" /> Clone
                    </Button>
                    <Button
                      disabled={
                        !editable ||
                        interactionBusy ||
                        validation.errors.length > 0
                      }
                      onClick={() => void publish()}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Publish
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        template.status !== "published" ||
                        template.is_default ||
                        interactionBusy
                      }
                      onClick={() =>
                        void mutate(
                          () => workflowsApi.setDefault(template.id),
                          template.id,
                        )
                      }
                    >
                      <Save className="mr-2 h-4 w-4" /> Set Default
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        template.status !== "published" || interactionBusy
                      }
                      onClick={() =>
                        void mutate(
                          () => workflowsApi.archiveTemplate(template.id),
                          template.id,
                        )
                      }
                    >
                      <Archive className="mr-2 h-4 w-4" /> Archive
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Required mapped
                    </p>
                    <p className="font-bold">
                      {validation.stats.mappedRequiredItems}/
                      {validation.stats.requiredItems}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Optional mapped
                    </p>
                    <p className="font-bold">
                      {validation.stats.mappedOptionalItems}/
                      {validation.stats.optionalItems}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Errors</p>
                    <p className="font-bold text-rose-600">
                      {validation.errors.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Warnings</p>
                    <p className="font-bold text-amber-600">
                      {validation.warnings.length}
                    </p>
                  </div>
                </div>
                {(validation.errors.length > 0 ||
                  validation.warnings.length > 0) && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <ul className="text-xs text-rose-700">
                      {validation.errors.map((code) => (
                        <li key={code}>• {code}</li>
                      ))}
                    </ul>
                    <ul className="text-xs text-amber-700">
                      {validation.warnings.map((code) => (
                        <li key={code}>• {code}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editable && (
                  <form
                    onSubmit={addStage}
                    className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"
                  >
                    <Input
                      aria-label="Tên Stage"
                      placeholder="Tên Stage"
                      value={stageName}
                      disabled={interactionBusy}
                      onChange={(event) => setStageName(event.target.value)}
                    />
                    <Input
                      aria-label="SLA Stage"
                      type="number"
                      min={1}
                      placeholder="SLA giờ"
                      value={stageSla}
                      disabled={interactionBusy}
                      onChange={(event) => setStageSla(event.target.value)}
                    />
                    <Button
                      type="submit"
                      disabled={!stageName.trim() || interactionBusy}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Stage
                    </Button>
                  </form>
                )}

                {stages.map((stage) => (
                  <StageEditor
                    key={stage.id}
                    stage={stage}
                    deliveryItems={deliveryItems}
                    editable={editable}
                    busy={interactionBusy}
                    onMutate={(action) => mutate(action, template.id)}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stage Dependencies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
                  <Select
                    aria-label="Stage trước"
                    value={predecessorStageId}
                    disabled={!editable}
                    onChange={(event) =>
                      setPredecessorStageId(event.target.value)
                    }
                  >
                    <option value="">Stage trước</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </Select>
                  <GitBranch className="m-auto h-4 w-4" />
                  <Select
                    aria-label="Stage sau"
                    value={successorStageId}
                    disabled={!editable}
                    onChange={(event) =>
                      setSuccessorStageId(event.target.value)
                    }
                  >
                    <option value="">Stage sau</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    disabled={
                      !editable ||
                      !predecessorStageId ||
                      !successorStageId ||
                      predecessorStageId === successorStageId ||
                      interactionBusy
                    }
                    onClick={() =>
                      void mutate(
                        () =>
                          workflowsApi.createStageDependency(template.id, {
                            predecessorStageId,
                            successorStageId,
                            lagHours: 0,
                          }),
                        template.id,
                      )
                    }
                  >
                    Thêm phụ thuộc
                  </Button>
                </div>
                {(template.stage_deps ?? []).map((dependency) => (
                  <div
                    key={dependency.id}
                    className="flex items-center justify-between rounded border p-2 text-sm"
                  >
                    <span>
                      {
                        stages.find(
                          (stage) =>
                            stage.id === dependency.predecessor_stage_id,
                        )?.name
                      }
                      {" → "}
                      {
                        stages.find(
                          (stage) => stage.id === dependency.successor_stage_id,
                        )?.name
                      }
                    </span>
                    {editable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={interactionBusy}
                        onClick={() =>
                          void mutate(
                            () =>
                              workflowsApi.deleteStageDependency(dependency.id),
                            template.id,
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function StageEditor({
  stage,
  deliveryItems,
  editable,
  busy,
  onMutate,
}: {
  stage: WorkflowTemplateStage;
  deliveryItems: ServiceDeliveryItem[];
  editable: boolean;
  busy: boolean;
  onMutate: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(stage.name);
  const [editSla, setEditSla] = useState(
    stage.sla_hours === null || stage.sla_hours === undefined
      ? ""
      : String(stage.sla_hours),
  );
  const [deliveryItemId, setDeliveryItemId] = useState("");
  const [completionMode, setCompletionMode] =
    useState<WorkflowCompletionMode>("tasks_done");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [approvalScope, setApprovalScope] =
    useState<WorkflowApprovalScope>("internal");
  const [slaHours, setSlaHours] = useState("");
  const [autoCreateTask, setAutoCreateTask] = useState(true);
  const effectiveApprovalRequired =
    completionMode === "tasks_done_and_approval" || approvalRequired;
  const mappedIds = new Set(
    (stage.items ?? []).map((item) => item.service_delivery_item_id),
  );

  return (
    <div className="rounded-xl border p-4" data-testid="workflow-stage">
      <div className="flex items-start justify-between gap-3">
        <div>
          {editing ? (
            <div className="flex gap-2">
              <Input
                aria-label="Chỉnh tên Stage"
                value={editName}
                disabled={busy}
                onChange={(event) => setEditName(event.target.value)}
              />
              <Input
                aria-label="Chỉnh SLA Stage"
                className="w-28"
                type="number"
                min={1}
                value={editSla}
                disabled={busy}
                onChange={(event) => setEditSla(event.target.value)}
              />
            </div>
          ) : (
            <p className="font-semibold">
              {stage.sort_order}. {stage.name}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {stage.is_required ? "Bắt buộc" : "Tùy chọn"} · SLA{" "}
            {stage.sla_hours ?? "—"}h
          </p>
        </div>
        {editable && (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || (editing && !editName.trim())}
              onClick={() => {
                if (!editing) {
                  setEditing(true);
                  return;
                }
                void onMutate(() =>
                  workflowsApi.updateStage(stage.id, {
                    name: editName.trim(),
                    slaHours: editSla ? Number(editSla) : null,
                  }),
                ).then((succeeded) => {
                  if (succeeded) setEditing(false);
                });
              }}
            >
              <Save className="mr-1 h-3 w-3" />
              {editing ? "Save Stage" : "Edit Stage"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void onMutate(() => workflowsApi.deleteStage(stage.id))
              }
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {(stage.items ?? []).map((item) => (
          <MappedItemEditor
            key={item.id}
            item={item}
            delivery={deliveryItems.find(
              (candidate) => candidate.id === item.service_delivery_item_id,
            )}
            editable={editable}
            busy={busy}
            onMutate={onMutate}
          />
        ))}
      </div>

      {editable && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <Select
            aria-label={`Delivery Item ${stage.name}`}
            value={deliveryItemId}
            disabled={busy}
            onChange={(event) => setDeliveryItemId(event.target.value)}
          >
            <option value="">Delivery Item</option>
            {deliveryItems
              .filter((item) => !mappedIds.has(item.id))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.is_required ? "*" : ""}
                </option>
              ))}
          </Select>
          <Select
            aria-label="Completion Mode"
            value={completionMode}
            disabled={busy}
            onChange={(event) => {
              setCompletionMode(event.target.value as WorkflowCompletionMode);
            }}
          >
            <option value="manual">Manual</option>
            <option value="tasks_done">Tasks Done</option>
            <option value="tasks_done_and_approval">Tasks + Approval</option>
          </Select>
          <Input
            aria-label="SLA Hours"
            type="number"
            min={1}
            placeholder="SLA Hours"
            value={slaHours}
            disabled={busy}
            onChange={(event) => setSlaHours(event.target.value)}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={autoCreateTask}
              disabled={busy}
              onChange={(event) => setAutoCreateTask(event.target.checked)}
            />
            Auto Create Task
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={effectiveApprovalRequired}
              disabled={completionMode === "tasks_done_and_approval" || busy}
              onChange={(event) => setApprovalRequired(event.target.checked)}
            />
            Approval Required
          </label>
          <Select
            aria-label="Approval Scope"
            disabled={!effectiveApprovalRequired || busy}
            value={approvalScope}
            onChange={(event) =>
              setApprovalScope(event.target.value as WorkflowApprovalScope)
            }
          >
            <option value="internal">Internal</option>
            <option value="client">Client</option>
            <option value="both">Both</option>
          </Select>
          <Button
            disabled={!deliveryItemId || busy}
            onClick={() =>
              void onMutate(() =>
                workflowsApi.mapItem(stage.id, {
                  serviceDeliveryItemId: deliveryItemId,
                  sortOrder: (stage.items?.length ?? 0) + 1,
                  completionMode,
                  approvalRequired: effectiveApprovalRequired,
                  approvalScope,
                  slaHours: slaHours ? Number(slaHours) : null,
                  autoCreateTask,
                }),
              ).then((succeeded) => {
                if (succeeded) setDeliveryItemId("");
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Map Delivery Item
          </Button>
        </div>
      )}
    </div>
  );
}

function MappedItemEditor({
  item,
  delivery,
  editable,
  busy,
  onMutate,
}: {
  item: WorkflowTemplateStageItem;
  delivery?: ServiceDeliveryItem;
  editable: boolean;
  busy: boolean;
  onMutate: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [completionMode, setCompletionMode] = useState<WorkflowCompletionMode>(
    item.completion_mode,
  );
  const [approvalRequired, setApprovalRequired] = useState(
    item.approval_required,
  );
  const [approvalScope, setApprovalScope] = useState<WorkflowApprovalScope>(
    item.approval_scope ?? "internal",
  );
  const [slaHours, setSlaHours] = useState(
    item.sla_hours === null || item.sla_hours === undefined
      ? ""
      : String(item.sla_hours),
  );
  const [autoCreateTask, setAutoCreateTask] = useState(item.auto_create_task);
  const effectiveApprovalRequired =
    completionMode === "tasks_done_and_approval" || approvalRequired;

  const reset = () => {
    setCompletionMode(item.completion_mode);
    setApprovalRequired(item.approval_required);
    setApprovalScope(item.approval_scope ?? "internal");
    setSlaHours(
      item.sla_hours === null || item.sla_hours === undefined
        ? ""
        : String(item.sla_hours),
    );
    setAutoCreateTask(item.auto_create_task);
  };

  const save = async () => {
    const succeeded = await onMutate(() =>
      workflowsApi.updateMappedItem(item.id, {
        completionMode,
        approvalRequired: effectiveApprovalRequired,
        approvalScope,
        slaHours: slaHours ? Number(slaHours) : null,
        autoCreateTask,
      }),
    );
    if (succeeded) setEditing(false);
  };

  return (
    <div className="rounded-lg bg-slate-50 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">
            {delivery?.name ?? item.service_delivery_item_code}
          </p>
          <p className="text-muted-foreground">
            {item.completion_mode} · approval{" "}
            {item.approval_required ? (item.approval_scope ?? "—") : "off"} ·
            SLA {item.sla_hours ?? "—"}h · task{" "}
            {item.auto_create_task ? "auto" : "manual"}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setEditing((current) => !current)}
            >
              Edit Delivery Item
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void onMutate(() => workflowsApi.removeMappedItem(item.id))
              }
            >
              <Trash2 className="h-4 w-4 text-rose-600" /> Remove Delivery Item
            </Button>
          </div>
        )}
      </div>

      {editable && editing && (
        <div className="mt-3 grid gap-2 rounded-lg border bg-white p-3 md:grid-cols-3">
          <Select
            aria-label={`Mapped Completion Mode ${item.id}`}
            value={completionMode}
            disabled={busy}
            onChange={(event) =>
              setCompletionMode(event.target.value as WorkflowCompletionMode)
            }
          >
            <option value="manual">Manual</option>
            <option value="tasks_done">Tasks Done</option>
            <option value="tasks_done_and_approval">Tasks + Approval</option>
          </Select>
          <Input
            aria-label={`Mapped SLA Hours ${item.id}`}
            type="number"
            min={1}
            placeholder="SLA Hours"
            value={slaHours}
            disabled={busy}
            onChange={(event) => setSlaHours(event.target.value)}
          />
          <Select
            aria-label={`Mapped Approval Scope ${item.id}`}
            disabled={!effectiveApprovalRequired || busy}
            value={approvalScope}
            onChange={(event) =>
              setApprovalScope(event.target.value as WorkflowApprovalScope)
            }
          >
            <option value="internal">Internal</option>
            <option value="client">Client</option>
            <option value="both">Both</option>
          </Select>
          <label className="flex items-center gap-2">
            <input
              aria-label={`Mapped Auto Create Task ${item.id}`}
              type="checkbox"
              checked={autoCreateTask}
              disabled={busy}
              onChange={(event) => setAutoCreateTask(event.target.checked)}
            />
            Auto Create Task
          </label>
          <label className="flex items-center gap-2">
            <input
              aria-label={`Mapped Approval Required ${item.id}`}
              type="checkbox"
              checked={effectiveApprovalRequired}
              disabled={completionMode === "tasks_done_and_approval" || busy}
              onChange={(event) => setApprovalRequired(event.target.checked)}
            />
            Approval Required
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              <Save className="mr-1 h-3 w-3" /> Save Delivery Item
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                reset();
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
