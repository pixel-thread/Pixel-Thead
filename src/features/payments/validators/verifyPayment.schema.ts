import { z } from "zod";

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required."),
  paymentId: z.string().min(1, "Payment ID is required."),
  signature: z.string().min(1, "Signature is required."),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
