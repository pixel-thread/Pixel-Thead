import { cors } from "hono/cors";
import { env } from "../config/env";

export const corsMiddleware = cors({
  origin: env.ALLOWED_ORIGINS,
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
  credentials: true,
});
