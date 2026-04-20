import { Hono } from "hono";
import app from "./app/index";

/**
 * Vercel Entry Point
 */
export default app;

/**
 * Local Development Entry Point
 */
if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
  import("./app/server").then(({ startServer }) => {
    startServer(app);
  });
}
