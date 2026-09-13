# R20-C2a Verification

## Scope delivered

R20-C2a is the commerce backend core beneath the remaining C2 UI and self-service work. It adds one additive migration (`20260913000000_r20_c2a_commerce_orders_fulfilment`) and no UI.

- **Catalogue hardening.** `CommerceProduct.audience` and `unitQuantity`; `REPORT_CREDIT_PACK` kind (must target `ORGANIZATION`/`COUNSELLOR`); candidate checkout lists candidate-audience products only; product create/update audited with before/after price.
- **Central-only pricing and approval.** `commerce.product.manage`, `commerce.price.manage`, `commerce.payment.approve` removed from the legacy organization-admin set (API guard and web mirror); routes additionally restricted to `SUPER_ADMIN`/`PLATFORM_ADMIN`; service methods assert central role.
- **Coupon authority.** `FREE` coupons central-only; tenant coupons must be product-bound and within `COMMERCE_TENANT_COUPON_MAX_BPS`; optional `appliesToKind` restriction enforced at redemption.
- **Purchaser-aware orders.** `purchaserType`, nullable `attemptId`, `creditWalletId`, `quantity`, `fulfilmentStatus`/`fulfilledAt`/`refundedAt`, database checks for purchaser shape and non-negative amounts; historical paid orders backfilled as fulfilled.
- **Single fulfilment path.** `OrderFulfilmentService.fulfil` (entitlements or credit-pack `PURCHASE` ledger entry, unique per order) used by zero-total checkout, Razorpay verify, Razorpay webhook, manual approval and admin retry; `reverse` for refunds.
- **Razorpay webhook.** `POST /commerce/webhooks/razorpay` with raw-body HMAC verification (`rawBody: true` in API bootstrap), `CommerceWebhookEvent` journal unique per provider event id, amount/currency check, `payment.captured`/`order.paid`/`payment.failed` handling, payment ↔ webhook event link.
- **Order operations.** `GET /admin/commerce/orders` with filters (`q`, organisation, status, fulfilment status, purchaser type, product kind, date range) and pagination; `GET /admin/commerce/orders/:id` with payments, entitlements, ledger entries and redemptions; central `cancel`, `refund`, `fulfil` (retry).

## Authorization boundary

Tenant administrators keep `commerce.view` (own organisation orders/products/coupons) and capped, product-bound `commerce.coupon.manage`. They cannot price products, create free coupons, approve payments, cancel, refund, or retry fulfilment. The webhook endpoint has no session and returns no tenant data; it only acknowledges receipt and the processing status.

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

Focused coverage: fulfilment idempotency and credit-pack ledgering, refund reversal caps, webhook signature/dedupe/amount checks and idempotent re-fulfilment, coupon authority and cap, central-only approval/cancel/refund/retry, product audience validation, permission-guard matrix, and migration invariants.

## Deferred to later C2 commits

- Admin UI for products, coupons and orders (C2b).
- Wallet lookup/transfer/bulk consumption, tenant and counsellor self-service credit purchase (C2c).
- Counselling scheduling (C2d).
- A worker sweep for `PAID` orders left `PENDING` fulfilment; until then central administrators retry through `POST /admin/commerce/orders/:id/fulfil`.
- Gateway-initiated refunds (`refund.processed`) are not consumed by the webhook yet; refunds are recorded through the central refund route.
