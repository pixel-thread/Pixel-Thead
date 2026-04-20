import { WebhookEvent } from "../types/webhook.types";
import { orderRepository } from "../../payments/repositories/order.repository";
import { app1Handler } from "../handlers/app1.handler";
import { app2Handler } from "../handlers/app2.handler";

export const routerService = {
  async route(event: WebhookEvent) {
    const payment = event.payload.payment?.entity;
    const app = payment?.notes?.app;
    const eventType = event.event;

    // Sync order status in DB on key payment events
    if (payment?.order_id) {
      if (eventType === "payment.captured") {
        await orderRepository.syncOrderStatus(payment.order_id, "PAID");
      }
      if (eventType === "payment.failed") {
        await orderRepository.syncOrderStatus(payment.order_id, "FAILED");
      }
    }

    // Dispatch to per-app handler
    switch (app) {
      case "web-app-1":
        return app1Handler.handle(eventType, event);
      case "web-app-2":
        return app2Handler.handle(eventType, event);
      case "mobile-app":
        // Mobile app handler — future implementation
        break;
      default:
        console.warn(`[Router] Unknown app in notes: "${app}"`);
    }
  },
};
