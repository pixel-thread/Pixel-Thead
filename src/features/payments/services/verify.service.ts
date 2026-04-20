import { env } from "../../../shared/config/env";
import { verifyRazorpaySignature } from "../../../shared/utils/crypto.util";
import { orderRepository } from "../repositories/order.repository";
import { paymentRepository } from "../repositories/payment.repository";
import { VerifyPaymentInput } from "../validators/verifyPayment.schema";

export const verifyService = {
  async verifyPayment(input: VerifyPaymentInput) {
    const { orderId, paymentId, signature } = input;

    // Step 1: Verify HMAC signature
    const isValid = verifyRazorpaySignature(
      `${orderId}|${paymentId}`,
      signature,
      env.RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      return {
        success: false as const,
        error: "Payment signature verification failed.",
      };
    }

    // Step 2: Confirm order exists in DB
    const order = await orderRepository.findByRazorpayId(orderId);
    if (!order) {
      return { success: false as const, error: "Order not found." };
    }

    // Step 3: Persist verified payment
    const payment = await paymentRepository.create({
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
      orderId: order.id,
      signature,
      status: "VERIFIED",
      verifiedAt: new Date(),
    });

    // Step 4: Update order status to PAID
    await orderRepository.updateStatus(order.id, "PAID");

    return {
      success: true as const,
      data: {
        orderId,
        paymentId,
        verified: true,
        verifiedAt: payment.verifiedAt!.toISOString(),
      },
    };
  },
};
