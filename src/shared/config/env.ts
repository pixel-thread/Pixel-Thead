import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SERVICE_BASE_URL: z.string().url(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  DIRECT_URL: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  RAZORPAY_BASE_URL: z.string().url().default("https://api.razorpay.com/v1"),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_JWT_ISSUER: z.string().url(),

  ALLOWED_ORIGINS: z.string().transform((s) => s.split(",")),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and exports environment variables.
 * Using an IIFE ensures 'env' is strictly defined or the process terminates.
 */
export const env = (() => {
  try {
    return envSchema.parse(process.env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const { fieldErrors } = err.flatten();
      const errorMessage = Object.entries(fieldErrors)
        .map(([field, errors]) => `  - ${field}: ${errors?.join(", ")}`)
        .join("\n");
      
      console.error(`\n❌ MISSING ENVIRONMENT VARIABLES:\n${errorMessage}\n`);
      console.error("Please ensure these are set in Vercel Dashboard Settings > Environment Variables.");
    } else {
      console.error("\n❌ UNKNOWN ERROR DURING ENVIRONMENT VALIDATION:", err);
    }
    // We still re-throw to prevent the app from running in an invalid state,
    // but the error message is now in the logs.
    throw new Error("Invalid project configuration. Check Vercel logs for details.");
  }
})();
