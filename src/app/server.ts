import { serve } from "@hono/node-server";
import app from "./index";
import { env } from "../shared/config/env";

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
