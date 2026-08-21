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
});
