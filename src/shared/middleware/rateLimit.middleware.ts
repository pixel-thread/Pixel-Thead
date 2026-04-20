import { createMiddleware } from "hono/factory";
import { env } from "../config/env";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip = c.req.header("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, {
      count: 1,
      resetAt: now + env.RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }

  if (entry.count >= env.RATE_LIMIT_MAX_REQUESTS) {
    return c.json(
      { success: false, error: "Too many requests. Please slow down." },
      429,
    );
  }

  entry.count++;
  return next();
});
