import { prisma } from "@db/prisma";
import { OrderStatus } from "@db/generated";

export const orderRepository = {
  async create(data: {
    razorpayOrderId: string;
    amount: number;
    currency: string;
    receipt: string;
    status: OrderStatus;
    app: string;
    userId: string;
    productId: string;
  }) {
    return prisma.order.create({ data });
  },

  async findByRazorpayId(razorpayOrderId: string) {
    return prisma.order.findUnique({ where: { razorpayOrderId } });
  },

  async updateStatus(id: string, status: OrderStatus) {
    return prisma.order.update({ where: { id }, data: { status } });
  },

  async findByUser(params: {
    userId: string;
    app?: string;
    status?: string;
    limit: number;
    offset: number;
  }) {
    return prisma.order.findMany({
      where: {
        userId: params.userId,
        ...(params.app ? { app: params.app } : {}),
        ...(params.status ? { status: params.status as OrderStatus } : {}),
      },
      include: { payment: true },
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip: params.offset,
    });
  },

  async syncOrderStatus(razorpayOrderId: string, status: OrderStatus) {
    const order = await this.findByRazorpayId(razorpayOrderId);
    if (!order) return null;
    return this.updateStatus(order.id, status);
  },
};
