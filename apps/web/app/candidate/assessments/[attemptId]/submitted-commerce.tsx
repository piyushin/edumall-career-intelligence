"use client";

import { useEffect, useState } from "react";
import { ApiError } from "../../../../lib/api";
import {
  CHECKOUT_ORDER_ACTION_LABEL,
  createCandidateOrder,
  createPaymentIntent,
  getCandidateCheckout,
  type CandidateCheckout,
  unavailableGatewayMessage,
  verifyRazorpayPayment,
} from "../../../../lib/candidate-commerce";
import { downloadCandidateReleasedReportPdf } from "../../../../lib/candidate-assessments";

type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open(): void;
};

type RazorpayConstructor = new (options: {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayResult) => void;
}) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

function formatMoney(currency: string, minor: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Unable to load payment gateway.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load payment gateway."));
    document.body.appendChild(script);
  });
}

export function SubmittedCommerce({ attemptId, title }: { attemptId: string; title: string }) {
  const [checkout, setCheckout] = useState<CandidateCheckout | null>(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");

    try {
      const data = await getCandidateCheckout(attemptId);
      setCheckout(data);

      if (!selectedProduct && data.products[0]) {
        setSelectedProduct(data.products[0].code);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to load your result status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [attemptId]);

  async function downloadReport() {
    setDownloading(true);
    setError("");

    try {
      const { blob, filename } = await downloadCandidateReleasedReportPdf(attemptId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to download your report.");
    } finally {
      setDownloading(false);
    }
  }

  async function completeRazorpayPayment(orderId: string, response: RazorpayResult) {
    setWorking(true);
    setError("");

    try {
      await verifyRazorpayPayment({
        orderId,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      });

      setMessage("Payment successful. Your access has been unlocked.");
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Payment verification failed.");
    } finally {
      setWorking(false);
    }
  }

  async function purchase() {
    if (!selectedProduct) {
      setError("Please select a report package.");
      return;
    }

    setWorking(true);
    setMessage("");
    setError("");

    try {
      const order = await createCandidateOrder(attemptId, selectedProduct, couponCode);

      if (!order.paymentRequired || order.status === "PAID") {
        setMessage(
          order.discountMinor > 0
            ? "Coupon accepted. Your access has been unlocked."
            : "Your access has been unlocked.",
        );
        await load();
        return;
      }

      const intent = await createPaymentIntent(order.id);

      if (!intent.gatewayConfigured) {
        setMessage(unavailableGatewayMessage(intent));
        return;
      }

      await loadRazorpayScript();

      if (!window.Razorpay) {
        throw new Error("Payment gateway could not be loaded.");
      }

      const razorpay = new window.Razorpay({
        key: intent.keyId,
        amount: intent.amountMinor,
        currency: intent.currency,
        name: "The EduMall",
        description: intent.description,
        order_id: intent.gatewayOrderId,
        ...(checkout
          ? {
              prefill: {
                name: `${checkout.candidate.firstName} ${checkout.candidate.lastName}`.trim(),
                email: checkout.candidate.email,
              },
            }
          : {}),
        theme: {
          color: "#dc2626",
        },
        handler: (response) => {
          void completeRazorpayPayment(order.id, response);
        },
      });

      razorpay.open();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Unable to continue checkout.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          Loading your Career Intelligence result status...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <section className="overflow-hidden rounded-[32px] border border-emerald-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-7 py-8 text-white sm:px-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-xl">
            ✓
          </div>
          <h1 className="mt-5 text-3xl font-black">Assessment completed successfully</h1>
          <p className="mt-3 max-w-3xl leading-7 text-emerald-50">
            Your responses for <strong>{title}</strong> have been securely submitted. Your Career
            Intelligence profile is now moving through scoring, interpretation and report
            processing.
          </p>
        </div>

        <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-red-600">
              Your result status
            </p>

            <h2 className="mt-3 text-2xl font-black text-slate-950">
              {checkout?.reportStatus === "RELEASED"
                ? "Your report has been released"
                : checkout?.reportStatus === "AWAITING_RELEASE"
                  ? "Your report is prepared and awaiting release"
                  : checkout?.reportStatus === "PROCESSING_REPORT"
                    ? "Your Career Intelligence report is being prepared"
                    : "Your assessment is being scored"}
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-600">
              Payment or a valid organisation coupon gives you commercial access to the report. It
              does not alter your assessment score or bypass the governed report-generation process.
            </p>

            {checkout?.reportAccess ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="font-black text-emerald-900">Report access unlocked</p>
                <p className="mt-2 text-sm leading-6 text-emerald-800">
                  {checkout.reportReleased
                    ? "Your detailed Career Intelligence report is available now."
                    : "Your access is confirmed. The report will become downloadable as soon as the governed report is released."}
                </p>

                {checkout.reportReleased ? (
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => void downloadReport()}
                    className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    {downloading ? "Preparing report..." : "Download My Career Intelligence Report"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {checkout?.counsellingAccess ? (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="font-black text-blue-900">Expert counselling included</p>
                <p className="mt-2 text-sm leading-6 text-blue-800">
                  Your account includes a counselling entitlement. Appointment scheduling will be
                  connected to this entitlement in the counselling module.
                </p>
              </div>
            ) : null}

            {message ? (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                {message}
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
              >
                {error}
              </div>
            ) : null}
          </div>

          {checkout?.commerceRequired && !checkout.reportAccess ? (
            <div className="rounded-3xl border border-orange-200 bg-[#fffaf6] p-6">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-700">
                Unlock your result
              </p>
              <h2 className="mt-3 text-2xl font-black text-slate-950">
                Choose your Career Intelligence package
              </h2>

              <div className="mt-6 space-y-3">
                {checkout.products.map((product) => (
                  <label
                    key={product.id}
                    className={`block cursor-pointer rounded-2xl border p-4 ${
                      selectedProduct === product.code
                        ? "border-red-400 bg-red-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="commerce-product"
                        checked={selectedProduct === product.code}
                        onChange={() => setSelectedProduct(product.code)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <span className="font-black text-slate-900">{product.name}</span>
                          <span className="whitespace-nowrap font-black text-red-600">
                            {formatMoney(product.currency, product.priceMinor)}
                          </span>
                        </div>
                        {product.description ? (
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {product.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-6">
                <label htmlFor="coupon-code" className="text-sm font-black text-slate-800">
                  Have an organisation / EduMall coupon?
                </label>
                <input
                  id="coupon-code"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  placeholder="ENTER COUPON CODE"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold uppercase outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <button
                type="button"
                disabled={working || checkout.products.length === 0}
                onClick={() => void purchase()}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3.5 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working ? "Please wait..." : CHECKOUT_ORDER_ACTION_LABEL}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                Create your order to apply an eligible coupon or continue with the payment options
                currently available for your account.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                What happens next?
              </p>
              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
                <p>✓ Assessment responses securely submitted</p>
                <p>✓ Deterministic scoring pipeline</p>
                <p>✓ Career Intelligence interpretation</p>
                <p>✓ CareerFit directions</p>
                <p>✓ Governed report release</p>
                <p>✓ Counselling option when included</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
