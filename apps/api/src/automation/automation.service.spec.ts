import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import type { NotificationsService } from '../notifications/notifications.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { AutomationService } from './automation.service';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const EMPLOYEE_ID = '22222222-2222-4222-8222-222222222222';
const RULE_ID = '33333333-3333-4333-8333-333333333333';
const NOTIFICATION_ID = '44444444-4444-4444-8444-444444444444';

function user(role: RequestUser['role'] = 'admin'): RequestUser {
  return {
    authUserId: role === 'admin' ? ADMIN_ID : EMPLOYEE_ID,
    profileId: role === 'admin' ? ADMIN_ID : EMPLOYEE_ID,
    email: `${role}@example.com`,
    phone: null,
    accountStatus: 'active',
    role,
    fullName: role,
    avatarUrl: null,
    approvedAt: null,
  };
}

function query(result: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> & {
    then?: (callback: (value: unknown) => unknown) => unknown;
  } = {};
  for (const method of [
    'select',
    'eq',
    'limit',
    'order',
    'range',
    'insert',
    'update',
    'single',
    'maybeSingle',
  ]) {
    chain[method] = jest.fn(() => chain);
  }
  const resolved = {
    data: [],
    count: 0,
    error: null,
    ...result,
  };
  chain.limit = jest.fn().mockResolvedValue(resolved);
  chain.range = jest.fn().mockResolvedValue(resolved);
  chain.single = jest.fn().mockResolvedValue(resolved);
  chain.maybeSingle = jest.fn().mockResolvedValue(resolved);
  chain.then = (callback) => Promise.resolve(callback(resolved));
  return chain;
}

describe('AutomationService', () => {
  let from: jest.Mock;
  let rpc: jest.Mock;
  let notifications: { publishExisting: jest.Mock };
  let service: AutomationService;

  beforeEach(() => {
    from = jest.fn();
    rpc = jest.fn();
    notifications = { publishExisting: jest.fn().mockResolvedValue({}) };
    service = new AutomationService(
      { getSystemClient: () => ({ from, rpc }) } as unknown as SupabaseService,
      notifications as unknown as NotificationsService,
    );
  });

  it('allows only admins to manage automation rules', async () => {
    await expect(
      service.listRules({ page: 1, pageSize: 20 }, user('employee')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('filters unmatched rule conditions before executing actions', async () => {
    from.mockReturnValueOnce(
      query({
        data: [
          {
            id: RULE_ID,
            name: 'Only done',
            trigger_type: 'task.updated',
            conditions: { status: 'done' },
            action_type: 'create_notification',
            action_config: { recipientUserIds: [EMPLOYEE_ID] },
          },
        ],
      }),
    );

    const result = await service.runEvent({
      triggerType: 'task.updated',
      eventKey: 'task.updated:one',
      payload: { status: 'todo' },
      actorUserId: ADMIN_ID,
    });

    expect(result.executions).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('executes create_notification once per rule and recipient', async () => {
    from.mockReturnValueOnce(
      query({
        data: [
          {
            id: RULE_ID,
            name: 'Notify assignee',
            trigger_type: 'task.assigned',
            conditions: {},
            action_type: 'create_notification',
            action_config: { recipientUserIds: [EMPLOYEE_ID] },
          },
        ],
      }),
    );
    rpc.mockResolvedValueOnce({
      data: {
        executed: true,
        execution_id: 'exec-1',
        notification_id: NOTIFICATION_ID,
      },
      error: null,
    });

    await service.runEvent({
      triggerType: 'task.assigned',
      eventKey: 'task.assigned:task-id:assignee',
      payload: { taskId: 'task-id', assigneeUserId: EMPLOYEE_ID },
      actorUserId: ADMIN_ID,
    });

    expect(rpc).toHaveBeenCalledWith(
      'phase7_create_automation_notification_once',
      expect.objectContaining({
        p_rule_id: RULE_ID,
        p_event_key: `task.assigned:task-id:assignee:notification:${EMPLOYEE_ID}`,
        p_recipient_user_id: EMPLOYEE_ID,
      }),
    );
    expect(notifications.publishExisting).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      EMPLOYEE_ID,
    );
  });
});
