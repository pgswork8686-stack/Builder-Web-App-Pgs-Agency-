// FLOW 07 - Hoan tat va ban giao: Admin checks the completion conditions and
// accepts the project, the manager hands documents over, the Client sees ONLY
// those documents (still after re-login), Admin archives the project.
// Browser UI (Playwright) + API + Postgres. Disposable DB only.
import assert from "node:assert/strict";
import { createFlow, LOCAL_UAT, runFlow, SLOW, U } from "./lib/flow-kit.mjs";

const flow = await createFlow({ id: "flow07", title: "Hoàn tất và bàn giao" });

await runFlow(flow, async () => {
  const { db } = flow;
  const stamp = Date.now().toString(36);
  const adminToken = await flow.token("admin");
  const leaderToken = await flow.token("leader");
  const employeeToken = await flow.token("employee");
  const clientToken = await flow.token("client");

  // ---- Fixture: a fresh project of the client's company --------------------------
  const created = await flow.api("POST", "/admin/projects", adminToken, {
    clientCompanyId: LOCAL_UAT.companies.primary.id,
    name: `[FLOW07] Dự án bàn giao ${stamp}`,
    status: "active",
    priority: "medium",
    projectManagerUserId: U.leader.id,
    departmentId: LOCAL_UAT.departments.primary.id,
    startDate: "2026-01-05",
    dueDate: "2026-12-31",
  });
  flow.expectStatus(created, [200, 201], "Fixture project");
  const projectId = created.data.id;
  const projectCode = created.data.projectCode;
  const projectName = created.data.name;
  flow.expectStatus(
    await flow.api("POST", `/admin/projects/${projectId}/members`, adminToken, { userId: U.employee.id, projectRole: "member" }),
    [200, 201],
    "Fixture member",
  );
  const task = await flow.api("POST", `/projects/${projectId}/tasks`, leaderToken, {
    title: `[FLOW07] Việc còn mở ${stamp}`,
    status: "todo",
    priority: "medium",
    sortOrder: 0,
    assigneeUserId: U.employee.id,
  });
  flow.expectStatus(task, [200, 201], "Fixture task");

  async function uploadFile(name, content) {
    const auth = await flow.api("POST", `/projects/${projectId}/files/upload-request`, leaderToken, {
      fileName: name,
      mimeType: "application/pdf",
      sizeBytes: Buffer.byteLength(content),
    });
    flow.expectStatus(auth, [200, 201], "upload-request");
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", new Blob([content], { type: "application/pdf" }), name);
    const put = await fetch(auth.data.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form });
    assert.ok(put.ok, `signed upload failed: ${put.status} ${await put.text()}`);
    const done = await flow.api("POST", `/projects/${projectId}/files/finalize`, leaderToken, { uploadSessionId: auth.data.uploadSessionId });
    flow.expectStatus(done, [200, 201], "finalize");
    return done.data.id;
  }
  const handoverContent = `%PDF-1.4\n% FLOW07 handover ${stamp}\n%%EOF\n`;
  const handoverName = `ban-giao-${stamp}.pdf`;
  const internalName = `noi-bo-${stamp}.pdf`;
  const internalId = await uploadFile(internalName, `%PDF-1.4\n% FLOW07 internal ${stamp}\n%%EOF\n`);
  const handoverId = await uploadFile(handoverName, handoverContent);
  flow.step("0. Fixture: a project of the client's company with one open task and two files", {
    projectId,
    projectCode,
  });

  const admin = await flow.openSession("admin");
  const page = admin.page;
  const projectUrl = `/app/admin/projects/${projectId}`;

  // ---- 1. Completion conditions block the acceptance -------------------------------------
  await page.goto(flow.url(projectUrl), { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Nghiệm thu/ }).first().click();
  const conditions = page.getByRole("region", { name: "Điều kiện hoàn thành" });
  await conditions.getByText("Chưa đủ điều kiện nghiệm thu").waitFor({ timeout: SLOW });
  await conditions.getByText(/1 công việc chưa hoàn thành/).waitFor();
  assert.equal(await page.getByRole("button", { name: /Xác nhận hoàn tất/ }).isDisabled(), true);
  await flow.shot(page, "01-completion-blocked");
  const blocked = await flow.api("PATCH", `/admin/projects/${projectId}`, adminToken, { status: "completed" });
  flow.expectStatus(blocked, 409, "The API must refuse too");
  assert.equal(blocked.data.code, "PROJECT_COMPLETION_BLOCKED");
  assert.equal(
    (await db.query(`SELECT status::text AS status FROM public.projects WHERE id = $1::uuid`, [projectId])).rows[0].status,
    "active",
  );
  flow.step("1. Open work blocks the acceptance in the UI and in the API (409); nothing changed");

  // ---- 2. Resolve, then accept ----------------------------------------------------------------
  flow.expectStatus(
    await flow.api("PATCH", `/projects/${projectId}/tasks/${task.data.id}`, adminToken, { status: "done" }),
    200,
    "Close the open task",
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Nghiệm thu/ }).first().click();
  await page.getByRole("region", { name: "Điều kiện hoàn thành" }).getByText(/Đủ điều kiện nghiệm thu/).waitFor({ timeout: SLOW });
  await page.getByRole("button", { name: /Xác nhận hoàn tất/ }).click();
  const completed = await flow.poll(
    "project completed",
    async () =>
      (await db.query(`SELECT status::text AS status, completed_at FROM public.projects WHERE id = $1::uuid`, [projectId])).rows[0],
    (row) => row.status === "completed",
  );
  assert.ok(completed.completed_at, "completed_at is stored");
  await flow.poll(
    "client completion notification",
    () => flow.notifications(U.client.id, "project.completed", projectId),
    (rows) => rows.length === 1,
  );
  await flow.poll(
    "manager completion notification",
    () => flow.notifications(U.leader.id, "project.completed", projectId),
    (rows) => rows.length === 1,
  );
  assert.equal((await flow.notifications(U.accountant.id, "project.completed", projectId)).length, 0);
  flow.step("2. Admin accepted the project: status completed + completed_at; client and manager notified");

  // ---- 3. Hand documents over ---------------------------------------------------------------------
  const leader = await flow.openSession("leader");
  await leader.page.goto(flow.url(`/app/projects/${projectId}/files`), { waitUntil: "networkidle" });
  await leader.page.getByRole("button", { name: `Bàn giao ${handoverName} cho khách hàng` }).click();
  await flow.poll(
    "handover flag",
    async () => (await db.query(`SELECT file_category FROM public.project_files WHERE id = $1::uuid`, [handoverId])).rows[0].file_category,
    (category) => category === "client_handover",
  );
  await leader.page.getByText("Đã bàn giao cho khách hàng").first().waitFor({ timeout: SLOW });
  assert.equal(
    (await db.query(`SELECT file_category FROM public.project_files WHERE id = $1::uuid`, [internalId])).rows[0].file_category,
    null,
    "the internal file stays internal",
  );
  await flow.poll(
    "handover notification",
    () => flow.notifications(U.client.id, "project.handover_document", projectId),
    (rows) => rows.length === 1,
  );
  await flow.shot(leader.page, "03-handed-over");
  flow.expectStatus(
    await flow.api("PATCH", `/projects/${projectId}/files/${internalId}/handover`, employeeToken, { clientVisible: true }),
    403,
    "An employee must not hand documents over",
  );
  flow.expectStatus(
    await flow.api("PATCH", `/projects/${projectId}/files/${internalId}/handover`, clientToken, { clientVisible: true }),
    403,
    "A client must not mark documents",
  );
  flow.expectStatus(
    await flow.api("PATCH", `/projects/${projectId}/files/${handoverId}/handover`, leaderToken, { clientVisible: true }),
    200,
    "Handing over twice is idempotent",
  );
  assert.equal((await flow.notifications(U.client.id, "project.handover_document", projectId)).length, 1, "no second notification");
  flow.step("3. Manager handed one file over: flag stored, client notified once; employees/clients cannot");

  // ---- 4. The client sees only the handed-over document --------------------------------------------------
  const client = await flow.openSession("client");
  await client.page.goto(flow.url("/app/notifications"), { waitUntil: "networkidle" });
  const card = client.page
    .locator("article")
    .filter({ has: client.page.getByRole("heading", { name: "Có tài liệu bàn giao mới" }) })
    .filter({ hasText: handoverName })
    .first();
  await card.waitFor({ timeout: SLOW });
  await Promise.all([
    client.page.waitForURL((u) => u.pathname === "/app/client/documents", { timeout: SLOW }),
    card.getByRole("link", { name: /Mở liên kết/ }).click(),
  ]);
  await client.page.locator(`tr[data-file-id="${handoverId}"]`).waitFor({ timeout: SLOW });
  assert.equal(await client.page.locator(`tr[data-file-id="${internalId}"]`).count(), 0, "the internal file must not be listed");
  assert.equal(await client.page.getByText(internalName).count(), 0);
  const [download] = await Promise.all([
    client.page.waitForEvent("download", { timeout: SLOW }),
    client.page.getByRole("button", { name: `Tải xuống ${handoverName}` }).click(),
  ]);
  assert.equal(download.suggestedFilename(), handoverName);
  const { createReadStream } = await import("node:fs");
  const chunks = [];
  for await (const chunk of createReadStream(await download.path())) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString("utf8"), handoverContent, "the downloaded bytes equal the uploaded ones");
  await flow.shot(client.page, "04-client-documents");
  await client.page.goto(flow.url("/app/client/projects/completed"), { waitUntil: "networkidle" });
  await client.page.getByText(projectName).first().waitFor({ timeout: SLOW });
  flow.step("4. Client followed the notification, sees only the handed-over file, downloaded identical bytes, sees the completed project");

  // ---- 5. Isolation ----------------------------------------------------------------------------------------
  flow.expectStatus(await flow.api("GET", `/projects/${projectId}/files`, clientToken), 403, "Project files stay closed to clients");
  flow.expectStatus(await flow.api("GET", `/client/me/handover/${internalId}/download`, clientToken), 404, "Internal file via the client API");
  flow.expectStatus(await flow.api("GET", "/client/me/handover", employeeToken), 403, "Employees have no client handover list");
  flow.expectStatus(await flow.api("GET", `/client/me/handover/${handoverId}/download`, employeeToken), 403, "Employee download");
  const list = await flow.api("GET", "/client/me/handover?page=1&pageSize=50", clientToken);
  flow.expectStatus(list, 200, "Client handover list");
  assert.ok(list.data.items.some((f) => f.id === handoverId));
  assert.ok(!JSON.stringify(list.data).includes(internalId), "no internal file id in the client list");
  assert.ok(!JSON.stringify(list.data).includes("storage_path"), "no storage path leaks");
  flow.step("5. Isolation: project files closed to clients, internal files not downloadable, employees locked out");

  // ---- 6. Archive: the exact business status, handover still reachable -----------------------------------------
  await page.goto(flow.url(projectUrl), { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Lưu trữ", exact: true }).click();
  await page.getByRole("button", { name: /Lưu trữ dự án/ }).click();
  const archived = await flow.poll(
    "project archived",
    async () => (await db.query(`SELECT status::text AS status FROM public.projects WHERE id = $1::uuid`, [projectId])).rows[0].status,
    (status) => status === "archived",
  );
  assert.equal(archived, "archived", "closing must store 'archived', never 'cancelled'");
  const again = await flow.openSession("client");
  await again.page.goto(flow.url("/app/client/documents"), { waitUntil: "networkidle" });
  await again.page.locator(`tr[data-file-id="${handoverId}"]`).waitFor({ timeout: SLOW });
  flow.expectStatus(
    await flow.api("GET", `/client/me/handover/${handoverId}/download`, await flow.token("client")),
    200,
    "Handover is still downloadable after archiving",
  );
  flow.step("6. Archiving stores 'archived'; after a brand-new login the client still reaches the handover");

  // ---- 7. Error + retry on the client page ------------------------------------------------------------------------
  let aborted = false;
  await again.page.route("**/api/v1/client/me/handover?*", (route) => {
    if (!aborted) {
      aborted = true;
      return route.abort();
    }
    return route.continue();
  });
  await again.page.reload({ waitUntil: "networkidle" });
  await again.page.getByRole("button", { name: /Thử lại/ }).click();
  await again.page.locator(`tr[data-file-id="${handoverId}"]`).waitFor({ timeout: SLOW });
  await again.page.unroute("**/api/v1/client/me/handover?*");
  flow.step("7. A failed load shows the error banner; 'Thử lại' recovers");

  // ---- 8. Responsive + accessibility ---------------------------------------------------------------------------------
  await flow.checkResponsive(again.page, "/app/client/documents");
  await flow.checkResponsive(leader.page, `/app/projects/${projectId}/files`);
  await flow.checkResponsive(page, projectUrl);
  flow.step("8. Documents, files and project pages: no overflow, no serious/critical axe issue at 375/768px");

  flow.writeState({ f07: { projectId, projectCode, handoverId } });
});
