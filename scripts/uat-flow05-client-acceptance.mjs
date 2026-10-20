// FLOW 05 - Client acceptance (nghiem thu), database-backed.
//
// Chain under test (real API + real local Supabase, asserted against Postgres):
//   1. Team Leader requests client approval  -> approval row + client notification
//   2. Client is notified, opens only the project/approvals they may see
//   3. Client rejects (revision) with a note -> decision stored; second answer is refused
//   4. Team Leader receives the result       -> notified, re-requests, Client approves
//   5. Client logs in again                  -> decision still correct (persistence)
//
// Loopback + disposable database only. Run after scripts/seed-local-uat.mjs and
// scripts/run-full-local-uat.mjs (which instantiates the project workflow).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
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
const EVIDENCE_DIR = process.env.PGS_UAT_EVIDENCE_DIR ?? "uat-evidence";

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

const U = LOCAL_UAT.users;
const PROJECT = LOCAL_UAT.projects.managed;
const FOREIGN_PROJECT = LOCAL_UAT.projects.foreign;

const db = new Client({ connectionString: DATABASE_URL });
const evidence = { startedAt: new Date().toISOString(), steps: [] };

function step(name, detail = {}) {
  evidence.steps.push({ name, ...detail });
  console.log(`✓ ${name}`);
}

function apiUrl(p) {
  assert.ok(p.startsWith("/"), "API paths must start with '/'.");
  const url = new URL(
    `${API_BASE_URL.origin}${API_BASE_URL.pathname.replace(/\/$/, "")}${p}`,
  );
  assert.equal(url.origin, API_BASE_URL.origin);
  return url.toString();
}

async function login(email) {
  const res = await fetch(
    new URL("/auth/v1/token?grant_type=password", SUPABASE_BASE_URL),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ email, password: LOCAL_UAT.password }),
      redirect: "error",
    },
  );
  const data = await res.json();
  assert.ok(res.ok, `Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function api(method, p, token, body = null) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(apiUrl(p), {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
    redirect: "error",
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  return { status: res.status, ok: res.ok, data };
}

function expectStatus(res, expected, label) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert.ok(
    allowed.includes(res.status),
    `${label}: expected HTTP ${allowed.join("/")} but got ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`,
  );
}

async function notificationsFor(userId, type, entityId) {
  const { rows } = await db.query(
    `SELECT id, title, action_url, read_at
       FROM public.notifications
      WHERE recipient_user_id = $1::uuid AND type = $2 AND entity_id = $3::uuid`,
    [userId, type, entityId],
  );
  return rows;
}

async function approvalRow(id) {
  const { rows } = await db.query(
    `SELECT id, approval_type, status, request_note, decision_note,
            requested_by_user_id, approver_user_id, responded_at,
            project_workflow_stage_item_id AS item_id
       FROM public.workflow_approval_requests WHERE id = $1::uuid`,
    [id],
  );
  assert.equal(rows.length, 1, `approval ${id} must exist in the database`);
  return rows[0];
}

async function itemStatus(itemId) {
  const { rows } = await db.query(
    `SELECT status::text AS status FROM public.project_workflow_stage_items WHERE id = $1::uuid`,
    [itemId],
  );
  return rows[0]?.status;
}

async function poll(label, read, accept, timeoutMs = 15_000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await read();
    if (accept(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`${label}: timed out; last value ${JSON.stringify(last)}`);
}

async function pickWorkflowItem() {
  const { rows } = await db.query(
    `SELECT w.id AS workflow_id, i.id AS item_id
       FROM public.project_workflows w
       JOIN public.project_workflow_stage_items i ON i.project_workflow_id = w.id
       JOIN public.project_workflow_stages s ON s.id = i.project_workflow_stage_id
      WHERE w.project_id = $1::uuid
        AND w.status::text NOT IN ('completed', 'cancelled', 'archived')
        AND i.status::text IN ('ready', 'in_progress')
        AND s.status::text IN ('ready', 'in_progress')
      ORDER BY w.created_at DESC, i.id
      LIMIT 1`,
    [PROJECT.id],
  );
  if (rows.length === 0) {
    const dump = await db.query(
      `SELECT i.status::text AS item_status, count(*)::int AS n
         FROM public.project_workflows w
         JOIN public.project_workflow_stage_items i ON i.project_workflow_id = w.id
        WHERE w.project_id = $1::uuid GROUP BY 1`,
      [PROJECT.id],
    );
    throw new Error(
      `No ready/in_progress workflow item on ${PROJECT.code}. Item states: ${JSON.stringify(dump.rows)}. Run scripts/run-full-local-uat.mjs first.`,
    );
  }
  return rows[0];
}

async function main() {
  await db.connect();
  console.log("\n=== FLOW 05: CLIENT ACCEPTANCE (database-backed) ===\n");

  const tokens = {
    admin: await login(U.admin.email),
    leader: await login(U.leader.email),
    employee: await login(U.employee.email),
    client: await login(U.client.email),
  };

  // ---- Fixture: one workflow item configured for CLIENT approval -------------
  const { workflow_id: workflowId, item_id: itemId } = await pickWorkflowItem();
  await db.query(
    `UPDATE public.workflow_approval_requests
        SET status = 'cancelled'
      WHERE project_workflow_stage_item_id = $1::uuid AND status = 'pending'`,
    [itemId],
  );
  await db.query(
    `UPDATE public.project_workflow_stage_items
        SET approval_required = true, approval_scope = 'client'
      WHERE id = $1::uuid`,
    [itemId],
  );
  step("Fixture: workflow item configured for client approval", {
    workflowId,
    itemId,
  });
  const base = `/projects/${PROJECT.id}/workflows/${workflowId}/approvals`;

  // ---- Negative RBAC before the happy path ----------------------------------
  expectStatus(
    await api("POST", base, tokens.client, {
      stageItemId: itemId,
      approvalType: "client",
    }),
    403,
    "Client must not request approvals",
  );
  step("Client cannot create an approval request (403)");

  // ---- 1. Team Leader requests client approval -------------------------------
  const requested = await api("POST", base, tokens.leader, {
    stageItemId: itemId,
    approvalType: "client",
    requestNote: "Bản thiết kế v1 sẵn sàng nghiệm thu [LOCAL-UAT flow05]",
  });
  expectStatus(requested, [200, 201], "Leader requests client approval");
  const approvalId = requested.data.id;
  assert.ok(approvalId, "approval id must be returned");

  let row = await approvalRow(approvalId);
  assert.equal(row.approval_type, "client");
  assert.equal(row.status, "pending");
  assert.equal(row.requested_by_user_id, U.leader.id);
  assert.equal(await itemStatus(itemId), "pending_approval");
  step("1a. Approval row created: client / pending, item -> pending_approval", {
    approvalId,
  });

  expectStatus(
    await api("POST", base, tokens.leader, {
      stageItemId: itemId,
      approvalType: "client",
    }),
    409,
    "Duplicate pending request must be refused",
  );
  step("1b. Duplicate pending request refused (409)");

  const clientNotes = await notificationsFor(
    U.client.id,
    "workflow.client_approval.requested",
    approvalId,
  );
  assert.equal(
    clientNotes.length,
    1,
    "Client must receive exactly one notification for the approval request",
  );
  assert.equal(clientNotes[0].action_url, "/app/client/approvals");
  assert.equal(
    (await notificationsFor(U.employee.id, "workflow.client_approval.requested", approvalId))
      .length,
    0,
    "Unrelated users must not be notified",
  );
  step("1c. Client notified by default (1 row, deep link /app/client/approvals) - no automation rule configured");

  // ---- 2. Client opens only what they may see --------------------------------
  const notifApi = await api("GET", "/notifications", tokens.client);
  expectStatus(notifApi, 200, "Client reads own notifications");
  assert.ok(
    JSON.stringify(notifApi.data).includes(approvalId),
    "Client notification list (API) must contain the approval",
  );
  const clientProjects = await api("GET", "/client/me/projects", tokens.client);
  expectStatus(clientProjects, 200, "Client lists own projects");
  assert.ok(
    JSON.stringify(clientProjects.data).includes(PROJECT.id),
    "Client project list must contain the project under acceptance",
  );
  expectStatus(
    await api("GET", `/client/me/projects/${PROJECT.id}`, tokens.client),
    200,
    "Client opens own project",
  );
  expectStatus(
    await api("GET", `/client/me/projects/${FOREIGN_PROJECT.id}`, tokens.client),
    [403, 404],
    "Client must not open a foreign project",
  );
  const clientList = await api("GET", base, tokens.client);
  expectStatus(clientList, 200, "Client lists approvals");
  const mine = clientList.data.find((a) => a.id === approvalId);
  assert.ok(mine, "Client sees the pending approval");
  assert.equal(mine.status, "pending");
  assert.ok(
    clientList.data.every((a) => a.approval_type === "client"),
    "Client only sees client-type approvals",
  );
  for (const hidden of ["request_note", "requested_by_user_id", "decision_note"]) {
    assert.ok(!(hidden in mine), `Client view must not expose ${hidden}`);
  }
  expectStatus(
    await api("GET", `/projects/${PROJECT.id}/tasks`, tokens.client),
    403,
    "Client must not read internal tasks",
  );
  const foreign = await api(
    "GET",
    `/projects/${FOREIGN_PROJECT.id}/workflows`,
    tokens.client,
  );
  expectStatus(foreign, [403, 404], "Client must not read a foreign project");
  expectStatus(
    await api("POST", `${base}/${approvalId}/respond`, tokens.leader, {
      decision: "approved",
    }),
    403,
    "Team Leader must not answer a client approval",
  );
  step("2. Client sees only own project + client approvals; internal data/403s hold");

  // Aggregate endpoint: server-side status filter + pagination, client only.
  const aggregate = await api(
    "GET",
    "/client/me/approvals?status=pending&page=1&pageSize=1",
    tokens.client,
  );
  expectStatus(aggregate, 200, "Client aggregate approvals");
  assert.equal(aggregate.data.page, 1);
  assert.equal(aggregate.data.pageSize, 1);
  assert.ok(aggregate.data.total >= 1, "pending total counts the new approval");
  assert.ok(aggregate.data.counts.pending >= 1);
  assert.equal(aggregate.data.items.length, 1, "pageSize=1 returns one row");
  const aggregated = aggregate.data.items.find((a) => a.id === approvalId);
  if (aggregate.data.total === 1) {
    assert.ok(aggregated, "the only pending approval is the one just requested");
  }
  for (const hidden of ["request_note", "decision_note", "requested_by_user_id"]) {
    assert.ok(
      !JSON.stringify(aggregate.data).includes(hidden),
      `aggregate view must not expose ${hidden}`,
    );
  }
  const beyond = await api(
    "GET",
    "/client/me/approvals?status=pending&page=9999&pageSize=50",
    tokens.client,
  );
  expectStatus(beyond, 200, "Out-of-range page");
  assert.deepEqual(beyond.data.items, []);
  assert.equal(beyond.data.total, aggregate.data.total);
  expectStatus(
    await api("GET", "/client/me/approvals?status=bogus", tokens.client),
    400,
    "Invalid status must be a 400",
  );
  expectStatus(
    await api("GET", "/client/me/approvals", tokens.leader),
    403,
    "Only clients may use the client aggregate",
  );
  step("2b. Aggregate endpoint: paginated, filtered, no internal notes, client-only");

  // ---- 3. Client asks for a revision ----------------------------------------
  const revisionNote = "Logo cần to hơn và đổi màu nền [LOCAL-UAT flow05]";
  expectStatus(
    await api("POST", `${base}/${approvalId}/respond`, tokens.client, {
      decision: "rejected",
      decisionNote: revisionNote,
    }),
    [200, 201],
    "Client requests revision",
  );
  row = await approvalRow(approvalId);
  assert.equal(row.status, "rejected");
  assert.equal(row.decision_note, revisionNote);
  assert.ok(row.responded_at, "responded_at must be set");
  assert.notEqual(await itemStatus(itemId), "pending_approval");
  step("3a. Revision stored: rejected + decision_note + responded_at; item released");

  expectStatus(
    await api("POST", `${base}/${approvalId}/respond`, tokens.client, {
      decision: "approved",
    }),
    409,
    "A decided approval cannot be answered again",
  );
  step("3b. Second answer refused (409)");

  // ---- 4. Team Leader receives result, re-requests, Client approves ----------
  const leaderView = await api("GET", base, tokens.leader);
  expectStatus(leaderView, 200, "Leader lists approvals");
  const seen = leaderView.data.find((a) => a.id === approvalId);
  assert.equal(seen.status, "rejected");
  assert.equal(seen.decision_note, revisionNote);
  const leaderNotes = await notificationsFor(
    U.leader.id,
    "workflow.client_approval.rejected",
    approvalId,
  );
  assert.equal(leaderNotes.length, 1, "Leader must be notified of the revision request");
  step("4a. Leader sees the rejection + note and is notified");

  const second = await api("POST", base, tokens.leader, {
    stageItemId: itemId,
    approvalType: "client",
    requestNote: "Bản v2 đã chỉnh sửa [LOCAL-UAT flow05]",
  });
  expectStatus(second, [200, 201], "Leader re-requests after revision");
  const secondId = second.data.id;
  assert.notEqual(secondId, approvalId);
  const approveNote = "Đã duyệt bản v2 [LOCAL-UAT flow05]";
  expectStatus(
    await api("POST", `${base}/${secondId}/respond`, tokens.client, {
      decision: "approved",
      decisionNote: approveNote,
    }),
    [200, 201],
    "Client approves v2",
  );
  const approved = await approvalRow(secondId);
  assert.equal(approved.status, "approved");
  assert.equal(approved.decision_note, approveNote);
  const finalItem = await itemStatus(itemId);
  assert.notEqual(finalItem, "pending_approval");
  assert.equal(
    (await notificationsFor(U.leader.id, "workflow.client_approval.approved", secondId))
      .length,
    1,
    "Leader must be notified of the approval",
  );
  step("4b. Re-request -> Client approved; Leader notified; workflow advanced", {
    secondId,
    itemStatusAfterApproval: finalItem,
  });

  // The client cannot create internal tasks, so a restricted system actor must
  // have created every ready auto-task item's primary task, without anyone
  // opening a page (no internal read happens between approval and this check).
  const missing = await poll(
    "ready auto-task items without a primary task",
    async () =>
      (
        await db.query(
          `SELECT i.id
             FROM public.project_workflow_stage_items i
            WHERE i.project_workflow_id = $1::uuid
              AND i.status::text = 'ready'
              AND i.auto_create_task = true
              AND NOT EXISTS (
                SELECT 1 FROM public.project_workflow_task_links l
                 WHERE l.project_workflow_stage_item_id = i.id
                   AND l.link_type = 'primary')`,
          [workflowId],
        )
      ).rows,
    (rows) => rows.length === 0,
  );
  const duplicates = await db.query(
    `SELECT project_workflow_stage_item_id, count(*)::int AS n
       FROM public.project_workflow_task_links
      WHERE link_type = 'primary'
        AND project_workflow_stage_item_id IN (
          SELECT id FROM public.project_workflow_stage_items
           WHERE project_workflow_id = $1::uuid)
      GROUP BY 1 HAVING count(*) > 1`,
    [workflowId],
  );
  assert.equal(duplicates.rowCount, 0, "no item may have two primary tasks");
  step("4c. Auto tasks created by the system actor after the client's approval; no duplicates", {
    stillMissing: missing.length,
  });

  // ---- 5. Persistence after a fresh login -----------------------------------
  const freshClient = await login(U.client.email);
  const again = await api("GET", base, freshClient);
  expectStatus(again, 200, "Client re-reads approvals after re-login");
  const byId = Object.fromEntries(again.data.map((a) => [a.id, a]));
  assert.equal(byId[approvalId].status, "rejected");
  assert.equal(byId[secondId].status, "approved");
  assert.equal((await approvalRow(approvalId)).status, "rejected");
  assert.equal((await approvalRow(secondId)).status, "approved");
  const tabs = {};
  for (const status of ["pending", "approved", "rejected"]) {
    const res = await api(
      "GET",
      `/client/me/approvals?status=${status}&page=1&pageSize=50`,
      freshClient,
    );
    expectStatus(res, 200, `Aggregate ${status}`);
    tabs[status] = res.data;
  }
  assert.ok(tabs.rejected.items.some((a) => a.id === approvalId));
  assert.ok(tabs.approved.items.some((a) => a.id === secondId));
  assert.ok(!tabs.pending.items.some((a) => [approvalId, secondId].includes(a.id)));
  assert.ok(tabs.approved.counts.approved >= 1 && tabs.approved.counts.rejected >= 1);
  step("5. After re-login the decisions are unchanged (API, aggregate tabs and database agree)");

  evidence.finishedAt = new Date().toISOString();
  evidence.result = "PASS";
}

try {
  await main();
} catch (error) {
  evidence.result = "FAIL";
  evidence.error = error instanceof Error ? error.message : String(error);
  console.error(`\n✗ FLOW 05 FAILED: ${evidence.error}`);
  process.exitCode = 1;
} finally {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "flow05-results.json"),
    JSON.stringify(evidence, null, 2),
  );
  await db.end().catch(() => {});
}
