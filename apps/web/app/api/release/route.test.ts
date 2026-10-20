import { describe, expect, it } from "vitest";
import { GET, resolveWebRelease } from "./route";

const SHA = "d88c750fc3e94f04ad69569f9b85f4ef8b05d0ca";

describe("web release endpoint", () => {
  it("uses RELEASE_SHA first, then the Vercel commit SHA", () => {
    expect(
      resolveWebRelease({
        RELEASE_SHA: SHA,
        VERCEL_GIT_COMMIT_SHA: "abcdef1",
      } as never).release.sha,
    ).toBe(SHA);
    expect(
      resolveWebRelease({ VERCEL_GIT_COMMIT_SHA: "abcdef1" } as never).release
        .sha,
    ).toBe("abcdef1");
  });

  it("reports unknown instead of leaking a non-SHA value", () => {
    const result = resolveWebRelease({
      RELEASE_SHA: "token=secret",
      BUILD_TIME: "not a date",
    } as never);
    expect(result.release).toEqual({ sha: "unknown", builtAt: null });
  });

  it("answers GET without caching", async () => {
    const response = GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.service).toBe("pgs-hub-web");
  });
});
