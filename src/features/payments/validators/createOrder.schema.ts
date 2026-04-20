import { z } from "zod";

export const createOrderSchema = z.object({
  amount: z
    .number({ required_error: "Amount is required." })
    .min(100, "Minimum amount is Rs 1 (100 paise).")
    .int("Amount must be an integer in paise."),
  currency: z.string().default("INR"),
  app: z.enum(["web-app-1", "web-app-2", "mobile-app"], {
    errorMap: () => ({ message: "Invalid app identifier." }),
  }),
  productId: z.string().min(1, "Product ID is required."),
  receipt: z.string().max(40).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
