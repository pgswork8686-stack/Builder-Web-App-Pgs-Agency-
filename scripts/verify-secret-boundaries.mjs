import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

const checks = [
  {
    path: "supabase/config.toml",
    forbidden: [
      /secret\s*=\s*"(?!env\()[^"]+"/i,
      /GOCSPX-[A-Za-z0-9_-]+/,
    ],
  },
  {
    path: "apps/web/.env.example",
    forbidden: [/SUPABASE_SECRET_KEY/i, /service_role/i, /sb_secret_/i],
  },
];

for (const check of checks) {
  const source = readFileSync(resolve(repoRoot, check.path), "utf8");
  for (const pattern of check.forbidden) {
    if (pattern.test(source)) {
      throw new Error(`Secret boundary violation in ${check.path}`);
    }
  }
}

console.log("SECRET_BOUNDARIES=PASS");
