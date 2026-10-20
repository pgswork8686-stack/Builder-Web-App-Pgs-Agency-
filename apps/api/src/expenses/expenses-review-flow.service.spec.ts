import { ExpensesService } from './expenses.service';

type Call = { method: string; args: unknown[] };

const EXPENSE = {
  id: 'expense-1',
  project_id: 'project-1',
  submitted_by_user_id: 'employee-1',
  title: 'Mua tên miền',
  amount: 500000,
  currency_code: 'VND',
  status: 'pending',
  project: { id: 'project-1', name: 'Website', project_code: 'DA_07' },
};

const accountant = {
  profileId: 'accountant-1',
  role: 'accountant',
  fullName: 'Kế toán',
} as never;

/** Chainable, thenable client; `rows` decides what each table resolves to. */
function setup(rows: Record<string, unknown>) {
  const log: Array<{ table: string; calls: Call[] }> = [];
  const client = {
    from(table: string) {
      const calls: Call[] = [];
      const builder: Record<string, unknown> = {};
      for (const method of [
        'select',
        'insert',
        'update',
        'eq',
        'limit',
        'single',
        'maybeSingle',
      ]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) => {
        log.push({ table, calls });
        return resolve({ data: rows[table] ?? null, error: null });
      };
      return builder;
    },
  };
  const createForUsers = jest.fn().mockResolvedValue([]);
  const service = new ExpensesService(
    { getSystemClient: () => client } as never,
    { createForUsers } as never,
  );
  (service as unknown as Record<string, jest.Mock>).getExpenseById = jest
    .fn()
    .mockResolvedValue(EXPENSE);
  return { service, log, createForUsers };
}

describe('Expense review loop', () => {
  it('requires a reason to reject and changes nothing without it', async () => {
    const { service, log, createForUsers } = setup({
      project_expenses: { ...EXPENSE, status: 'rejected' },
    });

    await expect(
      service.reviewExpense(
        'expense-1',
        { action: 'rejected', rejectionReason: ' no ' },
        accountant,
      ),
    ).rejects.toMatchObject({
      response: { code: 'EXPENSE_REJECTION_REASON_REQUIRED' },
    });
    expect(log).toEqual([]);
    expect(createForUsers).not.toHaveBeenCalled();
  });

  it('approves only while still pending and tells the submitter', async () => {
    const { service, log, createForUsers } = setup({
      project_expenses: { ...EXPENSE, status: 'approved' },
    });

    await service.reviewExpense(
      'expense-1',
      { action: 'approved' },
      accountant,
    );

    const calls = log.find(
      (entry) => entry.table === 'project_expenses',
    )!.calls;
    expect(
      calls.some(
        (c) =>
          c.method === 'eq' &&
          c.args[0] === 'status' &&
          c.args[1] === 'pending',
      ),
    ).toBe(true);
    const [recipients, input] = createForUsers.mock.calls[0];
    expect(recipients).toEqual(['employee-1']);
    expect(input).toMatchObject({
      type: 'expense.approved',
      entityType: 'project_expense',
      entityId: 'expense-1',
      actorUserId: 'accountant-1',
    });
  });

  it('puts the rejection reason into the notification', async () => {
    const { service, createForUsers } = setup({
      project_expenses: {
        ...EXPENSE,
        status: 'rejected',
        rejection_reason: 'Thiếu hóa đơn đỏ',
      },
    });

    await service.reviewExpense(
      'expense-1',
      { action: 'rejected', rejectionReason: 'Thiếu hóa đơn đỏ' },
      accountant,
    );

    expect(createForUsers.mock.calls[0][1].type).toBe('expense.rejected');
    expect(createForUsers.mock.calls[0][1].message).toContain(
      'Thiếu hóa đơn đỏ',
    );
  });

  it('refuses a second decision that lost the race (no overwrite, no notification)', async () => {
    const { service, createForUsers } = setup({ project_expenses: null });

    await expect(
      service.reviewExpense('expense-1', { action: 'approved' }, accountant),
    ).rejects.toMatchObject({
      response: { code: 'EXPENSE_ALREADY_PROCESSED' },
    });
    expect(createForUsers).not.toHaveBeenCalled();
  });

  it('reimburses only an approved expense, once', async () => {
    const approved = { ...EXPENSE, status: 'approved' };
    const ok = setup({
      project_expenses: { ...approved, status: 'reimbursed' },
    });
    (ok.service as unknown as Record<string, jest.Mock>).getExpenseById = jest
      .fn()
      .mockResolvedValue(approved);

    await ok.service.reimburseExpense('expense-1', accountant);

    const calls = ok.log.find(
      (entry) => entry.table === 'project_expenses',
    )!.calls;
    expect(
      calls.some(
        (c) =>
          c.method === 'eq' &&
          c.args[0] === 'status' &&
          c.args[1] === 'approved',
      ),
    ).toBe(true);
    expect(ok.createForUsers.mock.calls[0][1].type).toBe('expense.reimbursed');

    const twice = setup({ project_expenses: null });
    (twice.service as unknown as Record<string, jest.Mock>).getExpenseById =
      jest.fn().mockResolvedValue(approved);
    await expect(
      twice.service.reimburseExpense('expense-1', accountant),
    ).rejects.toMatchObject({ response: { code: 'EXPENSE_NOT_APPROVED' } });
    expect(twice.createForUsers).not.toHaveBeenCalled();
  });

  it('tells the accountants when an expense is submitted', async () => {
    const { service, createForUsers } = setup({
      projects: { id: 'project-1', project_code: 'DA_07' },
      project_expenses: EXPENSE,
      profiles: [{ id: 'accountant-1' }, { id: 'accountant-2' }],
    });

    await service.createExpense(
      {
        projectId: 'project-1',
        title: 'Mua tên miền',
        amount: 500000,
        currencyCode: 'VND',
        expenseCategory: 'hosting_domain',
      } as never,
      { profileId: 'admin-1', role: 'admin' } as never,
    );

    const [recipients, input] = createForUsers.mock.calls[0];
    expect(recipients).toEqual(['accountant-1', 'accountant-2']);
    expect(input).toMatchObject({
      type: 'expense.submitted',
      actionUrl: '/app/accountant/finance/project-expenses',
    });
  });
});
