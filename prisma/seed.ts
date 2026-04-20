import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
  WebhookEventStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding development database...");

  const order = await prisma.order.create({
    data: {
      razorpayOrderId: "order_DEV_001",
      amount: 49900,
      currency: "INR",
      receipt: "rcpt_dev_001",
      status: OrderStatus.PAID,
      app: "web-app-1",
      userId: "user_dev_clerk_001",
      productId: "prod_premium_monthly",
    },
  });

  await prisma.payment.create({
    data: {
      razorpayPaymentId: "pay_DEV_001",
      razorpayOrderId: "order_DEV_001",
      orderId: order.id,
      signature: "dev_hmac_signature_hash",
      status: PaymentStatus.VERIFIED,
      verifiedAt: new Date(),
    },
  });

  await prisma.webhookEvent.create({
    data: {
      razorpayEventId: "pay_DEV_001",
      eventType: "payment.captured",
      app: "web-app-1",
      rawPayload: JSON.stringify({ event: "payment.captured", payload: {} }),
      status: WebhookEventStatus.PROCESSED,
      processedAt: new Date(),
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
