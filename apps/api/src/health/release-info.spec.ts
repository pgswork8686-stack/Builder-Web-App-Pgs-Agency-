import { resolveReleaseInfo } from './release-info';

const SHA = 'd88c750fc3e94f04ad69569f9b85f4ef8b05d0ca';
const none = () => null;

describe('resolveReleaseInfo', () => {
  it('prefers RELEASE_SHA over GIT_SHA and the artifact file', () => {
    expect(
      resolveReleaseInfo(
        { RELEASE_SHA: SHA, GIT_SHA: 'abcdef1' },
        () => '1234567',
      ).sha,
    ).toBe(SHA);
  });

  it('falls back to GIT_SHA, then to the cPanel artifact SOURCE_SHA', () => {
    expect(resolveReleaseInfo({ GIT_SHA: 'abcdef1' }, none).sha).toBe(
      'abcdef1',
    );
    expect(resolveReleaseInfo({}, () => SHA).sha).toBe(SHA);
  });

  it('reports unknown when no source is available', () => {
    expect(resolveReleaseInfo({}, none)).toEqual({
      sha: 'unknown',
      builtAt: null,
    });
  });

  it('never exposes a value that is not a hex SHA or an ISO timestamp', () => {
    const result = resolveReleaseInfo(
      {
        RELEASE_SHA: 'postgres://user:secret@host/db',
        BUILD_TIME: 'yesterday; rm -rf /',
      },
      none,
    );
    expect(result).toEqual({ sha: 'unknown', builtAt: null });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('accepts an ISO build time', () => {
    expect(
      resolveReleaseInfo(
        { RELEASE_SHA: SHA, BUILD_TIME: '2026-10-20T08:00:00Z' },
        none,
      ),
    ).toEqual({ sha: SHA, builtAt: '2026-10-20T08:00:00Z' });
  });
});
