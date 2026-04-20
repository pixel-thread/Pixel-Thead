import { Hono } from "hono";
import { authMiddleware } from "@features/auth/middleware/clerk.middleware";
import { zValidator } from "@hono/zod-validator";
import { createOrderSchema } from "@features/payments/validators/createOrder.schema";
import { verifyPaymentSchema } from "@features/payments/validators/verifyPayment.schema";
import { orderService } from "@features/payments/services/order.service";
import { verifyService } from "@features/payments/services/verify.service";
import { orderRepository } from "@features/payments/repositories/order.repository";
import { ApiResponse } from "@utils/response.util";
import { HonoVariables } from "@/shared/types/hono.types";

const paymentRoutes = new Hono<{ Variables: HonoVariables }>();

// POST /payments/create-order
paymentRoutes.post(
  "/create-order",
  authMiddleware,
  zValidator("json", createOrderSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");

    const result = await orderService.createOrder({
      ...body,
      userId: user.userId,
    });
    if (!result.success)
      return c.json(ApiResponse.error(result.error), 400);
    return c.json(ApiResponse.success(result.data), 201);
  },
);

// POST /payments/verify
paymentRoutes.post(
  "/verify",
  authMiddleware,
  zValidator("json", verifyPaymentSchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await verifyService.verifyPayment(body);
    if (!result.success)
      return c.json(ApiResponse.error(result.error), 400);
    return c.json(ApiResponse.success(result.data), 200);
  },
);

// GET /payments/orders
paymentRoutes.get("/orders", authMiddleware, async (c) => {
  const user = c.get("user");
  const app = c.req.query("app");
  const status = c.req.query("status");
  const limit = Number(c.req.query("limit") ?? 20);
  const offset = Number(c.req.query("offset") ?? 0);

  const orders = await orderRepository.findByUser({
    userId: user.userId,
    app,
    status,
    limit,
    offset,
  });
  return c.json(ApiResponse.success(orders));
});

export default paymentRoutes;
