import { ConflictException } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { WorkflowService } from './workflow.service';
import { WorkflowValidationService } from './workflow-validation.service';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function query(result: QueryResult, capture?: jest.Mock) {
  const chain: Record<string, unknown> = {};
  for (const method of [
    'select',
    'eq',
    'in',
    'order',
    'limit',
    'is',
    'update',
    'delete',
  ]) {
    chain[method] = jest.fn(() => chain);
  }
  chain.insert = jest.fn((payload: unknown) => {
    capture?.(payload);
    return chain;
  });
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

const admin: RequestUser = {
  authUserId: '11111111-1111-4111-8111-111111111111',
  profileId: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  phone: null,
  accountStatus: 'active',
  role: 'admin',
  fullName: 'Admin',
  avatarUrl: null,
  approvedAt: '2026-01-01T00:00:00.000Z',
};

describe('WorkflowService behavioral hardening', () => {
  const templateId = '22222222-2222-4222-8222-222222222222';
  const stageId = '33333333-3333-4333-8333-333333333333';
  const deliveryItemId = '44444444-4444-4444-8444-444444444444';
  let from: jest.Mock;
  let rpc: jest.Mock;
  let service: WorkflowService;

  beforeEach(() => {
    from = jest.fn();
    rpc = jest.fn();
    service = new WorkflowService(
      { getSystemClient: () => ({ from, rpc }) } as never,
      new WorkflowValidationService(),
    );
  });

  it('maps Stage DTO fields explicitly to snake_case columns', async () => {
    const inserted = jest.fn();
    from
      .mockReturnValueOnce(
        query({
          data: { id: templateId, status: 'draft', service_id: 'service-1' },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { id: stageId }, error: null }, inserted),
      );

    await service.createStage(
      templateId,
      {
        name: 'Discovery',
        description: 'Scope',
        sortOrder: 2,
        isRequired: true,
        slaHours: 8,
      },
      admin,
    );

    expect(inserted).toHaveBeenCalledWith({
      workflow_template_id: templateId,
      name: 'Discovery',
      description: 'Scope',
      sort_order: 2,
      is_required: true,
      sla_hours: 8,
    });
  });

  it('maps Delivery Item DTO and both owning IDs to exact database columns', async () => {
    const inserted = jest.fn();
    from
      .mockReturnValueOnce(
        query({ data: { workflow_template_id: templateId }, error: null }),
      )
      .mockReturnValueOnce(
        query({
          data: { id: templateId, status: 'draft', service_id: 'service-1' },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: {
            id: deliveryItemId,
            service_id: 'service-1',
            delivery_item_code: 'HMDV_01',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { id: 'mapped-1' }, error: null }, inserted),
      );

    await service.mapItem(
      stageId,
      {
        serviceDeliveryItemId: deliveryItemId,
        sortOrder: 3,
        approvalRequired: true,
        approvalScope: 'client',
        slaHours: 4,
        autoCreateTask: true,
        completionMode: 'tasks_done_and_approval',
      },
      admin,
    );

    expect(inserted).toHaveBeenCalledWith({
      workflow_template_stage_id: stageId,
      workflow_template_id: templateId,
      service_delivery_item_id: deliveryItemId,
      service_delivery_item_code: 'HMDV_01',
      sort_order: 3,
      approval_required: true,
      approval_scope: 'client',
      sla_hours: 4,
      auto_create_task: true,
      completion_mode: 'tasks_done_and_approval',
    });
  });

  it('rejects a cross-service Delivery Item before insert', async () => {
    from
      .mockReturnValueOnce(
        query({ data: { workflow_template_id: templateId }, error: null }),
      )
      .mockReturnValueOnce(
        query({
          data: { id: templateId, status: 'draft', service_id: 'service-1' },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: {
            id: deliveryItemId,
            service_id: 'service-2',
            delivery_item_code: 'HMDV_02',
          },
          error: null,
        }),
      );

    await expect(
      service.mapItem(
        stageId,
        {
          serviceDeliveryItemId: deliveryItemId,
          sortOrder: 1,
          approvalRequired: false,
          approvalScope: 'internal',
          autoCreateTask: false,
          completionMode: 'manual',
        },
        admin,
      ),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_CROSS_SERVICE_ITEM' },
    });
    expect(from).toHaveBeenCalledTimes(3);
  });

  it('blocks mutation of a published template', async () => {
    from.mockReturnValueOnce(
      query({
        data: { id: templateId, status: 'published', service_id: 'service-1' },
        error: null,
      }),
    );

    await expect(
      service.updateTemplate(templateId, { name: 'Changed' }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses the atomic clone RPC instead of TypeScript graph inserts', async () => {
    rpc.mockResolvedValueOnce({
      data: '55555555-5555-4555-8555-555555555555',
      error: null,
    });
    from.mockReturnValueOnce(
      query({
        data: { id: '55555555-5555-4555-8555-555555555555' },
        error: null,
      }),
    );

    await service.cloneTemplate(templateId, admin);

    expect(rpc).toHaveBeenCalledWith('workflow_clone_template', {
      p_template_id: templateId,
      p_actor_id: admin.profileId,
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('uses the atomic set-default RPC', async () => {
    rpc.mockResolvedValueOnce({
      data: { id: templateId, is_default: true },
      error: null,
    });

    await service.setDefault(templateId, admin);

    expect(rpc).toHaveBeenCalledWith('workflow_set_default_template', {
      p_template_id: templateId,
      p_actor_id: admin.profileId,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects publish with no stages', async () => {
    from
      .mockReturnValueOnce(
        query({
          data: { id: templateId, status: 'draft', service_id: 'service-1' },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: {
            id: templateId,
            service_id: 'service-1',
            stages: [],
            stage_deps: [],
            item_deps: [],
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ data: [], error: null }));

    await expect(
      service.publishTemplate(templateId, admin),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_TEMPLATE_INVALID', errors: ['NO_STAGES'] },
    });
  });

  it('rejects publish when a required active Delivery Item is unmapped', async () => {
    from
      .mockReturnValueOnce(
        query({
          data: { id: templateId, status: 'draft', service_id: 'service-1' },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: {
            id: templateId,
            service_id: 'service-1',
            stages: [{ id: stageId, sort_order: 1, sla_hours: 4, items: [] }],
            stage_deps: [],
            item_deps: [],
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: [
            {
              id: deliveryItemId,
              service_id: 'service-1',
              is_required: true,
              active: true,
            },
          ],
          error: null,
        }),
      );

    await expect(
      service.publishTemplate(templateId, admin),
    ).rejects.toMatchObject({
      response: {
        code: 'WORKFLOW_TEMPLATE_INVALID',
        errors: ['REQUIRED_ITEM_UNMAPPED'],
      },
    });
  });

  it('rejects invalid approval configuration during canonical validation', async () => {
    from
      .mockReturnValueOnce(
        query({
          data: {
            id: templateId,
            service_id: 'service-1',
            stages: [
              {
                id: stageId,
                sort_order: 1,
                sla_hours: 4,
                items: [
                  {
                    id: 'item-1',
                    service_delivery_item_id: deliveryItemId,
                    approval_required: false,
                    approval_scope: 'internal',
                    completion_mode: 'tasks_done_and_approval',
                    sla_hours: 2,
                  },
                ],
              },
            ],
            stage_deps: [],
            item_deps: [],
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: [
            {
              id: deliveryItemId,
              service_id: 'service-1',
              is_required: false,
              active: true,
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: [{ id: deliveryItemId, service_id: 'service-1' }],
          error: null,
        }),
      );

    const result = await service.validateTemplateForPublish(templateId);
    expect(result.errors).toContain('INVALID_APPROVAL_CONFIGURATION');
  });
});
