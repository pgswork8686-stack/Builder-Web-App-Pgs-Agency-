// FLOW 02 - Phan cong cong viec: Team Leader creates a task and assigns it to an
// Employee. Browser UI (Playwright) + API + Postgres. Disposable DB only.
import assert from "node:assert/strict";
import { createFlow, LOCAL_UAT, runFlow, SLOW, U } from "./lib/flow-kit.mjs";

const flow = await createFlow({ id: "flow02", title: "Phân công công việc" });

await runFlow(flow, async () => {
  const { db } = flow;
  const state = flow.readState().f01;
  const projectId = state?.projectId ?? LOCAL_UAT.projects.managed.id;
  flow.note(
    state
      ? `Using the project created by Flow 01 (${state.projectCode})`
      : "Flow 01 state missing: using the seeded managed project",
  );
  const title = `[FLOW02] Thiết kế banner ${Date.now().toString(36)}`;

  const leader = await flow.openSession("leader");
  const page = leader.page;

  // ---- 1. Team Leader opens the project and creates the task -------------------
  await page.goto(flow.url(`/app/projects/${projectId}`), { waitUntil: "networkidle" });
  await page.locator("button").filter({ hasText: /^\s*Công việc/ }).first().click();
  await page.getByRole("button", { name: "Thêm Task" }).click();
  const dialog = page.locator("form").filter({ has: page.getByRole("button", { name: "Tạo task" }) });

  // empty title: the browser blocks the submit, nothing is stored
  const before = (await db.query(`SELECT count(*)::int AS n FROM public.tasks WHERE project_id = $1::uuid`, [projectId])).rows[0].n;
  await dialog.getByRole("button", { name: "Tạo task" }).click();
  await dialog.getByPlaceholder("Nhập nội dung công việc...").waitFor();
  assert.equal(
    (await db.query(`SELECT count(*)::int AS n FROM public.tasks WHERE project_id = $1::uuid`, [projectId])).rows[0].n,
    before,
    "an empty form must not create a task",
  );
  flow.step("1a. Empty title is blocked and nothing is stored");

  await dialog.getByPlaceholder("Nhập nội dung công việc...").fill(title);
  await flow.selectByText(dialog.locator("select").first(), /UAT Employee Local/);
  await dialog.getByRole("button", { name: "Tạo task" }).dblclick(); // double click must still create ONE task
  const task = (
    await flow.poll(
      "task row",
      async () =>
        (
          await db.query(
            `SELECT id, assignee_user_id, reporter_user_id, status::text AS status, project_id
               FROM public.tasks WHERE title = $1`,
            [title],
          )
        ).rows,
      (rows) => rows.length >= 1,
    )
  )[0];
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const count = (await db.query(`SELECT count(*)::int AS n FROM public.tasks WHERE title = $1`, [title])).rows[0].n;
  assert.equal(count, 1, "a double click must not create two tasks");
  assert.equal(task.project_id, projectId);
  assert.equal(task.assignee_user_id, U.employee.id);
  assert.equal(task.reporter_user_id, U.leader.id);
  assert.equal(task.status, "todo");
  await flow.shot(page, "01-task-created");
  flow.step("1b. Task created from the UI: assignee, reporter and status stored; double click created one", {
    taskId: task.id,
  });

  // ---- 2. The assignee is notified and finds the task ----------------------------
  await flow.poll(
    "assignment notification",
    () => flow.notifications(U.employee.id, "task.assigned", task.id),
    (rows) => rows.length === 1,
  );
  assert.equal((await flow.notifications(U.accountant.id, "task.assigned", task.id)).length, 0);
  const employee = await flow.openSession("employee");
  await employee.page.goto(flow.url("/app/notifications"), { waitUntil: "networkidle" });
  const card = employee.page
    .locator("article")
    .filter({ has: employee.page.getByRole("heading", { name: /Cong viec moi|Công việc mới/ }) })
    .filter({ hasText: title })
    .first();
  await card.waitFor({ timeout: SLOW });
  await Promise.all([
    employee.page.waitForURL((url) => url.pathname === `/app/projects/${projectId}/tasks/${task.id}`, { timeout: SLOW }),
    card.getByRole("link", { name: /Mở liên kết/ }).click(),
  ]);
  await employee.page.getByRole("heading", { name: title }).waitFor({ timeout: SLOW });
  await flow.shot(employee.page, "02-employee-task-detail");
  await employee.page.goto(flow.url("/app/employee/tasks"), { waitUntil: "networkidle" });
  await employee.page.getByText(title).first().waitFor({ timeout: SLOW });
  flow.step("2. Employee got the notification, opened the task from it and sees it in his task list");

  // ---- 3. Kanban + list are in sync -------------------------------------------------
  await page.goto(flow.url(`/app/projects/${projectId}/board`), { waitUntil: "networkidle" });
  await page.getByText(title).first().waitFor({ timeout: SLOW });
  await flow.shot(page, "03-kanban");
  flow.step("3. The task shows on the project Kanban board");

  // ---- 4. RBAC / scope ------------------------------------------------------------------
  const employeeToken = await flow.token("employee");
  const foreignToken = await flow.token("foreignEmployee");
  const leaderToken = await flow.token("leader");
  flow.expectStatus(
    await flow.api("GET", `/projects/${projectId}/tasks/${task.id}`, foreignToken),
    403,
    "A non-member must not read the task",
  );
  flow.expectStatus(
    await flow.api("POST", `/projects/${projectId}/tasks`, employeeToken, { title: "Không được tạo", status: "todo", priority: "medium", sortOrder: 0 }),
    403,
    "An employee must not create tasks",
  );
  flow.expectStatus(
    await flow.api("PATCH", `/projects/${projectId}/tasks/${task.id}`, employeeToken, { assigneeUserId: U.foreignEmployee.id }),
    403,
    "An employee must not reassign tasks",
  );
  const badAssignee = await flow.api("POST", `/projects/${projectId}/tasks`, leaderToken, {
    title: `${title} (người ngoài dự án)`,
    status: "todo",
    priority: "medium",
    sortOrder: 0,
    assigneeUserId: U.foreignEmployee.id,
  });
  flow.expectStatus(badAssignee, [400, 403, 404, 409, 422], "Assigning to a non-member must be refused");
  assert.equal(
    (await db.query(`SELECT count(*)::int AS n FROM public.tasks WHERE title = $1`, [`${title} (người ngoài dự án)`])).rows[0].n,
    0,
  );
  flow.step("4. RBAC: non-member read, employee create/reassign and non-member assignee are refused");

  // ---- 5. Refresh + new login -----------------------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(title).first().waitFor({ timeout: SLOW });
  const again = await flow.openSession("employee");
  await again.page.goto(flow.url("/app/employee/tasks"), { waitUntil: "networkidle" });
  await again.page.getByText(title).first().waitFor({ timeout: SLOW });
  flow.step("5. After refresh and a brand-new login the task is still there for both roles");

  // ---- 6. Responsive + accessibility ------------------------------------------------------------
  await flow.checkResponsive(page, `/app/projects/${projectId}/board`);
  await flow.checkResponsive(again.page, "/app/employee/tasks");
  await flow.checkResponsive(again.page, `/app/projects/${projectId}/tasks/${task.id}`);
  flow.step("6. No overflow and no serious/critical axe issues at 375/768px");

  flow.writeState({ f02: { projectId, taskId: task.id, taskTitle: title } });
});
