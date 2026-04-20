import { axiosClient } from "../../../shared/api/axios";
import { orderRepository } from "../repositories/order.repository";
import { CreateOrderInput } from "../validators/createOrder.schema";
import { RazorpayOrder } from "../types/payments.types";

export const orderService = {
  async createOrder(input: CreateOrderInput & { userId: string }) {
    try {
      // Step 1: Create order in Razorpay
      const { data } = await axiosClient.post<RazorpayOrder>("/orders", {
        amount: input.amount,
        currency: input.currency ?? "INR",
        receipt: input.receipt ?? `rcpt_${Date.now()}`,
        notes: {
          app: input.app,
          userId: input.userId,
          productId: input.productId,
        },
      });

      // Step 2: Persist order to DB
      await orderRepository.create({
        razorpayOrderId: data.id,
        amount: data.amount,
        currency: data.currency,
        receipt: data.receipt,
        status: "CREATED",
        app: input.app,
        userId: input.userId,
        productId: input.productId,
      });

      return {
        success: true as const,
        data: {
          orderId: data.id,
          amount: data.amount,
          currency: data.currency,
          receipt: data.receipt,
        },
      };
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.description ?? "Failed to create order.";
      return { success: false as const, error: message };
    }
  },
};
