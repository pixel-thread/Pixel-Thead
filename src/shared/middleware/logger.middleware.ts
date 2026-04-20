import { createMiddleware } from "hono/factory";
import { env } from "../config/env";

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const ip = c.req.header("x-forwarded-for") ?? "unknown";

  await next();

  const log = {
    method,
    path,
    status: c.res.status,
    ms: Date.now() - start,
    ip,
    timestamp: new Date().toISOString(),
  };

  if (env.LOG_FORMAT === "json") {
    console.log(JSON.stringify(log));
  } else {
    console.log(
      `[${log.timestamp}] ${method} ${path} -> ${log.status} (${log.ms}ms)`,
    );
  }
});
