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

## Commerce orders, payments and fulfilment (R20-C2a)

`CommerceProduct` carries backend-controlled `priceMinor`, an `audience` (`CANDIDATE`, `ORGANIZATION`, `COUNSELLOR`) and a `unitQuantity` (credits in a `REPORT_CREDIT_PACK`). Candidate checkout only lists candidate-audience report/counselling products. Catalogue creation, price changes and manual payment approval are central operations: `commerce.product.manage`, `commerce.price.manage` and `commerce.payment.approve` are no longer part of the legacy organization-admin permission set, and the service layer independently rejects non-central callers. Every product create/update writes an `AuditLog` row with the before/after price.

Coupons remain redeemable by candidates as before. Tenant administrators may only create product-bound `PERCENTAGE`/`FIXED` coupons within `COMMERCE_TENANT_COUPON_MAX_BPS`; `FREE` coupons are central-only. A coupon may additionally be restricted to one product kind through `appliesToKind`.

`CommerceOrder` distinguishes `purchaserType` (`CANDIDATE`, `ORGANIZATION`, `COUNSELLOR`), an optional `attemptId` (required for candidate orders by database check), an optional `creditWalletId` (required for organisation/counsellor orders), `quantity`, and a `fulfilmentStatus` separate from payment status. Historical paid orders are backfilled as `FULFILLED`.

`OrderFulfilmentService.fulfil` is the single idempotent fulfilment path. It runs inside the caller's transaction after the order is marked `PAID`, and dispatches by product kind: candidate report/counselling products upsert `CommerceEntitlement` rows; `REPORT_CREDIT_PACK` products find-or-create the purchaser's `REPORT_ACCESS` wallet and append one `PURCHASE` ledger entry (`unitQuantity × quantity`, unique per order at the database level). Zero-total checkout, browser Razorpay verification, the Razorpay webhook, central manual approval and administrative retry all call the same method, so the first path to succeed fulfils and later paths are no-ops.

`POST /commerce/webhooks/razorpay` is unauthenticated by design: the raw body is HMAC-verified with `RAZORPAY_WEBHOOK_SECRET`, every event is journaled once in `CommerceWebhookEvent` by provider event id, `payment.captured`/`order.paid` mark the matching intent and order paid (rejecting amount/currency mismatches) and fulfil, and `payment.failed` records sanitized failure detail. Successful payments link to their webhook event.

Central administrators may cancel pending orders, record refunds, and retry fulfilment. Refund records a `REFUNDED` payment, revokes entitlements granted by the order and reverses only unconsumed purchased credits (`REVERSAL` ledger entry capped by wallet balance); consumed credits and their report grants are never clawed back. Moving funds through the gateway remains an operator action.

## Legacy compatibility

`AssessmentReportRelease`, its schema, historical migration, records, and compatibility API are preserved. Existing release evidence remains readable and the staff UI labels it as legacy history. New automatic reports create no release row and neither candidate nor administrator access requires one. The legacy candidate PDF path remains as a compatibility alias but now opens the authorized generation-linked immutable snapshot.

Candidate 360 and current report operations derive state from `AssessmentReportGeneration`, immutable snapshot presence, candidate entitlements, and third-party grants. They never derive current status from the count or presence of release rows.

## R20-C1 operations UI

The Control Centre routes Reports directly to `/admin/reports`, not through the staff results area. Its report detail renders the immutable premium payload into report overview, CareerFit, and interpreted-profile sections instead of displaying raw JSON. Candidate 360 at `/admin/users/[userId]` combines safe identity, membership, assessment, commerce, report-access, counsellor assignment, and timestamp projections according to permission.

The staff workspace uses `/staff/reports`. Old `/staff/results` links redirect for URL compatibility, but the current interface has no approval/release action. Tenant administrators and counsellors can search authorized metadata; they can open a full report only when the backend projects an applicable active access grant.

## Remaining R20-C2

- C2b: admin commerce UI (products, coupons, orders) on the C2a backend.
- C2c: wallet transfers, bulk consumption, self-service credit purchase for tenants/counsellors.
- C2d: counselling booking/scheduling/fulfilment.

Durable background recovery remains a later platform concern when the worker evolves beyond its current health-only queue. OTP, if separately approved, also remains later work.
