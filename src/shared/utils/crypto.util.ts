import { createHmac } from "crypto";

/**
 * Verifies a Razorpay HMAC signature.
 *
 * @param data The raw payload or concatenated string (e.g., 'orderId|paymentId')
 * @param signature The signature to verify against
 * @param secret The Razorpay secret (key_secret or webhook_secret)
 * @returns boolean True if signature matches
 */
export const verifyRazorpaySignature = (
  data: string,
  signature: string,
  secret: string
): boolean => {
  const expectedSignature = createHmac("sha256", secret)
    .update(data)
    .digest("hex");
  return expectedSignature === signature;
};
