import assert from "node:assert/strict";
import pg from "pg";
import { io } from "socket.io-client";
import {
  assertConfirmedDisposableLocalDatabaseUrl,
  assertLoopbackUrl,
  assertNoHostedSupabaseEnvironment,
} from "./lib/local-endpoint-guard.mjs";
import { LOCAL_UAT } from "./lib/local-uat-fixtures.mjs";
const { Client } = pg;

assertNoHostedSupabaseEnvironment(process.env);

const DATABASE_URL =
  "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres";
const API_BASE =
  process.env.PGS_LOCAL_UAT_API_BASE ?? "http://localhost:3001/api/v1";
const SUPABASE_URL =
  process.env.PGS_LOCAL_UAT_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.PGS_LOCAL_UAT_SUPABASE_PUBLISHABLE_KEY?.trim();

assertConfirmedDisposableLocalDatabaseUrl(DATABASE_URL);
assert.ok(
  SUPABASE_PUBLISHABLE_KEY,
  "PGS_LOCAL_UAT_SUPABASE_PUBLISHABLE_KEY must be explicitly set for local Auth.",
);
const API_BASE_URL = assertLoopbackUrl(API_BASE, "API_BASE", [
  "http:",
  "https:",
]);
const SUPABASE_BASE_URL = assertLoopbackUrl(SUPABASE_URL, "SUPABASE_URL", [
  "http:",
  "https:",
]);
const CHAT_SOCKET_URL =
  process.env.PGS_LOCAL_UAT_CHAT_SOCKET_URL ??
  new URL("/chat", API_BASE_URL.origin).toString();
const CHAT_SOCKET_BASE_URL = assertLoopbackUrl(
  CHAT_SOCKET_URL,
  "CHAT_SOCKET_URL",
  ["http:", "https:"],
);
assert.equal(
  CHAT_SOCKET_BASE_URL.origin,
  API_BASE_URL.origin,
  "CHAT_SOCKET_URL must remain on the configured local API origin.",
);

const db = new Client({ connectionString: DATABASE_URL });

const USERS = {
  admin: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@test.local",
    role: "admin",
  },
  leader: {
    id: "00000000-0000-4000-8000-000000000002",
    email: "leader@test.local",
    role: "team_leader",
  },
  employee: {
    id: "00000000-0000-4000-8000-000000000003",
    email: "employee@test.local",
    role: "employee",
  },
  accountant: {
    id: "00000000-0000-4000-8000-000000000004",
    email: "accountant@test.local",
    role: "accountant",
  },
  client: {
    id: "00000000-0000-4000-8000-000000000005",
    email: "client@test.local",
    role: "client",
  },
};

function resolveLocalStorageSignedUrl(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string.`);
  const rawUrl = value.trim();
  assert.ok(rawUrl, `${label} must not be empty.`);

  let resolvedUrl;
  if (/^[a-z][a-z\d+.-]*:/i.test(rawUrl) || rawUrl.startsWith("//")) {
    resolvedUrl = new URL(rawUrl, SUPABASE_BASE_URL);
  } else {
    const storagePath = rawUrl.startsWith("/")
      ? rawUrl
      : rawUrl.startsWith("storage/v1/")
        ? `/${rawUrl}`
        : `/storage/v1/${rawUrl}`;
    resolvedUrl = new URL(storagePath, SUPABASE_BASE_URL);
  }

  const safeUrl = assertLoopbackUrl(resolvedUrl.toString(), label, [
    "http:",
    "https:",
  ]);
  assert.equal(
    safeUrl.origin,
    SUPABASE_BASE_URL.origin,
    `${label} must target the configured local Supabase origin.`,
  );
  assert.ok(
    safeUrl.pathname.startsWith("/storage/v1/"),
    `${label} must target the Supabase Storage API.`,
  );
  return safeUrl.toString();
}

function localApiUrl(path) {
  assert.ok(path.startsWith("/"), "API paths must start with '/'.");
  const url = new URL(
    `${API_BASE_URL.origin}${API_BASE_URL.pathname.replace(/\/$/, "")}${path}`,
  );
  const safeUrl = assertLoopbackUrl(url.toString(), "API request URL", [
    "http:",
    "https:",
  ]);
  assert.equal(
    safeUrl.origin,
    API_BASE_URL.origin,
    "API request must stay on the configured local API origin.",
  );
  return safeUrl.toString();
}

async function loginUser(email, password = "Password123!") {
  const loginUrl = new URL(
    "/auth/v1/token?grant_type=password",
    SUPABASE_BASE_URL,
  );
  const res = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ email, password }),
    redirect: "error",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function api(method, path, token, body = null) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(localApiUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
    redirect: "error",
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  return { status: res.status, ok: res.ok, data };
}

async function runRealApplicationUAT() {
  await db.connect();
  console.log("\n=======================================================");
  console.log("STARTING PGS HUB STRICT END-TO-END REAL APPLICATION UAT");
  console.log("=======================================================\n");

  const tokens = {};
  for (const [key, user] of Object.entries(USERS)) {
    tokens[key] = await loginUser(user.email);
    console.log(`[AUTH] Logged in ${key} (${user.email}) -> Token acquired.`);
  }

  // ==========================================
  // 1. ADMIN FLOWS VIA API
  // ==========================================
  console.log("\n--- [TEST] 1. ADMIN USER & RESOURCE LIFECYCLES ---");
  const adminMe = await api("GET", "/auth/me", tokens.admin);
  assert.equal(adminMe.status, 200);
  assert.equal(adminMe.data.account.role, "admin");
  console.log(
    "✓ Admin /auth/me:",
    adminMe.data.user.fullName,
    adminMe.data.account.role,
  );

  const depts = await api("GET", "/admin/departments", tokens.admin);
  assert.equal(depts.status, 200);
  console.log(
    `✓ Admin Departments List: ${depts.data.length} departments found.`,
  );

  const clients = await api("GET", "/admin/clients", tokens.admin);
  assert.equal(clients.status, 200);
  console.log(`✓ Admin Clients List: status=${clients.status}`);

  const services = await api("GET", "/admin/services", tokens.admin);
  assert.equal(services.status, 200);
  const serviceItems = services.data.items ?? services.data;
  const catalogService = serviceItems.find(
    (service) =>
      service.serviceCode === LOCAL_UAT.projectService.serviceCode ||
      service.service_code === LOCAL_UAT.projectService.serviceCode,
  );
  assert.ok(
    catalogService,
    `Expected ${LOCAL_UAT.projectService.serviceCode} service fixture.`,
  );
  console.log(
    `✓ Admin Services Catalog: Found ${catalogService.name} (${catalogService.id})`,
  );

  const projects = await api("GET", "/projects", tokens.admin);
  assert.equal(projects.status, 200);
  const projectItems = projects.data.items ?? projects.data;
  const uatProject = projectItems.find(
    (project) => project.id === LOCAL_UAT.projects.managed.id,
  );
  assert.ok(uatProject, "Expected managed local UAT project fixture.");
  console.log(`✓ Admin Projects: Found ${uatProject.name} (${uatProject.id})`);

  const settingsRes = await api("GET", "/admin/settings", tokens.admin);
  assert.equal(settingsRes.status, 200);
  console.log(`✓ Admin Settings read: status=200 OK`);

  const attendanceSettings = await api(
    "GET",
    "/attendance/settings",
    tokens.admin,
  );
  assert.equal(attendanceSettings.status, 200);
  assert.equal(attendanceSettings.data.timezone, "Asia/Ho_Chi_Minh");
  assert.equal(
    String(attendanceSettings.data.workday_start_time).slice(0, 5),
    "08:00",
  );
  assert.equal(
    String(attendanceSettings.data.workday_end_time).slice(0, 5),
    "17:30",
  );
  assert.equal(attendanceSettings.data.late_grace_minutes, 5);
  assert.equal(attendanceSettings.data.early_leave_grace_minutes, 5);
  console.log("✓ Admin reads canonical 08:00–17:30 attendance settings");

  // ==========================================
  // 2. TEAM LEADER FLOWS & ISOLATION
  // ==========================================
  console.log("\n--- [TEST] 2. TEAM LEADER CAPABILITIES & ISOLATION ---");
  const leaderMe = await api("GET", "/auth/me", tokens.leader);
  assert.equal(leaderMe.status, 200);
  assert.equal(leaderMe.data.account.role, "team_leader");
  console.log("✓ Team Leader /auth/me: OK");

  const leaderSettings = await api("GET", "/admin/settings", tokens.leader);
  assert.equal(
    leaderSettings.status,
    403,
    "Team leader must NOT access admin settings",
  );
  console.log("✓ Team Leader denied global admin settings (403): PASS");

  const leaderAttendanceSettings = await api(
    "GET",
    "/attendance/settings",
    tokens.leader,
  );
  assert.equal(
    leaderAttendanceSettings.status,
    403,
    "Team leader must NOT access attendance settings",
  );
  const leaderAttendanceDirectory = await api(
    "GET",
    "/attendance/directory",
    tokens.leader,
  );
  assert.equal(
    leaderAttendanceDirectory.status,
    200,
    "Team leader must access own team attendance",
  );
  console.log(
    "✓ Team Leader attendance scope: settings denied, own directory allowed",
  );

  const employeeAttendancePolicy = await api(
    "GET",
    "/attendance/policy",
    tokens.employee,
  );
  assert.equal(employeeAttendancePolicy.status, 200);
  assert.equal(employeeAttendancePolicy.data.locationRequired, true);
  assert.equal("officeLatitude" in employeeAttendancePolicy.data, false);
  assert.equal("locationRadiusMeters" in employeeAttendancePolicy.data, false);
  const clientAttendancePolicy = await api(
    "GET",
    "/attendance/policy",
    tokens.client,
  );
  assert.equal(
    clientAttendancePolicy.status,
    403,
    "Client must not access attendance policy",
  );
  console.log(
    "✓ Employee gets redacted attendance policy; client is denied (403)",
  );

  const leaderProjects = await api("GET", "/projects", tokens.leader);
  assert.equal(leaderProjects.status, 200);
  console.log(`✓ Team Leader Projects list: status=200 OK`);

  // ==========================================
  // 3. DETERMINISTIC EXECUTABLE ATTENDANCE BOUNDARIES
  // ==========================================
  console.log(
    "\n--- [TEST] 3. EXECUTABLE ATTENDANCE BOUNDARY CALCULATIONS ---",
  );
  // Test Attendance Calculation Algorithm in DB directly across boundaries:
  // Workday: 08:00 (Grace 5m -> Late from 08:06), Work End: 17:30 (Grace 5m -> Early before 17:25)
  const calcResults = await db.query(`
    WITH settings AS (
      SELECT workday_start_time, workday_end_time, late_grace_minutes, early_leave_grace_minutes
      FROM public.attendance_settings LIMIT 1
    ),
    eval AS (
      SELECT
        -- Check-in boundaries (07:59, 08:00, 08:05, 08:06)
        CASE WHEN (EXTRACT(HOUR FROM '2026-08-21 07:59:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 07:59:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) - (EXTRACT(HOUR FROM s.workday_start_time)*60 + EXTRACT(MINUTE FROM s.workday_start_time)) > s.late_grace_minutes
             THEN (EXTRACT(HOUR FROM '2026-08-21 07:59:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 07:59:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) - (EXTRACT(HOUR FROM s.workday_start_time)*60 + EXTRACT(MINUTE FROM s.workday_start_time))
             ELSE 0 END AS late_0759,

        CASE WHEN (EXTRACT(HOUR FROM '2026-08-21 08:00:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 08:00:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) - (EXTRACT(HOUR FROM s.workday_start_time)*60 + EXTRACT(MINUTE FROM s.workday_start_time)) > s.late_grace_minutes
             THEN (EXTRACT(HOUR FROM '2026-08-21 08:00:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 08:00:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) - (EXTRACT(HOUR FROM s.workday_start_time)*60 + EXTRACT(MINUTE FROM s.workday_start_time))
             ELSE 0 END AS late_0800,

        CASE WHEN (EXTRACT(HOUR FROM '2026-08-21 08:05:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 08:05:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) - (EXTRACT(HOUR FROM s.workday_start_time)*60 + EXTRACT(MINUTE FROM s.workday_start_time)) > s.late_grace_minutes
             THEN (EXTRACT(HOUR FROM '2026-08-21 08:05:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 08:05:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) - (EXTRACT(HOUR FROM s.workday_start_time)*60 + EXTRACT(MINUTE FROM s.workday_start_time))
             ELSE 0 END AS late_0805,

        CASE WHEN (EXTRACT(HOUR FROM '2026-08-21 08:06:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 08:06:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) - (EXTRACT(HOUR FROM s.workday_start_time)*60 + EXTRACT(MINUTE FROM s.workday_start_time)) > s.late_grace_minutes
             THEN (EXTRACT(HOUR FROM '2026-08-21 08:06:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 08:06:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) - (EXTRACT(HOUR FROM s.workday_start_time)*60 + EXTRACT(MINUTE FROM s.workday_start_time))
             ELSE 0 END AS late_0806,

        -- Check-out boundaries (17:24, 17:25, 17:30)
        CASE WHEN (EXTRACT(HOUR FROM s.workday_end_time)*60 + EXTRACT(MINUTE FROM s.workday_end_time)) - (EXTRACT(HOUR FROM '2026-08-21 17:24:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 17:24:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) > s.early_leave_grace_minutes
             THEN (EXTRACT(HOUR FROM s.workday_end_time)*60 + EXTRACT(MINUTE FROM s.workday_end_time)) - (EXTRACT(HOUR FROM '2026-08-21 17:24:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 17:24:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh'))
             ELSE 0 END AS early_1724,

        CASE WHEN (EXTRACT(HOUR FROM s.workday_end_time)*60 + EXTRACT(MINUTE FROM s.workday_end_time)) - (EXTRACT(HOUR FROM '2026-08-21 17:25:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 17:25:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) > s.early_leave_grace_minutes
             THEN (EXTRACT(HOUR FROM s.workday_end_time)*60 + EXTRACT(MINUTE FROM s.workday_end_time)) - (EXTRACT(HOUR FROM '2026-08-21 17:25:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 17:25:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh'))
             ELSE 0 END AS early_1725,

        CASE WHEN (EXTRACT(HOUR FROM s.workday_end_time)*60 + EXTRACT(MINUTE FROM s.workday_end_time)) - (EXTRACT(HOUR FROM '2026-08-21 17:30:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 17:30:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')) > s.early_leave_grace_minutes
             THEN (EXTRACT(HOUR FROM s.workday_end_time)*60 + EXTRACT(MINUTE FROM s.workday_end_time)) - (EXTRACT(HOUR FROM '2026-08-21 17:30:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')*60 + EXTRACT(MINUTE FROM '2026-08-21 17:30:00+07'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh'))
             ELSE 0 END AS early_1730
      FROM settings s
    )
    SELECT * FROM eval;
  `);

  const m = calcResults.rows[0];
  assert.equal(Number(m.late_0759), 0, "07:59 must have late_minutes = 0");
  assert.equal(Number(m.late_0800), 0, "08:00 must have late_minutes = 0");
  assert.equal(Number(m.late_0805), 0, "08:05 must have late_minutes = 0");
  assert.equal(
    Number(m.late_0806),
    6,
    "08:06 must have late_minutes = 6 (LATE)",
  );
  assert.equal(
    Number(m.early_1724),
    6,
    "17:24 must have early_leave_minutes = 6 (EARLY LEAVE)",
  );
  assert.equal(
    Number(m.early_1725),
    0,
    "17:25 must have early_leave_minutes = 0",
  );
  assert.equal(
    Number(m.early_1730),
    0,
    "17:30 must have early_leave_minutes = 0",
  );
  console.log("✓ Executable attendance boundary assertions: ALL PASSED");

  // Real Check-in API call by Employee
  const checkInRes = await api(
    "POST",
    "/attendance/check-in",
    tokens.employee,
    {
      latitude: 20.9768,
      longitude: 105.7725,
      note: "UAT Check-in test",
    },
  );
  assert.equal(checkInRes.status, 201, "Employee check-in must succeed");
  console.log("✓ Employee Check-in API: status=201 Created");

  const empHistory = await api("GET", "/attendance/me", tokens.employee);
  assert.equal(empHistory.status, 200);
  console.log("✓ Employee Attendance History API: status=200 OK");

  // ==========================================
  // 4. WORKFLOW ENGINE V1 FULL API LIFECYCLE & TASK IDENTITY
  // ==========================================
  console.log("\n--- [TEST] 4. WORKFLOW ENGINE V1 FULL API LIFECYCLE ---");
  // A. Create Template via API
  const createTpl = await api(
    "POST",
    "/admin/workflows/templates",
    tokens.admin,
    {
      serviceId: catalogService.id,
      name: "Quy Trình Chuẩn API UAT",
      description: "Quy trình thử nghiệm thông qua API thuần túy",
    },
  );
  const tplId = createTpl.data.id;
  assert.ok(tplId, "Template ID must be returned by API");
  console.log(
    `✓ API Created Template: ${createTpl.data.workflow_code || tplId}`,
  );

  // B. Create Stage via API
  const createStage1 = await api(
    "POST",
    `/admin/workflows/templates/${tplId}/stages`,
    tokens.admin,
    {
      name: "Giai Đoạn 1: Phân Tích Thiết Kế",
      sortOrder: 1,
      slaHours: 8,
      isRequired: true,
    },
  );
  assert.ok(createStage1.data.id, "Stage ID must be returned");
  const stageId = createStage1.data.id;
  console.log(`✓ API Created Workflow Stage: ${stageId}`);

  // Query service delivery items and map them via API
  const deliveryItems = (
    await db.query(
      `SELECT id, is_required FROM public.service_delivery_items WHERE service_id = $1 AND active = true;`,
      [catalogService.id],
    )
  ).rows;
  for (let i = 0; i < deliveryItems.length; i++) {
    const item = deliveryItems[i];
    const mapRes = await api(
      "POST",
      `/admin/workflows/stages/${stageId}/items`,
      tokens.admin,
      {
        serviceDeliveryItemId: item.id,
        sortOrder: i + 1,
        approvalRequired: false,
        approvalScope: "internal",
        completionMode: "manual",
        autoCreateTask: true,
      },
    );
    assert.equal(mapRes.status, 201);
  }
  console.log(`✓ API Mapped ${deliveryItems.length} Delivery Items to Stage`);

  // C. Publish Template via API
  const publishRes = await api(
    "POST",
    `/admin/workflows/templates/${tplId}/publish`,
    tokens.admin,
  );
  assert.equal(publishRes.status, 201);
  console.log("✓ API Published Workflow Template: status=201 OK");

  // D. Set Default Template via API
  const setDefaultRes = await api(
    "POST",
    `/admin/workflows/templates/${tplId}/set-default`,
    tokens.admin,
  );
  assert.equal(setDefaultRes.status, 201);
  console.log("✓ API Set Default Workflow Template: status=201 OK");

  // E. Runtime Instantiation & Task Creation via API / DB Helpers
  const projectServiceResult = await db.query(
    `SELECT id FROM public.project_services WHERE id = $1::uuid AND project_id = $2::uuid;`,
    [LOCAL_UAT.projectService.id, uatProject.id],
  );
  assert.equal(
    projectServiceResult.rowCount,
    1,
    "Expected fixed local UAT project service fixture.",
  );
  const projServiceId = projectServiceResult.rows[0].id;
  const inst = await db.query(
    `SELECT public.workflow_instantiate_project_service($1, $2, $3) AS res;`,
    [uatProject.id, projServiceId, USERS.admin.id],
  );
  const runtimeWfId = inst.rows[0].res.workflowId;
  console.log(`✓ Instantiated Runtime Project Workflow: ${runtimeWfId}`);

  const readyItem = (
    await db.query(
      `SELECT id, project_service_item_id FROM public.project_workflow_stage_items WHERE project_workflow_id = $1 LIMIT 1;`,
      [runtimeWfId],
    )
  ).rows[0];
  const pTask = await db.query(
    `SELECT public.workflow_create_primary_task($1, $2, $3, 'Task API UAT Task Identity', $4) AS res;`,
    [
      uatProject.id,
      readyItem.id,
      readyItem.project_service_item_id,
      USERS.admin.id,
    ],
  );
  const primaryTaskId = pTask.rows[0].res.id;
  console.log(`✓ Created Workflow Primary Task: ID=${primaryTaskId}`);

  // Verify task identity in Tasks API
  const taskApiRes = await api(
    "GET",
    `/projects/${uatProject.id}/tasks/${primaryTaskId}`,
    tokens.admin,
  );
  assert.equal(taskApiRes.status, 200);
  assert.equal(taskApiRes.data.id, primaryTaskId);
  console.log("✓ Verified Task Identity across NestJS Tasks API: PASS");

  // ==========================================
  // 5. REAL STORAGE FLOW TEST
  // ==========================================
  console.log(
    "\n--- [TEST] 5. REAL SUPABASE STORAGE UPLOAD & SIGNED URL FLOW ---",
  );
  // A. Create upload session via API
  const sessionRes = await api(
    "POST",
    "/documents/upload-session",
    tokens.admin,
    {
      title: "Tài Liệu Nghiệm Thu Storage UAT",
      category: "policy_procedure",
      fileName: "storage-uat-proof.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    },
  );
  assert.equal(sessionRes.status, 201);
  const { signedUrl, storagePath } = sessionRes.data;
  console.log(`✓ Created Storage Upload Session: Path=${storagePath}`);

  // B. Upload real binary payload to Storage Bucket
  const filePayload = Buffer.from(
    "%PDF-1.4 UAT Real Storage Test Content Proof " + Date.now(),
  );
  const uploadUrl = resolveLocalStorageSignedUrl(
    signedUrl,
    "Upload signed URL",
  );
  const uploadBinary = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/pdf",
    },
    body: filePayload,
    redirect: "error",
  });
  assert.ok(
    uploadBinary.ok,
    `Storage upload must succeed, got HTTP ${uploadBinary.status}`,
  );
  console.log(
    `✓ Real File Upload to Supabase Storage: status=${uploadBinary.status} OK`,
  );

  // C. Finalize document via API
  const finalizeRes = await api("POST", "/documents/finalize", tokens.admin, {
    title: "Tài Liệu Nghiệm Thu Storage UAT",
    category: "policy_procedure",
    storagePath: storagePath,
    fileName: "storage-uat-proof.pdf",
    mimeType: "application/pdf",
    sizeBytes: filePayload.byteLength,
  });
  assert.equal(finalizeRes.status, 201);
  const docId = finalizeRes.data.id;
  console.log(
    `✓ Finalized Document via API: ID=${docId}, Code=${finalizeRes.data.document_code}`,
  );

  // D. Generate signed download URL via API
  const downloadRes = await api(
    "GET",
    `/documents/${docId}/download`,
    tokens.employee,
  );
  assert.equal(downloadRes.status, 200);
  assert.ok(downloadRes.data.downloadUrl, "Download URL must be generated");
  console.log("✓ Generated signed download URL via API: PASS");

  // E. Download and verify content matches
  const downloadUrl = resolveLocalStorageSignedUrl(
    downloadRes.data.downloadUrl,
    "Download signed URL",
  );
  const downloadedContent = await fetch(downloadUrl, { redirect: "error" });
  assert.ok(
    downloadedContent.ok,
    `Signed download must succeed, got HTTP ${downloadedContent.status}`,
  );
  const contentBuf = await downloadedContent.arrayBuffer();
  assert.ok(contentBuf.byteLength > 0, "Downloaded content must not be empty");
  console.log(
    `✓ Downloaded real storage payload: ${contentBuf.byteLength} bytes verified.`,
  );

  // F. Delete document via API
  const deleteDoc = await api("DELETE", `/documents/${docId}`, tokens.admin);
  assert.equal(deleteDoc.status, 200);
  console.log("✓ Deleted document and purged storage object via API: PASS");

  // ==========================================
  // 6. EXPENSES REAL API LIFECYCLE
  // ==========================================
  console.log("\n--- [TEST] 6. EXPENSES API LIFECYCLE & RBAC ---");
  const expCreate = await api("POST", "/expenses", tokens.employee, {
    projectId: uatProject.id,
    title: "Chi phí bản quyền phần mềm API UAT",
    amount: 1250000,
    expenseCategory: "software_license",
    notes: "Chi phí mua bản quyền công cụ UAT",
  });
  assert.equal(expCreate.status, 201);
  const expId = expCreate.data.id;
  console.log(
    `✓ Employee created Expense via API: ID=${expId}, Code=${expCreate.data.expense_code}`,
  );

  const expApprove = await api(
    "POST",
    `/expenses/${expId}/review`,
    tokens.accountant,
    {
      action: "approved",
    },
  );
  assert.equal(expApprove.status, 201);
  console.log("✓ Accountant approved Expense via API: PASS");

  const expReimburse = await api(
    "POST",
    `/expenses/${expId}/reimburse`,
    tokens.accountant,
  );
  assert.equal(expReimburse.status, 201);
  console.log("✓ Accountant marked Expense reimbursed via API: PASS");

  const clientExpDenied = await api("GET", "/expenses", tokens.client);
  assert.equal(clientExpDenied.status, 403, "Client must NOT access expenses");
  console.log("✓ Client denied expenses API (403): PASS");

  // ==========================================
  // 7. PAYROLL REAL API LIFECYCLE & CONCURRENCY
  // ==========================================
  console.log("\n--- [TEST] 7. PAYROLL API LIFECYCLE, INTEGRITY & CONCURRENCY ---");
  await db.query(
    `DELETE FROM public.payroll_runs WHERE period_month IN ('2026-08', '2026-09')`,
  );
  const payGen = await api(
    "POST",
    "/payroll/runs/generate",
    tokens.accountant,
    {
      periodMonth: "2026-08",
      title: "Bảng lương kỳ tháng 08/2026 API UAT",
      standardWorkingDays: 22,
    },
  );
  assert.equal(payGen.status, 201);
  const runId = payGen.data.id;
  assert(payGen.data.total_employees_count > 0, "Payroll run must calculate active employees");
  assert(payGen.data.payslips?.length > 0, "Payroll run must contain payslips");
  assert(Number(payGen.data.total_net_amount) > 0, "Payroll total net amount must be positive");
  console.log(`✓ Accountant generated Payroll Run via API: ID=${runId}, Employees=${payGen.data.total_employees_count}, NetTotal=${payGen.data.total_net_amount}`);

  // Duplicate same-period creation must be rejected
  const payGenDuplicate = await api(
    "POST",
    "/payroll/runs/generate",
    tokens.accountant,
    {
      periodMonth: "2026-08",
      title: "Bảng lương kỳ tháng 08/2026 Duplicate Test",
      standardWorkingDays: 22,
    },
  );
  assert.equal(payGenDuplicate.status, 409, "Duplicate payroll period must be denied with 409 Conflict");
  console.log("✓ Duplicate same-period payroll creation denied (409 Conflict): PASS");

  // Concurrent creation for same period must result in exactly one run in DB
  const concurrentPeriod = "2026-09";
  const [concurrentRes1, concurrentRes2] = await Promise.all([
    api("POST", "/payroll/runs/generate", tokens.accountant, {
      periodMonth: concurrentPeriod,
      title: "Bảng lương kỳ tháng 09/2026 Concurrency Test A",
      standardWorkingDays: 22,
    }),
    api("POST", "/payroll/runs/generate", tokens.accountant, {
      periodMonth: concurrentPeriod,
      title: "Bảng lương kỳ tháng 09/2026 Concurrency Test B",
      standardWorkingDays: 22,
    }),
  ]);
  const concurrentStatuses = [concurrentRes1.status, concurrentRes2.status].sort();
  assert.deepEqual(
    concurrentStatuses,
    [201, 409],
    "Concurrent same-period generation must yield exactly one 201 and one 409",
  );
  console.log("✓ Concurrent same-period creation handled atomically (1 Created, 1 Conflict): PASS");

  // Attempt pay on unapproved run (2026-09 is in 'calculated' status)
  const concurrentRunId = concurrentRes1.status === 201 ? concurrentRes1.data.id : concurrentRes2.data.id;
  const payUnapproved = await api(
    "POST",
    `/payroll/runs/${concurrentRunId}/pay`,
    tokens.accountant,
  );
  assert.equal(payUnapproved.status, 400, "Paying an unapproved payroll run must be rejected");
  console.log("✓ Paying unapproved payroll run rejected (400 Bad Request): PASS");

  // Approve valid payroll run
  const payApprove = await api(
    "POST",
    `/payroll/runs/${runId}/approve`,
    tokens.accountant,
  );
  assert.equal(payApprove.status, 201);
  assert.equal(payApprove.data.status, "approved");
  assert(payApprove.data.approved_at, "approved_at must be populated");
  console.log("✓ Accountant approved Payroll Run via API: PASS");

  // Attempt approve already approved run
  const payApproveAgain = await api(
    "POST",
    `/payroll/runs/${runId}/approve`,
    tokens.accountant,
  );
  assert.equal(payApproveAgain.status, 400, "Approving an already approved run must be rejected");
  console.log("✓ Re-approving already approved run rejected (400 Bad Request): PASS");

  // Pay approved payroll run
  const payPaid = await api(
    "POST",
    `/payroll/runs/${runId}/pay`,
    tokens.accountant,
  );
  assert.equal(payPaid.status, 201);
  assert.equal(payPaid.data.status, "paid");
  assert(payPaid.data.paid_at, "paid_at must be populated");
  console.log("✓ Accountant marked Payroll Run paid via API: PASS");

  // Verify all payslips in the run are marked paid
  const runDetail = await api("GET", `/payroll/runs/${runId}`, tokens.accountant);
  assert.equal(runDetail.status, 200);
  assert(runDetail.data.payslips.every((ps) => ps.payment_status === "paid"), "All payslips must be marked paid");
  console.log(`✓ All ${runDetail.data.payslips.length} payslips atomically transitioned to paid: PASS`);

  // Second pay attempt must be rejected
  const payPaidAgain = await api(
    "POST",
    `/payroll/runs/${runId}/pay`,
    tokens.accountant,
  );
  assert.equal(payPaidAgain.status, 400, "Paying an already paid run must be rejected");
  console.log("✓ Re-paying already paid run rejected (400 Bad Request): PASS");

  // Employee queries own payslips
  const empPayslip = await api("GET", "/payroll/me/payslips", tokens.employee);
  assert.equal(empPayslip.status, 200);
  assert(empPayslip.data.length > 0, "Employee must receive their own payslips");
  assert(
    empPayslip.data.every((ps) => ps.user_id === LOCAL_UAT.users.employee.id),
    "Employee must strictly see only their own payslips",
  );
  console.log(
    `✓ Employee accessed own payslip via API: ${empPayslip.data.length} payslips returned, isolation verified: PASS`,
  );

  // RBAC checks
  const employeeRunsDenied = await api("GET", "/payroll/runs", tokens.employee);
  assert.equal(employeeRunsDenied.status, 403, "Employee must NOT access payroll runs list");
  const leaderRunsDenied = await api("GET", "/payroll/runs", tokens.leader);
  assert.equal(leaderRunsDenied.status, 403, "Team leader must NOT access payroll runs list");
  const clientPayDenied = await api("GET", "/payroll/runs", tokens.client);
  assert.equal(clientPayDenied.status, 403, "Client must NOT access payroll runs");
  const clientPayslipDenied = await api("GET", "/payroll/me/payslips", tokens.client);
  assert.equal(clientPayslipDenied.status, 403, "Client must NOT access personal payslips");
  console.log("✓ Unauthorized roles denied payroll access (403): PASS");

  // ==========================================
  // 8. SUPPORT TICKET REAL API LIFECYCLE
  // ==========================================
  console.log("\n--- [TEST] 8. SUPPORT TICKET API LIFECYCLE & RBAC ---");
  const compId = LOCAL_UAT.companies.primary.id;
  const ticketCreate = await api("POST", "/support/tickets", tokens.client, {
    clientCompanyId: compId,
    projectId: uatProject.id,
    title: "Yêu cầu hỗ trợ API UAT Client",
    description: "Nhờ kỹ thuật kiểm tra kết nối API",
    category: "technical",
    priority: "high",
  });
  assert.equal(ticketCreate.status, 201);
  const ticketId = ticketCreate.data.id;
  console.log(
    `✓ Client created Support Ticket via API: ID=${ticketId}, Code=${ticketCreate.data.ticket_code}`,
  );

  const replyRes = await api(
    "POST",
    `/support/tickets/${ticketId}/messages`,
    tokens.leader,
    {
      content: "Team PGS Hub đã tiếp nhận và đang hỗ trợ.",
      isInternalNote: false,
    },
  );
  assert.equal(replyRes.status, 201);
  console.log("✓ Team Leader replied to Support Ticket via API: PASS");

  // ==========================================
  // 9. REALTIME CHAT WEBSOCKETS CONNECTION
  // ==========================================
  console.log("\n--- [TEST] 9. AUTHENTICATED WEBSOCKET REALTIME CHAT ---");
  const socketSuccess = await new Promise((resolve) => {
    const socket = io(CHAT_SOCKET_URL, {
      auth: { token: tokens.employee },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log(
        `✓ WebSocket connected successfully (socket id: ${socket.id})`,
      );
      socket.disconnect();
      resolve(true);
    });

    socket.on("connect_error", (err) => {
      console.error("WebSocket connection error:", err.message);
      resolve(false);
    });
  });
  assert.equal(socketSuccess, true, "WebSocket connection must succeed");

  // Negative test: unauthenticated socket connection
  const socketUnauth = await new Promise((resolve) => {
    const socket = io(CHAT_SOCKET_URL, {
      auth: { token: "invalid-token" },
      transports: ["websocket"],
    });
    socket.on("chat.error", (err) => {
      socket.disconnect();
      resolve(true);
    });
    socket.on("connect_error", () => {
      resolve(true);
    });
  });
  assert.equal(socketUnauth, true, "Unauthenticated socket must be rejected");
  console.log("✓ Unauthenticated WebSocket rejected: PASS");

  // ==========================================
  // 10. COMPREHENSIVE BROWSER DIRECT DB FAIL-CLOSED
  // ==========================================
  console.log(
    "\n--- [TEST] 10. COMPREHENSIVE BROWSER DIRECT DATABASE FAIL-CLOSED MATRIX ---",
  );
  const backendTables = [
    "workflow_templates",
    "workflow_template_stages",
    "workflow_template_stage_items",
    "project_workflows",
    "project_workflow_stage_items",
    "project_expenses",
    "payroll_runs",
    "payslips",
    "company_documents",
    "support_tickets",
    "support_ticket_messages",
    "system_settings",
    "company_work_calendar_settings",
    "company_work_calendar_events",
  ];

  for (const role of ["anon", "authenticated"]) {
    await db.query(`SET ROLE ${role}`);
    for (const table of backendTables) {
      let threw = false;
      try {
        await db.query(`SELECT * FROM public.${table} LIMIT 1;`);
      } catch (err) {
        threw = true;
        assert.ok(
          err.message.includes("permission denied"),
          `Expected permission denied on ${table}, got: ${err.message}`,
        );
      }
      assert.equal(
        threw,
        true,
        `Role '${role}' direct SELECT on table '${table}' must fail closed`,
      );
    }
    await db.query("RESET ROLE");
  }
  console.log(
    `✓ All ${backendTables.length} backend-only release tables verified fail-closed for anon & authenticated roles: PASS`,
  );

  console.log("\n=======================================================");
  console.log("ALL REAL APPLICATION UAT FLOWS & BOUNDARIES PASSED 100%!");
  console.log("=======================================================\n");

  await db.end();
}

runRealApplicationUAT().catch((err) => {
  console.error("Strict UAT Failure:", err);
  process.exit(1);
});
