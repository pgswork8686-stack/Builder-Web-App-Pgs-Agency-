import { validateEnv } from './env.validation';

const safeTestConfig = {
  APP_ENV: 'test',
  PORT: '3001',
  WEB_URL: 'http://localhost:3000',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
  SUPABASE_SECRET_KEY: 'test-secret-key',
  INITIAL_ADMIN_EMAIL: 'admin@test.local',
};

describe('validateEnv', () => {
  it('accepts a fully local test configuration', () => {
    expect(validateEnv(safeTestConfig)).toMatchObject({
      APP_ENV: 'test',
      SUPABASE_URL: 'http://127.0.0.1:54321',
    });
  });

  it('rejects a hosted Supabase endpoint during test runs', () => {
    expect(() =>
      validateEnv({
        ...safeTestConfig,
        SUPABASE_URL: 'https://test-project.supabase.co',
      }),
    ).toThrow('SUPABASE_URL must use a loopback URL when APP_ENV=test');
  });

  it('rejects a non-local browser origin during test runs', () => {
    expect(() =>
      validateEnv({ ...safeTestConfig, WEB_URL: 'https://example.com' }),
    ).toThrow('WEB_URL must use a loopback URL when APP_ENV=test');
  });

  it.each(['0', '65536', '3001junk', '-1'])(
    'rejects invalid TCP port %s',
    (port) => {
      expect(() => validateEnv({ ...safeTestConfig, PORT: port })).toThrow(
        'ENVIRONMENT VALIDATION FAILED',
      );
    },
  );

  it.each(['0', '-1', '1.5', '120requests'])(
    'rejects invalid throttle limit %s',
    (limit) => {
      expect(() =>
        validateEnv({ ...safeTestConfig, THROTTLE_LIMIT: limit }),
      ).toThrow('ENVIRONMENT VALIDATION FAILED');
    },
  );

  it('rejects an invalid proxy boolean instead of silently defaulting it', () => {
    expect(() =>
      validateEnv({ ...safeTestConfig, TRUST_PROXY: 'yes' }),
    ).toThrow('ENVIRONMENT VALIDATION FAILED');
  });

  it('never includes supplied secret values in validation errors', () => {
    const suppliedSecret = 'must-never-appear-in-errors';

    try {
      validateEnv({
        ...safeTestConfig,
        SUPABASE_SECRET_KEY: suppliedSecret,
        WEB_URL: 'not-a-url',
      });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(String(error)).not.toContain(suppliedSecret);
    }
  });
});
