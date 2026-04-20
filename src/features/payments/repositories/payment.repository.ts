import { prisma } from "@db/prisma";
import { PaymentStatus } from "@db/generated";

export const paymentRepository = {
  async create(data: {
    razorpayPaymentId: string;
    razorpayOrderId: string;
    orderId: string;
    signature: string;
    status: PaymentStatus;
    verifiedAt: Date;
  }) {
    return prisma.payment.create({ data });
  },

  async findByRazorpayPaymentId(razorpayPaymentId: string) {
    return prisma.payment.findUnique({ where: { razorpayPaymentId } });
  },

  async findByOrderId(orderId: string) {
    return prisma.payment.findUnique({ where: { orderId } });
  },
};
