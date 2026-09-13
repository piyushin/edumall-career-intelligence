# R20-C2a Verification

## Scope delivered

R20-C2a is the commerce backend core beneath the remaining C2 UI and self-service work. It adds one additive migration (`20260913000000_r20_c2a_commerce_orders_fulfilment`) and no UI.

- **Catalogue hardening.** `CommerceProduct.audience` and `unitQuantity`; `REPORT_CREDIT_PACK` kind (must target `ORGANIZATION`/`COUNSELLOR`); candidate checkout lists candidate-audience products only; product create/update audited with before/after price.
- **Pricing authority** (`20260913010000_r20_c2a_pricing_policy`). `CommercePlatformPolicy` singleton (tenant coupon cap, tax policy, counsellor fee enablement/bounds), `CommerceOrganizationPolicy` (delegated pricing, coupons, coupon cap, manual payment), `CommerceOrganizationPrice` (tenant selling price, never zero, inside product floor/ceiling), `CommerceCounsellorFee` (counselling products only, inside platform bounds). Product floor/ceiling/tax columns; order price snapshot (`basePriceMinor`, `pricingSource`, `taxRateBps`, `taxMinor`) with backfill. `CommercePricingService.resolvePrice`/`computeTotals` is the only place a charge is computed.
- **Central-only operations.** Platform catalogue mutation, manual payment approval, cancellation, refund and fulfilment retry require a central session; `commerce.product.manage`, `commerce.payment.approve` and `commerce.refund.manage` are not in the legacy organization-admin set (API guard and web mirror). `commerce.price.manage` remains available to organization admins strictly for their own delegated selling price.
- **Coupon authority.** `FREE` coupons central-only; tenant coupons require platform enablement, are product-bound, within the platform/organization cap, exclude credit packs, need expiry and max redemptions, are audited, and at redemption never discount below the product floor.
- **Consumption rule and refunds.** `ReportOpenService` stamps `consumedAt` on the candidate's REPORT entitlement on first delivery; refunding a consumed entitlement requires a central `override` with reason (audited). Credit-pack refunds reverse only unconsumed credits from that purchase.
- **Institutional manual payments.** `POST /admin/commerce/orders/:id/manual-payment` (own organization order with `manualPaymentEnabled`, or candidate's own order) records a `PENDING` bank-transfer/UPI reference; central `/manual-approve` completes that payment and fulfils through the shared service.
- **Counsellor self-service fee.** `GET/PUT /staff/commerce/counselling-fees` for counsellors, gated by platform policy.
- **Purchaser-aware orders.** `purchaserType`, nullable `attemptId`, `creditWalletId`, `quantity`, `fulfilmentStatus`/`fulfilledAt`/`refundedAt`, database checks for purchaser shape and non-negative amounts; historical paid orders backfilled as fulfilled.
- **Single fulfilment path.** `OrderFulfilmentService.fulfil` (entitlements or credit-pack `PURCHASE` ledger entry, unique per order) used by zero-total checkout, Razorpay verify, Razorpay webhook, manual approval and admin retry; `reverse` for refunds.
- **Razorpay webhook.** `POST /commerce/webhooks/razorpay` with raw-body HMAC verification (`rawBody: true` in API bootstrap), `CommerceWebhookEvent` journal unique per provider event id, amount/currency check, `payment.captured`/`order.paid`/`payment.failed` handling, payment ↔ webhook event link.
- **Order operations.** `GET /admin/commerce/orders` with filters (`q`, organisation, status, fulfilment status, purchaser type, product kind, date range) and pagination; `GET /admin/commerce/orders/:id` with payments, entitlements, ledger entries and redemptions; central `cancel`, `refund`, `fulfil` (retry).

## Authorization boundary

Tenant administrators keep `commerce.view` (own organisation orders/products/coupons), delegated `commerce.price.manage` (own selling price inside platform bounds, only when the platform enables delegation) and capped, product-bound `commerce.coupon.manage` (only when the platform enables organization coupons). They cannot change platform prices, create free coupons, approve payments, cancel, refund, or retry fulfilment. Counsellors may only set their own counselling fee. The webhook endpoint has no session and returns no tenant data; it only acknowledges receipt and the processing status.

## Verification commands

Run from the repository root:

```text
pnpm lint
pnpm type-check
pnpm --filter @edumall/database test:unit
pnpm --filter @edumall/api test
pnpm --filter @edumall/web test
pnpm build
```

Focused coverage: price resolution (platform/delegated/counsellor, bounds, delegation revocation), tax computation, tenant price and counsellor fee authority, policy caps, coupon authority/cap/limits/credit-pack exclusion and floor clamping at redemption, order price snapshots, consumption stamping, refund consumption rule/override/idempotency, manual-payment reference and central approval, fulfilment idempotency and credit-pack ledgering, refund reversal caps, webhook signature/dedupe/amount checks and idempotent re-fulfilment, central-only approval/cancel/refund/retry, product audience validation, permission-guard matrix, and migration invariants.

## Deferred to later C2 commits

- Admin UI for products, coupons and orders (C2b).
- Wallet lookup/transfer/bulk consumption, tenant and counsellor self-service credit purchase (C2c).
- Counselling scheduling (C2d).
- A worker sweep for `PAID` orders left `PENDING` fulfilment; until then central administrators retry through `POST /admin/commerce/orders/:id/fulfil`.
- Gateway-initiated refunds (`refund.processed`) are not consumed by the webhook yet; refunds are recorded through the central refund route.
