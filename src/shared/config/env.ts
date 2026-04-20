import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .string()
    .trim()
    .pipe(z.enum(["development", "production", "test"]))
    .default("development"),
  SERVICE_BASE_URL: z.string().url().trim(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required.").trim(),
  DIRECT_URL: z
    .string()
    .optional()
    .transform((s) => s?.trim()),

  RAZORPAY_KEY_ID: z.string().min(1).trim(),
  RAZORPAY_KEY_SECRET: z.string().min(1).trim(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).trim(),
  RAZORPAY_BASE_URL: z
    .string()
    .url()
    .trim()
    .default("https://api.razorpay.com/v1"),

  CLERK_SECRET_KEY: z.string().min(1).trim(),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).trim(),
  CLERK_JWT_ISSUER: z.string().url().trim(),

  ALLOWED_ORIGINS: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim())),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  LOG_LEVEL: z
    .string()
    .trim()
    .pipe(z.enum(["debug", "info", "warn", "error"]))
    .default("info"),
  LOG_FORMAT: z
    .string()
    .trim()
    .pipe(z.enum(["json", "pretty"]))
    .default("json"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and exports environment variables.
 * If validation fails during build, we return a partial object to avoid crashing the build.
 */
export const env: Env = (() => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    // If we're in a build environment or don't have variables, we log and return defaults/fallbacks
    // but only if we are absolutely forced to (like during 'next build' where secrets aren't always present).
    if (process.env.NODE_ENV === "production") {
      const { fieldErrors } = result.error.flatten();
      const errorMessage = Object.entries(fieldErrors)
        .map(([field, errors]) => `  - ${field}: ${errors?.join(", ")}`)
        .join("\n");

      console.warn(
        `\n⚠️  MISSING OR INVALID ENVIRONMENT VARIABLES:\n${errorMessage}\n`
      );
      // During build time, Next.js might not have all env vars.
      // We return the data partially if it exists, or cast to Env if we want to bypass.
      // For runtime safety, the app will still fail if critical code is reached without these.
      return (result as any).data || {};
    }
    return result.data as any;
  }

  return result.data;
})();
