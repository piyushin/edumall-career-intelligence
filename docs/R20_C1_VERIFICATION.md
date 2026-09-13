# R20-C1 Verification

## Implemented product operations

R20-C1 adds product-operations UI on top of the R20-A/B report platform without changing the Prisma schema, migrations, or scientific generation pipeline.

- Control Centre navigation now groups People, Career Intelligence, and Governance operations and routes Reports to `/admin/reports`. Commercial pages that belong to C2 are not advertised as complete.
- `/admin/reports` uses the protected report-search API for name, mobile, email, submission date range, tenant name, assessment, generation, candidate entitlement, and counsellor filtering with pagination.
- Report rows keep record visibility distinct from full-report and PDF authorization. Failed or configuration-blocked reports expose retry only when the API projects central-admin retry authority.
- `/admin/reports/[attemptId]` loads scoped metadata independently from the complete immutable payload. Properly permitted central administrators receive a readable sectioned report, PDF download, and retry controls; a visible record without full access exposes no report payload.
- `/admin/users/[userId]` is Candidate 360: identity/mobile, memberships, assessment attempts, automatic generation, short/detailed availability, candidate access, orders/payments/coupon snapshots, entitlements, report grants, counsellor assignments, and existing timestamps are shown only from authorized projections.
- Candidate 360 does not infer current state from `AssessmentReportRelease`. Existing release rows appear only under **Legacy release history**.
- User directory search now matches the existing nullable `phoneE164` field and returns it in the safe projection.
- `/staff/reports` uses the scoped R20 report API. Tenant administrators remain tenant-bound; counsellors remain bound to active assigned/shared candidates. No organization UUID input is present.
- `/staff/reports/[attemptId]` shows processing, generated, configuration-required, and generation-failed states. It loads the complete payload only when `canViewFullReport` is true.
- Old `/staff/results` URLs redirect safely to the current report workspace. Historical release APIs and evidence remain unchanged.
- Published assessment versions show existing automatic-report configuration readiness. The UI never creates or infers scientific configuration.

## Authorization boundary

Backend authorization remains authoritative. Search uses `report.search`; central complete-report reads use `report.view.full`; PDF uses `report.download`; retry uses `assessment.manage`; Candidate 360 sections follow `candidate.view`, `commerce.view`, `report.credit.view`, and `counsellor.assignment.view`. Tenant/counsellor report access still requires the R20-A grant policy in addition to record scope.

The new attempt-detail endpoints return the same safe report-search projection for one scoped attempt. They do not return the immutable report payload. Complete payloads remain on the separately protected `/full` endpoints.

## Post-implementation review fixes

- Complimentary report-credit allotment and revocation (`POST /admin/report-credits/wallets/:id/allot` and `/revoke-unused`) now require a central Super Admin or Platform Admin session. `report.credit.manage` remains in the legacy organization-admin permission set for wallet creation and consumption, but a tenant administrator can no longer create free credit value for their own wallet.
- `GET /admin/reports/:attemptId` and `GET /staff/reports/:attemptId` match the attempt identifier exactly within the caller's scope instead of routing it through the free-text `contains` search, and reject any projection whose `attemptId` differs from the requested one.
- A platform-admin directory spec used a fixed invitation expiry date that had elapsed; the fixture is now relative to the current time.

## Verification commands

Run from the repository root:

```text
pnpm lint
pnpm type-check
pnpm --filter @edumall/api test
pnpm --filter @edumall/web test
pnpm build
```

Focused coverage verifies navigation and route separation, name/mobile/email search, generation state, action authorization, Candidate 360 generation semantics and mobile/report links, server-side tenant/counsellor scope, inaccessible-record behavior, permitted full-report opening, removal of current release wording, legacy release compatibility, and the unchanged candidate free-summary flow.

## Remaining R20-C2

- Dedicated payments and orders UI.
- Coupon management UI.
- Report-credit wallet purchase and allocation UX.
- Backend-controlled pricing UX.
- Tenant and counsellor self-service credit purchase.
- Counselling booking, scheduling, payment, and fulfilment.
