import { Hono } from "hono";
import app from "./app/index";

/**
 * Vercel Entry Point
 * Vercel uses this export to handle requests in production.
 */
export default app;

/**
 * Local Development Entry Point
 * We start the Node.js server explicitly if we're not in the real Vercel production runtime.
 * We allow startup during 'vercel dev' by checking NODE_ENV.
 */
const isRealVercelProduction = process.env.VERCEL === "1" && process.env.NODE_ENV === "production";

if (!isRealVercelProduction) {
  import("./app/server").then(({ startServer }) => {
    startServer(app);
  });
}
