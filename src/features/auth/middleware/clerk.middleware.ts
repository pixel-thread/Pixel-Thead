import { clerkMiddleware, getAuth } from "@clerk/hono";
import { createMiddleware } from "hono/factory";
import { ApiResponse } from "@utils/response.util";
import { HonoVariables } from "@types/hono.types";

/**
 * Clerk Authentication Middleware
 * Validates the JWT and ensures the user is authenticated before proceeding.
 */
export const authMiddleware = createMiddleware<{ Variables: HonoVariables }>(async (c, next) => {
  // 1. Run the official Clerk middleware logic
  const clerkHandler = clerkMiddleware();
  await clerkHandler(c, next);

  // 2. Check if the user is authenticated
  const auth = getAuth(c);

  if (!auth?.userId) {
    return c.json(ApiResponse.error("Unauthorized. Please provide a valid session.", 401), 401);
  }

  // 3. Populate our custom user context for downstream handlers
  c.set("user", {
    userId: auth.userId,
    sessionId: auth.sessionId ?? "unknown",
    email: null, // Basic payload from middleware; fetch via service if needed
  });

  await next();
});
