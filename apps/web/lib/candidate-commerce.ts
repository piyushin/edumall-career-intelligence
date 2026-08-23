import { apiRequest } from "./api";

export type CandidateReportStatus =
  | "ASSESSMENT_IN_PROGRESS"
  | "PROCESSING_SCORE"
  | "PROCESSING_REPORT"
  | "AWAITING_RELEASE"
  | "RELEASED";

export interface CandidateCommerceProduct {
  id: string;
  code: string;
  name: string;
  description: string | null;
  kind: "REPORT" | "COUNSELLING" | "REPORT_AND_COUNSELLING";
  currency: string;
  priceMinor: number;
}

export interface CandidateCheckout {
  attemptId: string;
  assessmentTitle: string;
  submittedAt: string | null;
  reportStatus: CandidateReportStatus;
  reportReleased: boolean;
  reportReleasedAt: string | null;
  commerceRequired: boolean;
  reportAccess: boolean;
  counsellingAccess: boolean;
  candidate: {
    email: string;
    firstName: string;
    lastName: string;
  };
  products: CandidateCommerceProduct[];
  entitlements: Array<{
    type: "REPORT" | "COUNSELLING";
    grantedAt: string;
    expiresAt: string | null;
    source: string;
  }>;
}

export interface CandidateOrderResult {
  id: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  paidAt: string | null;
  product: {
    code: string;
    name: string;
    kind: "REPORT" | "COUNSELLING" | "REPORT_AND_COUNSELLING";
  };
  paymentRequired: boolean;
}

export type PaymentIntent =
  | {
      gatewayConfigured: false;
      provider: "RAZORPAY";
      message: string;
    }
  | {
      gatewayConfigured: true;
      provider: "RAZORPAY";
      keyId: string;
      paymentId: string;
      orderId: string;
      gatewayOrderId: string;
      amountMinor: number;
      currency: string;
      description: string;
    };

export function getCandidateCheckout(attemptId: string): Promise<CandidateCheckout> {
  return apiRequest<CandidateCheckout>(`/commerce/attempts/${attemptId}/checkout`);
}

export function createCandidateOrder(
  attemptId: string,
  productCode: string,
  couponCode?: string,
): Promise<CandidateOrderResult> {
  return apiRequest<CandidateOrderResult>(`/commerce/attempts/${attemptId}/orders`, {
    method: "POST",
    body: JSON.stringify({
      productCode,
      ...(couponCode?.trim() ? { couponCode: couponCode.trim() } : {}),
    }),
  });
}

export function createPaymentIntent(orderId: string): Promise<PaymentIntent> {
  return apiRequest<PaymentIntent>(`/commerce/orders/${orderId}/payment-intent`, {
    method: "POST",
  });
}

export function verifyRazorpayPayment(input: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<{ status: "paid"; orderId: string }> {
  return apiRequest<{ status: "paid"; orderId: string }>("/commerce/payments/razorpay/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
