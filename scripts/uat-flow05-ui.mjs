// FLOW 05 (UI) - Team Leader -> Client -> Team Leader acceptance, driven through
// the real browser UI with Postgres assertions after every business step.
//
//   TL requests client approval (project workflow panel button)
//   Client opens the notification deep link -> /app/client/approvals
//   Client asks for a revision (validation first, then a note) -> stored
//   TL sees the rejection + notification, requests again from the UI
//   Client approves from the UI -> stored, TL notified
//   Refresh + brand-new login: the decisions are still correct (UI + DB)
//
// Loopback + disposable database only. Run after scripts/seed-local-uat.mjs and
// scripts/run-full-local-uat.mjs (which instantiates the project workflow).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { chromium } from "playwright";
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
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const OUT_DIR = path.resolve(
  process.env.PGS_UAT_EVIDENCE_DIR ?? "uat-evidence",
  "flow05-ui",
);
const AXE_PATH = process.env.PGS_AXE_PATH;
assertConfirmedDisposableLocalDatabaseUrl(DATABASE_URL);
assertLoopbackUrl(WEB_URL, "WEB_URL", ["http:", "https:"]);

const U = LOCAL_UAT.users;
const PROJECT = LOCAL_UAT.projects.managed;
const SLOW = 45_000;

const db = new Client({ connectionString: DATABASE_URL });
const evidence = { startedAt: new Date().toISOString(), steps: [], notes: [] };
const openPages = new Map();

fs.mkdirSync(OUT_DIR, { recursive: true });

function step(name, detail = {}) {
  evidence.steps.push({ name, ...detail });
  console.log(`✓ ${name}`);
}

async function shot(page, name) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function poll(label, read, accept, timeoutMs = 20_000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await read();
    if (accept(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`${label}: timed out; last value ${JSON.stringify(last)}`);
}

async function openSession(browser, who, width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  const page = await context.newPage();
  openPages.set(who, page);
  await page.goto(new URL("/auth/login", WEB_URL).toString());
  await page.fill('input[type="email"]', U[who].email);
  await page.fill('input[type="password"]', LOCAL_UAT.password);
  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith("/app"), {
      timeout: SLOW,
    }),
    page.click('button[type="submit"]'),
  ]);
  return { context, page };
}

async function approvalsFor(itemId) {
  const { rows } = await db.query(
    `SELECT id, status, approval_type, decision_note, request_note,
            requested_by_user_id, responded_at
       FROM public.workflow_approval_requests
      WHERE project_workflow_stage_item_id = $1::uuid AND approval_type = 'client'
      ORDER BY requested_at ASC, id ASC`,
    [itemId],
  );
  return rows;
}

async function notificationCount(userId, type, entityId) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM public.notifications
      WHERE recipient_user_id = $1::uuid AND type = $2 AND entity_id = $3::uuid`,
    [userId, type, entityId],
  );
  return rows[0].n;
}

/** An item whose name is unique in its workflow, reset to a clean client-approval fixture. */
async function prepareFixture() {
  const { rows } = await db.query(
    `SELECT i.id AS item_id, i.project_workflow_stage_id AS stage_id,
            w.id AS workflow_id, psi.name AS item_name
       FROM public.project_workflows w
       JOIN public.project_workflow_stage_items i ON i.project_workflow_id = w.id
       JOIN public.project_service_items psi ON psi.id = i.project_service_item_id
      WHERE w.project_id = $1::uuid
        AND w.status::text NOT IN ('completed', 'cancelled', 'archived')
      ORDER BY w.created_at DESC, i.id DESC
      LIMIT 40`,
    [PROJECT.id],
  );
  const names = rows.map((row) => row.item_name);
  const pick = rows.find(
    (row) => names.filter((name) => name === row.item_name).length === 1,
  );
  assert.ok(
    pick,
    `No workflow item with a unique name on ${PROJECT.code}; run scripts/run-full-local-uat.mjs first.`,
  );
  await db.query(
    `UPDATE public.workflow_approval_requests SET status = 'cancelled'
      WHERE project_workflow_stage_item_id = $1::uuid AND status = 'pending'`,
    [pick.item_id],
  );
  await db.query(
    `UPDATE public.project_workflow_stages SET status = 'in_progress'
      WHERE id = $1::uuid AND status::text NOT IN ('in_progress')`,
    [pick.stage_id],
  );
  await db.query(
    `UPDATE public.project_workflow_stage_items
        SET status = 'ready', completed_at = NULL,
            approval_required = true, approval_scope = 'client'
      WHERE id = $1::uuid`,
    [pick.item_id],
  );
  return {
    itemId: pick.item_id,
    workflowId: pick.workflow_id,
    itemName: pick.item_name,
  };
}

async function requestFromLeaderUi(page, fixture, note) {
  await page.goto(new URL(`/app/projects/${PROJECT.id}`, WEB_URL).toString(), {
    waitUntil: "networkidle",
  });
  const tab = page
    .locator('button, [role="tab"]')
    .filter({ hasText: /^\s*Quy trình\s*$/ })
    .first();
  await tab.click();
  await page.getByLabel(`Approval note ${fixture.itemId}`).fill(note);
  await page
    .getByRole("button", {
      name: `Request client approval for ${fixture.itemName}`,
      exact: true,
    })
    .click();
}

async function openNotificationFromCenter(page, title, expectedPath) {
  await page.goto(new URL("/app/notifications", WEB_URL).toString(), {
    waitUntil: "networkidle",
  });
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: title }) })
    .first();
  await card.waitFor({ timeout: SLOW });
  await Promise.all([
    page.waitForURL((url) => url.pathname === expectedPath, {
      timeout: SLOW,
    }),
    card.getByRole("link", { name: /Mở liên kết/ }).click(),
  ]);
}

async function axeSeriousCritical(page) {
  if (!AXE_PATH) return null;
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    });
    return result.violations
      .filter((v) => ["serious", "critical"].includes(v.impact))
      .map((v) => `${v.id}(${v.nodes.length})`);
  });
}

async function main() {
  await db.connect();
  const browser = await chromium.launch();
  try {
    console.log("\n=== FLOW 05 UI: Team Leader -> Client -> Team Leader ===\n");
    const fixture = await prepareFixture();
    step("Fixture: unique workflow item set up for client approval", fixture);

    const leader = await openSession(browser, "leader");
    const client = await openSession(browser, "client");

    // ---- 1. Team Leader requests client approval from the UI -----------------
    await requestFromLeaderUi(
      leader.page,
      fixture,
      "Bản thiết kế v1 [LOCAL-UAT flow05-ui]",
    );
    const first = await poll(
      "approval row after Team Leader click",
      () => approvalsFor(fixture.itemId),
      (rows) => rows.some((row) => row.status === "pending"),
    );
    const firstApproval = first.find((row) => row.status === "pending");
    assert.equal(firstApproval.requested_by_user_id, U.leader.id);
    assert.equal(firstApproval.request_note, "Bản thiết kế v1 [LOCAL-UAT flow05-ui]");
    await shot(leader.page, "01-leader-requested");
    await poll(
      "client notification",
      () =>
        notificationCount(
          U.client.id,
          "workflow.client_approval.requested",
          firstApproval.id,
        ),
      (n) => n === 1,
    );
    step("1. Team Leader requested via UI: pending row + client notified", {
      approvalId: firstApproval.id,
    });

    // ---- 2. Client follows the notification to the approvals page ------------
    await openNotificationFromCenter(
      client.page,
      "Có sản phẩm đang chờ bạn nghiệm thu",
      "/app/client/approvals",
    );
    const row = client.page.locator(`tr[data-approval-id="${firstApproval.id}"]`);
    await row.waitFor({ timeout: SLOW });
    assert.ok(
      (await row.innerText()).includes(fixture.itemName),
      "The approval row must show the item name",
    );
    await shot(client.page, "02-client-approvals");
    step("2. Client opened the notification deep link and sees the item");

    // ---- 3. Revision: validation first, then a stored note ---------------------
    await client.page
      .getByRole("button", {
        name: `Yêu cầu chỉnh sửa ${fixture.itemName}`,
        exact: true,
      })
      .click();
    await client.page
      .getByRole("button", { name: "Gửi yêu cầu chỉnh sửa", exact: true })
      .click();
    await client.page.getByRole("alert").filter({ hasText: /tối thiểu 5 ký tự/ }).waitFor();
    assert.equal(
      (await approvalsFor(fixture.itemId)).find((a) => a.id === firstApproval.id)
        .status,
      "pending",
      "An invalid revision must not change the database",
    );
    await shot(client.page, "03-client-validation-error");
    const revisionNote = "Logo cần to hơn và đổi màu nền [LOCAL-UAT flow05-ui]";
    await client.page.locator("#approval-note").fill(revisionNote);
    await client.page
      .getByRole("button", { name: "Gửi yêu cầu chỉnh sửa", exact: true })
      .click();
    await client.page
      .getByText(`Đã gửi yêu cầu chỉnh sửa cho "${fixture.itemName}".`)
      .waitFor({ timeout: SLOW });
    const afterReject = (await approvalsFor(fixture.itemId)).find(
      (a) => a.id === firstApproval.id,
    );
    assert.equal(afterReject.status, "rejected");
    assert.equal(afterReject.decision_note, revisionNote);
    assert.ok(afterReject.responded_at);
    step("3. Validation blocked an empty note; revision + note stored in DB");

    // ---- 4. Refresh keeps the truth ---------------------------------------------
    await client.page.reload({ waitUntil: "networkidle" });
    assert.equal(
      await client.page.locator(`tr[data-approval-id="${firstApproval.id}"]`).count(),
      0,
      "A decided approval must leave the pending tab after refresh",
    );
    await client.page.getByRole("tab", { name: /Đã yêu cầu chỉnh sửa/ }).click();
    await client.page
      .locator(`tr[data-approval-id="${firstApproval.id}"]`)
      .waitFor({ timeout: SLOW });
    step("4. After refresh the revision sits in the 'Đã yêu cầu chỉnh sửa' tab");

    // ---- 5. Team Leader sees the result, is notified, requests again -----------
    await leader.page.reload({ waitUntil: "networkidle" });
    await leader.page
      .locator('button, [role="tab"]')
      .filter({ hasText: /^\s*Quy trình\s*$/ })
      .first()
      .click();
    await leader.page
      .getByText(/Approval rejected \(client\)/)
      .first()
      .waitFor({ timeout: SLOW });
    assert.equal(
      await notificationCount(
        U.leader.id,
        "workflow.client_approval.rejected",
        firstApproval.id,
      ),
      1,
    );
    await openNotificationFromCenter(
      leader.page,
      "Khách hàng yêu cầu chỉnh sửa",
      `/app/projects/${PROJECT.id}`,
    );
    step("5a. Team Leader sees 'rejected' in the workflow and in notifications");

    await requestFromLeaderUi(
      leader.page,
      fixture,
      "Bản v2 đã chỉnh sửa [LOCAL-UAT flow05-ui]",
    );
    const second = await poll(
      "second approval row",
      () => approvalsFor(fixture.itemId),
      (rows) => rows.filter((a) => a.status === "pending").length === 1,
    );
    const secondApproval = second.find((a) => a.status === "pending");
    assert.notEqual(secondApproval.id, firstApproval.id);
    step("5b. Team Leader re-requested from the UI", {
      approvalId: secondApproval.id,
    });

    // ---- 6. Client approves from the UI -----------------------------------------
    await client.page.goto(new URL("/app/client/approvals", WEB_URL).toString(), {
      waitUntil: "networkidle",
    });
    await client.page
      .locator(`tr[data-approval-id="${secondApproval.id}"]`)
      .waitFor({ timeout: SLOW });
    await client.page
      .getByRole("button", {
        name: `Phê duyệt ${fixture.itemName}`,
        exact: true,
      })
      .click();
    await client.page.locator("#approval-note").fill("Đã duyệt bản v2 [LOCAL-UAT flow05-ui]");
    await client.page
      .getByRole("button", { name: "Xác nhận phê duyệt", exact: true })
      .click();
    await client.page
      .getByText(`Đã phê duyệt "${fixture.itemName}".`)
      .waitFor({ timeout: SLOW });
    const afterApprove = (await approvalsFor(fixture.itemId)).find(
      (a) => a.id === secondApproval.id,
    );
    assert.equal(afterApprove.status, "approved");
    assert.equal(afterApprove.decision_note, "Đã duyệt bản v2 [LOCAL-UAT flow05-ui]");
    assert.equal(
      await notificationCount(
        U.leader.id,
        "workflow.client_approval.approved",
        secondApproval.id,
      ),
      1,
    );
    step("6. Client approved from the UI: stored in DB, Team Leader notified");

    // ---- 7. Brand-new login, other viewport, accessibility ----------------------
    await client.context.close();
    const again = await openSession(browser, "client", 375);
    await again.page.goto(new URL("/app/client/approvals", WEB_URL).toString(), {
      waitUntil: "networkidle",
    });
    await again.page.getByRole("tab", { name: /Đã phê duyệt/ }).click();
    await again.page
      .locator(`tr[data-approval-id="${secondApproval.id}"]`)
      .waitFor({ timeout: SLOW });
    const overflow = await again.page.evaluate(
      () =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.ok(overflow <= 1, `No horizontal page overflow at 375px (got ${overflow}px)`);
    await shot(again.page, "07-client-relogin-375");
    const violations = await axeSeriousCritical(again.page);
    if (violations !== null) {
      assert.deepEqual(violations, [], "axe serious/critical on /app/client/approvals");
    } else {
      evidence.notes.push("PGS_AXE_PATH not set: axe skipped");
    }
    const finalRows = await approvalsFor(fixture.itemId);
    assert.deepEqual(
      finalRows.map((a) => a.status),
      ["rejected", "approved"],
    );
    step("7. New login at 375px: decisions unchanged, no overflow, axe clean", {
      axe: violations === null ? "skipped" : "clean",
    });

    evidence.result = "PASS";
  } finally {
    await browser.close().catch(() => {});
  }
}

try {
  await main();
} catch (error) {
  evidence.result = "FAIL";
  evidence.error = error instanceof Error ? error.message : String(error);
  console.error(`\n✗ FLOW 05 UI FAILED: ${evidence.error}`);
  for (const [who, page] of openPages) {
    await shot(page, `failure-${who}`).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  evidence.finishedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(OUT_DIR, "flow05-ui-results.json"),
    JSON.stringify(evidence, null, 2),
  );
  await db.end().catch(() => {});
}
