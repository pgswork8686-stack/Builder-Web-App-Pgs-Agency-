import { z } from 'zod';

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .preprocess((val) => parseInt(val as string, 10), z.number())
    .default(3001),
  WEB_URL: z
    .string()
    .url('WEB_URL must be a valid URL (e.g., http://localhost:3000)'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'SUPABASE_PUBLISHABLE_KEY is required'),
  SUPABASE_SECRET_KEY: z.string().min(1, 'SUPABASE_SECRET_KEY is required'),
  INITIAL_ADMIN_EMAIL: z
    .string()
    .email('INITIAL_ADMIN_EMAIL must be a valid email address'),
  THROTTLE_TTL: z
    .preprocess(
      (val) =>
        val !== undefined && val !== '' ? parseInt(val as string, 10) : 60000,
      z.number().int().positive(),
    )
    .default(60000),
  THROTTLE_LIMIT: z
    .preprocess(
      (val) =>
        val !== undefined && val !== '' ? parseInt(val as string, 10) : 120,
      z.number().int().positive(),
    )
    .default(120),
  TRUST_PROXY: z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    if (typeof val === 'boolean') return val;
    return undefined;
  }, z.boolean().optional()),
  CALENDARIFIC_API_KEY: z.string().optional(),
});

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => {
        const path = err.path.join('.');
        // Do not include the actual value in logs to prevent secret leak
        return `- Environment variable "${path}": ${err.message}`;
      })
      .join('\n');

    throw new Error(
      `\n=== ENVIRONMENT VALIDATION FAILED ===\n${errors}\n=====================================`,
    );
  }

  return result.data;
}
