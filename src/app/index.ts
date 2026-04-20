import { Hono } from "hono";
import { corsMiddleware } from "@middleware/cors.middleware";
import { loggerMiddleware } from "@middleware/logger.middleware";
import { rateLimitMiddleware } from "@middleware/rateLimit.middleware";
import { registerErrorHandlers } from "@middleware/error.middleware";
import { registerRoutes } from "./routes";
import { HonoVariables } from "@/shared/types/hono.types";

const app = new Hono<{ Variables: HonoVariables }>();

// ── Middleware Registration (order matters) ──────────────────
app.use("*", corsMiddleware); // 1. CORS headers
app.use("*", loggerMiddleware); // 2. Log every request
app.use("*", rateLimitMiddleware); // 3. Rate limit

// ── Route Registration ──────────────────────────────────────
const api = new Hono<{ Variables: HonoVariables }>();
registerRoutes(api);

// Mount the API sub-router
app.route("/api", api);

// ── Error Handlers (must be last) ───────────────────────────
registerErrorHandlers(app);
registerErrorHandlers(api); // Also handle errors within the sub-router

export default app;
