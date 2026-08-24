import { z } from 'zod';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function parseInteger(value: unknown): unknown {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  return value;
}

function isLoopbackUrl(value: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    APP_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z
      .preprocess(
        parseInteger,
        z.number().int().min(1).max(65535, 'PORT must be a valid TCP port'),
      )
      .default(3001),
    WEB_URL: z
      .string()
      .url('WEB_URL must be a valid URL (e.g., http://localhost:3000)'),
    SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
    SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .trim()
      .min(1, 'SUPABASE_PUBLISHABLE_KEY is required'),
    SUPABASE_SECRET_KEY: z
      .string()
      .trim()
      .min(1, 'SUPABASE_SECRET_KEY is required'),
    INITIAL_ADMIN_EMAIL: z
      .string()
      .email('INITIAL_ADMIN_EMAIL must be a valid email address'),
    THROTTLE_TTL: z
      .preprocess(
        (val) => (val !== undefined && val !== '' ? parseInteger(val) : 60000),
        z.number().int().positive(),
      )
      .default(60000),
    THROTTLE_LIMIT: z
      .preprocess(
        (val) => (val !== undefined && val !== '' ? parseInteger(val) : 120),
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
      if (val === undefined || val === '') return undefined;
      return val;
    }, z.boolean().optional()),
    CALENDARIFIC_API_KEY: z.string().optional(),
  })
  .superRefine((config, context) => {
    if (config.APP_ENV !== 'test') {
      return;
    }

    for (const [key, value] of [
      ['SUPABASE_URL', config.SUPABASE_URL],
      ['WEB_URL', config.WEB_URL],
    ] as const) {
      if (!isLoopbackUrl(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must use a loopback URL when APP_ENV=test`,
        });
      }
    }
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
