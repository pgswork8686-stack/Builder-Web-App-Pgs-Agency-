// FLOW 08 - Resilience of the business flows: an API outage with retry, an
// expired session, and access that is revoked while a user is still signed in.
// Browser UI (Playwright) + API + Postgres. Disposable DB only.
import assert from "node:assert/strict";
import { createFlow, LOCAL_UAT, runFlow, SLOW, U } from "./lib/flow-kit.mjs";

const flow = await createFlow({
  id: "flow08",
  title: "Khả năng chịu lỗi: gián đoạn, hết phiên, thu hồi quyền",
});

await runFlow(flow, async () => {
  const { db } = flow;
  const stamp = Date.now().toString(36);
  const adminToken = await flow.token("admin");
  const leaderToken = await flow.token("leader");
  const employeeToken = await flow.token("employee");

  // ---- Fixture: a project WITHOUT a department, so membership is the only grant ---------
  const created = await flow.api("POST", "/admin/projects", adminToken, {
    clientCompanyId: LOCAL_UAT.companies.primary.id,
    name: `[FLOW08] Dự án chịu lỗi ${stamp}`,
    status: "active",
    priority: "medium",
    projectManagerUserId: U.leader.id,
    startDate: "2026-01-05",
    dueDate: "2026-12-31",
  });
  flow.expectStatus(created, [200, 201], "Fixture project");
  const projectId = created.data.id;
  const projectName = created.data.name;
  flow.expectStatus(
    await flow.api("POST", `/admin/projects/${projectId}/members`, adminToken, {
      userId: U.employee.id,
      projectRole: "member",
    }),
    [200, 201],
    "Fixture member",
  );
  const taskTitle = `[FLOW08] Việc của nhân viên ${stamp}`;
  const task = await flow.api(
    "POST",
    `/projects/${projectId}/tasks`,
    leaderToken,
    {
      title: taskTitle,
      status: "todo",
      priority: "medium",
      sortOrder: 0,
      assigneeUserId: U.employee.id,
    },
  );
  flow.expectStatus(task, [200, 201], "Fixture task");
  const taskId = task.data.id;
  flow.step(
    "0. Fixture: project without department, employee member, one task assigned",
    {
      projectId,
      taskId,
    },
  );

  // ---- 1. Missing or garbage credentials are refused, nothing leaks -------------------------------
  for (const [label, token] of [
    ["empty token", ""],
    ["garbage token", "not-a-jwt"],
  ]) {
    const res = await flow.api("GET", `/projects/${projectId}/tasks`, token);
    flow.expectStatus(res, 401, `Task list with ${label}`);
    assert.ok(
      !JSON.stringify(res.data).includes(taskTitle),
      `${label}: the response must not contain task data`,
    );
  }
  flow.step(
    "1. Requests with an empty or garbage token get 401 and no task data",
  );

  // ---- 2. API outage (the page lists its projects first): it explains the failure and recovers on retry --------------------------
  const employee = await flow.openSession("employee");
  const page = employee.page;
  let blockTasks = true;
  let blocked = 0;
  await page.route(/\/api\/v1\/projects(\?|$)/, (route) => {
    if (blockTasks) {
      blocked += 1;
      return route.abort("connectionrefused");
    }
    return route.continue();
  });
  await page.goto(flow.url("/app/employee/tasks"), {
    waitUntil: "networkidle",
  });
  const alert = page.getByRole("alert").first();
  await alert.waitFor({ timeout: SLOW });
  const retry = page.getByRole("button", { name: "Thử lại" });
  await retry.waitFor({ timeout: SLOW });
  assert.ok(blocked >= 1, "the outage must actually have been simulated");
  await flow.shot(page, "01-outage-error");
  blockTasks = false;
  const [recovered] = await Promise.all([
    page.waitForResponse(
      (r) => /\/api\/v1\/projects(\?|$)/.test(r.url()) && r.status() === 200,
      { timeout: SLOW },
    ),
    retry.click(),
  ]);
  assert.equal(recovered.status(), 200);
  await retry.waitFor({ state: "detached", timeout: SLOW });
  await flow.shot(page, "02-after-retry");
  flow.step(
    "2. API outage shows an error with a retry button; after the API returns, retry loads the page",
  );

  // ---- 3. Expired session: protected page sends the user to sign-in, signing in again works --------
  await page.unroute(/\/api\/v1\/projects(\?|$)/);
  await employee.context.clearCookies();
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto(flow.url("/app/employee/tasks"));
  await page.waitForURL((url) => url.pathname.startsWith("/auth/login"), {
    timeout: SLOW,
  });
  await flow.shot(page, "03-session-expired-login");
  await page.fill('input[type="email"]', U.employee.email);
  await page.fill('input[type="password"]', LOCAL_UAT.password);
  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith("/app"), {
      timeout: SLOW,
    }),
    page.click('button[type="submit"]'),
  ]);
  await page.goto(flow.url("/app/employee/tasks"), {
    waitUntil: "networkidle",
  });
  assert.ok(
    new URL(page.url()).pathname.startsWith("/app/employee"),
    "after signing in again the employee reaches the workspace",
  );
  flow.step(
    "3. Expired session redirects to sign-in; signing in again restores access",
  );

  // ---- 4. Access revoked while signed in: API and UI stop exposing the project ----------------------
  const before = await flow.api(
    "GET",
    `/projects/${projectId}/tasks`,
    employeeToken,
  );
  flow.expectStatus(
    before,
    200,
    "Member can read the project tasks before revocation",
  );
  const members = await flow.api(
    "GET",
    `/admin/projects/${projectId}/members`,
    adminToken,
  );
  flow.expectStatus(members, 200, "Member list");
  const rows = Array.isArray(members.data) ? members.data : members.data.items;
  const membership = rows.find(
    (m) => (m.userId ?? m.user_id ?? m.user?.id) === U.employee.id,
  );
  assert.ok(membership, "the employee membership must be listed");
  flow.expectStatus(
    await flow.api(
      "DELETE",
      `/admin/projects/${projectId}/members/${membership.id}`,
      adminToken,
    ),
    [200, 204],
    "Revoke membership",
  );
  const left = await db.query(
    `SELECT count(*)::int AS n FROM public.project_memberships
      WHERE project_id = $1::uuid AND user_id = $2::uuid`,
    [projectId, U.employee.id],
  );
  assert.equal(left.rows[0].n, 0, "membership row removed");

  const after = await flow.api(
    "GET",
    `/projects/${projectId}/tasks`,
    employeeToken,
  );
  flow.expectStatus(after, [403, 404], "Revoked member reads the task list");
  assert.ok(
    !JSON.stringify(after.data).includes(taskTitle),
    "no task data after revocation",
  );
  const patch = await flow.api(
    "PATCH",
    `/projects/${projectId}/tasks/${taskId}`,
    employeeToken,
    { status: "in_progress" },
  );
  flow.expectStatus(patch, [403, 404], "Revoked member updates the task");
  const status = await db.query(
    `SELECT status::text AS status FROM public.tasks WHERE id = $1::uuid`,
    [taskId],
  );
  assert.equal(status.rows[0].status, "todo", "the task was not changed");

  await page.goto(flow.url(`/app/projects/${projectId}`), {
    waitUntil: "networkidle",
  });
  assert.equal(
    await page.getByText(projectName).count(),
    0,
    "the project name must not be shown to a revoked member",
  );
  await flow.shot(page, "04-revoked-project-page");
  flow.step(
    "4. After revocation the API refuses read and write (403/404), the database is unchanged and the UI shows no project data",
  );
});
