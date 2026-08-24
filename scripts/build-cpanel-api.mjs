import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = join(repoRoot, "apps", "api");
const distRoot = join(apiRoot, "dist");
const packagingRoot = join(repoRoot, "packaging", "cpanel-api");
const artifactsRoot = join(repoRoot, "artifacts");
const outputRoot = join(artifactsRoot, "cpanel-api");
const zipPath = join(artifactsRoot, "pgs-hub-api-cpanel.zip");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function verifyRuntimeManifest() {
  const apiPackage = readJson(join(apiRoot, "package.json"));
  const runtimePackage = readJson(join(packagingRoot, "package.json"));
  const expected = {};

  for (const name of Object.keys(apiPackage.dependencies).sort()) {
    const installedManifest = join(
      apiRoot,
      "node_modules",
      ...name.split("/"),
      "package.json",
    );
    if (!existsSync(installedManifest)) {
      throw new Error(`Missing installed runtime dependency: ${name}`);
    }
    expected[name] = readJson(installedManifest).version;
  }

  if (
    JSON.stringify(expected) !== JSON.stringify(runtimePackage.dependencies)
  ) {
    throw new Error(
      "packaging/cpanel-api/package.json is out of sync with the installed API runtime dependency versions",
    );
  }

  const lock = readJson(join(packagingRoot, "package-lock.json"));
  const lockedRoot = lock.packages?.[""]?.dependencies;
  if (JSON.stringify(expected) !== JSON.stringify(lockedRoot)) {
    throw new Error(
      "packaging/cpanel-api/package-lock.json is out of sync with the runtime manifest",
    );
  }
}

function copyRuntimeDist() {
  cpSync(distRoot, join(outputRoot, "dist"), {
    recursive: true,
    filter: (source) => {
      if (statSync(source).isDirectory()) return true;
      return source.endsWith(".js");
    },
  });
}

function listFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`Unsupported artifact entry: ${path}`);
    }
  };
  visit(root);
  return files;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createDeterministicZip(root, destination) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const path of listFiles(root)) {
    const name = relative(root, path).split(sep).join("/");
    const nameBuffer = Buffer.from(name, "utf8");
    const content = readFileSync(path);
    const compressed = content;
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 * 0x10000) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  const fileCount = centralParts.length / 2;
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(fileCount, 8);
  end.writeUInt16LE(fileCount, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  writeFileSync(
    destination,
    Buffer.concat([...localParts, centralBuffer, end]),
  );
}

function scanArtifact() {
  const forbiddenPath =
    /(^|\/)(\.env($|\.)|\.git($|\/)|backups?($|\/))|\.(dump|backup|pem|key)$/i;
  const forbiddenContent = [
    /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/,
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
    /(?:cloudflare_api_token|tunnel_token|database_password|db_password)\s*[:=]\s*["']?[A-Za-z0-9_./+-]{12,}/i,
    /SUPABASE_SECRET_KEY\s*=\s*\S+/,
  ];

  for (const path of listFiles(outputRoot)) {
    const artifactPath = relative(outputRoot, path).split(sep).join("/");
    if (forbiddenPath.test(artifactPath)) {
      throw new Error(`Forbidden artifact path: ${artifactPath}`);
    }
    const content = readFileSync(path, "utf8");
    if (forbiddenContent.some((pattern) => pattern.test(content))) {
      throw new Error(`Potential secret detected in artifact: ${artifactPath}`);
    }
  }
}

rmSync(outputRoot, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(outputRoot, { recursive: true });

if (!process.env.npm_execpath) {
  throw new Error("Run this builder through pnpm so npm_execpath is available");
}
run(process.execPath, [process.env.npm_execpath, "--filter", "api", "build"]);
if (!existsSync(join(distRoot, "main.js"))) {
  throw new Error(
    "Expected compiled entrypoint apps/api/dist/main.js was not found",
  );
}
verifyRuntimeManifest();
copyRuntimeDist();
cpSync(join(packagingRoot, "package.json"), join(outputRoot, "package.json"));
cpSync(
  join(packagingRoot, "package-lock.json"),
  join(outputRoot, "package-lock.json"),
);
writeFileSync(
  join(outputRoot, "app.js"),
  "'use strict';\n\nrequire('./dist/main.js');\n",
);

const gitResult = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (gitResult.status !== 0) throw new Error("Unable to record source Git SHA");
writeFileSync(
  join(outputRoot, "DEPLOYMENT_INFO.txt"),
  [
    "PGS HUB API - CPANEL/PASSENGER ARTIFACT",
    `SOURCE_SHA=${gitResult.stdout.trim()}`,
    "TARGET_NODE=22.23.0",
    "STARTUP_FILE=app.js",
    "INSTALL_COMMAND=npm ci --omit=dev --ignore-scripts",
    "ENTRYPOINT=dist/main.js",
    "",
  ].join("\n"),
);

scanArtifact();
createDeterministicZip(outputRoot, zipPath);
const zip = readFileSync(zipPath);
const sha256 = createHash("sha256").update(zip).digest("hex");
console.log(
  `CPANEL_ARTIFACT=${relative(repoRoot, zipPath).split(sep).join("/")}`,
);
console.log(`CPANEL_ARTIFACT_SIZE=${zip.length}`);
console.log(`CPANEL_ARTIFACT_SHA256=${sha256}`);
console.log("SECRET_SCAN=PASS");
