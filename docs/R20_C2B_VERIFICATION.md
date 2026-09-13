# R20-C2b Verification

## Scope delivered

R20-C2b is the Control Centre commerce UI on top of the C2a backend. It adds no schema and no scientific change. Backend additions are limited to coupon lifecycle endpoints that C2a did not yet expose: `PUT /admin/commerce/coupons/:id` (validity, usage limits, description, status — discount type/value and code stay immutable) and `GET /admin/commerce/coupons/:id/redemptions`; coupon listing now includes the organization and redemption count.

- **Navigation.** Control Centre gains a **Commerce** group: Products & Pricing (`/admin/commerce/products`), Orders & Payments (`/admin/commerce/orders`), Coupons (`/admin/commerce/coupons`), Report Credits (`/admin/report-credits`, interim page until C2c). Items follow `commerce.view` / `report.credit.view`; visibility is never authorization.
- **Products & Pricing.** Platform sessions with `commerce.product.manage` + `commerce.price.manage` create/edit products (base price, floor, ceiling, tax rate, audience, unit quantity, organization / assessment-version scope, status) and edit the platform commercial policy (tenant coupon cap, tax policy, counsellor fee enablement and bounds). Tenant sessions see platform products with the platform base price and a separate **Your selling price** column; when the platform has delegated pricing to the organization and the session holds `commerce.price.manage`, the tenant sets its own selling price (own organization only, never credit packs). Floor/ceiling are displayed as server facts; the server performs all validation.
- **Organization commercial policy.** On the platform-only organization detail route, central administrators with `commerce.price.manage` edit delegated pricing, tenant coupons, the organization coupon cap and manual-payment enablement, see the organization's selling prices and may set a price on its behalf.
- **Coupons.** List (scope, discount, binding, validity, usage, status), create, edit, deactivate/reactivate, and a redemption drill-down linking to orders. `FREE` is offered only to platform sessions; tenant forms require product binding, expiry and max redemptions and exclude credit packs, mirroring — never replacing — backend policy. The effective cap shown to tenants comes from the platform/organization policy, not a constant.
- **Orders & Payments.** Filtered, paginated search (text, order/fulfilment status, purchaser type, product kind, date range). Order detail shows purchaser, organization, candidate report link, product, the immutable pricing snapshot (base price, pricing source, subtotal, discount, tax, total), payment timeline with manual-payment reference/evidence and gateway failure detail, entitlements and credit-ledger movements. Actions: **Record payment reference** (tenant admin for its own organization order when manual payment is enabled, or central), **Approve manual payment**, **Cancel**, **Refund** with reference/reason and the central consumed-entitlement override, **Retry fulfilment** — each shown only with the matching central permission and re-authorized by the server.

## Authorization boundary

Every commerce page is wrapped in `AdminRoute` with a server-validated permission, and every mutation is a CSRF-protected request the API authorizes independently. Tenant sessions cannot see or call platform catalogue mutation, approval, cancel, refund or retry; the UI hides them, the API guard and service both deny them. No price is computed or sent by the browser: forms send product codes and whole-currency amounts that the server converts, bounds-checks and audits.

## Verification commands

Run from the repository root:

```text
pnpm lint
pnpm type-check
pnpm --filter @edumall/api test
pnpm --filter @edumall/web test
pnpm build
```

Focused coverage: commerce lib formatting/encoding/CSRF, tenant vs central permission projection, navigation group and route presence, per-page permission guards, central-only catalogue/policy gating with separate tenant selling price, organization delegation controls, free-coupon and tenant-limit mirroring without hardcoded caps, order action gating and manual-payment workflow, absence of release approval or client-side pricing, and backend coupon-edit scoping.

## Remaining C2

- **C2c**: wallet lookup/ledger UI, central allotment UI, organization → counsellor transfers, bulk consumption, candidate-principal unlock, tenant/counsellor self-service credit purchase (`/staff/credits`), staff "unlock with 1 credit" on report detail; replaces the interim Report Credits page.
- **C2d**: counselling availability/booking/cancellation/no-show, platform counsellor pool, contract grant for booked counsellor, online/offline session details, notifications.
- Deferred platform items: worker sweep for stuck fulfilment; gateway `refund.processed` webhook consumption.
