# R20 Report Platform Architecture

## Scope

R20-A establishes the durable schema, authorization, and API primitives for automatic reports. R20-B connects those primitives to submission, automatic governed report generation, the free candidate summary, and entitlement-based detailed report access. R20-C1 adds the report-operations and Candidate 360 interfaces while preserving those boundaries. No scientific identifiers, norms, mappings, thresholds, weights, or interpretations are seeded.

## Access concepts

Candidate commercial access and third-party access are intentionally separate:

- `CommerceEntitlement` remains the candidate/user entitlement for one attempt. A public candidate may always receive the short result, but opening the complete report requires an active, unexpired `REPORT` entitlement. Existing non-commercial candidate behavior and historical rows remain supported.
- `CommerceReportAccessGrant` authorizes a non-candidate `USER` (for example, a counsellor) or `ORGANIZATION` (tenant) for one attempt. A database check requires exactly one owner matching `principalType`. Active partial unique indexes prevent duplicate active grants.
- Search visibility is not report-open authority. Search returns metadata and an explicit `canViewFullReport`; it never returns report payloads.
- `ReportAccessPolicyService` is the server-side report-open decision point. Attempt/report identifiers do not bypass candidate ownership, administrative scope, tenant membership, counsellor assignment, entitlement, or grant checks.

Platform Super Admin and delegated Platform Admin sessions with `report.view.full` may open reports in their administrative scope without commerce. Organization Admin access is tenant access and requires an organization grant. Counsellors require both an active candidate assignment and a user grant.

## Report-credit accounting

`CommerceCreditWallet` supports a `USER` or `ORGANIZATION` owner and caches the current `REPORT_ACCESS` balance. Database checks enforce exactly one matching owner and a non-negative balance. Partial unique indexes provide one wallet per owner and credit type.

`CommerceCreditLedgerEntry` is the immutable accounting source of truth. Every positive quantity has a signed delta and `balanceAfter`. Purchase, admin allotment, transfers, consumption, reversal, and revocation are represented as business events. Database constraints validate quantity/direction/balance, and triggers reject ledger updates and deletes.

All balance changes run in `SERIALIZABLE` transactions. Consumption atomically decrements one credit, appends the ledger entry, creates the matching `CommerceReportAccessGrant`, and writes `AuditLog` evidence. A partial unique ledger index prevents charging the same wallet twice for an attempt; duplicate requests return the existing credit grant when available. Revocation is capped by both current balance and net administrator-allotted credits so consumed allotments cannot be revoked. Complimentary allotment and its revocation are central platform operations (Super Admin or a permitted Platform Admin within scope); tenant administrators can view their wallets and consume credits they hold but cannot create credit value without a purchase.

## Candidate and counsellor ownership

`CandidateCounsellorAssignment` is the server-side candidate-sharing relationship. It carries organization, candidate, counsellor, lifecycle status, assigning actor, timestamps, consent timestamp/metadata hooks, and general metadata. Active partial uniqueness prevents duplicate active assignments. Candidate and counsellor must have active, correctly typed memberships in the same organization when assigned.

Counsellor report search is always constrained through an active assignment in the current organization. Frontend filtering is not part of the security boundary.

## Report search

`GET /admin/reports` serves platform/delegated/organization administrators, subject to `report.search`. `GET /staff/reports` serves authorized staff and counsellors. Candidates are excluded by both route roles and service checks.

Search supports free text, candidate name, mobile, email, submitted date/range, organization ID/name, assessment, assessment version, generation status, candidate entitlement status, and counsellor. Results are paginated metadata containing candidate, organization, assessment, generation, entitlement, and `canViewFullReport` fields only.

R20-C1 exposes this projection through `/admin/reports` and `/staff/reports`. The UI never treats a visible row as report-open authority. A narrow scoped metadata endpoint for one attempt supports detail screens but returns no snapshot payload; `/full` and PDF endpoints continue to authorize independently. Platform administrators filter organizations by name rather than entering UUIDs. Staff organization and counsellor scope is derived from the authenticated context on the server.

Platform-scoped administrators search platform data (optionally narrowed by organization). Organization-scoped sessions cannot select another organization. Counsellors are additionally restricted to their own active assignments.

## Automatic report configuration and generation state

`AssessmentReportConfiguration` binds one assessment version to its approved norm group, interpretation set, CareerFit model, and report template version. At most one row is `ACTIVE` per assessment version. Activation is serializable and validates that:

- the norm group belongs to the same assessment version and declared norm version;
- the interpretation set and CareerFit model belong to the same assessment version; and
- the norm set, interpretation set, and CareerFit model are all `PUBLISHED`.

`AssessmentReportGeneration` provides one durable orchestration record per attempt with `PENDING`, `PROCESSING`, `GENERATED`, `BLOCKED_CONFIGURATION`, and `FAILED` states, configuration/snapshot references, retry count, sanitized operational error fields, and processing timestamps.

`AutomaticReportProcessingService` is the single R20-B orchestration path. After the submission transaction, deterministic scoring completes first and the processor then:

- confirms submitted state and resolves the latest immutable scoring run;
- requires exactly one active configuration for the assessment version;
- validates that configured norm, interpretation, CareerFit, and taxonomy references remain published and version-compatible;
- invokes the existing norm and CareerFit execution services, applies the configured interpretation set, and creates/reuses the immutable report-data snapshot;
- links the exact configuration and snapshot to the attempt generation; and
- records system-attributed start, retry, generated, blocked-configuration, and failed audit evidence.

All scientific stages retain their existing hashes and unique constraints. Reprocessing a generated attempt returns the linked snapshot. Processing failures never change the submitted attempt. Missing/invalid active configuration is recorded as `BLOCKED_CONFIGURATION`; other failures are recorded as `FAILED` with sanitized candidate-safe operational text. An authorized central administrator may invoke the same processor through the authenticated retry route. PDF byte rendering is deliberately outside submission and is performed only when an authorized user requests a download.

`GET /admin/report-configurations/readiness/:assessmentVersionId` exposes pre-commerce readiness for one active configuration plus published norm, interpretation, and CareerFit checks. Report search includes generation attempts and sanitized failure details.

The R20-C1 assessment workspace displays this readiness for published versions as ready, missing active configuration, or unpublished/version-mismatched configuration. It does not create configuration or scientific data.

## Candidate short result and detailed access

`GET /candidate/assessments/:attemptId/short-result` is restricted to the authenticated candidate's own tenant-scoped attempt and never checks commerce entitlement. Before completion it returns explicit scoring/processing/configuration-blocked/failed states. Once generated, it projects only concise published construct labels/summaries and the top five governed CareerFit directions from the immutable snapshot. It omits raw scores, internal construct keys, scientific IDs, evidence, methodology, provenance, candidate contact data, and the complete premium payload.

The complete candidate report and PDF use `ReportOpenService` and `ReportAccessPolicyService`. A generated public-signup report is `DETAILED_REPORT_READY_LOCKED` until an active report entitlement exists and `DETAILED_REPORT_UNLOCKED` afterward. Payment, coupon, or institutional entitlement does not call generation. Non-commercial institutional semantics remain unchanged.

Platform Super Admin and properly permitted Platform Admin sessions can open/download the generation-linked snapshot without candidate commerce or release. Tenant administrators still require an organization report-access grant. Counsellors still require both active assignment and a user report-access grant. All PDF routes render the immutable snapshot selected by the generation record and authorize before reading/rendering it.

## Phone storage

`User.phoneE164` maps to nullable, indexed `phone_e164 VARCHAR(16)`. It is deliberately not unique because family members may share a contact number. Existing users remain valid with `NULL`. New public candidate registrations require a mobile number, normalize common separators, validate conservative E.164 (`+`, non-zero international prefix, 8–15 digits), and persist the canonical value. Internal historical account paths remain nullable. OTP is out of scope.

## Permissions and audit

R20-A extends the existing R19.1 permission system with `report.search`, `report.view.full`, `report.download`, `report.credit.view`, `report.credit.manage`, `counsellor.assignment.view`, and `counsellor.assignment.manage`. Super Admin wildcard access remains unchanged. Delegated assignments still resolve through `AdminProfile`, `AdminRoleAssignment`, active templates, and platform/organization scope; authorization remains fail-closed.

Credit and counsellor assignment mutations, plus report configuration changes, write `AuditLog` evidence inside their transactions. The existing privileged mutation interceptor remains enabled on administrative controllers.

## Commerce pricing authority (R20-C2a)

The backend owns every amount charged; the web only selects a product code. Authority is layered:

- **Platform** (`CommercePlatformPolicy`, single `DEFAULT` row; `CommerceProduct`): base price (`priceMinor`), floor (`minPriceMinor`), ceiling (`maxPriceMinor`), tax policy (`taxRateBps` per product or `defaultTaxRateBps`, `taxInclusivePricing`), report-credit cost (`REPORT_CREDIT_PACK` products), the tenant coupon cap, and whether counsellor fee pricing is enabled with its bounds. Platform-wide catalogue changes require a platform-scoped central session (`commerce.product.manage` + `commerce.price.manage`); each change is audited with before/after prices.
- **Organization delegation** (`CommerceOrganizationPolicy`, granted by the platform per organization): `delegatedPricingEnabled`, `couponsEnabled` with an optional `couponMaxDiscountBps` that can only tighten the platform cap, and `manualPaymentEnabled`.
- **Tenant selling price** (`CommerceOrganizationPrice`): an organization admin with `commerce.price.manage` may set its own selling price for a candidate product only for its own organization, only while delegation is enabled, strictly inside the product floor/ceiling, and never zero (database check). Report-credit cost cannot be delegated. `resolvePrice` honours a tenant price only while the delegation flag is on and the price is still inside the current bounds; otherwise the platform base price applies.
- **Counsellor fee** (`CommerceCounsellorFee`): a counsellor may set their own fee on `COUNSELLING` products inside the platform bounds when the platform has enabled counsellor pricing. Counsellors never influence report prices or credit cost.

Every order snapshots what was actually charged: `basePriceMinor`, `pricingSource` (`PLATFORM` / `ORGANIZATION` / `COUNSELLOR`), `subtotalMinor`, `discountMinor`, `taxRateBps`, `taxMinor`, `totalMinor`. Historical rows are backfilled with `basePriceMinor = subtotalMinor`.

## Coupons (R20-C2a)

`FREE` / 100 % coupons are central-only. A tenant administrator may create coupons only when the platform has enabled organization coupons, only for its own organization, bound to a specific non-credit product, `PERCENTAGE`/`FIXED` within the effective cap (platform cap, further limited by the organization cap), and with an expiry and a maximum redemption count. At redemption a tenant coupon can never take the charged price below the product floor and never applies to report-credit packs, so it can neither create free platform value nor manufacture credits. Coupon creation is audited. Coupons may be restricted to one product kind through `appliesToKind`.

## Commerce orders, payments and fulfilment (R20-C2a)

`CommerceOrder` distinguishes `purchaserType` (`CANDIDATE`, `ORGANIZATION`, `COUNSELLOR`), an optional `attemptId` (required for candidate orders by database check), an optional `creditWalletId` (required for organisation/counsellor orders), `quantity`, and a `fulfilmentStatus` separate from payment status. Historical paid orders are backfilled as `FULFILLED`. Existing candidate checkout behaviour is preserved: candidate-audience products only, coupon entry, zero-total orders paid immediately, Razorpay intent/verify.

`OrderFulfilmentService.fulfil` is the single idempotent fulfilment path. It runs inside the caller's transaction after the order is marked `PAID`, and dispatches by product kind: candidate report/counselling products upsert `CommerceEntitlement` rows; `REPORT_CREDIT_PACK` products find-or-create the purchaser's `REPORT_ACCESS` wallet and append one `PURCHASE` ledger entry (`unitQuantity × quantity`, unique per order at the database level). Zero-total checkout, browser Razorpay verification, the Razorpay webhook, central manual approval and administrative retry all call the same method, so the first path to succeed fulfils and later paths are no-ops.

`POST /commerce/webhooks/razorpay` is unauthenticated by design: the raw body is HMAC-verified with `RAZORPAY_WEBHOOK_SECRET`, every event is journaled once in `CommerceWebhookEvent` by provider event id (replays are reported as duplicates and never reprocessed), `payment.captured`/`order.paid` mark the matching intent and order paid (rejecting amount/currency mismatches) and fulfil, and `payment.failed` records sanitized failure detail. Successful payments link to their webhook event.

**Institutional manual payments.** An order stays `PENDING` while the purchasing organization (tenant admin, own organization order, `manualPaymentEnabled`) or the candidate (own order) records a bank-transfer/UPI reference through `POST /admin/commerce/orders/:id/manual-payment`, which creates or updates one `PENDING` `MANUAL` payment. Only a central administrator with `commerce.payment.approve` may approve (`/manual-approve`); approval completes that pending payment as `MANUAL_APPROVED`, marks the order `PAID`, and fulfils through the same service. A tenant administrator can never approve their own payment.

**Refunds and cancellation** are central (`commerce.refund.manage`, `commerce.payment.approve` for cancel/retry). Cancel applies to `PENDING` orders only. Refund is idempotent and follows the consumption rule: a candidate report entitlement counts as consumed once the complete report has been delivered (`consumedAt`, set by `ReportOpenService` on first candidate open/download while the entitlement stays `ACTIVE`); refunding a consumed entitlement requires `override: true` with a reason, recorded in the audit row. Credit-pack refunds reverse only the unconsumed credits attributable to that purchase (`REVERSAL` capped by wallet balance and by purchased minus already reversed); consumed credits and their report grants are never clawed back and the wallet never goes negative. Moving funds through the gateway remains an operator action.

## Report-credit accounting rule

One report credit = one full-report access grant for one assessment attempt to one principal (candidate/user, organization, or counsellor/user). A consumed credit never unlocks a second principal; each additional principal requires its own credit, entitlement, or explicit contract grant. The only exception is the temporary counsellor `CONTRACT` grant created by a paid counselling booking (C2d), which is part of delivering the purchased service. Candidate-principal consumption (institution spends a credit to give a candidate the report) is implemented in C2c on top of this rule.

## Legacy compatibility

`AssessmentReportRelease`, its schema, historical migration, records, and compatibility API are preserved. Existing release evidence remains readable and the staff UI labels it as legacy history. New automatic reports create no release row and neither candidate nor administrator access requires one. The legacy candidate PDF path remains as a compatibility alias but now opens the authorized generation-linked immutable snapshot.

Candidate 360 and current report operations derive state from `AssessmentReportGeneration`, immutable snapshot presence, candidate entitlements, and third-party grants. They never derive current status from the count or presence of release rows.

## R20-C1 operations UI

The Control Centre routes Reports directly to `/admin/reports`, not through the staff results area. Its report detail renders the immutable premium payload into report overview, CareerFit, and interpreted-profile sections instead of displaying raw JSON. Candidate 360 at `/admin/users/[userId]` combines safe identity, membership, assessment, commerce, report-access, counsellor assignment, and timestamp projections according to permission.

The staff workspace uses `/staff/reports`. Old `/staff/results` links redirect for URL compatibility, but the current interface has no approval/release action. Tenant administrators and counsellors can search authorized metadata; they can open a full report only when the backend projects an applicable active access grant.

## R20-C2b commerce operations UI

The Control Centre **Commerce** group (Products & Pricing, Orders & Payments, Coupons, Report Credits) renders the C2a backend. Platform sessions manage the catalogue, platform policy and per-organization delegation (on the organization detail route); tenant sessions see the platform base price and, when delegated, set a separate selling price for their own candidates. Coupon lifecycle (validity, limits, status, redemption drill-down) uses `PUT /admin/commerce/coupons/:id` and `GET /admin/commerce/coupons/:id/redemptions`; discount type/value and code are immutable. Order detail exposes the pricing snapshot, payment timeline, manual-payment reference recording (purchasing organization), central approval, cancel, refund with override, and fulfilment retry. UI visibility mirrors permissions but never substitutes for server authorization. See `R20_C2B_VERIFICATION.md`.

## Remaining R20-C2

- C2c: wallet lookup/transfers/bulk consumption, candidate-principal unlock, self-service credit purchase for tenants/counsellors.
- C2d: counselling booking/scheduling/fulfilment.

Durable background recovery remains a later platform concern when the worker evolves beyond its current health-only queue. OTP, if separately approved, also remains later work.
