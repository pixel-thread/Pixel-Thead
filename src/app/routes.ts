import { Hono } from "hono";
import { authRoutes } from "@features/auth";
import { webhookRoutes } from "@features/webhook";
import { paymentRoutes } from "@features/payments";
import { HonoVariables } from "@/shared/types/hono.types";


export function registerRoutes(app: Hono<{ Variables: HonoVariables }>) {
  app.route("/auth", authRoutes);
  app.route("/payments", paymentRoutes);
  app.route("/webhook", webhookRoutes);

  // Health check — used by load balancers and uptime monitors
  app.get("/health", (c) =>
    c.json({ status: "ok", timestamp: new Date().toISOString() }),
  );
}
