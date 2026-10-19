// FLOW 01 - Khoi tao du an (Admin): customer -> project -> manager / member /
// service -> visibility for Team Leader + Employee, with RBAC and tenant checks.
// Real browser UI (Playwright) + API + Postgres assertions. Disposable DB only.
import assert from "node:assert/strict";
import { createFlow, escapeRegExp, LOCAL_UAT, runFlow, SLOW, U } from "./lib/flow-kit.mjs";

const flow = await createFlow({ id: "flow01", title: "Khởi tạo dự án" });

await runFlow(flow, async () => {
  const { db } = flow;
  const stamp = Date.now().toString(36);
  const companyName = `[FLOW01] Khách hàng ${stamp}`;
  const projectName = `[FLOW01] Dự án ${stamp}`;

  const admin = await flow.openSession("admin");
  const adminPage = admin.page;

  // ---- 1. Admin creates the customer ------------------------------------------
  await adminPage.goto(flow.url("/app/admin/clients"), { waitUntil: "networkidle" });
  await adminPage.getByRole("button", { name: /Thêm khách hàng/ }).first().click();
  await adminPage.getByLabel(/^Tên doanh nghiệp/).fill(companyName);
  await adminPage.getByLabel(/^Email liên hệ/).fill(`f01-${stamp}@example.test`);
  await adminPage.getByRole("button", { name: "Tạo khách hàng", exact: true }).click();
  const company = (
    await flow.poll(
      "client company row",
      async () =>
        (await db.query(`SELECT id, code FROM public.client_companies WHERE name = $1`, [companyName])).rows,
      (rows) => rows.length === 1,
    )
  )[0];
  await flow.shot(adminPage, "01-customer-created");
  flow.step("1. Admin created the customer through the UI (row in client_companies)", {
    companyId: company.id,
    code: company.code,
  });

  // Empty state of the customer list (loading/empty/error coverage)
  await adminPage.goto(flow.url("/app/admin/clients"), { waitUntil: "networkidle" });
  await adminPage.getByPlaceholder(/Tìm theo tên/).fill(`khong-co-${stamp}-xyz`);
  await adminPage.getByText("Không tìm thấy khách hàng").waitFor({ timeout: SLOW });
  flow.step("1b. Customer search with no match shows the empty state");

  // ---- 2. Admin creates the project (3-step wizard) -----------------------------
  await adminPage.goto(flow.url("/app/admin/projects"), { waitUntil: "networkidle" });
  await adminPage.getByRole("button", { name: /Tạo dự án mới/ }).first().click();
  await adminPage.getByLabel(/^Khách hàng Doanh nghiệp/).selectOption({ label: companyName });
  await adminPage.getByLabel(/^Tên dự án/).fill(projectName);
  await adminPage
    .getByPlaceholder(/Mô tả mục tiêu/)
    .fill("Dự án kiểm thử luồng khởi tạo [LOCAL-UAT flow01]");
  await adminPage.getByRole("button", { name: "Tiếp tục" }).click();
  await flow.selectByText(
    adminPage.getByLabel(/^Quản lý dự án/),
    new RegExp(`\\(${escapeRegExp(U.leader.email)}\\)`),
  );
  await adminPage.getByLabel(/^Ngày bắt đầu/).fill("2026-01-05");
  await adminPage.getByLabel(/^Hạn chót dự kiến/).fill("2026-12-31");
  await adminPage.getByLabel(/^Trạng thái kích hoạt ban đầu/).selectOption("active");
  await adminPage.getByRole("button", { name: "Tiếp tục" }).click();
  await adminPage.getByRole("button", { name: /Tạo dự án ngay/ }).click();
  const project = (
    await flow.poll(
      "project row",
      async () =>
        (
          await db.query(
            `SELECT id, project_code, client_company_id, project_manager_user_id, status::text AS status
               FROM public.projects WHERE name = $1`,
            [projectName],
          )
        ).rows,
      (rows) => rows.length === 1,
    )
  )[0];
  assert.equal(project.client_company_id, company.id, "project belongs to the new customer");
  assert.equal(project.project_manager_user_id, U.leader.id, "Team Leader is the project manager");
  assert.equal(project.status, "active");
  assert.match(project.project_code, /^DA_\d+$/);
  flow.step("2. Admin created the project through the wizard: customer + Team Leader + status stored", {
    projectId: project.id,
    projectCode: project.project_code,
  });

  // ---- 3. Members and services from the project page ---------------------------
  await adminPage.goto(flow.url(`/app/admin/projects/${project.id}`), { waitUntil: "networkidle" });
  await adminPage.locator("button").filter({ hasText: /^\s*Nhân sự/ }).first().click();
  await adminPage.getByRole("button", { name: "Thêm nhân sự" }).click();
  await flow.selectByText(
    adminPage.getByLabel(/^Chọn nhân viên/),
    new RegExp(`\\(${escapeRegExp(U.employee.email)}\\)`),
  );
  await adminPage.getByRole("button", { name: "Lưu thành viên" }).click();
  await flow.poll(
    "employee membership",
    async () =>
      (
        await db.query(
          `SELECT project_role::text AS role FROM public.project_memberships
            WHERE project_id = $1::uuid AND user_id = $2::uuid`,
          [project.id, U.employee.id],
        )
      ).rows,
    (rows) => rows.length === 1 && rows[0].role === "member",
  );
  flow.step("3a. Admin added the Employee to the project (project_memberships)");

  await adminPage.locator("button").filter({ hasText: /^\s*Dịch vụ/ }).first().click();
  await adminPage.getByRole("button", { name: "Gán dịch vụ" }).click();
  await flow.selectByText(
    adminPage.getByLabel(/^Chọn gói dịch vụ/),
    new RegExp(escapeRegExp(LOCAL_UAT.projectService.serviceCode)),
  );
  await adminPage.getByRole("button", { name: "Lưu dịch vụ" }).click();
  await flow.poll(
    "project service",
    async () =>
      (
        await db.query(
          `SELECT ps.id FROM public.project_services ps
             JOIN public.services s ON s.id = ps.service_id
            WHERE ps.project_id = $1::uuid AND s.service_code = $2`,
          [project.id, LOCAL_UAT.projectService.serviceCode],
        )
      ).rows,
    (rows) => rows.length === 1,
  );
  await flow.shot(adminPage, "03-project-members-services");
  flow.step("3b. Admin assigned the service to the project (project_services)");

  // Department: the API supports it, the approved wizard (Figma) has no field.
  const adminToken = await flow.token("admin");
  const dept = await flow.api("PATCH", `/admin/projects/${project.id}`, adminToken, {
    departmentId: LOCAL_UAT.departments.primary.id,
  });
  flow.expectStatus(dept, 200, "Assign department");
  assert.equal(
    (await db.query(`SELECT department_id FROM public.projects WHERE id = $1::uuid`, [project.id])).rows[0].department_id,
    LOCAL_UAT.departments.primary.id,
  );
  flow.note("Department is assigned via PATCH /admin/projects/:id: the approved project wizard has no department field (design gap).");
  flow.step("3c. Department stored on the project (API; no UI field in the approved design)");

  // ---- 4. Default notifications -------------------------------------------------
  await flow.poll(
    "manager notification",
    () => flow.notifications(U.leader.id, "project.manager_assigned", project.id),
    (rows) => rows.length >= 1,
  );
  await flow.poll(
    "member notification",
    () => flow.notifications(U.employee.id, "project.member_added", project.id),
    (rows) => rows.length === 1,
  );
  assert.equal((await flow.notifications(U.accountant.id, "project.manager_assigned", project.id)).length, 0);
  flow.step("4. Team Leader and Employee were notified by default; others were not");

  // ---- 5. What each role sees ----------------------------------------------------
  const leader = await flow.openSession("leader");
  await leader.page.goto(flow.url("/app/notifications"), { waitUntil: "networkidle" });
  const card = leader.page
    .locator("article")
    .filter({ has: leader.page.getByRole("heading", { name: "Bạn được giao quản lý dự án" }) })
    .first();
  await card.waitFor({ timeout: SLOW });
  await Promise.all([
    leader.page.waitForURL((url) => url.pathname === `/app/projects/${project.id}`, { timeout: SLOW }),
    card.getByRole("link", { name: /Mở liên kết/ }).click(),
  ]);
  await leader.page.getByText(projectName).first().waitFor({ timeout: SLOW });
  await flow.shot(leader.page, "05-leader-opened-project");
  await leader.page.goto(flow.url("/app/team-leader/projects"), { waitUntil: "networkidle" });
  await leader.page.getByText(projectName).first().waitFor({ timeout: SLOW });
  flow.step("5a. Team Leader follows the notification to the project and sees it in his list");

  const employee = await flow.openSession("employee");
  await employee.page.goto(flow.url("/app/employee/projects"), { waitUntil: "networkidle" });
  await employee.page.getByText(projectName).first().waitFor({ timeout: SLOW });
  flow.step("5b. Employee sees the project he was added to");

  // ---- 6. RBAC and tenant isolation ------------------------------------------------
  const leaderToken = await flow.token("leader");
  const employeeToken = await flow.token("employee");
  const foreignToken = await flow.token("foreignEmployee");
  const clientToken = await flow.token("client");
  flow.expectStatus(await flow.api("GET", `/projects/${project.id}`, leaderToken), 200, "Leader reads own project");
  flow.expectStatus(await flow.api("GET", `/projects/${project.id}`, employeeToken), 200, "Member reads project");
  flow.expectStatus(await flow.api("GET", `/projects/${project.id}`, foreignToken), [403, 404], "Non-member employee must not read the project");
  const foreignList = await flow.api("GET", "/projects?page=1&pageSize=100", foreignToken);
  flow.expectStatus(foreignList, 200, "Foreign project list");
  assert.ok(
    !JSON.stringify(foreignList.data).includes(project.id),
    "The new project must not appear in a non-member's list",
  );
  flow.expectStatus(
    await flow.api("GET", `/client/me/projects/${project.id}`, clientToken),
    [403, 404],
    "Another company's client must not open the project",
  );
  flow.expectStatus(
    await flow.api("POST", `/admin/projects/${project.id}/members`, employeeToken, {
      userId: U.foreignEmployee.id,
      projectRole: "member",
    }),
    403,
    "An employee must not add members",
  );
  flow.expectStatus(
    await flow.api("POST", "/admin/projects", employeeToken, {
      clientCompanyId: company.id,
      name: "Không được tạo",
    }),
    403,
    "An employee must not create projects",
  );
  flow.step("6. RBAC + tenant isolation: non-member, other client and employee writes are refused");

  // ---- 7. No duplicates ---------------------------------------------------------------
  flow.expectStatus(
    await flow.api("POST", "/admin/projects", adminToken, {
      clientCompanyId: company.id,
      name: `${projectName} (trùng mã)`,
      projectCode: project.project_code,
      status: "active",
    }),
    409,
    "Duplicate project code",
  );
  flow.expectStatus(
    await flow.api("POST", `/admin/projects/${project.id}/members`, adminToken, {
      userId: U.employee.id,
      projectRole: "member",
    }),
    409,
    "Duplicate membership",
  );
  flow.step("7. Duplicate project code and duplicate membership are refused (409)");

  // ---- 8. Refresh + brand-new login ------------------------------------------------------
  await adminPage.reload({ waitUntil: "networkidle" });
  await adminPage.getByText(projectName).first().waitFor({ timeout: SLOW });
  const again = await flow.openSession("leader");
  await again.page.goto(flow.url("/app/team-leader/projects"), { waitUntil: "networkidle" });
  await again.page.getByText(projectName).first().waitFor({ timeout: SLOW });
  flow.step("8. After refresh and a brand-new login the data is still there");

  // ---- 9. Responsive + accessibility ----------------------------------------------------------
  await flow.checkResponsive(adminPage, "/app/admin/clients");
  await flow.checkResponsive(adminPage, "/app/admin/projects");
  await flow.checkResponsive(adminPage, `/app/admin/projects/${project.id}`);
  await flow.checkResponsive(again.page, "/app/team-leader/projects");
  flow.step("9. No overflow and no serious/critical axe issues at 375/768px on the touched pages");

  flow.writeState({
    f01: {
      projectId: project.id,
      projectCode: project.project_code,
      projectName,
      companyId: company.id,
      companyName,
    },
  });
});
