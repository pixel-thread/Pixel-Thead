import { serve } from "@hono/node-server";
import { env } from "../shared/config/env";
import type { Hono } from "hono";

export const startServer = (app: Hono<any>) => {
  const port = env.PORT;

  console.log(`
╔══════════════════════════════════════════════════╗
║   Central Payments & Auth Service v1.1.0         ║
║   Environment: ${env.NODE_ENV.padEnd(33)}║
║   Port: ${String(port).padEnd(40)}║
╚══════════════════════════════════════════════════╝
`);

  serve({
    fetch: app.fetch,
    port,
  });
};
