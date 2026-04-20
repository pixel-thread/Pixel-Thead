import { Hono } from "hono";
import { webhookService } from "@features/webhook/services/webhook.service";
import { ApiResponse } from "@utils/response.util";

const webhookRoutes = new Hono();

// POST /webhook/razorpay
// No authMiddleware — Razorpay signs requests with HMAC instead
webhookRoutes.post("/razorpay", async (c) => {
  const rawBody = await c.req.text(); // Must be raw string BEFORE any JSON parsing
  const signature = c.req.header("x-razorpay-signature");

  if (!signature) {
    return c.json(ApiResponse.error("Missing webhook signature."), 400);
  }

  const result = await webhookService.process({ rawBody, signature });

  if (!result.success) {
    return c.json(ApiResponse.error(result.error), 400);
  }

  return c.json(ApiResponse.success(null), 200);
});

export default webhookRoutes;
