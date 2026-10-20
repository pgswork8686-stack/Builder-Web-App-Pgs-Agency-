import { FinanceService } from './finance.service';

type Call = { method: string; args: unknown[] };

const accountant = { profileId: 'accountant-1', role: 'accountant' } as never;

/** Chainable, thenable client; every table resolves through `handler(calls)`. */
function setup(
  handler: (table: string, calls: Call[]) => Record<string, unknown>,
) {
  const log: Array<{ table: string; calls: Call[] }> = [];
  const client = {
    from(table: string) {
      const calls: Call[] = [];
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'in', 'order', 'range', 'limit']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) => {
        log.push({ table, calls });
        return resolve({ error: null, ...handler(table, calls) });
      };
      return builder;
    },
  };
  const service = new FinanceService({
    getSystemClient: () => client,
  } as never);
  return { service, log };
}

const query = { page: 2, pageSize: 10 } as never;

describe('Finance payment ledger (reconciliation)', () => {
  it('is for Admin and Accountant only', async () => {
    const { service } = setup(() => ({ data: [] }));

    for (const role of ['employee', 'team_leader', 'client']) {
      await expect(
        service.getPaymentLedger(query, { profileId: 'x', role } as never),
      ).rejects.toBeDefined();
    }
  });

  it('lists payments newest first with the invoice they settle, paginated', async () => {
    const { service, log } = setup(() => ({
      data: [
        {
          id: 'pay-1',
          invoice_id: 'inv-1',
          amount: '4000000.00',
          paid_at: '2026-10-19T03:00:00Z',
          payment_reference: 'REF-1',
          payment_method: 'Chuyển khoản ngân hàng',
          recorder: { full_name: 'Kế toán A' },
          invoice: [
            {
              invoice_number: 'INV-1',
              currency_code: 'VND',
              amount: '10000000.00',
              paid_amount: '4000000.00',
              status: 'partially_paid',
              client_company: { name: 'Công ty ABC' },
            },
          ],
        },
        {
          id: 'pay-2',
          invoice_id: 'inv-2',
          amount: 1,
          paid_at: '2026-10-18T00:00:00Z',
          invoice: null,
        },
      ],
      count: 12,
    }));

    const page = await service.getPaymentLedger(query, accountant);

    expect(page.total).toBe(12);
    expect(page.totalPages).toBe(2);
    expect(page.items[0]).toEqual({
      id: 'pay-1',
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-1',
      invoiceStatus: 'partially_paid',
      clientCompany: 'Công ty ABC',
      currencyCode: 'VND',
      amount: 4000000,
      paidAt: '2026-10-19T03:00:00Z',
      paymentMethod: 'Chuyển khoản ngân hàng',
      paymentReference: 'REF-1',
      recordedBy: 'Kế toán A',
      invoiceAmount: 10000000,
      invoicePaidAmount: 4000000,
      invoiceOutstanding: 6000000,
    });
    // a payment whose invoice cannot be read is still listed, without invented numbers
    expect(page.items[1]).toMatchObject({
      invoiceNumber: null,
      invoiceOutstanding: null,
    });
    const calls = log[0].calls;
    expect(calls.find((c) => c.method === 'range')?.args).toEqual([10, 19]);
    expect(calls.find((c) => c.method === 'order')?.args).toEqual([
      'paid_at',
      { ascending: false },
    ]);
  });
});

describe('Finance receivables (công nợ)', () => {
  const rows = [
    {
      id: 'inv-old',
      invoice_number: 'INV-OLD',
      issue_date: '2000-01-01',
      due_date: '2000-01-31',
      amount: '1000.00',
      paid_amount: '250.00',
      currency_code: 'VND',
      status: 'overdue',
      client_company: { name: 'Công ty ABC' },
      project: null,
    },
    {
      id: 'inv-future',
      invoice_number: 'INV-FUTURE',
      issue_date: '2099-01-01',
      due_date: '2099-12-31',
      amount: '500.00',
      paid_amount: '0.00',
      currency_code: 'VND',
      status: 'issued',
      client_company: [{ name: 'Công ty XYZ' }],
      project: { name: 'Website' },
    },
  ];

  function receivables() {
    return setup((_table, calls) =>
      calls.some((c) => c.method === 'range')
        ? { data: rows, count: 2 }
        : {
            data: [
              {
                amount: '1000.00',
                paid_amount: '250.00',
                currency_code: 'VND',
                due_date: '2000-01-31',
              },
              {
                amount: '500.00',
                paid_amount: '0.00',
                currency_code: 'VND',
                due_date: '2099-12-31',
              },
              {
                amount: '300.00',
                paid_amount: '100.00',
                currency_code: 'USD',
                due_date: '2000-02-01',
              },
            ],
          },
    );
  }

  it('is for Admin and Accountant only', async () => {
    const { service } = receivables();
    await expect(
      service.getReceivables(query, {
        profileId: 'x',
        role: 'client',
      } as never),
    ).rejects.toBeDefined();
  });

  it('computes the outstanding amount and the ageing per invoice', async () => {
    const { service, log } = receivables();

    const result = await service.getReceivables(
      { page: 1, pageSize: 20 },
      accountant,
    );

    expect(result.items[0]).toMatchObject({
      id: 'inv-old',
      outstanding: 750,
      paidAmount: 250,
      clientCompany: 'Công ty ABC',
    });
    expect(result.items[0].overdueDays).toBeGreaterThan(9000);
    expect(result.items[1]).toMatchObject({
      outstanding: 500,
      overdueDays: 0,
      clientCompany: 'Công ty XYZ',
      projectName: 'Website',
    });
    const statuses = log[0].calls.find((c) => c.method === 'in')?.args;
    expect(statuses).toEqual([
      'status',
      ['issued', 'partially_paid', 'overdue'],
    ]);
    expect(log[0].calls.find((c) => c.method === 'order')?.args).toEqual([
      'due_date',
      { ascending: true },
    ]);
  });

  it('totals the open invoices per currency over all of them, not just the page', async () => {
    const { service } = receivables();

    const result = await service.getReceivables(
      { page: 1, pageSize: 1 },
      accountant,
    );

    expect(result.totals).toEqual({
      VND: { outstanding: 1250, overdue: 750 },
      USD: { outstanding: 200, overdue: 200 },
    });
    expect(result.total).toBe(2);
  });
});
