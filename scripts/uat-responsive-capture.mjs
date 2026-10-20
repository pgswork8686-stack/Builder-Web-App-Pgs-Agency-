// Disposable-environment browser UAT: logs in as each of the five seeded
// roles, visits that role's key routes at 375/768/1024/1440 px, and records
// HTTP status, console/page errors, horizontal overflow, basic semantics and
// axe-core violations, plus a screenshot per page/width.
//
// Loopback only. Never run against staging/production: credentials are the
// synthetic Password123! test accounts created by scripts/seed-local-uat.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";
import {
  assertLoopbackUrl,
  assertNoHostedSupabaseEnvironment,
} from "./lib/local-endpoint-guard.mjs";

assertNoHostedSupabaseEnvironment(process.env);

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const WEB_ORIGIN = assertLoopbackUrl(WEB_URL, "WEB_URL", [
  "http:",
  "https:",
]).origin;
const OUT_DIR = path.resolve(
  process.env.PGS_UAT_EVIDENCE_DIR ?? "uat-evidence",
);
const PASSWORD = "Password123!";
const AXE_PATH = process.env.PGS_AXE_PATH;
const WIDTHS = [375, 768, 1024, 1440];

const ROLES = {
  admin: {
    email: "admin@test.local",
    routes: [
      "/app/admin",
      "/app/admin/tasks",
      "/app/admin/kanban",
      "/app/admin/calendar",
      "/app/admin/leave",
      "/app/admin/projects",
      "/app/admin/clients",
      "/app/admin/people",
      "/app/admin/documents",
      "/app/admin/finance",
      "/app/admin/finance/invoices",
      "/app/admin/finance/contracts",
      "/app/admin/reports",
      "/app/admin/attendance",
      "/app/admin/settings",
      "/app/admin/accounts/pending",
      "/app/notifications",
      "/app/profile",
    ],
  },
  team_leader: {
    email: "leader@test.local",
    routes: [
      "/app/team-leader",
      "/app/team-leader/tasks",
      "/app/team-leader/kanban",
      "/app/team-leader/calendar",
      "/app/team-leader/projects",
      "/app/team-leader/approvals",
      "/app/team-leader/documents",
      "/app/team-leader/reports",
      "/app/team-leader/attendance",
      "/app/notifications",
      "/app/profile",
    ],
  },
  employee: {
    email: "employee@test.local",
    routes: [
      "/app/employee",
      "/app/employee/tasks",
      "/app/employee/calendar",
      "/app/leave",
      "/app/attendance",
      "/app/employee/projects",
      "/app/employee/documents",
      "/app/employee/payroll",
      "/app/employee/reports",
      "/app/notifications",
      "/app/profile",
    ],
  },
  accountant: {
    email: "accountant@test.local",
    routes: [
      "/app/accountant",
      "/app/accountant/clients",
      "/app/accountant/finance",
      "/app/accountant/finance/contracts",
      "/app/accountant/finance/invoices",
      "/app/accountant/finance/payments",
      "/app/accountant/finance/debts",
      "/app/accountant/finance/cashflow",
      "/app/accountant/finance/project-expenses",
      "/app/accountant/payroll",
      "/app/accountant/vouchers",
      "/app/accountant/reports",
      "/app/accountant/attendance",
      "/app/notifications",
    ],
  },
  client: {
    email: "client@test.local",
    routes: [
      "/app/client",
      "/app/client/projects",
      "/app/client/projects/completed",
      "/app/client/approvals",
      "/app/client/documents",
      "/app/client/contracts",
      "/app/client/invoices",
      "/app/client/payments",
      "/app/client/meetings",
      "/app/client/support",
      "/app/notifications",
    ],
  },
};

const slug = (route) =>
  route.replace(/^\/app\/?/, "").replace(/\//g, "_") || "home";

function isLoopback(url) {
  try {
    const host = new URL(url).hostname;
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
  } catch {
    return false;
  }
}

async function login(browser, role, email) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(new URL("/auth/login", WEB_URL).toString());
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith("/app"), {
      timeout: 45_000,
    }),
    page.click('button[type="submit"]'),
  ]);
  const state = await context.storageState();
  await context.close();
  return state;
}

async function inspect(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const nameOf = (el) =>
      (
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.getAttribute("title") ||
        el.textContent ||
        ""
      ).trim();
    const unlabeledControls = [
      ...document.querySelectorAll(
        "input:not([type=hidden]), select, textarea",
      ),
    ].filter((el) => {
      if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"))
        return false;
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`))
        return false;
      return !el.closest("label");
    }).length;
    return {
      overflowX: doc.scrollWidth - doc.clientWidth,
      h1Count: document.querySelectorAll("h1").length,
      lang: doc.lang || null,
      imagesWithoutAlt: [...document.querySelectorAll("img")].filter(
        (img) => !img.hasAttribute("alt"),
      ).length,
      buttonsWithoutName: [...document.querySelectorAll("button")].filter(
        (b) => !nameOf(b),
      ).length,
      unlabeledControls,
      title: document.title,
    };
  });
}

async function runAxe(page) {
  if (!AXE_PATH) return null;
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      // First offenders only, so the evidence JSON stays small but actionable.
      samples: v.nodes.slice(0, 8).map((n) => {
        const data = (n.any[0] && n.any[0].data) || {};
        return {
          target: n.target.join(" "),
          fg: data.fgColor,
          bg: data.bgColor,
          ratio: data.contrastRatio,
          expected: data.expectedContrastRatio,
          text: (n.html || "").slice(0, 120),
        };
      }),
    }));
  });
}

const results = [];
const browser = await chromium.launch();
try {
  for (const [role, config] of Object.entries(ROLES)) {
    let state;
    try {
      state = await login(browser, role, config.email);
    } catch (error) {
      results.push({
        role,
        route: "/auth/login",
        width: 1440,
        ok: false,
        problems: [`login failed: ${error.message.split("\n")[0]}`],
      });
      continue;
    }
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        storageState: state,
        viewport: { width, height: width <= 768 ? 900 : 1000 },
      });
      await context.route("**/*", (route) =>
        isLoopback(route.request().url())
          ? route.continue()
          : route.abort("blockedbyclient"),
      );
      for (const route of config.routes) {
        const page = await context.newPage();
        const consoleErrors = [];
        const failedRequests = [];
        page.on("console", (msg) => {
          if (msg.type() === "error")
            consoleErrors.push(msg.text().slice(0, 200));
        });
        page.on("pageerror", (err) =>
          consoleErrors.push(`pageerror: ${err.message.slice(0, 200)}`),
        );
        page.on("response", (res) => {
          if (res.status() >= 400 && isLoopback(res.url()))
            failedRequests.push(
              `${res.status()} ${new URL(res.url()).pathname}`,
            );
        });
        const entry = { role, route, width, problems: [] };
        try {
          const response = await page.goto(new URL(route, WEB_URL).toString(), {
            waitUntil: "networkidle",
            timeout: 45_000,
          });
          entry.status = response?.status() ?? null;
          const finalUrl = new URL(page.url());
          entry.finalPath = finalUrl.pathname;
          if (finalUrl.origin !== WEB_ORIGIN)
            entry.problems.push("left origin");
          if (entry.status >= 400) entry.problems.push(`HTTP ${entry.status}`);
          if (finalUrl.pathname !== route)
            entry.problems.push(`redirected to ${finalUrl.pathname}`);
          const facts = await inspect(page);
          Object.assign(entry, facts);
          if (facts.overflowX > 1)
            entry.problems.push(`horizontal overflow ${facts.overflowX}px`);
          entry.axe = await runAxe(page);
          // Accessibility gate: serious/critical axe violations fail the page.
          // Set UAT_AXE_GATE=off only for local triage, never in CI.
          if (process.env.UAT_AXE_GATE !== "off") {
            if (entry.axe === null) {
              entry.problems.push("axe-core not loaded (gate cannot run)");
            } else {
              const blocking = entry.axe.filter((v) =>
                ["serious", "critical"].includes(v.impact),
              );
              if (blocking.length)
                entry.problems.push(
                  `axe: ${blocking.map((v) => `${v.id}(${v.nodes})`).join(", ")}`,
                );
            }
          }
          entry.consoleErrors = consoleErrors;
          entry.failedRequests = failedRequests;
          if (consoleErrors.length)
            entry.problems.push(`${consoleErrors.length} console error(s)`);
          if (failedRequests.length)
            entry.problems.push(
              `failed API calls: ${[...new Set(failedRequests)].join(", ")}`,
            );
          const dir = path.join(OUT_DIR, "screenshots", role, String(width));
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({
            path: path.join(dir, `${slug(route)}.png`),
            fullPage: true,
          });
        } catch (error) {
          entry.problems.push(
            `navigation failed: ${error.message.split("\n")[0]}`,
          );
        }
        entry.ok = entry.problems.length === 0;
        results.push(entry);
        await page.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, "responsive-results.json"),
  JSON.stringify(results, null, 2),
);

const failed = results.filter((r) => !r.ok);
const lines = [
  "# Disposable-CI responsive & accessibility run",
  "",
  "Disposable local Supabase + seeded synthetic accounts. **Not production or staging UAT.**",
  "",
  `Pages x widths checked: ${results.length}. Passed: ${results.length - failed.length}. With problems: ${failed.length}.`,
  "",
  "| Role | Route | Width | Result | Problems | axe (serious/critical) |",
  "|------|-------|-------|--------|----------|------------------------|",
  ...results.map((r) => {
    const serious = (r.axe ?? []).filter((v) =>
      ["serious", "critical"].includes(v.impact),
    );
    return `| ${r.role} | ${r.route} | ${r.width} | ${r.ok ? "PASS" : "FAIL"} | ${r.problems.join("; ") || "-"} | ${
      r.axe
        ? serious.map((v) => `${v.id}(${v.nodes})`).join(", ") || "none"
        : "n/a"
    } |`;
  }),
];
fs.writeFileSync(path.join(OUT_DIR, "responsive-summary.md"), lines.join("\n"));
console.log(lines.join("\n"));
assert.equal(
  failed.length,
  0,
  `${failed.length} page/width combinations had problems`,
);
