import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CHECKOUT_ORDER_ACTION_LABEL,
  unavailableGatewayMessage,
  type PaymentIntent,
} from "./candidate-commerce";

describe("candidate checkout launch copy", () => {
  it("gives truthful offline guidance when the runtime API reports no gateway", () => {
    const intent: PaymentIntent = {
      gatewayConfigured: false,
      provider: "RAZORPAY",
      message: "Gateway is not configured.",
    };

    const message = unavailableGatewayMessage(intent);

    expect(CHECKOUT_ORDER_ACTION_LABEL).toBe("Create Order / Apply Coupon");
    expect(message).toContain("Online payment is currently unavailable");
    expect(message).toMatch(/coupon/i);
    expect(message).toMatch(/UPI/);
    expect(message).toMatch(/bank transfer/i);
    expect(message).toMatch(/cash\/offline/i);
    expect(message).toMatch(/sponsored/i);
    expect(message).toMatch(/complimentary/i);
    expect(message).not.toMatch(/secure online payment|proceed to secure payment/i);
  });

  it("keeps the runtime gateway branch and removes misleading pre-click promises", () => {
    const component = readFileSync(
      fileURLToPath(
        new URL("../app/candidate/assessments/[attemptId]/submitted-commerce.tsx", import.meta.url),
      ),
      "utf8",
    );

    expect(component).toContain("if (!intent.gatewayConfigured)");
    expect(component).toContain("unavailableGatewayMessage(intent)");
    expect(component).toContain("new window.Razorpay");
    expect(component).not.toContain("Proceed to Secure Payment");
    expect(component).not.toContain("Online payment is verified server-side");
  });
});
