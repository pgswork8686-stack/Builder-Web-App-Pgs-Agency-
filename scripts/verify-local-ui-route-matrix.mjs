import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { LOCAL_UAT } from "./lib/local-uat-fixtures.mjs";
import {
  assertLoopbackUrl,
  assertNoHostedSupabaseEnvironment,
} from "./lib/local-endpoint-guard.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const WEB_APP_DIRECTORY = resolve(REPOSITORY_ROOT, "apps", "web", "app");
const DEFAULT_BROWSER_EXECUTABLE =
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DEFAULT_EVIDENCE_DIRECTORY = ".tmp-ui-route-matrix";
const DEFAULT_TIMEOUT_MS = 20_000;
const SETTLE_DELAY_MS = 250;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PAGE_FILE_NAMES = new Set(["page.tsx", "page.ts", "page.jsx", "page.js"]);

const ROLE_HOMES = Object.freeze({
  admin: "/app/admin",
  leader: "/app/team-leader",
  employee: "/app/employee",
  accountant: "/app/accountant",
  client: "/app/client",
});

const ROLE_KEYS = Object.freeze(Object.keys(ROLE_HOMES));

const ROLE_USERS = Object.freeze({
  admin: LOCAL_UAT.users.admin,
  leader: LOCAL_UAT.users.leader,
  employee: LOCAL_UAT.users.employee,
  accountant: LOCAL_UAT.users.accountant,
  client: LOCAL_UAT.users.client,
});

const PUBLIC_BASELINE_CASES = Object.freeze([
  { route: "/", expectedPath: "/auth/login" },
  { route: "/auth/resolve", expectedPath: "/auth/login" },
  { route: "/auth/login", expectedPath: "/auth/login" },
  { route: "/auth/sign-up", expectedPath: "/auth/sign-up" },
  { route: "/auth/forgot-password", expectedPath: "/auth/forgot-password" },
  { route: "/auth/reset-password", expectedPath: "/auth/reset-password" },
  { route: "/auth/update-password", expectedPath: "/auth/update-password" },
]);

const ACCOUNT_STATE_ROUTES_REQUIRING_SEPARATE_FIXTURES = Object.freeze([
  "/account/pending",
  "/account/rejected",
]);

const SCREENSHOT_SPECS = Object.freeze([
  { role: "anonymous", route: "/auth/login", fileName: "login.png" },
  { role: "admin", route: "/app/admin", fileName: "dashboard.png" },
  {
    role: "admin",
    route: "/app/admin/attendance",
    fileName: "attendance.png",
  },
  {
    role: "leader",
    route: "/app/team-leader/tasks",
    fileName: "tasks.png",
  },
  {
    role: "leader",
    route: "/app/team-leader/kanban",
    fileName: "kanban.png",
  },
  {
    role: "leader",
    route: "/app/team-leader/calendar",
    fileName: "calendar.png",
  },
  {
    role: "admin",
    route: "/app/admin/workflows",
    fileName: "workflow.png",
  },
  {
    role: "accountant",
    route: "/app/accountant/finance/project-expenses",
    fileName: "expenses.png",
  },
  {
    role: "accountant",
    route: "/app/accountant/payroll",
    fileName: "payroll.png",
  },
  {
    role: "employee",
    route: "/app/employee/documents",
    fileName: "documents.png",
  },
  {
    role: "client",
    route: "/app/client/support",
    fileName: "support.png",
  },
]);

const SCREENSHOT_FILE_BY_ROLE_AND_ROUTE = new Map(
  SCREENSHOT_SPECS.map((specification) => [
    `${specification.role}:${specification.route}`,
    specification.fileName,
  ]),
);

function getLocalAuthority(url) {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  const defaultPort =
    url.protocol === "http:" || url.protocol === "ws:"
      ? "80"
      : url.protocol === "https:" || url.protocol === "wss:"
        ? "443"
        : "";
  return `${hostname}:${url.port || defaultPort}`;
}

function requireExplicitLocalPublicUrl(environment, name) {
  const value = environment[name]?.trim();
  assert.ok(
    value,
    `${name} must be explicitly set to a local loopback URL before browser credentials can be entered.`,
  );
  return assertLoopbackUrl(value, name, ["http:", "https:"]);
}

function requireExplicitValue(environment, name, description) {
  const value = environment[name]?.trim();
  assert.ok(value, `${name} must be explicitly set ${description}.`);
  return value;
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value.trim() === "") return fallback;
  assert.match(
    value,
    /^\d+$/u,
    "PGS_UI_ROUTE_MATRIX_TIMEOUT_MS must be a whole number.",
  );
  const parsed = Number(value);
  assert.ok(parsed > 0, "PGS_UI_ROUTE_MATRIX_TIMEOUT_MS must be positive.");
  return parsed;
}

function assertBrowserPublicKey(value) {
  assert.ok(
    !/(?:service[_-]?role|secret)/iu.test(value),
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a browser publishable key, never a service-role or secret key.",
  );
}

function assertWebRootUrl(url) {
  assert.equal(url.pathname, "/", "WEB_URL must not include a path.");
  assert.equal(url.search, "", "WEB_URL must not include query parameters.");
  assert.equal(url.hash, "", "WEB_URL must not include a fragment.");
}

function parseRouteFixtureFile(environment) {
  const fixtureFile = requireExplicitValue(
    environment,
    "PGS_UI_ROUTE_FIXTURES_FILE",
    "to a local JSON fixture file before dynamic routes can be tested",
  );
  const resolvedFixtureFile = resolve(process.cwd(), fixtureFile);
  assert.ok(
    existsSync(resolvedFixtureFile),
    "PGS_UI_ROUTE_FIXTURES_FILE must point to an existing local JSON fixture file.",
  );

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(resolvedFixtureFile, "utf8"));
  } catch {
    throw new Error("PGS_UI_ROUTE_FIXTURES_FILE must contain valid JSON.");
  }

  return {
    fixtureFile: resolvedFixtureFile,
    fixtures: validateRouteFixtures(parsed),
  };
}

export function validateRouteFixtures(value) {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    "Route fixtures must be a JSON object.",
  );
  assert.equal(
    value.schemaVersion,
    1,
    "Route fixtures must declare schemaVersion: 1.",
  );

  const requiredFields = [
    "projectId",
    "taskId",
    "clientId",
    "userId",
    "contractId",
    "invoiceId",
  ];
  const fixtures = {};
  for (const field of requiredFields) {
    const identifier = value[field];
    assert.equal(
      typeof identifier,
      "string",
      `Route fixture ${field} must be a UUID string.`,
    );
    assert.match(
      identifier,
      UUID_PATTERN,
      `Route fixture ${field} must be a UUID.`,
    );
    fixtures[field] = identifier;
  }
  return Object.freeze(fixtures);
}

function readLocalBrowserConfiguration(environment) {
  const webUrl = assertLoopbackUrl(
    environment.WEB_URL ?? "http://127.0.0.1:3000",
    "WEB_URL",
    ["http:", "https:"],
  );
  assertWebRootUrl(webUrl);

  const publicApiUrl = requireExplicitLocalPublicUrl(
    environment,
    "NEXT_PUBLIC_API_URL",
  );
  const publicSupabaseUrl = requireExplicitLocalPublicUrl(
    environment,
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  const publishableKey = requireExplicitValue(
    environment,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "before browser credentials can be entered",
  );
  assertBrowserPublicKey(publishableKey);

  const password = requireExplicitValue(
    environment,
    "PGS_UI_ROUTE_MATRIX_PASSWORD",
    "with the local synthetic account password",
  );
  const { fixtureFile, fixtures } = parseRouteFixtureFile(environment);
  const browserExecutablePath =
    environment.PGS_UI_BROWSER_EXECUTABLE_PATH?.trim() ||
    DEFAULT_BROWSER_EXECUTABLE;
  assert.ok(
    existsSync(browserExecutablePath),
    "A local Chromium executable is required; no browser download is attempted by this UAT script.",
  );

  const evidenceDirectory = resolve(
    environment.PGS_UI_EVIDENCE_DIR?.trim() || DEFAULT_EVIDENCE_DIRECTORY,
  );
  const timeoutMs = parsePositiveInteger(
    environment.PGS_UI_ROUTE_MATRIX_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  const allowedAuthorities = new Set(
    [webUrl, publicApiUrl, publicSupabaseUrl].map(getLocalAuthority),
  );

  return {
    allowedAuthorities,
    browserExecutablePath,
    evidenceDirectory,
    fixtureFile,
    fixtures,
    password,
    publicApiUrl,
    publicSupabaseUrl,
    timeoutMs,
    webUrl,
    webOrigin: webUrl.origin,
  };
}

function findPageFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name),
  );
  const files = [];
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findPageFiles(entryPath));
    } else if (entry.isFile() && PAGE_FILE_NAMES.has(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

export function discoverPageRouteTemplates(appDirectory = WEB_APP_DIRECTORY) {
  return findPageFiles(appDirectory)
    .map((pageFile) => {
      const pageDirectory = dirname(relative(appDirectory, pageFile));
      if (pageDirectory === ".") return "/";
      return `/${pageDirectory.split(sep).join("/")}`;
    })
    .sort((left, right) => left.localeCompare(right));
}

function routeMatchesPrefix(routeTemplate, prefix) {
  return routeTemplate === prefix || routeTemplate.startsWith(`${prefix}/`);
}

export function rolesAllowedToRenderRoute(routeTemplate) {
  assert.ok(
    routeTemplate === "/app" || routeTemplate.startsWith("/app/"),
    `${routeTemplate} is not a protected /app route.`,
  );
  if (routeTemplate === "/app") return ROLE_KEYS;
  if (routeMatchesPrefix(routeTemplate, "/app/admin")) return ["admin"];
  if (routeMatchesPrefix(routeTemplate, "/app/team-leader")) {
    return ["admin", "leader"];
  }
  if (routeMatchesPrefix(routeTemplate, "/app/employee")) {
    return ["admin", "employee"];
  }
  if (routeMatchesPrefix(routeTemplate, "/app/accountant")) {
    return ["admin", "accountant"];
  }
  if (routeMatchesPrefix(routeTemplate, "/app/client")) {
    return ["admin", "client"];
  }
  if (
    ["/app/notifications", "/app/chat", "/app/profile"].some((prefix) =>
      routeMatchesPrefix(routeTemplate, prefix),
    )
  ) {
    return ROLE_KEYS;
  }
  if (
    ["/app/projects", "/app/attendance", "/app/leave"].some((prefix) =>
      routeMatchesPrefix(routeTemplate, prefix),
    )
  ) {
    return ["admin", "leader", "employee"];
  }
  throw new Error(
    `No explicit role policy is registered for protected page route ${routeTemplate}.`,
  );
}

function fixtureFieldForRouteParameter(routeTemplate, parameterName) {
  if (parameterName === "projectId") return "projectId";
  if (parameterName === "taskId") return "taskId";
  if (parameterName === "clientId") return "clientId";
  if (parameterName === "userId") return "userId";
  if (parameterName === "id") {
    if (routeTemplate.includes("/finance/contracts/[id]")) {
      return "contractId";
    }
    if (routeTemplate.includes("/finance/invoices/[id]")) {
      return "invoiceId";
    }
  }
  throw new Error(
    `No local fixture mapping is registered for dynamic parameter [${parameterName}] in ${routeTemplate}.`,
  );
}

export function materializeRouteTemplate(routeTemplate, fixtures) {
  return routeTemplate.replace(/\[([^/\]]+)\]/gu, (match, parameterName) => {
    const fixtureField = fixtureFieldForRouteParameter(
      routeTemplate,
      parameterName,
    );
    const value = fixtures[fixtureField];
    assert.ok(
      value,
      `Route fixture ${fixtureField} is required for ${routeTemplate}.`,
    );
    return encodeURIComponent(value);
  });
}

export function buildRouteMatrix(routeTemplates, fixtures) {
  return routeTemplates.flatMap((routeTemplate) => {
    const route = materializeRouteTemplate(routeTemplate, fixtures);
    const allowedRoles = rolesAllowedToRenderRoute(routeTemplate);
    const cases = [
      {
        expectedPath: "/auth/login",
        expectation: "auth_redirect",
        role: "anonymous",
        route,
        routeTemplate,
      },
    ];

    for (const role of ROLE_KEYS) {
      const allowed = allowedRoles.includes(role);
      cases.push({
        expectedPath:
          routeTemplate === "/app"
            ? ROLE_HOMES[role]
            : allowed
              ? route
              : ROLE_HOMES[role],
        expectation:
          routeTemplate === "/app"
            ? "role_home_redirect"
            : allowed
              ? "render"
              : "role_protection_redirect",
        role,
        route,
        routeTemplate,
      });
    }
    return cases;
  });
}

function absoluteWebUrl(webUrl, route) {
  return new URL(route, webUrl).toString();
}

function assertAllowedBrowserUrl(
  urlValue,
  label,
  protocols,
  allowedAuthorities,
) {
  const url = assertLoopbackUrl(urlValue, label, protocols);
  assert.ok(
    allowedAuthorities.has(getLocalAuthority(url)),
    `${label} must target an explicitly configured local web, API, or Supabase endpoint.`,
  );
  return url;
}

function safeRequestPath(urlValue) {
  try {
    const url = new URL(urlValue);
    return url.pathname || "/";
  } catch {
    return "[unparseable URL]";
  }
}

function redactDiagnosticText(value) {
  return String(value)
    .replace(/bearer\s+[^\s]+/giu, "Bearer [redacted]")
    .replace(
      /(password|token|apikey|authorization)=?[^\s,;]*/giu,
      "$1=[redacted]",
    )
    .slice(0, 600);
}

function createOutboundGuard(context, allowedAuthorities) {
  const blockedRequests = [];

  async function allowOnlyConfiguredLocalHttp(route) {
    try {
      assertAllowedBrowserUrl(
        route.request().url(),
        "Browser HTTP request",
        ["http:", "https:"],
        allowedAuthorities,
      );
      await route.continue();
    } catch {
      blockedRequests.push("HTTP request outside configured local endpoints");
      await route.abort("blockedbyclient");
    }
  }

  function allowOnlyConfiguredLocalWebSocket(webSocketRoute) {
    try {
      assertAllowedBrowserUrl(
        webSocketRoute.url(),
        "Browser WebSocket request",
        ["ws:", "wss:"],
        allowedAuthorities,
      );
      webSocketRoute.connectToServer();
    } catch {
      blockedRequests.push("WebSocket outside configured local endpoints");
      webSocketRoute.close({
        code: 1008,
        reason: "Non-local WebSocket requests are blocked during local UAT.",
      });
    }
  }

  return {
    async install() {
      await context.route("**/*", allowOnlyConfiguredLocalHttp);
      assert.equal(
        typeof context.routeWebSocket,
        "function",
        "The installed Playwright version must support WebSocket request routing for fail-closed local UAT.",
      );
      await context.routeWebSocket("**/*", allowOnlyConfiguredLocalWebSocket);
    },
    assertClean(label) {
      assert.equal(
        blockedRequests.length,
        0,
        `${label} attempted a non-local browser request.`,
      );
    },
    clear() {
      blockedRequests.length = 0;
    },
  };
}

function createPageAudit(page, outboundGuard, allowedAuthorities) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(redactDiagnosticText(message.text()));
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(redactDiagnosticText(error.message));
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${safeRequestPath(request.url())} (${redactDiagnosticText(
        request.failure()?.errorText ?? "failed",
      )})`,
    );
  });
  page.on("response", (response) => {
    try {
      assertAllowedBrowserUrl(
        response.url(),
        "Browser response",
        ["http:", "https:"],
        allowedAuthorities,
      );
      if (response.status() >= 400) {
        badResponses.push(
          `${response.status()} ${safeRequestPath(response.url())}`,
        );
      }
    } catch {
      badResponses.push("response outside configured local endpoints");
    }
  });

  return {
    assertClean(label) {
      outboundGuard.assertClean(label);
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
    clear() {
      consoleErrors.length = 0;
      pageErrors.length = 0;
      failedRequests.length = 0;
      badResponses.length = 0;
      outboundGuard.clear();
    },
  };
}

async function waitForRenderedRoute(page, expectedPath, timeoutMs) {
  await page.waitForFunction(
    (pathname) => window.location.pathname === pathname,
    expectedPath,
    { timeout: timeoutMs },
  );
  await page.waitForFunction(
    () => document.readyState === "complete",
    undefined,
    { timeout: timeoutMs },
  );

  if (expectedPath === "/app" || expectedPath.startsWith("/app/")) {
    await page.waitForFunction(
      () =>
        !document.body?.innerText.includes("Đang kiểm tra quyền truy cập..."),
      undefined,
      { timeout: timeoutMs },
    );
  }
  await page.waitForTimeout(SETTLE_DELAY_MS);
}

async function navigateAndAssert({
  audit,
  expectedPath,
  label,
  page,
  route,
  timeoutMs,
  webOrigin,
  webUrl,
}) {
  audit.clear();
  const startedAt = performance.now();
  const response = await page.goto(absoluteWebUrl(webUrl, route), {
    timeout: timeoutMs,
    waitUntil: "domcontentloaded",
  });
  assert.ok(response, `${label} did not return an HTTP response.`);
  assert.ok(
    response.status() < 400,
    `${label} initial navigation returned HTTP ${response.status()}.`,
  );
  await waitForRenderedRoute(page, expectedPath, timeoutMs);

  const finalUrl = assertLoopbackUrl(page.url(), `${label} final URL`, [
    "http:",
    "https:",
  ]);
  assert.equal(
    finalUrl.origin,
    webOrigin,
    `${label} left the configured web origin.`,
  );
  assert.equal(
    finalUrl.pathname,
    expectedPath,
    `${label} ended at an unexpected route.`,
  );
  assert.equal(
    finalUrl.search,
    "",
    `${label} unexpectedly changed query parameters.`,
  );
  return {
    durationMs: Math.round(performance.now() - startedAt),
    finalPath: finalUrl.pathname,
  };
}

function routeTemplateMatchesPath(routeTemplate, pathname) {
  const templateSegments = routeTemplate.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  if (templateSegments.length !== pathSegments.length) return false;
  return templateSegments.every(
    (segment, index) =>
      (/^\[[^/\]]+\]$/u.test(segment) && pathSegments[index].length > 0) ||
      segment === pathSegments[index],
  );
}

async function auditInternalLinks({
  allowedAuthorities,
  allRouteTemplates,
  page,
  summary,
  webAuthority,
}) {
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((anchors) =>
      [
        ...new Set(
          anchors
            .map((anchor) => anchor.getAttribute("href"))
            .filter((href) => typeof href === "string" && href.length > 0),
        ),
      ].sort(),
    );

  for (const href of hrefs) {
    if (href.startsWith("#")) {
      summary.linkAudit.fragmentLinks += 1;
      continue;
    }

    let url;
    try {
      url = new URL(href, page.url());
    } catch {
      throw new Error("A rendered page contains an invalid anchor URL.");
    }
    if (["mailto:", "tel:"].includes(url.protocol)) {
      summary.linkAudit.nonHttpLinks += 1;
      continue;
    }

    assertAllowedBrowserUrl(
      url.toString(),
      "Rendered anchor URL",
      ["http:", "https:"],
      allowedAuthorities,
    );
    if (
      getLocalAuthority(url) !== webAuthority ||
      url.pathname.startsWith("/api/")
    ) {
      summary.linkAudit.localNonPageLinks += 1;
      continue;
    }

    assert.ok(
      allRouteTemplates.some((routeTemplate) =>
        routeTemplateMatchesPath(routeTemplate, url.pathname),
      ),
      "A rendered local anchor does not resolve to a declared Next page route.",
    );
    summary.linkAudit.pageLinks += 1;
  }
}

async function captureScreenshotIfRequired({
  evidenceDirectory,
  page,
  role,
  route,
  summary,
}) {
  const fileName = SCREENSHOT_FILE_BY_ROLE_AND_ROUTE.get(`${role}:${route}`);
  if (!fileName || summary.screenshots.includes(fileName)) return;
  await page.screenshot({
    fullPage: true,
    path: join(evidenceDirectory, fileName),
  });
  summary.screenshots.push(fileName);
}

async function loginRole(context, configuration, role) {
  const page = await context.newPage();
  const outboundGuard = createOutboundGuard(
    context,
    configuration.allowedAuthorities,
  );
  await outboundGuard.install();
  const audit = createPageAudit(
    page,
    outboundGuard,
    configuration.allowedAuthorities,
  );
  const user = ROLE_USERS[role];
  assert.ok(user, `No local synthetic browser user is registered for ${role}.`);

  await navigateAndAssert({
    audit,
    expectedPath: "/auth/login",
    label: `${role} login page`,
    page,
    route: "/auth/login",
    timeoutMs: configuration.timeoutMs,
    webOrigin: configuration.webOrigin,
    webUrl: configuration.webUrl,
  });
  audit.assertClean(`${role} login page`);

  audit.clear();
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', configuration.password);
  await page.click('button[type="submit"]');
  await waitForRenderedRoute(page, ROLE_HOMES[role], configuration.timeoutMs);
  const finalUrl = assertLoopbackUrl(page.url(), `${role} login final URL`, [
    "http:",
    "https:",
  ]);
  assert.equal(finalUrl.origin, configuration.webOrigin);
  assert.equal(finalUrl.pathname, ROLE_HOMES[role]);
  audit.assertClean(`${role} login`);
  return { audit, page };
}

async function runAnonymousCases(browser, configuration, summary) {
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { height: 900, width: 1440 },
  });
  try {
    const outboundGuard = createOutboundGuard(
      context,
      configuration.allowedAuthorities,
    );
    await outboundGuard.install();
    const page = await context.newPage();
    const audit = createPageAudit(
      page,
      outboundGuard,
      configuration.allowedAuthorities,
    );

    for (const testCase of PUBLIC_BASELINE_CASES) {
      const result = await navigateAndAssert({
        audit,
        expectedPath: testCase.expectedPath,
        label: `anonymous public route ${testCase.route}`,
        page,
        route: testCase.route,
        timeoutMs: configuration.timeoutMs,
        webOrigin: configuration.webOrigin,
        webUrl: configuration.webUrl,
      });
      await captureScreenshotIfRequired({
        evidenceDirectory: configuration.evidenceDirectory,
        page,
        role: "anonymous",
        route: testCase.expectedPath,
        summary,
      });
      audit.assertClean(`anonymous public route ${testCase.route}`);
      summary.cases.push({
        durationMs: result.durationMs,
        expectation: "public_route",
        finalPath: result.finalPath,
        role: "anonymous",
        routeTemplate: testCase.route,
      });
    }

    const protectedRoutes = summary.protectedRouteTemplates;
    for (const routeTemplate of protectedRoutes) {
      const route = materializeRouteTemplate(
        routeTemplate,
        configuration.fixtures,
      );
      const result = await navigateAndAssert({
        audit,
        expectedPath: "/auth/login",
        label: `anonymous protection ${routeTemplate}`,
        page,
        route,
        timeoutMs: configuration.timeoutMs,
        webOrigin: configuration.webOrigin,
        webUrl: configuration.webUrl,
      });
      audit.assertClean(`anonymous protection ${routeTemplate}`);
      summary.cases.push({
        durationMs: result.durationMs,
        expectation: "auth_redirect",
        finalPath: result.finalPath,
        role: "anonymous",
        routeTemplate,
      });
    }
  } finally {
    await context.close();
  }
}

async function runAuthenticatedCases(browser, configuration, summary) {
  for (const role of ROLE_KEYS) {
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { height: 900, width: 1440 },
    });
    try {
      const { audit, page } = await loginRole(context, configuration, role);
      for (const routeTemplate of summary.protectedRouteTemplates) {
        const route = materializeRouteTemplate(
          routeTemplate,
          configuration.fixtures,
        );
        const allowed = rolesAllowedToRenderRoute(routeTemplate).includes(role);
        const expectedPath =
          routeTemplate === "/app"
            ? ROLE_HOMES[role]
            : allowed
              ? route
              : ROLE_HOMES[role];
        const expectation =
          routeTemplate === "/app"
            ? "role_home_redirect"
            : allowed
              ? "render"
              : "role_protection_redirect";
        const result = await navigateAndAssert({
          audit,
          expectedPath,
          label: `${role} ${expectation} ${routeTemplate}`,
          page,
          route,
          timeoutMs: configuration.timeoutMs,
          webOrigin: configuration.webOrigin,
          webUrl: configuration.webUrl,
        });
        if (expectation === "render") {
          await auditInternalLinks({
            allowedAuthorities: configuration.allowedAuthorities,
            allRouteTemplates: summary.allRouteTemplates,
            page,
            summary,
            webAuthority: getLocalAuthority(configuration.webUrl),
          });
          await captureScreenshotIfRequired({
            evidenceDirectory: configuration.evidenceDirectory,
            page,
            role,
            route: routeTemplate,
            summary,
          });
        }
        audit.assertClean(`${role} ${expectation} ${routeTemplate}`);
        summary.cases.push({
          durationMs: result.durationMs,
          expectation,
          finalPath: result.finalPath,
          role,
          routeTemplate,
        });
      }
    } finally {
      await context.close();
    }
  }
}

function createSummary(allRouteTemplates, protectedRouteTemplates) {
  return {
    accountStateRoutesRequiringSeparateFixtures:
      ACCOUNT_STATE_ROUTES_REQUIRING_SEPARATE_FIXTURES,
    allRouteTemplates,
    cases: [],
    discoveredAt: new Date().toISOString(),
    linkAudit: {
      fragmentLinks: 0,
      localNonPageLinks: 0,
      nonHttpLinks: 0,
      pageLinks: 0,
    },
    protectedRouteTemplates,
    screenshots: [],
    sourcePageRouteCount: allRouteTemplates.length,
    sourceProtectedRouteCount: protectedRouteTemplates.length,
    sourcePublicRouteCount:
      allRouteTemplates.length - protectedRouteTemplates.length,
  };
}

async function run() {
  // This runs before Chromium starts or any credential is entered. It scans
  // the whole inherited process environment and refuses hosted Supabase state.
  assertNoHostedSupabaseEnvironment(process.env);
  const configuration = readLocalBrowserConfiguration(process.env);
  const allRouteTemplates = discoverPageRouteTemplates();
  const protectedRouteTemplates = allRouteTemplates.filter(
    (routeTemplate) =>
      routeTemplate === "/app" || routeTemplate.startsWith("/app/"),
  );
  assert.ok(
    protectedRouteTemplates.length > 0,
    "No protected Next page routes were discovered.",
  );
  for (const routeTemplate of protectedRouteTemplates) {
    rolesAllowedToRenderRoute(routeTemplate);
    materializeRouteTemplate(routeTemplate, configuration.fixtures);
  }

  mkdirSync(configuration.evidenceDirectory, { recursive: true });
  const summary = createSummary(allRouteTemplates, protectedRouteTemplates);
  console.log(
    `Local UI route matrix discovered ${summary.sourceProtectedRouteCount} protected page routes (${summary.sourcePageRouteCount} source page routes total).`,
  );
  console.log(
    "Running anonymous protection and all five local synthetic roles with outbound, redirect, response, console, and loading guards enabled.",
  );

  const browser = await chromium.launch({
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-browser-check",
      "--disable-sync",
      "--no-default-browser-check",
      "--no-first-run",
    ],
    executablePath: configuration.browserExecutablePath,
    headless: true,
  });

  try {
    await runAnonymousCases(browser, configuration, summary);
    await runAuthenticatedCases(browser, configuration, summary);
  } finally {
    await browser.close();
  }

  const summaryPath = join(configuration.evidenceDirectory, "summary.json");
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(
    `Local UI route matrix passed ${summary.cases.length} navigation cases; captured ${summary.screenshots.length} required screenshots.`,
  );
}

const invokedAsScript =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Local UI route matrix failed: ${redactDiagnosticText(message)}`,
    );
    process.exitCode = 1;
  });
}
