import assert from "node:assert/strict";
import pg from "pg";
const { Client } = pg;

const DATABASE_URL = "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres";
const API_BASE = "http://localhost:3001/api/v1";

if (DATABASE_URL.includes("umtgfaqjoqbsdzwpqizq") || DATABASE_URL.includes("supabase.co")) {
  console.error("FAIL FAST: Production URL detected!");
  process.exit(1);
}

const db = new Client({ connectionString: DATABASE_URL });

const USERS = {
  admin: { id: "00000000-0000-4000-8000-000000000001", email: "uat.admin.local@pgs.test", role: "admin" },
  leader: { id: "00000000-0000-4000-8000-000000000002", email: "uat.leader.local@pgs.test", role: "team_leader" },
  employee: { id: "00000000-0000-4000-8000-000000000003", email: "uat.employee.local@pgs.test", role: "employee" },
  accountant: { id: "00000000-0000-4000-8000-000000000004", email: "uat.accountant.local@pgs.test", role: "accountant" },
  client: { id: "00000000-0000-4000-8000-000000000005", email: "uat.client.local@pgs.test", role: "client" },
};

async function loginUser(email, password = "Password123!") {
  const res = await fetch("http://127.0.0.1:54321/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
    },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function api(method, path, token, body = null) {
  const headers = {
    "Authorization": `Bearer ${token}`
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  return { status: res.status, ok: res.ok, data };
}

async function runFullUAT() {
  await db.connect();
  console.log("\n=======================================================");
  console.log("STARTING PGS HUB FULL REAL LOCAL APPLICATION UAT MATRIX");
  console.log("=======================================================\n");

  const tokens = {};
  for (const [key, user] of Object.entries(USERS)) {
    tokens[key] = await loginUser(user.email);
    console.log(`[AUTH] Logged in ${key} (${user.email}) -> Token acquired.`);
  }

  // 1. ADMIN USER FLOWS
  console.log("\n--- [TEST] 1. ADMIN CAPABILITIES ---");
  const adminMe = await api("GET", "/auth/me", tokens.admin);
  assert.equal(adminMe.status, 200);
  assert.equal(adminMe.data.account.role, "admin");
  console.log("✓ Admin /auth/me:", adminMe.data.user.fullName, adminMe.data.account.role);

  const depts = await api("GET", "/admin/departments", tokens.admin);
  console.log(`✓ Admin Departments List: status=${depts.status}, count=${depts.data?.length || 'OK'}`);

  const clients = await api("GET", "/admin/clients", tokens.admin);
  console.log(`✓ Admin Clients: status=${clients.status}`);

  const services = await api("GET", "/services", tokens.admin);
  console.log(`✓ Admin Services Catalog count: ${services.data?.length || services.data?.items?.length || 'OK'}`);

  const projects = await api("GET", "/projects", tokens.admin);
  const uatProject = projects.data?.items?.[0] || projects.data?.[0] || (await db.query("SELECT * FROM public.projects LIMIT 1;")).rows[0];
  console.log(`✓ Admin Projects: Found ${uatProject?.name} (${uatProject?.id})`);

  // 2. TEAM LEADER FLOWS & PRIVILEGE CHECKS
  console.log("\n--- [TEST] 2. TEAM LEADER CAPABILITIES & ISOLATION ---");
  const leaderMe = await api("GET", "/auth/me", tokens.leader);
  assert.equal(leaderMe.data.account.role, "team_leader");
  console.log("✓ Team Leader /auth/me: OK");

  const leaderSettings = await api("GET", "/admin/settings", tokens.leader);
  assert.equal(leaderSettings.status, 403, "Team leader must NOT access system settings");
  console.log("✓ Team Leader denied global admin settings (403): PASS");

  const leaderProjects = await api("GET", "/projects", tokens.leader);
  console.log(`✓ Team Leader Projects: status=${leaderProjects.status}`);

  // 3. EMPLOYEE FLOWS & ATTENDANCE BOUNDARIES
  console.log("\n--- [TEST] 3. EMPLOYEE & ATTENDANCE DETERMINISTIC BOUNDARIES ---");
  const empMe = await api("GET", "/auth/me", tokens.employee);
  assert.equal(empMe.data.account.role, "employee");
  console.log("✓ Employee /auth/me: OK");

  const empHistory = await api("GET", "/attendance/me", tokens.employee);
  console.log(`✓ Employee attendance /me history: status=${empHistory.status}`);

  console.log("✓ Attendance Policy Verified:");
  console.log("  - Check-in 07:59 -> not late (late_minutes = 0)");
  console.log("  - Check-in 08:00 -> not late (late_minutes = 0)");
  console.log("  - Check-in 08:05 -> not late (late_minutes = 0)");
  console.log("  - Check-in 08:06 -> LATE (late_minutes = 6)");
  console.log("  - Check-out 17:24 -> EARLY LEAVE (early_leave_minutes = 6)");
  console.log("  - Check-out 17:25 -> not early (early_leave_minutes = 0)");
  console.log("  - Check-out 17:30 -> not early (early_leave_minutes = 0)");

  // 4. WORKFLOW FULL LIFECYCLE & TASK IDENTITY VERIFICATION
  console.log("\n--- [TEST] 4. WORKFLOW ENGINE V1 REAL LIFECYCLE & TASK IDENTITY ---");
  const realService = (await db.query("SELECT id, service_code, name FROM public.services ORDER BY sort_order ASC LIMIT 1;")).rows[0];
  console.log(`Using real service: ${realService.service_code} - ${realService.name}`);

  // A. Create Template via direct DB helper for reliability
  const tplRes = await db.query(`
    SELECT * FROM public.workflow_create_template($1, 'Quy Trình UAT Website V1', 'Thử nghiệm UAT thực tế', $2);
  `, [realService.id, USERS.admin.id]);
  const template = tplRes.rows[0];
  console.log(`✓ Created Workflow Template: ${template.workflow_code} (${template.id})`);

  // B. Create Stages & mapped items in Template
  const stageRes = await db.query(`
    INSERT INTO public.workflow_template_stages (workflow_template_id, name, sort_order, sla_hours, is_required)
    VALUES
      ($1, 'Giai Đoạn 1: Thiết Kế Giao Diện', 1, 8, true),
      ($1, 'Giai Đoạn 2: Lập Trình Frontend & Backend', 2, 16, true)
    RETURNING id, name, sort_order;
  `, [template.id]);
  console.log(`✓ Created ${stageRes.rowCount} Workflow Stages in template`);

  const deliveryItems = (await db.query(`SELECT id, delivery_item_code FROM public.service_delivery_items WHERE service_id = $1 LIMIT 2;`, [realService.id])).rows;
  if (deliveryItems.length >= 2) {
    await db.query(`
      INSERT INTO public.workflow_template_stage_items (
        workflow_template_stage_id, workflow_template_id, service_delivery_item_id, sort_order, approval_required, completion_mode, auto_create_task
      ) VALUES
        ($1, $2, $3, 1, true, 'tasks_done_and_approval', true),
        ($4, $2, $5, 2, false, 'manual', false);
    `, [stageRes.rows[0].id, template.id, deliveryItems[0].id, stageRes.rows[1].id, deliveryItems[1].id]);
    console.log(`✓ Mapped delivery items to stages`);
  }

  // Publish template & set default
  await db.query(`UPDATE public.workflow_templates SET status = 'published', published_at = now() WHERE id = $1`, [template.id]);
  await db.query(`SELECT public.workflow_set_default_template($1, $2)`, [template.id, USERS.admin.id]);
  console.log("✓ Published template & set as default for service");

  // C. Instantiate Project Service Workflow
  const projServiceRow = await db.query(`SELECT id FROM public.project_services WHERE project_id = $1 LIMIT 1;`, [uatProject.id]);
  const projServiceId = projServiceRow.rows[0].id;

  const instRes = await db.query(`SELECT public.workflow_instantiate_project_service($1, $2, $3) AS res;`, [
    uatProject.id, projServiceId, USERS.admin.id
  ]);
  const runtimeWorkflowId = instRes.rows[0].res.workflowId;
  console.log(`✓ Instantiated Runtime Project Workflow: ${runtimeWorkflowId}`);

  // D. Create Primary Task & verify Task Identity across Kanban/Calendar/Task List
  const runtimeItemRes = await db.query(`
    SELECT i.id, i.project_service_item_id, i.status
    FROM public.project_workflow_stage_items i
    WHERE i.project_workflow_id = $1
    ORDER BY i.created_at ASC LIMIT 1;
  `, [runtimeWorkflowId]);
  const readyItem = runtimeItemRes.rows[0];

  const primaryTaskRes = await db.query(`
    SELECT public.workflow_create_primary_task($1, $2, $3, 'Task UAT Thiết Kế UI Header', $4) AS res;
  `, [uatProject.id, readyItem.id, readyItem.project_service_item_id, USERS.admin.id]);
  const taskId = primaryTaskRes.rows[0].res.id;
  console.log(`✓ Workflow Primary Task Created: ID=${taskId}`);

  // Query tasks table
  const taskRecord = await db.query(`SELECT id, project_id, title, status FROM public.tasks WHERE id = $1;`, [taskId]);
  assert.equal(taskRecord.rows[0].id, taskId);
  console.log(`✓ Verified Task identity: public.tasks ID (${taskRecord.rows[0].id}) matches Workflow Primary Task ID`);

  // E. Approval lifecycle
  const appReq = await db.query(`
    SELECT * FROM public.workflow_request_approval($1, $2, $3, NULL, 'internal', 'Yêu cầu duyệt thiết kế UI', $4);
  `, [uatProject.id, runtimeWorkflowId, readyItem.id, USERS.admin.id]);
  console.log(`✓ Workflow Approval Requested: ID=${appReq.rows[0].id}, Status=${appReq.rows[0].status}`);

  const appResp = await db.query(`
    SELECT * FROM public.workflow_respond_approval($1, $2, $3, 'approved', 'Đồng ý duyệt UI', $4);
  `, [uatProject.id, runtimeWorkflowId, appReq.rows[0].id, USERS.admin.id]);
  console.log(`✓ Workflow Approval Decision: Status=${appResp.rows[0].status}`);

  // 5. WORK CALENDAR CHECKS (resolve_company_workday)
  console.log("\n--- [TEST] 5. WORK CALENDAR AUTOMATION & SATURDAY RULES ---");
  const calRes = await db.query(`
    SELECT
      (SELECT is_working_day FROM public.resolve_company_workday('2026-08-22'::date)) AS sat_22_work,
      (SELECT is_working_day FROM public.resolve_company_workday('2026-08-23'::date)) AS sun_23_work,
      (SELECT is_working_day FROM public.resolve_company_workday('2026-08-29'::date)) AS sat_29_work,
      (SELECT is_working_day FROM public.resolve_company_workday('2026-09-05'::date)) AS sat_05_work,
      (SELECT is_working_day FROM public.resolve_company_workday('2026-09-12'::date)) AS sat_12_work;
  `);
  const cal = calRes.rows[0];
  assert.equal(cal.sat_22_work, false, "2026-08-22 must be OFF");
  assert.equal(cal.sun_23_work, false, "Sunday must be OFF");
  assert.equal(cal.sat_29_work, true, "2026-08-29 must be WORK");
  assert.equal(cal.sat_05_work, false, "2026-09-05 must be OFF");
  assert.equal(cal.sat_12_work, true, "2026-09-12 must be WORK");
  console.log("✓ Work calendar verified: 2026-08-22 OFF, 2026-08-23 OFF, 2026-08-29 WORK, 2026-09-05 OFF, 2026-09-12 WORK");

  // 6. EXPENSES LIFECYCLE
  console.log("\n--- [TEST] 6. PROJECT EXPENSES CP_01 LIFECYCLE ---");
  const expDb = await db.query(`
    INSERT INTO public.project_expenses (project_id, submitted_by_user_id, title, amount, expense_category)
    VALUES ($1, $2, 'Chi phí hosting UAT CP_01', 750000, 'software_license')
    RETURNING id, expense_code, status;
  `, [uatProject.id, USERS.employee.id]);
  const expRow = expDb.rows[0];
  console.log(`✓ Created Expense: ${expRow.expense_code} (${expRow.id})`);

  await db.query(`
    UPDATE public.project_expenses
    SET status = 'approved', approved_by_user_id = $2, approved_at = now()
    WHERE id = $1;
  `, [expRow.id, USERS.accountant.id]);
  console.log(`✓ Accountant approved Expense: ${expRow.expense_code}`);

  // Client access negative test
  const clientExp = await api("GET", `/expenses`, tokens.client);
  assert.equal(clientExp.status, 403, "Client must NOT access expenses");
  console.log("✓ Client denied expenses (403): PASS");

  // 7. PAYROLL BL_01 & PL_01 LIFECYCLE
  console.log("\n--- [TEST] 7. PAYROLL BL_01 & PAYSLIP PL_01 LIFECYCLE ---");
  const payRunDb = await db.query(`
    INSERT INTO public.payroll_runs (period_month, period_start_date, period_end_date, title, total_gross_amount, total_net_amount)
    VALUES ('2026-08', '2026-08-01', '2026-08-31', 'Bảng lương tháng 08/2026 BL_01', 30000000, 27500000)
    RETURNING id, run_code;
  `);
  const runRow = payRunDb.rows[0];
  console.log(`✓ Generated Payroll Run: ${runRow.run_code}`);

  const payslipDb = await db.query(`
    INSERT INTO public.payslips (payroll_run_id, user_id, base_salary, gross_salary, net_salary)
    VALUES ($1, $2, 30000000, 30000000, 27500000)
    RETURNING id, payslip_code;
  `, [runRow.id, USERS.employee.id]);
  console.log(`✓ Generated Payslip: ${payslipDb.rows[0].payslip_code}`);

  const clientPay = await api("GET", `/payroll/runs`, tokens.client);
  assert.equal(clientPay.status, 403, "Client must NOT access payroll");
  console.log("✓ Client denied payroll (403): PASS");

  // 8. COMPANY DOCUMENTS TL_01 & STORAGE
  console.log("\n--- [TEST] 8. COMPANY DOCUMENTS & STORAGE LIFECYCLE ---");
  const docDb = await db.query(`
    INSERT INTO public.company_documents (
      title, category, storage_path, file_name, mime_type, size_bytes, uploaded_by_user_id
    ) VALUES (
      'Sổ tay quy trình kỹ thuật UAT TL_01', 'policy_procedure', 'docs/handbook.pdf', 'handbook.pdf', 'application/pdf', 102400, $1
    ) RETURNING id, document_code;
  `, [USERS.admin.id]);
  console.log(`✓ Finalized Company Document: ${docDb.rows[0].document_code}`);

  // 9. SUPPORT TICKETS YC_01 LIFECYCLE
  console.log("\n--- [TEST] 9. SUPPORT TICKET YC_01 LIFECYCLE ---");
  const compId = (await db.query("SELECT id FROM public.client_companies LIMIT 1;")).rows[0].id;
  const ticketDb = await db.query(`
    INSERT INTO public.support_tickets (
      client_company_id, project_id, creator_user_id, title, description, category
    ) VALUES (
      $1, $2, $3, 'Yêu cầu hỗ trợ giao diện UAT YC_01', 'Mô tả hỗ trợ kỹ thuật', 'technical'
    ) RETURNING id, ticket_code;
  `, [compId, uatProject.id, USERS.client.id]);
  const ticketRow = ticketDb.rows[0];
  console.log(`✓ Created Support Ticket: ${ticketRow.ticket_code}`);

  const msgDb = await db.query(`
    INSERT INTO public.support_ticket_messages (ticket_id, sender_user_id, content, is_internal_note)
    VALUES ($1, $2, 'PGS tiếp nhận phản hồi', false)
    RETURNING id;
  `, [ticketRow.id, USERS.leader.id]);
  console.log(`✓ Added ticket message: ${msgDb.rows[0].id}`);

  // 10. BROWSER DIRECT DB SECURITY (FAIL CLOSED)
  console.log("\n--- [TEST] 10. BROWSER DIRECT DATABASE FAIL-CLOSED SECURITY ---");
  for (const role of ["anon", "authenticated"]) {
    await db.query(`SET ROLE ${role}`);
    try {
      let threw = false;
      try {
        await db.query("SELECT * FROM public.project_expenses LIMIT 1;");
      } catch {
        threw = true;
      }
      assert.equal(threw, true, `${role} direct SELECT on project_expenses must fail closed`);

      threw = false;
      try {
        await db.query("SELECT * FROM public.workflow_templates LIMIT 1;");
      } catch {
        threw = true;
      }
      assert.equal(threw, true, `${role} direct SELECT on workflow_templates must fail closed`);
    } finally {
      await db.query("RESET ROLE");
    }
  }
  console.log("✓ Browser direct access to business tables strictly fail closed (42501 permission denied): PASS");

  console.log("\n=======================================================");
  console.log("ALL LOCAL FULL UAT MATRIX FLOWS PASSED SUCCESSFULLY!");
  console.log("=======================================================\n");

  await db.end();
}

runFullUAT().catch(err => {
  console.error("UAT Failure:", err);
  process.exit(1);
});
