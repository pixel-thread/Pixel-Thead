import { env } from "../../../shared/config/env";
import { verifyRazorpaySignature } from "../../../shared/utils/crypto.util";
import { routerService } from "./router.service";
import { webhookEventRepository } from "../repositories/webhookEvent.repository";
import { WebhookEvent } from "../types/webhook.types";

export const webhookService = {
  async process({
    rawBody,
    signature,
  }: {
    rawBody: string;
    signature: string;
  }) {
    // Step 1: Verify signature BEFORE touching DB
    const isValid = verifyRazorpaySignature(
      rawBody,
      signature,
      env.RAZORPAY_WEBHOOK_SECRET
    );

    if (!isValid) {
      console.warn("[Webhook] Signature mismatch — possible spoofed request.");
      return { success: false as const, error: "Invalid webhook signature." };
    }

    // Step 2: Parse payload
    let event: WebhookEvent;
    try {
      event = JSON.parse(rawBody) as WebhookEvent;
    } catch {
      return { success: false as const, error: "Malformed JSON payload." };
    }

    const razorpayEventId =
      event.payload.payment?.entity?.id ?? `${event.event}_${event.created_at}`;
    const eventType = event.event;
    const app = event.payload.payment?.entity?.notes?.app ?? "unknown";

    // Step 3: DB-backed idempotency check
    const existing = await webhookEventRepository.findByRazorpayEventId(
      razorpayEventId,
      eventType,
    );
    if (existing) {
      console.info(
        `[Webhook] Duplicate skipped: ${eventType} / ${razorpayEventId}`,
      );
      return { success: true as const };
    }

    // Step 4: Persist as RECEIVED before processing
    const webhookRecord = await webhookEventRepository.create({
      razorpayEventId,
      eventType,
      app,
      rawPayload: rawBody,
      status: "RECEIVED",
    });

    // Step 5: Route and process
    try {
      await routerService.route(event);
      await webhookEventRepository.updateStatus(webhookRecord.id, "PROCESSED");
    } catch (err) {
      console.error("[Webhook] Processing error:", err);
      await webhookEventRepository.updateStatus(webhookRecord.id, "FAILED");
      // Do NOT rethrow — avoids 500 -> Razorpay retry loop
    }

    return { success: true as const };
  },


};
