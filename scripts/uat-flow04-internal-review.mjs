// FLOW 04 - Kiem tra va duyet noi bo: the Team Leader rejects (with a reason) and
// approves an Employee's result. Both branches, notifications, no duplicate
// approval, workflow moves on. Browser UI (Playwright) + API + Postgres.
import assert from "node:assert/strict";
import { createFlow, LOCAL_UAT, runFlow, SLOW, U } from "./lib/flow-kit.mjs";

const flow = await createFlow({ id: "flow04", title: "Kiểm tra và duyệt nội bộ" });

await runFlow(flow, async () => {
  const { db } = flow;
  const prior = flow.readState().f03 ?? flow.readState().f02;
  const projectId = prior?.projectId ?? LOCAL_UAT.projects.managed.id;
  const leaderToken = await flow.token("leader");
  const employeeToken = await flow.token("employee");
  const adminToken = await flow.token("admin");

  // Fixture: a task assigned to the employee and submitted for review.
  async function newReviewTask(label) {
    const title = `[FLOW04] ${label} ${Date.now().toString(36)}`;
    const created = await flow.api("POST", `/projects/${projectId}/tasks`, leaderToken, {
      title,
      status: "todo",
      priority: "medium",
      sortOrder: 0,
      assigneeUserId: U.employee.id,
    });
    flow.expectStatus(created, [200, 201], "Fixture task");
    const id = created.data.id;
    flow.expectStatus(await flow.api("PATCH", `/projects/${projectId}/tasks/${id}`, employeeToken, { status: "in_progress" }), 200, "start");
    flow.expectStatus(await flow.api("PATCH", `/projects/${projectId}/tasks/${id}`, employeeToken, { status: "review" }), 200, "submit");
    return { id, title };
  }
  const statusOf = async (id) =>
    (await db.query(`SELECT status::text AS status FROM public.tasks WHERE id = $1::uuid`, [id])).rows[0].status;

  const task = await newReviewTask("Banner chờ duyệt");
  const url = `/app/projects/${projectId}/tasks/${task.id}`;
  await flow.poll(
    "review notification",
    () => flow.notifications(U.leader.id, "task.review_requested", task.id),
    (rows) => rows.length === 1,
  );
  flow.step("0. Fixture: an employee task is waiting for review", { taskId: task.id });

  const leader = await flow.openSession("leader");
  const page = leader.page;
  await page.goto(flow.url(url), { waitUntil: "networkidle" });
  const panel = page.getByRole("region", { name: "Duyệt kết quả công việc" });
  await panel.waitFor({ timeout: SLOW });

  // ---- 1. REJECT branch (UI): reason required, stored, employee notified -----------------
  await panel.getByRole("button", { name: /Yêu cầu chỉnh sửa/ }).click();
  await page.getByRole("button", { name: /^Gửi yêu cầu chỉnh sửa$/ }).click();
  await page.getByRole("alert").filter({ hasText: /tối thiểu 5 ký tự/ }).waitFor({ timeout: SLOW });
  assert.equal(await statusOf(task.id), "review", "an empty reason must not change the task");
  await flow.shot(page, "01-reject-validation");
  const reason = `Logo cần to hơn và đổi màu nền [FLOW04 ${Date.now().toString(36)}]`;
  await page.locator("#review-note").fill(reason);
  await page.getByRole("button", { name: /^Gửi yêu cầu chỉnh sửa$/ }).click();
  await flow.poll("task sent back", () => statusOf(task.id), (status) => status === "in_progress");
  const noteRow = (
    await flow.poll(
      "rejection comment",
      async () =>
        (
          await db.query(
            `SELECT author_user_id FROM public.task_comments WHERE task_id = $1::uuid AND content = $2`,
            [task.id, `Yêu cầu chỉnh sửa: ${reason}`],
          )
        ).rows,
      (rows) => rows.length === 1,
    )
  )[0];
  assert.equal(noteRow.author_user_id, U.leader.id);
  const rejected = await flow.poll(
    "rejection notification",
    () => flow.notifications(U.employee.id, "task.review_rejected", task.id),
    (rows) => rows.length === 1,
  );
  assert.ok(rejected[0].message.includes(reason), "the reason travels in the notification");
  flow.step("1. Reject: reason required; task back to in_progress; reason stored as a comment; employee notified with it");

  // ---- 2. The employee reads the request and redoes the work ---------------------------------
  const employee = await flow.openSession("employee");
  await employee.page.goto(flow.url("/app/notifications"), { waitUntil: "networkidle" });
  const card = employee.page
    .locator("article")
    .filter({ has: employee.page.getByRole("heading", { name: "Yêu cầu chỉnh sửa công việc" }) })
    .filter({ hasText: task.title })
    .first();
  await card.waitFor({ timeout: SLOW });
  await Promise.all([
    employee.page.waitForURL((u) => u.pathname === url, { timeout: SLOW }),
    card.getByRole("link", { name: /Mở liên kết/ }).click(),
  ]);
  await employee.page.getByText(`Yêu cầu chỉnh sửa: ${reason}`).waitFor({ timeout: SLOW });
  assert.equal(await employee.page.getByLabel("Đổi trạng thái công việc").inputValue(), "in_progress");
  await employee.page.getByLabel("Bình luận mới").fill("Đã chỉnh logo và màu nền theo yêu cầu.");
  await employee.page.getByRole("button", { name: "Gửi bình luận" }).click();
  await employee.page.getByRole("button", { name: "Gửi duyệt" }).click();
  await flow.poll("resubmitted", () => statusOf(task.id), (status) => status === "review");
  await flow.poll(
    "second review notification",
    () => flow.notifications(U.leader.id, "task.review_requested", task.id),
    (rows) => rows.length === 2,
  );
  flow.step("2. Employee read the request from the notification, reworked and resubmitted; Team Leader notified again");

  // ---- 3. APPROVE branch (UI) with an error + retry --------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await panel.waitFor({ timeout: SLOW });
  await page.route("**/api/v1/projects/*/tasks/*", (route) =>
    route.request().method() === "PATCH" ? route.abort() : route.continue(),
  );
  await panel.getByRole("button", { name: "Duyệt hoàn thành" }).click();
  await page.locator(".border-red-200").first().waitFor({ timeout: SLOW });
  assert.equal(await statusOf(task.id), "review", "a failed request must not approve");
  await flow.shot(page, "03-approve-error");
  await page.unroute("**/api/v1/projects/*/tasks/*");
  await panel.getByRole("button", { name: "Duyệt hoàn thành" }).click();
  await flow.poll("approved", () => statusOf(task.id), (status) => status === "done");
  await panel.waitFor({ state: "detached", timeout: SLOW });
  const approved = await flow.poll(
    "approval notification",
    () => flow.notifications(U.employee.id, "task.review_approved", task.id),
    (rows) => rows.length === 1,
  );
  assert.equal(approved[0].action_url, url);
  flow.step("3. Approve: the failed request changed nothing; the retry approved; employee notified");

  // ---- 4. No duplicate approval, no reopening by the employee ----------------------------------------
  const second = await newReviewTask("Duyệt đồng thời");
  const both = await Promise.all([
    flow.api("PATCH", `/projects/${projectId}/tasks/${second.id}`, leaderToken, { status: "done" }),
    flow.api("PATCH", `/projects/${projectId}/tasks/${second.id}`, adminToken, { status: "done" }),
  ]);
  both.forEach((res) => flow.expectStatus(res, 200, "Concurrent approval"));
  await flow.poll("concurrent approval", () => statusOf(second.id), (status) => status === "done");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.equal(
    (await flow.notifications(U.employee.id, "task.review_approved", second.id)).length,
    1,
    "two simultaneous approvals produce one notification",
  );
  flow.expectStatus(
    await flow.api("PATCH", `/projects/${projectId}/tasks/${second.id}`, leaderToken, { status: "done" }),
    200,
    "Approving again is idempotent",
  );
  assert.equal((await flow.notifications(U.employee.id, "task.review_approved", second.id)).length, 1);
  const reopen = await flow.api("PATCH", `/projects/${projectId}/tasks/${second.id}`, employeeToken, { status: "in_progress" });
  flow.expectStatus(reopen, 403, "An employee must not reopen an approved task");
  assert.equal(reopen.data.code, "TASK_REVIEW_REQUIRED");
  assert.equal(await statusOf(second.id), "done");
  flow.step("4. Simultaneous + repeated approvals give one transition and one notification; the employee cannot reopen");

  // ---- 5. Server-side reason rule + wrong actors ------------------------------------------------------------
  const third = await newReviewTask("Từ chối qua API");
  const noReason = await flow.api("PATCH", `/projects/${projectId}/tasks/${third.id}`, leaderToken, { status: "in_progress" });
  flow.expectStatus(noReason, 400, "Sending back without a reason");
  assert.equal(noReason.data.code, "REVIEW_NOTE_REQUIRED");
  assert.equal(await statusOf(third.id), "review");
  flow.expectStatus(
    await flow.api("PATCH", `/projects/${projectId}/tasks/${third.id}`, employeeToken, { status: "in_progress", reviewNote: "tự từ chối" }),
    403,
    "An employee must not attach review notes",
  );
  flow.step("5. The reason is enforced by the API too; employees cannot decide or annotate reviews");

  // ---- 6. Approval moves the workflow on ------------------------------------------------------------------------
  // Self-contained fixture (disposable DB only) so this branch ALWAYS runs: on the
  // Team Leader's managed project, item A (open primary task) gates item B
  // (finish_to_start). Approving A's task must complete A and unlock B.
  const wfProjectId = LOCAL_UAT.projects.managed.id;
  const inst = (
    await db.query(`SELECT public.workflow_instantiate_project_service($1::uuid, $2::uuid, $3::uuid) AS res`, [
      wfProjectId,
      LOCAL_UAT.projectService.id,
      U.admin.id,
    ])
  ).rows[0].res;
  assert.equal(inst.instantiated, true, "Fixture: the managed project must have a runtime workflow (needs a default published template)");
  const wfItems = (
    await db.query(
      `SELECT i.id, i.project_service_item_id, i.project_workflow_stage_id
         FROM public.project_workflow_stage_items i
        WHERE i.project_workflow_id = $1::uuid
        ORDER BY i.project_workflow_stage_id, i.id`,
      [inst.workflowId],
    )
  ).rows;
  assert.ok(wfItems.length >= 2, "Fixture: the workflow needs at least two items (predecessor + successor)");
  const [itemA, itemB] = wfItems;
  const itemIds = [itemA.id, itemB.id];
  const stageIds = [...new Set([itemA.project_workflow_stage_id, itemB.project_workflow_stage_id])];
  await db.query(`DELETE FROM public.project_workflow_item_dependencies WHERE predecessor_stage_item_id = ANY($1::uuid[]) OR successor_stage_item_id = ANY($1::uuid[])`, [itemIds]);
  await db.query(`DELETE FROM public.project_workflow_task_links WHERE project_workflow_stage_item_id = ANY($1::uuid[])`, [itemIds]);
  await db.query(`UPDATE public.project_workflow_stages SET status = 'ready', completed_at = NULL WHERE id = ANY($1::uuid[])`, [stageIds]);
  await db.query(
    `UPDATE public.project_workflow_stage_items
        SET completion_mode = 'tasks_done', approval_required = false, approval_scope = NULL, completed_at = NULL,
            status = CASE WHEN id = $1::uuid THEN 'ready' ELSE 'blocked' END
      WHERE id = ANY($2::uuid[])`,
    [itemA.id, itemIds],
  );
  await db.query(
    `INSERT INTO public.project_workflow_item_dependencies (project_workflow_id, predecessor_stage_item_id, successor_stage_item_id)
     VALUES ($1::uuid, $2::uuid, $3::uuid)`,
    [inst.workflowId, itemA.id, itemB.id],
  );
  const primary = (
    await db.query(
      `SELECT public.workflow_create_primary_task($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid) AS res`,
      [wfProjectId, itemA.id, itemA.project_service_item_id, `[FLOW04] Hạng mục workflow ${Date.now().toString(36)}`, U.admin.id],
    )
  ).rows[0].res;
  const itemStatus = async (id) =>
    (await db.query(`SELECT status::text AS status FROM public.project_workflow_stage_items WHERE id = $1::uuid`, [id])).rows[0].status;
  assert.equal(await itemStatus(itemB.id), "blocked", "Fixture: the successor starts blocked");
  const wfTask = `/projects/${wfProjectId}/tasks/${primary.id}`;
  flow.expectStatus(await flow.api("PATCH", wfTask, leaderToken, { assigneeUserId: U.employee.id }), 200, "Assign workflow task");
  flow.expectStatus(await flow.api("PATCH", wfTask, employeeToken, { status: "review" }), 200, "Submit workflow task");
  assert.equal(await itemStatus(itemA.id) === "completed", false, "A task in review must not complete its workflow item");
  assert.equal(await itemStatus(itemB.id), "blocked", "The successor stays blocked while the predecessor is in review");
  flow.expectStatus(await flow.api("PATCH", wfTask, leaderToken, { status: "done" }), 200, "Approve workflow task");
  await flow.poll("workflow item completed", () => itemStatus(itemA.id), (status) => status === "completed");
  await flow.poll("successor item unlocked", () => itemStatus(itemB.id), (status) => status === "ready");
  flow.step("6. Approving the linked task completed its workflow item and unlocked the next item (blocked -> ready)", {
    itemId: itemA.id,
    unlockedItemId: itemB.id,
  });

  // ---- 7. Refresh + new login ----------------------------------------------------------------------------------------
  await page.goto(flow.url(url), { waitUntil: "networkidle" });
  assert.equal(await page.getByLabel("Đổi trạng thái công việc").inputValue(), "done");
  const again = await flow.openSession("employee");
  await again.page.goto(flow.url(url), { waitUntil: "networkidle" });
  assert.equal(await again.page.getByLabel("Đổi trạng thái công việc").inputValue(), "done");
  flow.step("7. After refresh and a brand-new login both roles see the approved task");

  // ---- 8. Responsive + accessibility ------------------------------------------------------------------------------------
  const pending = await newReviewTask("Kiểm tra giao diện");
  await flow.checkResponsive(page, `/app/projects/${projectId}/tasks/${pending.id}`);
  flow.step("8. The review panel page has no overflow and no serious/critical axe issue at 375/768px");

  flow.writeState({ f04: { projectId, taskId: task.id } });
});
