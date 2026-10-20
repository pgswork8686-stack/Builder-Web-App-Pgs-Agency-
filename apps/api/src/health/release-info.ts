import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ReleaseInfo {
  sha: string;
  builtAt: string | null;
}

const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const BUILT_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

function readDeploymentInfoSha(): string | null {
  // The cPanel artifact (scripts/build-cpanel-api.mjs) writes SOURCE_SHA next
  // to app.js, one directory above the compiled dist/ folder.
  for (const candidate of [
    join(__dirname, '..', '..', 'DEPLOYMENT_INFO.txt'),
    join(process.cwd(), 'DEPLOYMENT_INFO.txt'),
  ]) {
    try {
      const match = /^SOURCE_SHA=(.+)$/m.exec(readFileSync(candidate, 'utf8'));
      if (match) return match[1].trim();
    } catch {
      // file not present in this runtime; try the next source
    }
  }
  return null;
}

/**
 * Identifies the build that is actually running. Only a hex commit SHA and an
 * ISO build timestamp are ever exposed; anything else is reported as unknown so
 * a misconfigured variable can never leak internal text.
 */
export function resolveReleaseInfo(
  env: NodeJS.ProcessEnv = process.env,
  readFromArtifact: () => string | null = readDeploymentInfoSha,
): ReleaseInfo {
  const candidate =
    env.RELEASE_SHA?.trim() || env.GIT_SHA?.trim() || readFromArtifact();
  const builtAt = env.BUILD_TIME?.trim();
  return {
    sha: candidate && SHA_PATTERN.test(candidate) ? candidate : 'unknown',
    builtAt: builtAt && BUILT_AT_PATTERN.test(builtAt) ? builtAt : null,
  };
}
