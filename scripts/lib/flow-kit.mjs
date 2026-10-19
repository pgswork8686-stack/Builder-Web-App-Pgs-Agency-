// Shared helpers for the cross-role flow UATs (Playwright UI + API + Postgres).
//
// Loopback + disposable database only. Every flow script creates one context
// with createFlow(), drives the real UI through openSession(), asserts the
// database after each business step and finishes with finish(), which writes
// <evidence>/<flow id>/<flow id>-results.json (+ screenshots).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { chromium } from "playwright";
import {
  assertConfirmedDisposableLocalDatabaseUrl,
  assertLoopbackUrl,
  assertNoHostedSupabaseEnvironment,
} from "./local-endpoint-guard.mjs";
import { LOCAL_UAT } from "./local-uat-fixtures.mjs";

export { LOCAL_UAT };
export const U = LOCAL_UAT.users;
export const SLOW = 45_000;

const DATABASE_URL =
  "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres";

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createFlow({ id, title }) {
  assertNoHostedSupabaseEnvironment(process.env);
  assertConfirmedDisposableLocalDatabaseUrl(DATABASE_URL);
  const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
  const API_BASE =
    process.env.PGS_LOCAL_UAT_API_BASE ?? "http://localhost:3001/api/v1";
  const SUPABASE_URL =
    process.env.PGS_LOCAL_UAT_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const KEY = process.env.PGS_LOCAL_UAT_SUPABASE_PUBLISHABLE_KEY?.trim();
  assertLoopbackUrl(WEB_URL, "WEB_URL", ["http:", "https:"]);
  const apiUrl = assertLoopbackUrl(API_BASE, "API_BASE", ["http:", "https:"]);
  const supabaseUrl = assertLoopbackUrl(SUPABASE_URL, "SUPABASE_URL", [
    "http:",
    "https:",
  ]);
  assert.ok(KEY, "PGS_LOCAL_UAT_SUPABASE_PUBLISHABLE_KEY must be set.");

  const root = path.resolve(process.env.PGS_UAT_EVIDENCE_DIR ?? "uat-evidence");
  const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  const db = new pg.Client({ connectionString: DATABASE_URL });
  await db.connect();

  const evidence = {
    flow: id,
    title,
    startedAt: new Date().toISOString(),
    steps: [],
    notes: [],
  };
  const openPages = new Map();
  let browser = null;

  const flow = {
    id,
    db,
    dir,
    root,
    evidence,
    WEB_URL,

    step(name, detail = {}) {
      evidence.steps.push({ name, ...detail });
      console.log(`✓ [${id}] ${name}`);
    },
    note(text) {
      evidence.notes.push(text);
      console.log(`  note: ${text}`);
    },
    url(p) {
      return new URL(p, WEB_URL).toString();
    },

    async shot(page, name) {
      await page.screenshot({
        path: path.join(dir, `${name}.png`),
        fullPage: true,
      });
    },

    async poll(label, read, accept, timeoutMs = 20_000) {
      const started = Date.now();
      let last;
      while (Date.now() - started < timeoutMs) {
        last = await read();
        if (accept(last)) return last;
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      throw new Error(`${label}: timed out; last value ${JSON.stringify(last)}`);
    },

    async browser() {
      browser ??= await chromium.launch();
      return browser;
    },

    async openSession(who, { width = 1440, height = 900 } = {}) {
      const b = await flow.browser();
      const context = await b.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      openPages.set(`${who}-${openPages.size}`, page);
      await page.goto(flow.url("/auth/login"));
      await page.fill('input[type="email"]', U[who].email);
      await page.fill('input[type="password"]', LOCAL_UAT.password);
      await Promise.all([
        page.waitForURL((url) => url.pathname.startsWith("/app"), {
          timeout: SLOW,
        }),
        page.click('button[type="submit"]'),
      ]);
      return { context, page };
    },

    async token(who) {
      const res = await fetch(
        new URL("/auth/v1/token?grant_type=password", supabaseUrl),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: KEY },
          body: JSON.stringify({
            email: U[who].email,
            password: LOCAL_UAT.password,
          }),
          redirect: "error",
        },
      );
      const data = await res.json();
      assert.ok(res.ok, `Login failed for ${who}: ${JSON.stringify(data)}`);
      return data.access_token;
    },

    async api(method, p, token, body = null) {
      const headers = { Authorization: `Bearer ${token}` };
      if (body) headers["Content-Type"] = "application/json";
      const res = await fetch(
        `${apiUrl.origin}${apiUrl.pathname.replace(/\/$/, "")}${p}`,
        {
          method,
          headers,
          body: body ? JSON.stringify(body) : null,
          redirect: "error",
        },
      );
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : await res.text();
      return { status: res.status, ok: res.ok, data };
    },

    expectStatus(res, expected, label) {
      const allowed = Array.isArray(expected) ? expected : [expected];
      assert.ok(
        allowed.includes(res.status),
        `${label}: expected HTTP ${allowed.join("/")} but got ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`,
      );
    },

    async notifications(userId, type, entityId) {
      const { rows } = await db.query(
        `SELECT id, title, message, action_url, read_at FROM public.notifications
          WHERE recipient_user_id = $1::uuid AND type = $2
            AND ($3::uuid IS NULL OR entity_id = $3::uuid)
          ORDER BY created_at DESC`,
        [userId, type, entityId ?? null],
      );
      return rows;
    },

    /** serious/critical axe violations on the current page, or null if axe is unavailable. */
    async axe(page) {
      const axePath = process.env.PGS_AXE_PATH;
      if (!axePath) return null;
      await page.addScriptTag({ path: axePath });
      return page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        });
        return result.violations
          .filter((v) => ["serious", "critical"].includes(v.impact))
          .map((v) => {
            const first = v.nodes[0];
            const data = (first && first.any[0] && first.any[0].data) || {};
            const detail = data.fgColor
              ? ` fg=${data.fgColor} bg=${data.bgColor} ratio=${data.contrastRatio}`
              : "";
            return `${v.id}(${v.nodes.length}) ${first ? first.target.join(" ") : ""}${detail}`;
          });
      });
    },

    /** No horizontal overflow and no serious/critical axe issue at several widths. */
    async checkResponsive(page, route, widths = [375, 768]) {
      await page.goto(flow.url(route), { waitUntil: "networkidle" });
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        assert.ok(
          overflow <= 1,
          `${route}: horizontal overflow ${overflow}px at ${width}px`,
        );
        const violations = await flow.axe(page);
        if (violations === null) {
          if (!evidence.notes.includes("PGS_AXE_PATH not set: axe skipped")) {
            evidence.notes.push("PGS_AXE_PATH not set: axe skipped");
          }
        } else {
          assert.deepEqual(
            violations,
            [],
            `${route}: axe serious/critical at ${width}px`,
          );
        }
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    },

    /** Choose an <option> of a <select> by a RegExp on its visible text. */
    async selectByText(select, pattern) {
      const value = await select.evaluate(
        (el, source) => {
          const re = new RegExp(source);
          const hit = Array.from(el.options).find((o) => re.test(o.text));
          return hit ? hit.value : null;
        },
        pattern.source,
      );
      assert.ok(value, `No option matching ${pattern}`);
      await select.selectOption(value);
      return value;
    },

    readState() {
      try {
        return JSON.parse(fs.readFileSync(path.join(root, "flow-state.json"), "utf8"));
      } catch {
        return {};
      }
    },
    writeState(patch) {
      const next = { ...flow.readState(), ...patch };
      fs.writeFileSync(
        path.join(root, "flow-state.json"),
        JSON.stringify(next, null, 2),
      );
    },

    async finish(error) {
      if (error) {
        evidence.result = "FAIL";
        evidence.error = error instanceof Error ? error.message : String(error);
        console.error(`\n✗ [${id}] FAILED: ${evidence.error}`);
        for (const [name, page] of openPages) {
          await page
            .screenshot({
              path: path.join(dir, `failure-${name}.png`),
              fullPage: true,
            })
            .catch(() => {});
        }
        process.exitCode = 1;
      } else {
        evidence.result = "PASS";
      }
      evidence.finishedAt = new Date().toISOString();
      fs.writeFileSync(
        path.join(dir, `${id}-results.json`),
        JSON.stringify(evidence, null, 2),
      );
      await browser?.close().catch(() => {});
      await db.end().catch(() => {});
    },
  };
  return flow;
}

/** Runs a flow body and always finishes it (evidence + exit code). */
export async function runFlow(flow, body) {
  try {
    await body();
    await flow.finish();
  } catch (error) {
    await flow.finish(error);
  }
}
