export interface WebhookEvent {
  event: string;
  account_id: string;
  contains: string[];
  created_at: number;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        method: string;
        notes: Record<string, string>;
        created_at: number;
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
        amount: number;
        currency: string;
        notes: Record<string, string>;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        amount_paid: number;
        amount_due: number;
        currency: string;
        status: string;
      };
    };
  };
}
