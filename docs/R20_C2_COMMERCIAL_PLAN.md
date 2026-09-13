# R20-C2 Commercial Plan

Status: C2a implemented (see `R20_C2A_VERIFICATION.md`); C2b–C2d pending. Decisions below were confirmed on 2026-09-13 with the recommended defaults.

## Authoritative business decisions (2026-09-13)

1. **Pricing authority.** Platform controls base price, floor, ceiling, tax policy, per-organization delegation, report-credit cost and platform-wide products. A delegated organization admin may set its own selling price for its own organization within floor/ceiling, never zero. Counsellors may set their own counselling fee within platform bounds when enabled; they never control report price or credit cost. Orders snapshot the actual charged price. _(Implemented in C2a.)_
2. **Coupon authority.** FREE/100 %/complimentary coupons are central-only. Tenants create organization-scoped percentage/fixed discounts only when the platform enables it, within a backend-configurable cap, product-bound, with validity and usage limits, never below the platform floor, never on credit packs; all audited. _(Implemented in C2a.)_
3. **One report credit = one full-report grant for one attempt to one principal** (candidate/user, organization, counsellor/user). No silent multi-principal unlock. Exception: the temporary counsellor `CONTRACT` grant created by a paid counselling booking. _(Rule documented; candidate-principal consumption in C2c.)_
4. **Refunds.** Candidate report: refundable while unconsumed; once opened, only by central override with audit reason. Credit packs: only unused purchased credits reversed, partial allowed, wallet never negative. Counselling: per cancellation policy. All idempotent and audited. _(Implemented in C2a except counselling.)_
5. **Public-signup counsellor pool.** Platform-owned counsellor organization for public candidates; institutional candidates preferentially see their own tenant's authorized counsellors; no cross-tenant visibility. _(C2d.)_
6. **Counselling logistics.** Default 45-minute sessions, duration product-configurable; candidate cancel/reschedule up to 24 h before, inside 24 h only by admin exception; no-show consumes the entitlement with counsellor/admin exceptions audited; provider-neutral meeting URL entered by counsellor/admin; ONLINE and OFFLINE (centre/address/date/time) supported. _(C2d.)_
7. **Institutional manual payments.** Bank transfer / UPI with reference recorded by the institution, verified and approved centrally, fulfilled by the same `OrderFulfilmentService`; tenant admins never approve their own payment. _(Implemented in C2a.)_

## Product rules carried forward

- Report generation is automatic after submission; no counsellor approval anywhere in C2.
- The candidate always receives the free short result. The complete report is generated regardless of payment; only access is commerce-controlled.
- Platform Super Admin / permitted Platform Admin open reports without commerce. Tenant and counsellor search scope never grants full-report access; a valid credit-backed grant, contract grant, or admin grant is required.
- Prices are backend-controlled. The web never sends a price; it selects a product code.
- `AssessmentReportRelease` is historical only.
- Every mutation is tenant-scoped and audited inside its transaction.

## What already exists (do not rebuild)

| Area                       | Backend                                                                                                                                                                                                                                                                          | Web                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Product catalogue          | **exists** `CommerceProduct` (REPORT / COUNSELLING / REPORT_AND_COUNSELLING, optional org + assessment-version scope, `priceMinor`), `GET/POST/PUT /admin/commerce/products`                                                                                                     | none                                                                                        |
| Coupons                    | **exists** `CommerceCoupon` (FREE / PERCENTAGE / FIXED, validity, max/per-user limits), `GET/POST /admin/commerce/coupons`, redemption rows                                                                                                                                      | none                                                                                        |
| Candidate orders + payment | **exists** `GET /commerce/attempts/:id/checkout`, `POST /commerce/attempts/:id/orders`, Razorpay intent + client-signature verify, manual approval (`POST /admin/commerce/orders/:id/manual-approve`), zero-total orders auto-paid, `CommerceEntitlement` grant per product kind | **exists** candidate checkout in `candidate/assessments/[attemptId]/submitted-commerce.tsx` |
| Orders list                | **exists** `GET /admin/commerce/orders`                                                                                                                                                                                                                                          | none (Candidate 360 shows per-user snapshot only)                                           |
| Report credits             | **exists** wallet create/get/ledger, central allot/revoke, consume-for-attempt (creates `CommerceReportAccessGrant` atomically)                                                                                                                                                  | none                                                                                        |
| Counsellor assignment      | **exists** assign/revoke/list                                                                                                                                                                                                                                                    | none                                                                                        |
| Counselling                | entitlement type only; no scheduling model                                                                                                                                                                                                                                       | placeholder text in checkout                                                                |

Known gaps in the existing layer that C2 must close:

1. Payment fulfilment relies solely on the browser's Razorpay verify callback; there is no server-side webhook, so a closed tab after capture leaves a paid-but-unfulfilled order.
2. `CommerceOrder` is candidate-shaped (`userId`, `attemptId`, one product) and cannot represent an organization or counsellor buying credit packs.
3. `commerce.product.manage`, `commerce.price.manage`, and `commerce.coupon.manage` are in the legacy organization-admin permission set, so a tenant admin can today create a zero-price product or a FREE coupon scoped to their own organization and unlock candidate reports without paying the platform.
4. Wallet transfers (organization → counsellor), bulk consumption, wallet lookup by owner, and a "my wallet" projection do not exist.
5. There is no refund/cancel path and no reversal of unconsumed purchased credits.

## Work packages

### C2-1 Backend pricing and catalogue hardening

Schema (one additive migration):

- `CommerceProductKind` += `REPORT_CREDIT_PACK`, `COUNSELLING_SESSION` (keep the three existing kinds).
- `CommerceProduct.unitQuantity Int @default(1)` — credits in a pack or sessions in a bundle. Check constraint `unit_quantity >= 1`.
- `CommerceProduct.audience` enum `CANDIDATE | ORGANIZATION | COUNSELLOR` so checkout screens only list products the buyer may purchase.

Authorization:

- Product and price mutation become central-only (`SUPER_ADMIN` / platform-scoped or in-scope `PLATFORM_ADMIN`). Remove `commerce.product.manage` and `commerce.price.manage` from the legacy organization-admin set in `PermissionsGuard` and mirror in `apps/web/lib/admin-authorization.ts`. Tenant admins keep `commerce.view`.
- Product list for tenants is read-only and filtered to platform-wide products plus products scoped to their organization.

API:

- `PUT /admin/commerce/products/:id` gains `unitQuantity`, `audience`, `status` (already), and a price history record in `AuditLog` metadata (old/new `priceMinor`).
- `GET /commerce/pricing` (authenticated, any role) returns active products for the caller's audience/org/version so the web renders backend prices only.

Web: `/admin/commerce/products` (Control Centre → Commerce group): list, create, edit price/status, org/version scope pickers by name.

### C2-2 Orders, payments, fulfilment

Schema:

- `CommerceOrder`: make `attemptId` nullable; add `purchaserType` (`CANDIDATE | ORGANIZATION | COUNSELLOR`), `purchaserOrganizationId?`, `quantity Int @default(1)`, `fulfilledAt?`, `fulfilmentStatus` (`PENDING | FULFILLED | FAILED`), `refundedAt?`. Check constraint: `attempt_id IS NOT NULL` when the product kind is REPORT / COUNSELLING / REPORT_AND_COUNSELLING.
- `CommercePayment`: add `webhookEventId? @unique`, `failureCode?`, `failureMessage?`.
- New `CommerceWebhookEvent` (provider, eventId unique, payload, receivedAt, processedAt, status) for idempotent webhook processing.

Backend:

- `OrderFulfilmentService.fulfil(orderId)` — single idempotent entry point (SERIALIZABLE): re-reads the order, exits if already fulfilled, then dispatches by product kind: candidate entitlement (existing `grantEntitlements`), credit pack → wallet `PURCHASE` ledger entry (creating the wallet if absent, `orderId` linked, quantity = `unitQuantity × quantity`), counselling → entitlement rows. Called from Razorpay verify, webhook, manual approval, and zero-total orders.
- `POST /commerce/webhooks/razorpay` — raw-body HMAC verification with `RAZORPAY_WEBHOOK_SECRET`, dedupe on event id, handles `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`. Unauthenticated route, CSRF-exempt, rate-limited.
- `POST /admin/commerce/orders/:id/cancel` (PENDING only) and `POST /admin/commerce/orders/:id/refund` (records refund payment, revokes entitlement, `REVERSAL` of unconsumed purchased credits only; consumed credits are not clawed back). Both audited; refund requires `commerce.payment.approve` and central role.
- `GET /admin/commerce/orders` gains filters (status, organization, purchaser, product kind, date range, pagination) and `GET /admin/commerce/orders/:id` with payments, entitlements, ledger entries.
- Retry job: worker sweep of orders `PAID` + `fulfilmentStatus = PENDING` older than N minutes (uses the existing worker queue; can start as a scheduled query).

Web: `/admin/commerce/orders` list + detail (payments timeline, manual approve with method/reference, cancel, refund). Tenant admins see their own organization's orders read-only plus manual-payment evidence.

### C2-3 Coupons

Backend:

- `PUT /admin/commerce/coupons/:id` (description, validity, limits, status). Codes are immutable after creation.
- `GET /admin/commerce/coupons/:id/redemptions`.
- Coupon `appliesToKinds` (array) so credit-pack coupons and candidate coupons are distinct; FREE / 100 % coupons become central-only to create (tenant admins may create PERCENTAGE / FIXED up to a platform-set cap — see decisions).
- Coupon validation reused unchanged for candidate orders; extended to credit-pack orders.

Web: `/admin/commerce/coupons` list/create/edit/deactivate with redemption drill-down; candidate checkout already accepts a code.

### C2-4 Report-credit wallets and bulk allocation

Backend (`ReportCreditService` additions):

- `GET /admin/report-credits/wallets?ownerType=&ownerUserId=|ownerOrganizationId=` lookup; `GET /staff/report-credits/wallet` returns the caller's own wallet (organization wallet for tenant admins, user wallet for counsellors) with balance and recent ledger.
- `POST /admin/report-credits/wallets/:id/transfer` — organization wallet → counsellor user wallet in the same organization (active COUNSELLOR membership required), atomic `TRANSFER_OUT` / `TRANSFER_IN` pair with a shared `metadata.transferId`; tenant admins may transfer from their own organization wallet.
- `POST /staff/report-credits/unlock` — tenant admin or counsellor consumes one credit from their own wallet for one attempt in scope (wraps `consumeForAttempt` with the principal derived from the session, never from the body).
- `POST /admin/report-credits/wallets/:id/bulk-consume` — list of attempt IDs, per-item result (`charged | already_granted | skipped:<code>`), single transaction, hard cap 200 per request.
- Wallet status changes (`SUSPENDED` / `CLOSED`) central-only with audit.

Web:

- `/admin/report-credits`: find wallet by organization or user name, balance, ledger, allot / revoke (central), transfer, bulk consume by pasted attempt list or from a report-search selection.
- Organization detail and Candidate 360 gain a wallet panel.
- `/staff/reports/[attemptId]`: when `canViewFullReport` is false, show balance and an **Unlock with 1 credit** action; on success re-fetch and render the report. `/staff/reports` gains a wallet balance chip and multi-select bulk unlock for tenant admins.

### C2-5 Tenant / counsellor self-service credit purchase

Backend:

- `GET /staff/commerce/credit-packs` — active `REPORT_CREDIT_PACK` products for the caller's audience/organization.
- `POST /staff/commerce/orders` — `{ productCode, quantity, couponCode? }`; purchaser derived from session (organization wallet for tenant admin, user wallet for counsellor). Zero-total orders fulfil immediately; otherwise Razorpay intent via the existing intent/verify path generalised to non-candidate orders; webhook and manual approval fulfil the same way.
- Manual bank-transfer flow for institutions: order created `PENDING` with a displayed reference; central admin approves with evidence via C2-2 manual approval.

Web: `/staff/credits` — balance, packs with backend prices, buy (Razorpay checkout already wired for candidates; reuse the client component), pending manual orders with reference, purchase history.

### C2-6 Counselling booking, scheduling, payment, fulfilment

Schema:

- `CounsellorAvailability` (counsellorUserId, organizationId, weekday, startMinute, endMinute, timezone, slotMinutes, validFrom/Until, status).
- `CounsellingBooking` (organizationId, candidateUserId, counsellorUserId, attemptId?, entitlementId, scheduledStart, scheduledEnd, status `REQUESTED | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW`, meetingUrl?, cancellationReason?, notes JSON, timestamps, actor IDs). Partial unique index on (counsellorUserId, scheduledStart) for non-cancelled bookings to prevent double booking.
- `CounsellingBookingEvent` append-only history.

Backend:

- Candidate: list bookable counsellors/slots for an attempt with an ACTIVE `COUNSELLING` entitlement; create booking (entitlement reserved, not consumed); cancel/reschedule within policy.
- On booking confirmation the system creates (or reuses) a `CandidateCounsellorAssignment` and a `USER` `CommerceReportAccessGrant` with source `CONTRACT` for the assigned counsellor, so the counsellor can prepare from the full report without spending a credit. Grant expires with the booking window + configurable grace.
- Counsellor: manage availability, confirm, complete (entitlement → `CONSUMED`), mark no-show.
- Admin: oversight list, reassign counsellor, force-cancel with refund hook to C2-2.
- Notifications through the existing outbox (booking requested / confirmed / reminder / cancelled).

Web: `/candidate/counselling` (book, upcoming, history), `/staff/counselling` (availability editor, calendar list, session actions), `/admin/counselling` (oversight).

## Sequencing and commits

1. **C2a** — C2-1 schema + authorization hardening, C2-2 schema, `OrderFulfilmentService`, webhook, cancel/refund, order filters. Backend + tests + docs.
2. **C2b** — Admin commerce UI: products, coupons (with C2-3 backend additions), orders.
3. **C2c** — C2-4 wallet backend additions + admin/staff credit UI, then C2-5 self-service purchase.
4. **C2d** — C2-6 counselling.

Each commit keeps `pnpm lint`, `pnpm type-check`, API/web tests, and `pnpm build` green and updates `R20_REPORT_PLATFORM_ARCHITECTURE.md`.

## Business decisions required before C2a starts

1. **Tenant pricing authority.** Recommended: only central platform administrators create products or set prices; tenant admins are read-only on catalogue. (Today the legacy permission set allows tenant admins to price their own products at zero.)
2. **Tenant coupon authority.** Recommended: FREE / 100 % coupons are central-only; tenants may create partial discounts capped by a platform setting (e.g. ≤ 50 %). Alternative: tenants create no coupons and sponsor candidates only through credits.
3. **What one tenant credit buys.** Recommended: one credit = one organization (or counsellor) full-report grant for one attempt. Whether that also unlocks the candidate's own detailed view ("sponsored candidate access") is a separate choice; recommended as an explicit per-unlock option that costs no extra credit but is recorded as a distinct candidate entitlement with source `TENANT_CREDIT`.
4. **Refund policy.** Recommended: refunds revoke candidate entitlements and reverse only unconsumed purchased credits; consumed credits are non-refundable.
5. **Counsellor pool for public-signup candidates.** Public candidates have no tenant counsellors. Recommended: a platform-owned counsellor organization whose counsellors are bookable by public candidates; institutional candidates book within their tenant.
6. **Counselling logistics.** Session length, cancellation/reschedule window, and whether meeting links are entered manually by the counsellor or generated by an integration (none exists today).
7. **Manual institutional payments.** Confirm bank transfer with central approval is the accepted path for institutional credit purchases (no invoicing system exists in the repo).
