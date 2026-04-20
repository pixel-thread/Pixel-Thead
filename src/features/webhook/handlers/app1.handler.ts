import { WebhookEvent } from "../types/webhook.types";

export const app1Handler = {
  async handle(eventType: string, event: WebhookEvent) {
    const payment = event.payload.payment?.entity;

    switch (eventType) {
      case "payment.captured":
        console.info(`[App1] Payment captured: ${payment?.id}`);
        // Notify App1 backend to activate subscription or credits
        // await axios.post("https://app1-backend.com/internal/activate", { paymentId: payment?.id });
        break;
      case "payment.failed":
        console.warn(`[App1] Payment failed: ${payment?.id}`);
        break;
      case "refund.processed":
        console.info(`[App1] Refund processed: ${payment?.id}`);
        break;
      default:
        console.info(`[App1] Unhandled event: ${eventType}`);
    }
  },
};
