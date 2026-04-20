export interface RazorpayOrder {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  notes: Record<string, string>;
  created_at: number;
}

export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  receipt: string;
}

export interface VerifyPaymentResponse {
  orderId: string;
  paymentId: string;
  verified: boolean;
  verifiedAt: string;
}
