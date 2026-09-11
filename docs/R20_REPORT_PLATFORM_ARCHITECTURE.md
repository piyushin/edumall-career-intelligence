# R20 Report Platform Architecture

## Scope

R20-A establishes the durable schema, authorization, and API primitives for automatic reports. It does not replace the complete submission workflow or redesign candidate/admin screens. No scientific identifiers, norms, mappings, thresholds, weights, or interpretations are seeded.

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

All balance changes run in `SERIALIZABLE` transactions. Consumption atomically decrements one credit, appends the ledger entry, creates the matching `CommerceReportAccessGrant`, and writes `AuditLog` evidence. A partial unique ledger index prevents charging the same wallet twice for an attempt; duplicate requests return the existing credit grant when available. Revocation is capped by both current balance and net administrator-allotted credits so consumed allotments cannot be revoked.

## Candidate and counsellor ownership

`CandidateCounsellorAssignment` is the server-side candidate-sharing relationship. It carries organization, candidate, counsellor, lifecycle status, assigning actor, timestamps, consent timestamp/metadata hooks, and general metadata. Active partial uniqueness prevents duplicate active assignments. Candidate and counsellor must have active, correctly typed memberships in the same organization when assigned.

Counsellor report search is always constrained through an active assignment in the current organization. Frontend filtering is not part of the security boundary.

## Report search

`GET /admin/reports` serves platform/delegated/organization administrators, subject to `report.search`. `GET /staff/reports` serves authorized staff and counsellors. Candidates are excluded by both route roles and service checks.

Search supports free text, candidate name, mobile, email, submitted date/range, organization ID/name, assessment, assessment version, generation status, candidate entitlement status, and counsellor. Results are paginated metadata containing candidate, organization, assessment, generation, entitlement, and `canViewFullReport` fields only.

Platform-scoped administrators search platform data (optionally narrowed by organization). Organization-scoped sessions cannot select another organization. Counsellors are additionally restricted to their own active assignments.

## Automatic report configuration and generation state

`AssessmentReportConfiguration` binds one assessment version to its approved norm group, interpretation set, CareerFit model, and report template version. At most one row is `ACTIVE` per assessment version. Activation is serializable and validates that:

- the norm group belongs to the same assessment version and declared norm version;
- the interpretation set and CareerFit model belong to the same assessment version; and
- the norm set, interpretation set, and CareerFit model are all `PUBLISHED`.

`AssessmentReportGeneration` provides one durable orchestration record per attempt with `PENDING`, `PROCESSING`, `GENERATED`, `BLOCKED_CONFIGURATION`, and `FAILED` states, configuration/snapshot references, retry count, sanitized operational error fields, and processing timestamps. R20-A does not expose operational errors to candidates.

## Phone storage

`User.phoneE164` maps to nullable, indexed `phone_e164 VARCHAR(16)`. It is deliberately not unique because family members may share a contact number. Existing users remain valid with `NULL`. New public candidate registrations require a mobile number, normalize common separators, validate conservative E.164 (`+`, non-zero international prefix, 8–15 digits), and persist the canonical value. Internal historical account paths remain nullable. OTP is out of scope.

## Permissions and audit

R20-A extends the existing R19.1 permission system with `report.search`, `report.view.full`, `report.download`, `report.credit.view`, `report.credit.manage`, `counsellor.assignment.view`, and `counsellor.assignment.manage`. Super Admin wildcard access remains unchanged. Delegated assignments still resolve through `AdminProfile`, `AdminRoleAssignment`, active templates, and platform/organization scope; authorization remains fail-closed.

Credit and counsellor assignment mutations, plus report configuration changes, write `AuditLog` evidence inside their transactions. The existing privileged mutation interceptor remains enabled on administrative controllers.

## Legacy compatibility

`AssessmentReportRelease`, its schema, historical migration, records, and candidate release-reading flow are preserved. R20-A only adds references and new tables; it performs no destructive drop or rename. Existing releases remain readable. Candidate PDF access still honors the historical released snapshot while also using the centralized commercial report policy.

## Follow-on work

R20-B must connect assessment submission to deterministic scoring, automatic CareerFit execution, configuration resolution, generation-state transitions/retries, complete snapshot generation, and the free short result. It must stop requiring a new manual `AssessmentReportRelease` for the normal automatic commercial workflow while keeping historical releases readable.

R20-C must implement the full candidate/admin report UX, tenant/counsellor self-service credit purchasing through preserved checkout/payment primitives, report download experiences, and optional counselling journeys. OTP, if approved, is also later work.
