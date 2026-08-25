# R19.1C Super Admin Control Centre

## Launch scope

R19.1C provides the operational UI for the accepted R19.1A authorization boundary and R19.1B platform APIs. It includes the platform dashboard, administrator and assignment management, protected and custom role governance, audit exploration, organization support, global user/customer support, and the existing assessment, assignment, report-release, commerce and entitlement entry points.

The browser never determines authoritative access. `/auth/session` returns the effective permissions already resolved by the server. Navigation and controls use that safe projection for usability, while every data request and mutation remains protected by the API role, permission, scope, CSRF and audit controls. A page whose session lacks platform scope suppresses its global API effect and renders access denied.

No credential hash, reset material, raw invitation token, session token or unrestricted audit metadata is requested or rendered. Sessions remain in HTTP-only cookies and are never copied to browser storage. A 401 redirects to the same-origin login flow; a 403 remains an explicit access-denied result.

## Launch P1 — ADMIN_INVITATION_EMAIL_DELIVERY

Administrative invitation creation, resend and revoke are operational and observable, but the production email provider and outbox dispatcher are not configured in this source-development phase. `BLOCKED_CONFIGURATION` is displayed as:

> Invitation created — email delivery is not configured.

The UI must never claim that an email was sent unless the backend returns a confirmed sent delivery status. `ADMIN_INVITATION_EMAIL_DELIVERY` must be closed separately before final commercial-launch acceptance.
