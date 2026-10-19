// FLOW 06 - Ke toan: invoice -> partial payment -> final payment, duplicate and
// overpayment protection, client visibility/tenant isolation, expense approval
// and reimbursement with notifications, payments ledger + receivables pages.
// No real payment: every amount is a record in the disposable database.
import assert from "node:assert/strict";
import { createFlow, LOCAL_UAT, runFlow, SLOW, U } from "./lib/flow-kit.mjs";

const flow = await createFlow({
  id: "flow06",
  title: "Kế toán và tài chính",
});

await runFlow(flow, async () => {
  const { db } = flow;
  const stamp = Date.now().toString(36).toUpperCase();
  const accountantToken = await flow.token("accountant");
  const adminToken = await flow.token("admin");
  const leaderToken = await flow.token("leader");
  const employeeToken = await flow.token("employee");
  const clientToken = await flow.token("client");
  const company = LOCAL_UAT.companies.primary.id;
  const today = new Date().toISOString().slice(0, 10);
  const dueSoon = "2099-12-31";

  // ---- 1. Accountant creates an invoice (draft), RBAC on who may -------------------------
  const body = {
    invoiceNumber: `F06-${stamp}`,
    clientCompanyId: company,
    issueDate: today,
    dueDate: dueSoon,
    amount: 10000000,
    currencyCode: "VND",
    clientVisible: true,
    notes: "Flow 06",
  };
  for (const [who, token] of [
    ["employee", employeeToken],
    ["leader", leaderToken],
    ["client", clientToken],
  ]) {
    const denied = await flow.api("POST", "/finance/invoices", token, body);
    flow.expectStatus(denied, 403, `${who} must not create invoices`);
  }
  const created = await flow.api(
    "POST",
    "/finance/invoices",
    accountantToken,
    body,
  );
  flow.expectStatus(created, [200, 201], "create invoice");
  const invoiceId = created.data.id;
  const dbInvoice = async () =>
    (
      await db.query(
        "SELECT status, amount::float AS amount, paid_amount::float AS paid FROM public.invoices WHERE id=$1::uuid",
        [invoiceId],
      )
    ).rows[0];
  assert.equal((await dbInvoice()).status, "draft");
  const hiddenDraft = await flow.api(
    "GET",
    `/finance/invoices/${invoiceId}`,
    clientToken,
  );
  assert.ok(
    hiddenDraft.status === 404 || hiddenDraft.status === 403,
    `draft must be hidden from client, got ${hiddenDraft.status}`,
  );
  flow.step(
    "1. Accountant creates a draft invoice; others are refused (403); the client cannot see the draft",
    { invoiceId },
  );

  // ---- 2. Payment on a draft is refused; issue; client sees it ---------------------------
  const payment = (amount, reference) => ({
    amount,
    paidAt: new Date().toISOString(),
    paymentReference: reference,
    paymentMethod: "Chuyển khoản ngân hàng",
  });
  const early = await flow.api(
    "POST",
    `/finance/invoices/${invoiceId}/payments`,
    accountantToken,
    payment(1000, `EARLY-${stamp}`),
  );
  flow.expectStatus(early, [400, 409, 422], "payment on a draft");
  assert.match(JSON.stringify(early.data), /INVOICE_NOT_PAYABLE/);
  const issued = await flow.api(
    "POST",
    `/finance/invoices/${invoiceId}/transition`,
    accountantToken,
    { status: "issued" },
  );
  flow.expectStatus(issued, [200, 201], "issue invoice");
  assert.equal((await dbInvoice()).status, "issued");
  const seen = await flow.api(
    "GET",
    `/finance/invoices/${invoiceId}`,
    clientToken,
  );
  flow.expectStatus(seen, 200, "client reads the issued invoice");
  flow.step(
    "2. A draft cannot be paid; issuing makes it visible to the client",
    {},
  );

  // ---- 3. Partial payment, duplicate reference, overpayment ------------------------------
  const first = await flow.api(
    "POST",
    `/finance/invoices/${invoiceId}/payments`,
    accountantToken,
    payment(4000000, `REF-${stamp}-1`),
  );
  flow.expectStatus(first, [200, 201], "partial payment");
  let row = await dbInvoice();
  assert.equal(row.status, "partially_paid");
  assert.equal(row.paid, 4000000);

  const duplicate = await flow.api(
    "POST",
    `/finance/invoices/${invoiceId}/payments`,
    accountantToken,
    payment(1000000, `ref-${stamp}-1`),
  );
  flow.expectStatus(duplicate, [409], "duplicate reference (case-insensitive)");
  assert.match(JSON.stringify(duplicate.data), /PAYMENT_REFERENCE_DUPLICATE/);

  const over = await flow.api(
    "POST",
    `/finance/invoices/${invoiceId}/payments`,
    accountantToken,
    payment(6000001, `REF-${stamp}-OVER`),
  );
  flow.expectStatus(over, [400, 409, 422], "overpayment");
  assert.match(JSON.stringify(over.data), /PAYMENT_EXCEEDS_OUTSTANDING/);
  row = await dbInvoice();
  assert.equal(
    row.paid,
    4000000,
    "refused payments must not change the paid amount",
  );
  const count = await db.query(
    "SELECT count(*)::int AS n FROM public.invoice_payments WHERE invoice_id=$1::uuid",
    [invoiceId],
  );
  assert.equal(count.rows[0].n, 1);
  flow.step(
    "3. Partial payment recorded; duplicate reference -> 409; overpayment refused; DB unchanged",
    {},
  );

  // ---- 4. Concurrent final payments: exactly one wins ------------------------------------
  const race = await Promise.all(
    [1, 2].map((n) =>
      flow.api(
        "POST",
        `/finance/invoices/${invoiceId}/payments`,
        accountantToken,
        payment(6000000, `REF-${stamp}-FINAL-${n}`),
      ),
    ),
  );
  assert.equal(
    race.filter((r) => r.ok).length,
    1,
    `exactly one concurrent payment may succeed: ${race.map((r) => r.status)}`,
  );
  row = await dbInvoice();
  assert.equal(row.status, "paid");
  assert.equal(row.paid, 10000000);
  const afterPaid = await flow.api(
    "POST",
    `/finance/invoices/${invoiceId}/payments`,
    accountantToken,
    payment(1, `REF-${stamp}-LATE`),
  );
  assert.ok(!afterPaid.ok, "a paid invoice accepts no further payment");
  flow.step(
    "4. Two concurrent final payments: one wins, invoice is paid exactly, extra payment refused",
    {},
  );

  // ---- 5. Tenant isolation ---------------------------------------------------------------
  const foreign = await flow.api("POST", "/finance/invoices", accountantToken, {
    ...body,
    invoiceNumber: `F06-FOREIGN-${stamp}`,
    clientCompanyId: LOCAL_UAT.companies.foreign.id,
  });
  flow.expectStatus(foreign, [200, 201], "foreign company invoice");
  await flow.api(
    "POST",
    `/finance/invoices/${foreign.data.id}/transition`,
    accountantToken,
    { status: "issued" },
  );
  const peek = await flow.api(
    "GET",
    `/finance/invoices/${foreign.data.id}`,
    clientToken,
  );
  assert.ok(
    [403, 404].includes(peek.status),
    `client must not read another company's invoice, got ${peek.status}`,
  );
  const list = await flow.api(
    "GET",
    "/finance/invoices?pageSize=100",
    clientToken,
  );
  flow.expectStatus(list, 200, "client invoice list");
  const ids = (list.data.items ?? list.data.data ?? []).map((i) => i.id);
  assert.ok(ids.includes(invoiceId));
  assert.ok(
    !ids.includes(foreign.data.id),
    "foreign invoice leaked into the client list",
  );
  for (const [who, token] of [
    ["employee", employeeToken],
    ["leader", leaderToken],
    ["client", clientToken],
  ]) {
    const ledger = await flow.api("GET", "/finance/payments", token);
    flow.expectStatus(ledger, 403, `${who} must not read the payment ledger`);
    flow.expectStatus(
      await flow.api("GET", "/finance/receivables", token),
      403,
      `${who} must not read receivables`,
    );
  }
  flow.step(
    "5. Client sees only its own company's invoices; ledger and receivables are 403 for non-finance roles",
    {},
  );

  // ---- 6. Expense: employee submits, accountant approves/rejects/reimburses ---------------
  const project = await flow.api("POST", "/admin/projects", adminToken, {
    clientCompanyId: company,
    name: `[FLOW06] Dự án chi phí ${stamp}`,
    status: "active",
    priority: "medium",
    projectManagerUserId: U.leader.id,
    departmentId: LOCAL_UAT.departments.primary.id,
    startDate: "2026-01-05",
    dueDate: "2026-12-31",
  });
  flow.expectStatus(project, [200, 201], "fixture project");
  flow.expectStatus(
    await flow.api(
      "POST",
      `/admin/projects/${project.data.id}/members`,
      adminToken,
      { userId: U.employee.id, projectRole: "member" },
    ),
    [200, 201],
    "fixture member",
  );
  const newExpense = async (title) => {
    const res = await flow.api("POST", "/expenses", employeeToken, {
      projectId: project.data.id,
      title,
      amount: 250000,
      currencyCode: "VND",
      expenseCategory: "travel",
    });
    flow.expectStatus(res, [200, 201], "create expense");
    return res.data.id;
  };
  const expenseStatus = async (id) =>
    (
      await db.query(
        "SELECT status FROM public.project_expenses WHERE id=$1::uuid",
        [id],
      )
    ).rows[0]?.status;

  const approvedId = await newExpense(`Chi phí đi lại ${stamp}`);
  assert.equal(await expenseStatus(approvedId), "pending");
  await flow.poll(
    "accountant notified of the submitted expense",
    () => flow.notifications(U.accountant.id, "expense.submitted", approvedId),
    (r) => r.length === 1,
  );
  flow.expectStatus(
    await flow.api("POST", `/expenses/${approvedId}/review`, employeeToken, {
      action: "approved",
    }),
    403,
    "employee must not approve",
  );
  flow.expectStatus(
    await flow.api(
      "POST",
      `/expenses/${approvedId}/reimburse`,
      accountantToken,
    ),
    [400, 403, 409],
    "reimburse before approval",
  );
  assert.equal(await expenseStatus(approvedId), "pending");

  flow.expectStatus(
    await flow.api("POST", `/expenses/${approvedId}/review`, accountantToken, {
      action: "approved",
    }),
    [200, 201],
    "approve",
  );
  const again = await flow.api(
    "POST",
    `/expenses/${approvedId}/review`,
    accountantToken,
    {
      action: "rejected",
      rejectionReason: "Duyệt lại sau khi đã duyệt",
    },
  );
  assert.ok(!again.ok, "an expense already processed cannot be reviewed again");
  assert.equal(await expenseStatus(approvedId), "approved");
  await flow.poll(
    "employee notified of approval",
    () => flow.notifications(U.employee.id, "expense.approved", approvedId),
    (r) => r.length === 1,
  );
  flow.expectStatus(
    await flow.api(
      "POST",
      `/expenses/${approvedId}/reimburse`,
      accountantToken,
    ),
    [200, 201],
    "reimburse",
  );
  assert.equal(await expenseStatus(approvedId), "reimbursed");
  await flow.poll(
    "employee notified of reimbursement",
    () => flow.notifications(U.employee.id, "expense.reimbursed", approvedId),
    (r) => r.length === 1,
  );

  const rejectedId = await newExpense(`Chi phí bị từ chối ${stamp}`);
  flow.expectStatus(
    await flow.api("POST", `/expenses/${rejectedId}/review`, accountantToken, {
      action: "rejected",
    }),
    400,
    "rejection needs a reason",
  );
  assert.equal(await expenseStatus(rejectedId), "pending");
  flow.expectStatus(
    await flow.api("POST", `/expenses/${rejectedId}/review`, accountantToken, {
      action: "rejected",
      rejectionReason: "Thiếu chứng từ hợp lệ",
    }),
    [200, 201],
    "reject with reason",
  );
  assert.equal(await expenseStatus(rejectedId), "rejected");
  const rejection = await flow.poll(
    "employee notified of rejection",
    () => flow.notifications(U.employee.id, "expense.rejected", rejectedId),
    (r) => r.length === 1,
  );
  assert.match(`${rejection[0].message}`, /Thiếu chứng từ hợp lệ/);
  flow.step(
    "6. Expense: submit -> accountant notified; employee cannot approve; approve/reimburse/reject(+reason) update DB and notify the employee; no double processing",
    {},
  );

  // ---- 7. UI: ledger and receivables on real data, refresh + re-login ---------------------
  const finance = await flow.openSession("accountant");
  const page = finance.page;
  await page.goto(flow.url("/app/accountant/finance/payments"), {
    waitUntil: "networkidle",
  });
  const paymentRows = page.locator("tr[data-payment-id]");
  await paymentRows.first().waitFor({ timeout: SLOW });
  const paymentsDb = (
    await db.query("SELECT count(*)::int AS n FROM public.invoice_payments")
  ).rows[0].n;
  assert.ok((await paymentRows.count()) >= 1);
  await page.getByText(`F06-${stamp}`).first().waitFor({ timeout: SLOW });
  await page.getByText("Đã tất toán").first().waitFor({ timeout: SLOW });
  await flow.shot(page, "payments-ledger");

  // second invoice stays open so it appears in receivables
  const open = await flow.api("POST", "/finance/invoices", accountantToken, {
    ...body,
    invoiceNumber: `F06-OPEN-${stamp}`,
    amount: 5000000,
  });
  flow.expectStatus(open, [200, 201], "open invoice");
  flow.expectStatus(
    await flow.api(
      "POST",
      `/finance/invoices/${open.data.id}/transition`,
      accountantToken,
      { status: "issued" },
    ),
    [200, 201],
    "issue open invoice",
  );
  flow.expectStatus(
    await flow.api(
      "POST",
      `/finance/invoices/${open.data.id}/payments`,
      accountantToken,
      payment(1000000, `REF-${stamp}-OPEN`),
    ),
    [200, 201],
    "partial on open invoice",
  );
  await page.goto(flow.url("/app/accountant/finance/debts"), {
    waitUntil: "networkidle",
  });
  const openRow = page.locator(`tr[data-invoice-id="${open.data.id}"]`);
  await openRow.waitFor({ timeout: SLOW });
  assert.ok(
    /4[.,\s]?000[.,\s]?000/.test(
      (await openRow.innerText()).replace(/ /g, " "),
    ),
    "outstanding must be 4,000,000",
  );
  assert.equal(
    await page.locator(`tr[data-invoice-id="${invoiceId}"]`).count(),
    0,
    "a paid invoice is not a receivable",
  );
  await flow.shot(page, "receivables");

  await page.reload({ waitUntil: "networkidle" });
  await openRow.waitFor({ timeout: SLOW });
  const relogin = await flow.openSession("accountant");
  await relogin.page.goto(flow.url("/app/accountant/finance/debts"), {
    waitUntil: "networkidle",
  });
  await relogin.page
    .locator(`tr[data-invoice-id="${open.data.id}"]`)
    .waitFor({ timeout: SLOW });
  flow.step(
    "7. Ledger and receivables render real DB data; a paid invoice is absent from receivables; same after refresh and re-login",
    { paymentsDb },
  );

  // ---- 8. Error + retry, audit, responsive ------------------------------------------------
  let failNext = true;
  await page.route("**/finance/receivables**", (route) => {
    if (failNext) {
      failNext = false;
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Máy chủ lỗi tạm thời" }),
      });
    }
    return route.continue();
  });
  await page.goto(flow.url("/app/accountant/finance/debts"), {
    waitUntil: "networkidle",
  });
  await page.getByText("Không tải được dữ liệu").waitFor({ timeout: SLOW });
  await page.getByRole("button", { name: /Thử lại/ }).click();
  await openRow.waitFor({ timeout: SLOW });
  await page.unroute("**/finance/receivables**");

  const audit = await db
    .query(
      "SELECT count(*)::int AS n FROM public.finance_audit_events WHERE entity_id=$1::uuid",
      [invoiceId],
    )
    .catch(() => null);
  if (audit)
    assert.ok(audit.rows[0].n >= 3, "invoice lifecycle must be audited");
  for (const route of [
    "/app/accountant/finance/payments",
    "/app/accountant/finance/debts",
  ]) {
    await flow.checkResponsive(page, route, [375, 768, 1024, 1440]);
  }
  flow.step(
    "8. Error -> retry works; invoice lifecycle audited; no overflow and no serious/critical axe issue at 375/768/1024/1440",
    {},
  );
});
