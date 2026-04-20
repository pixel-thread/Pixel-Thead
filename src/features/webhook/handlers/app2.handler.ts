import { WebhookEvent } from "../types/webhook.types";

export const app2Handler = {
  async handle(eventType: string, event: WebhookEvent) {
    const payment = event.payload.payment?.entity;

    switch (eventType) {
      case "payment.captured":
        console.info(`[App2] Payment captured: ${payment?.id}`);
        // Notify App2 backend to activate subscription or credits
        // await axios.post("https://app2-backend.com/internal/activate", { paymentId: payment?.id });
        break;
      case "payment.failed":
        console.warn(`[App2] Payment failed: ${payment?.id}`);
        break;
      case "refund.processed":
        console.info(`[App2] Refund processed: ${payment?.id}`);
        break;
      default:
        console.info(`[App2] Unhandled event: ${eventType}`);
    }
  },
};
