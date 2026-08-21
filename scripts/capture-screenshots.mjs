import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";
import { assertLoopbackUrl } from "./lib/local-endpoint-guard.mjs";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const SCREENSHOTS_DIR = "D:/Điệp Web App/pgs-hub/docs/user-guide/screenshots";
const PASSWORD = "Password123!";

const WEB_ORIGIN = assertLoopbackUrl(WEB_URL, "WEB_URL", [
  "http:",
  "https:",
]).origin;

function requireExplicitLocalPublicUrl(name) {
  const value = process.env[name]?.trim();
  assert.ok(
    value,
    `${name} must be explicitly set to a local loopback URL before credentials can be entered.`,
  );
  return assertLoopbackUrl(value, name, ["http:", "https:"]);
}

// Do not rely on the web client's development defaults. This check makes an
// operator explicitly opt into local-only public endpoints before login fills
// any test account credentials.
const PUBLIC_API_URL = requireExplicitLocalPublicUrl("NEXT_PUBLIC_API_URL");
const PUBLIC_SUPABASE_URL = requireExplicitLocalPublicUrl(
  "NEXT_PUBLIC_SUPABASE_URL",
);
assert.ok(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be explicitly set for local browser UAT.",
);

const USERS = {
  admin: "admin@test.local",
  leader: "leader@test.local",
  employee: "employee@test.local",
  accountant: "accountant@test.local",
  client: "client@test.local",
};

function absoluteUrl(route) {
  return new URL(route, WEB_URL).toString();
}

function assertSameWebOrigin(value, label) {
  const url = assertLoopbackUrl(value, label, ["http:", "https:"]);
  assert.equal(
    url.origin,
    WEB_ORIGIN,
    `${label} must remain on the configured WEB_URL origin.`,
  );
  return url;
}

function createOutboundGuard(context) {
  const blockedRequests = [];

  async function allowOnlyLoopbackHttp(route) {
    const request = route.request();
    const url = request.url();
    try {
      assertLoopbackUrl(url, "Browser HTTP request", ["http:", "https:"]);
      await route.continue();
    } catch {
      blockedRequests.push(`${request.method()} ${url}`);
      await route.abort("blockedbyclient");
    }
  }

  async function allowOnlyLoopbackWebSocket(webSocketRoute) {
    const url = webSocketRoute.url();
    try {
      assertLoopbackUrl(url, "Browser WebSocket request", ["ws:", "wss:"]);
      webSocketRoute.connectToServer();
    } catch {
      blockedRequests.push(`WebSocket ${url}`);
      await webSocketRoute.close({
        code: 1008,
        reason: "Non-loopback WebSocket requests are blocked during local UAT.",
      });
    }
  }

  return {
    async install() {
      // Install before any page is opened. Blocking service workers prevents a
      // service-worker fetch from bypassing Playwright request routing.
      await context.route("**/*", allowOnlyLoopbackHttp);
      await context.routeWebSocket("**/*", allowOnlyLoopbackWebSocket);
    },
    assertNoBlockedRequests(label) {
      assert.deepEqual(
        blockedRequests,
        [],
        `${label} attempted non-loopback browser requests:\n${blockedRequests.join("\n")}`,
      );
    },
  };
}

function auditPage(page, outboundGuard) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} (${request.failure()?.errorText ?? "failed"})`,
    );
  });
  page.on("response", (response) => {
    const url = response.url();
    try {
      assertLoopbackUrl(url, "Browser response", ["http:", "https:"]);
    } catch {
      badResponses.push(`non-loopback response ${response.status()} ${url}`);
      return;
    }
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${url}`);
    }
  });

  return {
    clear() {
      consoleErrors.length = 0;
      pageErrors.length = 0;
      failedRequests.length = 0;
      badResponses.length = 0;
    },
    assertClean(label) {
      outboundGuard.assertNoBlockedRequests(label);
      const evidence = [
        ...consoleErrors.map((item) => `console: ${item}`),
        ...pageErrors.map((item) => `page: ${item}`),
        ...failedRequests.map((item) => `network: ${item}`),
        ...badResponses.map((item) => `response: ${item}`),
      ];
      assert.deepEqual(
        evidence,
        [],
        `${label} has browser errors:\n${evidence.join("\n")}`,
      );
    },
  };
}

async function captureRoute(page, audit, route, fileName) {
  audit.clear();
  const expectedUrl = assertSameWebOrigin(
    absoluteUrl(route),
    `${route} expected route`,
  );
  const response = await page.goto(expectedUrl.toString(), {
    waitUntil: "networkidle",
  });
  assert(
    response?.ok(),
    `${route} returned HTTP ${response?.status() ?? "no response"}`,
  );
  assert.equal(
    response.request().redirectedFrom(),
    null,
    `${route} redirected instead of loading its requested route directly.`,
  );
  await page.waitForTimeout(500);

  const actualUrl = assertSameWebOrigin(page.url(), `${route} final page`);
  assert.equal(
    actualUrl.pathname,
    expectedUrl.pathname,
    `${route} redirected to ${actualUrl.pathname}`,
  );
  assert.equal(
    actualUrl.search,
    expectedUrl.search,
    `${route} changed query parameters`,
  );
  audit.assertClean(route);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, fileName),
    fullPage: true,
  });
  console.log(`Captured ${fileName}`);
}

async function loginWithOutboundGuard(context, outboundGuard, role) {
  const page = await context.newPage();
  const audit = auditPage(page, outboundGuard);
  await captureRoute(page, audit, "/auth/login", "login.png");

  audit.clear();
  await page.fill('input[type="email"]', USERS[role]);
  await page.fill('input[type="password"]', PASSWORD);
  const navigation = page.waitForURL(
    (url) => url.origin === WEB_ORIGIN && url.pathname.startsWith("/app/"),
    { timeout: 15_000 },
  );
  await page.click('button[type="submit"]');
  await navigation;
  await page.waitForLoadState("networkidle");
  const finalUrl = assertSameWebOrigin(page.url(), `${role} login final page`);
  assert.ok(
    finalUrl.pathname.startsWith("/app/"),
    `${role} login did not reach an application route.`,
  );
  audit.assertClean(`${role} login`);
  return { page, audit };
}

async function captureForRole(browser, role, routes) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  try {
    const outboundGuard = createOutboundGuard(context);
    await outboundGuard.install();
    const { page, audit } = await loginWithOutboundGuard(
      context,
      outboundGuard,
      role,
    );
    for (const [route, fileName] of routes) {
      await captureRoute(page, audit, route, fileName);
    }
  } finally {
    await context.close();
  }
}

async function run() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  console.log(
    `Browser UAT is restricted to ${WEB_ORIGIN}; public API ${PUBLIC_API_URL.origin}; public Supabase ${PUBLIC_SUPABASE_URL.origin}.`,
  );

  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  try {
    await captureForRole(browser, "admin", [
      ["/app/admin", "dashboard.png"],
      ["/app/admin/attendance", "attendance.png"],
      ["/app/admin/workflows", "workflow.png"],
    ]);
    await captureForRole(browser, "leader", [
      ["/app/team-leader/tasks", "tasks.png"],
      ["/app/team-leader/kanban", "kanban.png"],
      ["/app/team-leader/calendar", "calendar.png"],
    ]);
    await captureForRole(browser, "accountant", [
      ["/app/accountant/finance/project-expenses", "expenses.png"],
      ["/app/accountant/payroll", "payroll.png"],
    ]);
    await captureForRole(browser, "employee", [
      ["/app/employee/documents", "documents.png"],
    ]);
    await captureForRole(browser, "client", [
      ["/app/client/support", "support.png"],
    ]);
  } finally {
    await browser.close();
  }

  console.log("All required local UI routes passed and were captured.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
