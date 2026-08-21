import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildRouteMatrix,
  discoverPageRouteTemplates,
  materializeRouteTemplate,
  rolesAllowedToRenderRoute,
  validateRouteFixtures,
} from "./verify-local-ui-route-matrix.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const FIXTURES = Object.freeze({
  clientId: "00000000-0000-4000-8000-000000000001",
  contractId: "00000000-0000-4000-8000-000000000002",
  invoiceId: "00000000-0000-4000-8000-000000000003",
  projectId: "00000000-0000-4000-8000-000000000004",
  schemaVersion: 1,
  taskId: "00000000-0000-4000-8000-000000000005",
  userId: "00000000-0000-4000-8000-000000000006",
});

test("discovers the current Next page-route inventory without accepting an obsolete 86-route claim", () => {
  const routes = discoverPageRouteTemplates();
  const protectedRoutes = routes.filter(
    (route) => route === "/app" || route.startsWith("/app/"),
  );

  assert.equal(routes.length, 99);
  assert.equal(protectedRoutes.length, 90);
  assert.equal(
    protectedRoutes.filter((route) => route.includes("[")).length,
    17,
  );
  assert.equal(
    routes.includes("/app/admin/projects/[projectId]/tasks/[taskId]"),
    true,
  );
  assert.equal(routes.includes("/app/client/projects/[projectId]"), true);
});

test("maps the app layout's role prefixes explicitly", () => {
  assert.deepEqual(rolesAllowedToRenderRoute("/app/admin/tasks"), ["admin"]);
  assert.deepEqual(rolesAllowedToRenderRoute("/app/team-leader/tasks"), [
    "admin",
    "leader",
  ]);
  assert.deepEqual(rolesAllowedToRenderRoute("/app/employee/tasks"), [
    "admin",
    "employee",
  ]);
  assert.deepEqual(rolesAllowedToRenderRoute("/app/accountant/payroll"), [
    "admin",
    "accountant",
  ]);
  assert.deepEqual(rolesAllowedToRenderRoute("/app/client/support"), [
    "admin",
    "client",
  ]);
  assert.deepEqual(rolesAllowedToRenderRoute("/app/projects/[projectId]"), [
    "admin",
    "leader",
    "employee",
  ]);
  assert.deepEqual(rolesAllowedToRenderRoute("/app/chat"), [
    "admin",
    "leader",
    "employee",
    "accountant",
    "client",
  ]);
});

test("requires explicit local fixture IDs for every dynamic route shape", () => {
  const fixtures = validateRouteFixtures(FIXTURES);
  assert.equal(
    materializeRouteTemplate(
      "/app/projects/[projectId]/tasks/[taskId]",
      fixtures,
    ),
    "/app/projects/00000000-0000-4000-8000-000000000004/tasks/00000000-0000-4000-8000-000000000005",
  );
  assert.equal(
    materializeRouteTemplate("/app/admin/finance/contracts/[id]", fixtures),
    "/app/admin/finance/contracts/00000000-0000-4000-8000-000000000002",
  );
  assert.equal(
    materializeRouteTemplate("/app/accountant/finance/invoices/[id]", fixtures),
    "/app/accountant/finance/invoices/00000000-0000-4000-8000-000000000003",
  );
});

test("builds an anonymous and five-role case for every protected page template", () => {
  const matrix = buildRouteMatrix(["/app", "/app/admin/tasks"], FIXTURES);
  assert.equal(matrix.length, 12);
  assert.deepEqual(matrix[0], {
    expectedPath: "/auth/login",
    expectation: "auth_redirect",
    role: "anonymous",
    route: "/app",
    routeTemplate: "/app",
  });
  assert.equal(
    matrix.some(
      (testCase) =>
        testCase.role === "employee" &&
        testCase.routeTemplate === "/app/admin/tasks" &&
        testCase.expectation === "role_protection_redirect" &&
        testCase.expectedPath === "/app/employee",
    ),
    true,
  );
});

test("route matrix scans the complete environment before Chromium launch", async () => {
  const source = await readFile(
    resolve(SCRIPT_DIRECTORY, "verify-local-ui-route-matrix.mjs"),
    "utf8",
  );
  const preflightIndex = source.indexOf(
    "assertNoHostedSupabaseEnvironment(process.env)",
  );
  const browserIndex = source.indexOf("chromium.launch");

  assert.ok(preflightIndex >= 0);
  assert.ok(browserIndex >= 0);
  assert.ok(preflightIndex < browserIndex);
});
