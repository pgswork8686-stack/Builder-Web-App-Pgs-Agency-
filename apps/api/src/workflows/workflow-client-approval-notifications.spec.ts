import { WorkflowRuntimeService } from './workflow-runtime.service';

type NotifyCaller = {
  notifyClientApproval: (
    kind: 'requested' | 'approved' | 'rejected',
    approval: {
      id: string;
      approval_type: string;
      requested_by_user_id: string;
    },
    projectId: string,
    actorId: string,
    decisionNote?: string | null,
  ) => Promise<void>;
};

const PROJECT = {
  name: 'Website Hồ Mộc',
  client_company_id: 'company-9',
  project_manager_user_id: 'pm-1',
};

function buildService(
  options: { memberships?: unknown[]; failProject?: boolean } = {},
) {
  const projectChain = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest
          .fn()
          .mockResolvedValue(
            options.failProject
              ? { data: null, error: new Error('db down') }
              : { data: PROJECT, error: null },
          ),
      }),
    }),
  };
  const membershipChain = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: options.memberships ?? [],
        error: null,
      }),
    }),
  };
  const from = jest.fn((table: string) =>
    table === 'projects' ? projectChain : membershipChain,
  );
  const createForUsers = jest.fn().mockResolvedValue([]);
  const service = new WorkflowRuntimeService(
    { getSystemClient: jest.fn().mockReturnValue({ from }) } as never,
    { createTask: jest.fn() } as never,
    { calculateDueAt: jest.fn() } as never,
    undefined,
    { createForUsers } as never,
  );
  return { notify: service as unknown as NotifyCaller, createForUsers, from };
}

const approval = {
  id: 'approval-1',
  approval_type: 'client',
  requested_by_user_id: 'leader-1',
};

describe('Client approval notifications', () => {
  it('tells every active client member when acceptance is requested', async () => {
    const { notify, createForUsers } = buildService({
      memberships: [
        { user_id: 'client-1', profile: { account_status: 'active' } },
        { user_id: 'client-2', profile: [{ account_status: 'active' }] },
        { user_id: 'client-3', profile: { account_status: 'disabled' } },
      ],
    });

    await notify.notifyClientApproval(
      'requested',
      approval,
      'project-7',
      'leader-1',
    );

    expect(createForUsers).toHaveBeenCalledTimes(1);
    const [recipients, input] = createForUsers.mock.calls[0];
    expect(recipients).toEqual(['client-1', 'client-2']);
    expect(input).toMatchObject({
      type: 'workflow.client_approval.requested',
      entityType: 'workflow_approval',
      entityId: 'approval-1',
      actionUrl: '/app/client/approvals',
      actorUserId: 'leader-1',
    });
    expect(input.message).toContain('Website Hồ Mộc');
  });

  it('tells the requester and the project manager about the decision, with the note', async () => {
    const { notify, createForUsers } = buildService();

    await notify.notifyClientApproval(
      'rejected',
      approval,
      'project-7',
      'client-1',
      'Logo cần to hơn',
    );

    const [recipients, input] = createForUsers.mock.calls[0];
    expect(recipients).toEqual(['leader-1', 'pm-1']);
    expect(input).toMatchObject({
      type: 'workflow.client_approval.rejected',
      actionUrl: '/app/projects/project-7',
    });
    expect(input.message).toContain('Logo cần to hơn');
  });

  it('does nothing for internal approvals', async () => {
    const { notify, createForUsers, from } = buildService();

    await notify.notifyClientApproval(
      'requested',
      { ...approval, approval_type: 'internal' },
      'project-7',
      'leader-1',
    );

    expect(createForUsers).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('never fails the approval when the lookup or delivery fails', async () => {
    const { notify, createForUsers } = buildService({ failProject: true });

    await expect(
      notify.notifyClientApproval(
        'approved',
        approval,
        'project-7',
        'client-1',
      ),
    ).resolves.toBeUndefined();
    expect(createForUsers).not.toHaveBeenCalled();
  });
});
