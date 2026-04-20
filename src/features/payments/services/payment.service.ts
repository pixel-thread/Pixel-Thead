import { prisma } from "@/shared/db/prisma";
import { NotFoundError } from "@/shared/lib/errors";

export const PaymentService = {
  async getOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    return order;
  },
};
