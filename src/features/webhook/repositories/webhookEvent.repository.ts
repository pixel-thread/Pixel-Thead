import { prisma } from "@db/prisma";
import { WebhookEventStatus } from "@prisma/client";

export const webhookEventRepository = {
  async create(data: {
    razorpayEventId: string;
    eventType: string;
    app: string;
    rawPayload: string;
    status: WebhookEventStatus;
  }) {
    return prisma.webhookEvent.create({ data });
  },

  async findByRazorpayEventId(razorpayEventId: string, eventType: string) {
    return prisma.webhookEvent.findFirst({
      where: {
        razorpayEventId,
        eventType,
        status: { not: "FAILED" }, // FAILED events are retryable
      },
    });
  },

  async updateStatus(id: string, status: WebhookEventStatus) {
    return prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        processedAt: status === "PROCESSED" ? new Date() : undefined,
      },
    });
  },

  async findFailed(limit = 50) {
    return prisma.webhookEvent.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  },
};
