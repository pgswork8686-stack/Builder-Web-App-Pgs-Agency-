// FLOW 03 - Thuc hien va bao cao tien do: Employee works on the assigned task,
// comments, uploads a file and submits it for review; the Team Leader sees it.
// Browser UI (Playwright) + API + Postgres. Disposable DB only.
import assert from "node:assert/strict";
import { createFlow, LOCAL_UAT, runFlow, SLOW, U } from "./lib/flow-kit.mjs";

const flow = await createFlow({ id: "flow03", title: "Thực hiện và báo cáo tiến độ" });

await runFlow(flow, async () => {
  const { db } = flow;
  const prior = flow.readState().f02;
  let projectId = prior?.projectId ?? LOCAL_UAT.projects.managed.id;
  let taskId = prior?.taskId;
  let title = prior?.taskTitle;
  const leaderToken = await flow.token("leader");
  if (!taskId) {
    title = `[FLOW03] Báo cáo tiến độ ${Date.now().toString(36)}`;
    const created = await flow.api("POST", `/projects/${projectId}/tasks`, leaderToken, {
      title,
      status: "todo",
      priority: "medium",
      sortOrder: 0,
      assigneeUserId: U.employee.id,
    });
    flow.expectStatus(created, [200, 201], "Fixture task");
    taskId = created.data.id;
    flow.note("Flow 02 state missing: created a fixture task through the API");
  } else {
    flow.note("Using the task created by Flow 02");
  }
  const taskUrl = `/app/projects/${projectId}/tasks/${taskId}`;
  const statusOf = async () =>
    (await db.query(`SELECT status::text AS status, updated_by FROM public.tasks WHERE id = $1::uuid`, [taskId])).rows[0];

  const employee = await flow.openSession("employee");
  const page = employee.page;

  // ---- 1. Employee starts the task ---------------------------------------------
  await page.goto(flow.url(taskUrl), { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: title }).waitFor({ timeout: SLOW });
  const select = page.getByLabel("Đổi trạng thái công việc");
  const options = await select.locator("option").allInnerTexts();
  assert.ok(!options.includes("Hoàn thành"), `An employee must not be offered "Hoàn thành" (got ${options.join(", ")})`);
  await select.selectOption("in_progress");
  const started = await flow.poll("in_progress", statusOf, (row) => row.status === "in_progress");
  assert.equal(started.updated_by, U.employee.id);
  flow.step("1. Employee set the task to in_progress; 'Hoàn thành' is not offered to him");

  // ---- 2. Comment ----------------------------------------------------------------
  const comment = `Đã hoàn thiện bản v1, chờ góp ý [FLOW03 ${Date.now().toString(36)}]`;
  await page.getByLabel("Bình luận mới").fill(comment);
  await page.getByRole("button", { name: "Gửi bình luận" }).click();
  await page.getByText(comment).first().waitFor({ timeout: SLOW });
  const commentRow = (
    await flow.poll(
      "comment row",
      async () => (await db.query(`SELECT id, author_user_id FROM public.task_comments WHERE task_id = $1::uuid AND content = $2`, [taskId, comment])).rows,
      (rows) => rows.length === 1,
    )
  )[0];
  assert.equal(commentRow.author_user_id, U.employee.id);
  await flow.poll(
    "comment notification for the Team Leader",
    () => flow.notifications(U.leader.id, "task.comment", commentRow.id),
    (rows) => rows.length === 1,
  );
  flow.step("2. Employee commented: stored with author, Team Leader notified");

  // ---- 3. Upload a deliverable ---------------------------------------------------------
  const fileName = `ket-qua-flow03-${Date.now().toString(36)}.pdf`;
  await page.getByLabel("Chọn tệp tải lên").setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% PGS HUB flow03 deliverable\n%%EOF\n"),
  });
  await page.getByRole("button", { name: `Tải xuống ${fileName}` }).waitFor({ timeout: SLOW });
  const file = (
    await flow.poll(
      "project_files row",
      async () =>
        (
          await db.query(
            `SELECT uploaded_by, task_id, size_bytes::int AS size FROM public.project_files
              WHERE project_id = $1::uuid AND original_name = $2`,
            [projectId, fileName],
          )
        ).rows,
      (rows) => rows.length === 1,
    )
  )[0];
  assert.equal(file.uploaded_by, U.employee.id);
  assert.equal(file.task_id, taskId, "the file is attached to the task");
  assert.ok(file.size > 0);
  await flow.shot(page, "03-employee-uploaded");
  flow.step("3. Employee uploaded a deliverable: file row attached to the task");

  // ---- 4. Submit for review --------------------------------------------------------------
  await page.getByRole("button", { name: "Gửi duyệt" }).click();
  await flow.poll("review status", statusOf, (row) => row.status === "review");
  await page.getByText(/chờ Trưởng nhóm duyệt/).waitFor({ timeout: SLOW });
  await flow.poll(
    "review notification for the Team Leader",
    () => flow.notifications(U.leader.id, "task.review_requested", taskId),
    (rows) => rows.length === 1,
  );
  flow.step("4. Employee submitted for review: status review + Team Leader notified");

  // ---- 5. The Team Leader sees the change ----------------------------------------------------
  const leader = await flow.openSession("leader");
  await leader.page.goto(flow.url("/app/notifications"), { waitUntil: "networkidle" });
  const card = leader.page
    .locator("article")
    .filter({ has: leader.page.getByRole("heading", { name: "Công việc chờ duyệt" }) })
    .filter({ hasText: title })
    .first();
  await card.waitFor({ timeout: SLOW });
  await Promise.all([
    leader.page.waitForURL((url) => url.pathname === taskUrl, { timeout: SLOW }),
    card.getByRole("link", { name: /Mở liên kết/ }).click(),
  ]);
  await leader.page.getByRole("region", { name: "Duyệt kết quả công việc" }).waitFor({ timeout: SLOW });
  await leader.page.getByText(comment).first().waitFor();
  await leader.page.getByRole("button", { name: `Tải xuống ${fileName}` }).waitFor();
  assert.equal(await leader.page.getByLabel("Đổi trạng thái công việc").inputValue(), "review");
  await flow.shot(leader.page, "05-leader-sees-submission");
  flow.step("5. Team Leader opens the notification: status, comment, file and the review panel are all there");

  // ---- 6. No self-approval, no foreign access, no duplicate submit ---------------------------------
  const employeeToken = await flow.token("employee");
  const foreignToken = await flow.token("foreignEmployee");
  const approve = await flow.api("PATCH", `/projects/${projectId}/tasks/${taskId}`, employeeToken, { status: "done" });
  flow.expectStatus(approve, 403, "An employee must not approve his own work");
  assert.equal(approve.data.code, "TASK_REVIEW_REQUIRED");
  flow.expectStatus(
    await flow.api("PATCH", `/projects/${projectId}/tasks/${taskId}`, employeeToken, { title: "Đổi tên trái phép" }),
    403,
    "An employee may change the status only",
  );
  flow.expectStatus(
    await flow.api("POST", `/projects/${projectId}/tasks/${taskId}/comments`, foreignToken, { content: "xen vào" }),
    403,
    "A non-member must not comment",
  );
  const workflow = (await db.query(`SELECT id FROM public.project_workflows WHERE project_id = $1::uuid LIMIT 1`, [projectId])).rows[0];
  if (workflow) {
    flow.expectStatus(
      await flow.api("POST", `/projects/${projectId}/workflows/${workflow.id}/approvals`, employeeToken, { approvalType: "internal", stageItemId: "00000000-0000-4000-8000-000000000000" }),
      [400, 403],
      "An employee must not request or decide workflow approvals",
    );
  }
  flow.expectStatus(
    await flow.api("PATCH", `/projects/${projectId}/tasks/${taskId}`, employeeToken, { status: "review" }),
    200,
    "Submitting again is idempotent",
  );
  assert.equal((await flow.notifications(U.leader.id, "task.review_requested", taskId)).length, 1, "no second review notification");
  assert.equal((await statusOf()).status, "review");
  flow.step("6. RBAC: no self-approval, no field edits, no foreign comment; resubmitting does not notify twice");

  // ---- 7. Refresh + new login -------------------------------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(comment).first().waitFor({ timeout: SLOW });
  await page.getByRole("button", { name: `Tải xuống ${fileName}` }).waitFor();
  assert.equal(await page.getByLabel("Đổi trạng thái công việc").inputValue(), "review");
  const again = await flow.openSession("employee");
  await again.page.goto(flow.url(taskUrl), { waitUntil: "networkidle" });
  await again.page.getByText(/chờ Trưởng nhóm duyệt/).waitFor({ timeout: SLOW });
  flow.step("7. After refresh and a brand-new login: status, comment and file are intact");

  // ---- 8. Responsive + accessibility ---------------------------------------------------------------------
  await flow.checkResponsive(again.page, taskUrl);
  await flow.checkResponsive(leader.page, taskUrl);
  flow.step("8. Task detail has no overflow and no serious/critical axe issue at 375/768px (employee + leader)");

  flow.writeState({ f03: { projectId, taskId, taskTitle: title, comment, fileName } });
});
