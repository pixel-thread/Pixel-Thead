import { Hono } from "hono";
import app from "./app/index";

/**
 * Vercel Entry Point
 * Vercel specifically looks for an 'export default' of a Hono instance.
 */
export default app;

/**
 * Local Development Entry Point
 * Only starts the Node.js server if we're not running in a Vercel/Serverless environment.
 */
if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
  import("./app/server").then(({ startServer }) => {
    startServer(app);
  });
}
