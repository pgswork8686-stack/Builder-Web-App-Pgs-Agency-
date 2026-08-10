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
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'SUPABASE_PUBLISHABLE_KEY is required'),
  SUPABASE_SECRET_KEY: z.string().min(1, 'SUPABASE_SECRET_KEY is required'),
  INITIAL_ADMIN_EMAIL: z.string().email().default('pgsword6868@gmail.com'),
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
