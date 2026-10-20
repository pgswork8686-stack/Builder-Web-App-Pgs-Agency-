const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const BUILT_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

export const dynamic = "force-dynamic";

export function resolveWebRelease(env: NodeJS.ProcessEnv = process.env) {
  const candidate =
    env.RELEASE_SHA?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim() || "";
  const builtAt = env.BUILD_TIME?.trim() ?? "";
  return {
    service: "pgs-hub-web",
    release: {
      sha: SHA_PATTERN.test(candidate) ? candidate : "unknown",
      builtAt: BUILT_AT_PATTERN.test(builtAt) ? builtAt : null,
    },
  };
}

// Public, read-only release identification. Exposes only a commit SHA and a
// build timestamp so a deployed web build can be matched to a Git commit.
export function GET() {
  return Response.json(resolveWebRelease(), {
    headers: { "Cache-Control": "no-store" },
  });
}
