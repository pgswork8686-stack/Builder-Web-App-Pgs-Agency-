import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const expectedNode = "22.23.0";
if (process.versions.node !== expectedNode) {
  throw new Error(
    `cPanel artifact verification requires Node ${expectedNode}; received ${process.versions.node}`,
  );
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(repoRoot, "artifacts", "cpanel-api");
const temporaryRoot = mkdtempSync(join(tmpdir(), "pgs-hub-cpanel-"));
const runtimeRoot = join(temporaryRoot, "app");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nodeCommand = process.execPath;
let output = "";

function copyDirectory(sourceDirectory, targetDirectory) {
  mkdirSync(targetDirectory, { recursive: true });
  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = join(sourceDirectory, entry.name);
    const targetPath = join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      copyFileSync(sourcePath, targetPath);
    } else {
      throw new Error(`Unsupported artifact entry: ${sourcePath}`);
    }
  }
}

function appendOutput(chunk) {
  output = `${output}${chunk}`.slice(-200000);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveExit, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Child process did not exit before timeout"));
    }, timeoutMs);
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolveExit({ code, signal });
    });
  });
}

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error("Packaged API did not become healthy before timeout");
}

function expectFailFast(name, mutate) {
  const marker = "fake-secret-marker-must-not-appear";
  const environment = {
    ...process.env,
    APP_ENV: "production",
    PORT: "31999",
    WEB_URL: "https://hub.example.com",
    DATABASE_URL:
      "postgresql://postgres:postgres@db.example.supabase.co:5432/postgres",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "test-placeholder",
    SUPABASE_SECRET_KEY: marker,
    JWT_SECRET: "test-jwt-secret-with-at-least-32-characters",
    INITIAL_ADMIN_EMAIL: "admin@example.com",
    THROTTLE_TTL: "60000",
    THROTTLE_LIMIT: "120",
    TRUST_PROXY: "true",
  };
  mutate(environment);
  const result = spawnSync(nodeCommand, ["app.js"], {
    cwd: runtimeRoot,
    env: environment,
    encoding: "utf8",
    timeout: 10000,
  });
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status === 0 || result.error?.code === "ETIMEDOUT") {
    throw new Error(`${name} did not fail fast`);
  }
  if (combined.includes(marker)) {
    throw new Error(`${name} leaked the supplied secret marker`);
  }
  console.log(`${name}=PASS`);
}

try {
  // Node 22 fs.cpSync can terminate the Windows process when the source path
  // contains non-ASCII segments. Copy entries explicitly so the same artifact
  // verification works from Unicode workspaces and Linux CI.
  copyDirectory(source, runtimeRoot);
  const install = spawnSync(
    npmCommand,
    ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
    {
      cwd: runtimeRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );
  if (install.status !== 0) {
    throw new Error(`npm ci failed: ${install.stderr || install.stdout}`);
  }

  const port = 31841;
  const environment = {
    ...process.env,
    APP_ENV: "production",
    PORT: String(port),
    WEB_URL: "https://hub.example.com",
    DATABASE_URL:
      "postgresql://postgres:postgres@db.example.supabase.co:5432/postgres",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "test-placeholder",
    SUPABASE_SECRET_KEY: "test-placeholder",
    JWT_SECRET: "test-jwt-secret-with-at-least-32-characters",
    INITIAL_ADMIN_EMAIL: "admin@example.com",
    THROTTLE_TTL: "60000",
    THROTTLE_LIMIT: "120",
    TRUST_PROXY: "true",
  };
  const child = spawn(nodeCommand, ["app.js"], {
    cwd: runtimeRoot,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", appendOutput);
  child.stderr.on("data", appendOutput);
  const exitPromise = waitForExit(child, 30000);
  const healthUrl = `http://127.0.0.1:${port}/api/v1/health`;
  await waitForHealth(healthUrl, 15000);

  const allowed = await fetch(healthUrl, {
    headers: {
      Origin: "https://hub.example.com",
      "X-Request-Id": "cpanel-node22-smoke",
    },
  });
  const body = await allowed.json();
  if (
    allowed.status !== 200 ||
    body.status !== "ok" ||
    body.service !== "pgs-hub-api" ||
    allowed.headers.get("x-request-id") !== "cpanel-node22-smoke" ||
    allowed.headers.get("access-control-allow-origin") !==
      "https://hub.example.com"
  ) {
    throw new Error(
      "Packaged API health, request ID, or allowed CORS smoke failed",
    );
  }

  const unauthenticatedAuth = await fetch(
    `http://127.0.0.1:${port}/api/v1/auth/me`,
  );
  const unauthenticatedAuthBody = await unauthenticatedAuth.json();
  if (
    unauthenticatedAuth.status !== 401 ||
    unauthenticatedAuthBody.statusCode !== 401 ||
    unauthenticatedAuthBody.code !== "UNAUTHORIZED"
  ) {
    throw new Error(
      "Packaged API unauthenticated auth smoke did not return 401 UNAUTHORIZED",
    );
  }

  const rejected = await fetch(healthUrl, {
    headers: { Origin: "https://evil.example.com" },
  });
  const rejectedBody = await rejected.json();
  if (
    rejected.status !== 403 ||
    rejectedBody.statusCode !== 403 ||
    rejectedBody.code !== "CORS_ORIGIN_DENIED" ||
    typeof rejectedBody.message !== "string" ||
    /stack|node_modules|\\\\/i.test(JSON.stringify(rejectedBody)) ||
    rejected.headers.get("access-control-allow-origin") ===
      "https://evil.example.com"
  ) {
    throw new Error(
      "Production CORS did not return the expected sanitized rejection",
    );
  }

  child.kill("SIGTERM");
  const exited = await exitPromise;
  if (exited.code !== 0 && exited.signal !== "SIGTERM") {
    throw new Error(
      `Packaged API did not shut down cleanly: ${JSON.stringify(exited)}\n${output}`,
    );
  }
  console.log("NODE_22_STARTUP=PASS");
  console.log("HEALTH=PASS");
  console.log("REQUEST_ID=PASS");
  console.log("AUTH=PASS");
  console.log("CORS=PASS");
  console.log("SIGTERM=PASS");

  expectFailFast("MISSING_SUPABASE_SECRET_KEY", (env) => {
    delete env.SUPABASE_SECRET_KEY;
  });
  expectFailFast("MISSING_DATABASE_URL", (env) => {
    delete env.DATABASE_URL;
  });
  expectFailFast("MISSING_JWT_SECRET", (env) => {
    delete env.JWT_SECRET;
  });
  expectFailFast("INVALID_WEB_URL", (env) => {
    env.WEB_URL = "not-a-url";
  });
  expectFailFast("INVALID_INITIAL_ADMIN_EMAIL", (env) => {
    env.INITIAL_ADMIN_EMAIL = "not-an-email";
  });
  expectFailFast("INVALID_PORT", (env) => {
    env.PORT = "70000";
  });
  expectFailFast("INVALID_THROTTLE_LIMIT", (env) => {
    env.THROTTLE_LIMIT = "0";
  });
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
