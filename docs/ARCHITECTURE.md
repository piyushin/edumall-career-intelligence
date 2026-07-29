# EduMall Career Intelligence Platform - Architecture

**Repository:** piyushin/edumall-career-intelligence  
**Authoritative specification:** docs/SRS.md  
**Architecture status:** Approved direction for Phase 0 and V1 planning  
**Last updated:** 2026-07-30  

## 1. Executive Product Summary

The EduMall Career Intelligence Platform is a multi-tenant, multilingual, web-based assessment, counselling, reporting, and career-intelligence platform. The approved V1 product is **EduMall Career Intelligence Assessment - Classes 9-10**.

V1 will support a controlled pilot for **100-300 students in Gandhinagar/Gujarat**, initially covering **Classes 9 and 10, CBSE and GSEB English-medium students**. The platform will provide career-planning and stream-selection evidence for students, parents/guardians, counsellors, schools, EduMall Head Office, DiLCe Centres, and approved counsellors.

The platform must remain evidence-led, counsellor-reviewable, versioned, auditable, and privacy-preserving. It must not diagnose mental illness, guarantee a career, generate autonomous final narratives, copy proprietary psychometric material, or make automated adverse education or employment decisions.

## 2. Recommended Version 1 Scope

V1 should implement a production-grade pilot platform for Classes 9-10:

- Tenant and organisation management for EduMall Head Office, schools, DiLCe Centres, and approved counsellors.
- Managed identity integration, application roles, tenant memberships, consent records, and session controls.
- Candidate onboarding with verified guardian consent, student assent, consent version, and consent timestamp for all candidates under 18.
- Campaign, invitation, assignment, completion tracking, and counsellor case workflow.
- English assessment content delivery first, with Gujarati-ready interface/report architecture and Hindi/Marathi architecture readiness.
- Versioned assessment authoring and interpretation-library governance.
- Assessment delivery with instructions, language selection, autosave, resume, server-authoritative timers, and idempotent submission.
- Coverage for career-planning readiness, personality, interests, values, emotional intelligence, cognitive abilities, aptitudes, study behaviour, executive functioning, achievement motivation, communication/social skills, creativity, leadership potential, resilience, development-support indicators, stream suitability, career-cluster suitability, and career roadmap.
- Provisional 30-40 page report generated from version-controlled interpretation rules.
- Counsellor approval for sensitive indicators and report release.
- Aggregate school analytics plus specifically authorised student-report access.
- Audit logs, download logs, tenant-isolation tests, cross-tenant access tests, and structured operational monitoring.

V1 must use synthetic/test fixtures until approved psychometric content, scoring rules, norm tables, and interpretation rules are supplied by authorised human owners.

## 3. Deferred Scope For Later Phases

Deferred tenant and product scope:

- Colleges.
- Universities.
- ITIs.
- Polytechnics.
- Employers.
- Corporate HR clients.
- Full employability and HR decision-support modules.
- 360-degree feedback.
- 9-box grid.
- Overseas country-readiness modules.

Deferred technical/product scope:

- Enterprise SSO.
- Native mobile applications.
- Advanced proctoring.
- AI narrative personalisation.
- Commerce beyond pilot needs.
- Data warehouse and advanced analytics.
- Public partner APIs and broad third-party integrations.

## 4. Primary User Roles

V1 roles:

- Platform Owner: global EduMall administration, tenant setup, security, release controls, and operational oversight.
- School Admin: manages authorised school campaigns, candidate lists, and aggregate analytics.
- DiLCe Centre Admin: manages approved centre campaigns and candidate support workflows.
- Approved Counsellor: reviews complete results, sensitive indicators, counselling notes, recommendations, and release controls.
- Candidate/Student: completes onboarding, assent, assigned assessment, and views approved summary/recommendations.
- Parent/Guardian: provides verified consent and receives the full approved report.
- Content Author: drafts controlled assessment/report content but cannot self-publish.
- Translator/Language Reviewer: reviews and approves language versions.
- Psychometric Director: approves instruments, scoring assets, interpretation library, validation status, and release readiness.
- Auditor/Support: has reason-coded, time-bound, audited diagnostic access only.

Deferred roles include employer/HR admin, assessor/proctor for advanced proctoring, college/university admin, ITI/polytechnic admin, and corporate HR panel reviewers.

## 5. Tenant And Organisation Types

Approved V1 tenant types:

- EduMall Head Office.
- School.
- DiLCe Centre.
- Approved Counsellor.

Deferred tenant types:

- Colleges.
- Universities.
- ITIs.
- Polytechnics.
- Employers.
- Corporate HR clients.

The organisation model should support schools with branches/classes/batches, DiLCe Centres with local counsellor operations, and approved counsellor practices with authorised case assignments. It should not hard-code school-only assumptions because later phases require colleges, ITIs, polytechnics, and employers.

## 6. Access-Control Boundaries

Access control must combine RBAC, tenant scope, organisation scope, campaign scope, report-release state, minor-data rules, and purpose limitation.

Required V1 boundaries:

- Students see only student-friendly summaries and approved recommendations.
- Parents/guardians see the full approved report for linked minors according to consent and release rules.
- Counsellors see complete results, review controls, confidential counselling notes, and release controls for assigned cases.
- Schools see aggregate analytics and only specifically authorised student reports.
- Private counselling notes are not visible to schools unless separately authorised.
- DiLCe Centres access only authorised candidates and campaigns.
- EduMall Head Office access is privileged, least-privilege, audited, and purpose-bound.
- Support access is time-bound, reason-coded, and audited.
- Tenant and campaign boundaries are enforced in application services and tested automatically.

## 7. Recommended Technology Stack

Approved stack:

| Layer | Approved choice |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Components | Accessible UI component library |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| Data access | Prisma |
| Cache/queue foundation | Redis |
| Jobs | BullMQ |
| Object storage | S3-compatible private object storage |
| PDF rendering | Internal Playwright PDF worker |
| Runtime/development | Docker |
| CI/CD | GitHub Actions |
| Monitoring | Structured logs, correlation IDs, OpenTelemetry-compatible instrumentation, error tracking, operational alerts |

Hosting direction: managed cloud infrastructure with primary storage and processing in India.

## 8. Monorepo Structure

Recommended structure:

```text
/apps/web                 Next.js candidate, guardian, counsellor, school, centre, and admin UI
/apps/api                 NestJS modular-monolith API
/apps/worker              BullMQ workers for scoring, PDF, notifications, imports, and audit/event processing
/packages/ui              Accessible design system and report components
/packages/contracts       OpenAPI schemas, DTOs, and generated clients
/packages/domain          Shared domain types, state machines, policies, and pure business rules
/packages/scoring         Versioned scoring interfaces and deterministic scoring runtime
/packages/reporting       Report schemas, render contracts, components, and interpretation bindings
/packages/i18n            Locale resources, terminology controls, and review metadata
/packages/security        Permission helpers, audit-event types, and crypto abstractions
/packages/testing         Synthetic fixtures, factories, and contract-test helpers
/packages/config          Shared TypeScript, lint, format, test, and build config
/infra                    Future deployment and monitoring definitions after CTO approval
/docs                     SRS, architecture, ADRs, decision log, open questions, threat model
```

This structure is for future implementation. This documentation task creates no application code, package files, Docker files, migrations, or infrastructure.

## 9. Frontend Architecture

The frontend should be a Next.js application organised around role-specific route groups:

- Candidate/student assessment and report summary.
- Parent/guardian consent and full approved report access.
- Counsellor case review and report-release workflow.
- School aggregate analytics and authorised report access.
- DiLCe Centre campaign and support workflow.
- EduMall Head Office administration.
- Content, translation, and interpretation-review workflow.

The frontend must not compute authoritative scores, norms, sensitive alerts, or final recommendations. It renders backend-provided structured facts, report components, and release states.

Frontend requirements:

- Accessible assessment player with keyboard support, responsive layout, visible save state, timer display, and connection status.
- Gujarati-ready UI/report architecture from the beginning.
- Hindi and Marathi architecture readiness.
- No hard-coded user-facing strings.
- No autonomous AI-generated narrative.
- Charts and report content must remain readable in web and PDF.

## 10. Backend And API Architecture

Use a **modular monolith for V1** with strong module boundaries. Recommended modules:

- Identity and Tenancy.
- Roles, Permissions, and Memberships.
- Candidate Profile, Guardian Consent, and Student Assent.
- Organisations, Campaigns, and Assignments.
- Assessment Authoring.
- Translation and Language Review.
- Assessment Delivery.
- Attempt, Autosave, Timer, and Submission.
- Scoring Orchestration.
- Interpretation Library.
- Report Generation and Release.
- Counsellor Review.
- School Analytics.
- Audit, Privacy, and Governance.
- Notifications.
- Object Storage.
- Operations and Monitoring.

Use background jobs and internal events for asynchronous processing, including scoring, PDF rendering, notifications, imports, exports, and operational/audit event processing.

Expose versioned REST APIs under `/api/v1` with OpenAPI contracts. GraphQL is deferred unless later dashboards require it.

## 11. PostgreSQL Database Approach

PostgreSQL is the transactional source of truth for:

- Tenants, organisations, memberships, roles, and permissions.
- Candidate profiles, guardian links, consent versions, and student assent.
- Campaigns, assignments, attempts, responses, timer state, and integrity events.
- Instruments, forms, items, translations, interpretation rules, and publication state.
- Scoring snapshots, result facts, report releases, and counsellor review records.
- Audit events, download logs, privacy requests, and retention controls.

Database principles:

- UUID or ULID identifiers.
- UTC timestamps.
- Strong tenant and ownership foreign keys.
- Append-only snapshots for submitted attempts, score facts, report releases, consent history, and audit events.
- PII logically separated from responses and analytics where practical.
- JSONB only for bounded versioned payloads such as report facts, scoring snapshots, and source metadata.
- Indexes on tenant, organisation, campaign, assignment, attempt, status, and timestamp access paths.

## 12. Prisma Data-Access Approach

Prisma should be the primary application data-access layer.

Required conventions:

- Central Prisma client wrapper with request context, tenant context, actor context, and correlation ID.
- No direct controller-level ad hoc data access.
- Service/repository methods require explicit tenant and purpose context.
- Transactions for submission finalisation, report release, consent changes, publication approvals, and audit-critical updates.
- Raw SQL only when reviewed for RLS, locking, performance, or analytics.
- Migration workflow must include review, testing, and rollback/forward-fix documentation once implementation begins.

Prisma must not obscure permission rules. Tenant isolation and permission checks are domain rules and must be tested.

## 13. Multi-Tenant Data-Isolation Model

Approved model:

- Application-layer tenant enforcement.
- PostgreSQL Row-Level Security where practical.
- Automated cross-tenant access tests.

Every tenant-owned record should carry tenant ownership unless truly platform-global and read-only. Shared platform content must have explicit ownership, publication, and visibility rules.

Test coverage must include:

- Cross-tenant reads.
- Cross-tenant writes.
- IDOR attempts.
- Report access.
- Object-storage signed URL access.
- School aggregate drill-down privacy thresholds.
- Counsellor case-assignment scope.

## 14. Authentication And Session Model

Approved direction:

- Managed identity provider preferred.
- Application roles, permissions, tenant memberships, consent records, guardian links, and student assent remain in PostgreSQL.

V1 model:

- Secure web session with managed identity integration.
- MFA required for privileged roles when supported by the identity provider.
- Session/device management and login alerts.
- Rate limits and abuse protection for auth endpoints.
- Guardian-linked accounts for minors.
- Student assent captured separately from guardian consent.

Enterprise SSO is deferred.

## 15. Role-Based And Tenant-Based Permissions

Use RBAC for baseline capabilities and policy checks for tenant, organisation, campaign, role, purpose, age/minor status, and report-release state.

Required policies:

- School admins cannot access private counselling notes unless separately authorised.
- Schools cannot access individual reports unless specifically authorised.
- Counsellors can access complete results only for assigned cases.
- Parents/guardians can access linked minor reports only after release.
- Students see student-friendly summary and approved recommendations only.
- EduMall privileged access is least-privilege and audited.
- Content publication, translation publication, interpretation-library publication, and report release require maker-checker or authorised approval.

## 16. Parent Consent And Minor-Data Controls

For all candidates under 18:

- Verified guardian consent is required.
- Student assent is required.
- Consent version and timestamp are stored.
- Purpose-specific consent covers assessment, report sharing, counselling, communications, and optional future research/validation where approved.
- Consent withdrawal, correction, deletion, and grievance workflows must be auditable.
- Sensitive indicators cannot be released without human counsellor review.

Retention default: **three years after last active service**, followed by deletion or anonymisation unless legal hold, renewed consent, or contractual requirements apply. Retention periods must be configurable and remain subject to final legal approval.

## 17. Student-Profile Architecture

V1 student profile should capture only necessary fields:

- Identity and contact fields required for assessment and guardian workflow.
- Age/date of birth sufficient to enforce minor controls.
- Class, board, medium, school, location, and campaign assignment.
- Language preference.
- Optional academic/context fields only where approved for interpretation.
- Accommodation requests stored separately and not used to penalise scores.

Profile snapshots should be captured at assignment/submission/report time so reports can explain which facts were used.

## 18. Assessment-Authoring Architecture

Authoring must be governed and versioned:

- Instruments, editions, forms, sections, item pools, items, options, media, and locale variants.
- Lifecycle: draft, review, pilot, approved, published, suspended, retired.
- Maker-checker approval for controlled content.
- Independent translation review and versioning.
- No copied proprietary questions.
- No generated assessment questions in implementation tasks unless specifically approved later.

The initial pilot may use English assessment content first, but the data model and UI must be Gujarati-ready and Hindi/Marathi architecture-ready.

## 19. Question-Bank Versioning

Question-bank rules:

- Published item versions are immutable.
- Corrections create new versions.
- Every attempt references exact instrument, edition, form, item, option, language, scoring model, norm set, and interpretation/report versions.
- Item exposure and compromise flags are tracked.
- Pilot and provisional content cannot be marketed as validated.
- Historical attempts are not silently recalculated after content, key, norm, translation, or interpretation changes.

## 20. Translation And Language-Review Workflow

Approved language approach:

- English assessment content first.
- Gujarati-ready interface and report architecture from the beginning.
- Hindi and Marathi architecture-ready.
- All translations require independent review and versioning.

Workflow:

- Source content created and approved.
- Forward translation.
- Independent review for language, reading level, culture, and technical meaning.
- Back-translation or bilingual reconciliation where required.
- Psychometric/language performance review when data exists.
- Maker-checker approval.
- Stale translation blocking when source content changes.

## 21. Assessment-Delivery Architecture

Delivery flow:

- Assignment through campaign or authorised counsellor/school action.
- Pre-test instructions, consent confirmation, language selection, device check, and practice section.
- Attempt starts only after eligibility and consent checks pass.
- Form snapshot and section rules are server-authoritative.
- Autosave after every response and heartbeat.
- Resume returns authoritative server state.
- Submit is idempotent and locks the attempt.
- Scoring and report jobs run asynchronously.

The assessment experience must support low-friction pilot administration while preserving integrity and auditability.

## 22. Autosave And Resume Design

Autosave design:

- Save every response with attempt ID, item version, section ID, response payload, client sequence, server timestamp, and idempotency key.
- Heartbeat stores connection state, active section, timer checkpoint, and progress.
- Local buffering may cover brief network interruptions but must be scoped to the active authenticated user and cleared after sync/logout.
- Server reconciles duplicate or out-of-order saves.
- Resume uses server state, not client memory, as the source of truth.
- Final submission freezes responses.

## 23. Timed Assessment Controls

Timed controls:

- Server-authoritative timers.
- Section and total timers configurable by instrument and accommodation rules.
- Pause/break rules explicit per campaign/instrument.
- Client displays timer; server enforces timer.
- Expiry and finalisation are idempotent.
- Timing anomalies generate integrity/validity events.

Integrity events may identify unusual behaviour but must not automatically accuse a candidate of cheating.

## 24. Response Integrity And Audit Events

Track:

- Attempt lifecycle.
- Autosave and heartbeat.
- Section entry/exit.
- Submission and lock state.
- Timer events.
- Unusual behaviour and integrity events.
- Validity flags.
- Report release and report access.
- Private note changes.
- Consent changes.
- Download events.

Audit events should include actor, tenant, role, purpose, timestamp, correlation ID, reason where required, and before/after values where appropriate.

## 25. Scoring-Engine Boundaries

Scoring must be deterministic and backend-only:

- No scoring in frontend code.
- No autonomous AI scoring.
- No invented scoring formulas.
- No hidden tenant-specific scoring overrides.
- Inputs are immutable attempt snapshots and approved scoring assets.
- Outputs are structured score facts, validity flags, confidence data, and report facts.

Live scoring requires approved scoring rules, signed fixtures, and psychometric sign-off.

## 26. Scoring-Model Versioning

Each scoring model should include:

- Instrument and form applicability.
- Version, status, effective date, owner, and approval record.
- Keys, weights, missingness rules, minimum-answer rules, validity rules, and score derivation rules once approved.
- Compatibility with norm tables and interpretation rules.
- Signed golden fixtures.

Any change creates a new version. Historical results retain their original scoring snapshot.

## 27. Norm-Table Versioning

Norm tables should include:

- Norm set ID.
- Instrument/scoring compatibility.
- Norm group definition.
- Sample metadata.
- Language/cohort coverage.
- Reliability/validity metadata.
- Review date and limitations.
- Status: pilot, provisional, validated, suspended, or retired.

V1 reports are provisional unless psychometric leadership approves validated claims.

## 28. Interpretation-Rule Versioning

The V1 report uses a version-controlled interpretation library:

- Component ID and version.
- Score/data bindings.
- Visibility rules.
- Confidence rules.
- Language resources.
- Sensitive-alert rules.
- Human-review requirement.
- Approval state.

No autonomous AI-generated narrative is allowed in V1. Counsellor edits may add interpretation but cannot change raw scores or immutable score facts.

## 29. Career Knowledge-Base Architecture

V1 should include only the career/stream/cluster knowledge needed for Classes 9-10 stream and career-cluster suitability.

Rules:

- Source, owner, retrieval date, review date, and licence/usage notes are required.
- Recommendations must show evidence and confidence.
- No final career guarantee.
- Career-cluster and stream recommendations must never depend on one domain alone.
- No proprietary report narratives or third-party protected materials may be copied.

## 30. Competency-Framework Architecture

Corporate competency frameworks are deferred. The architecture should remain compatible with future competency and employability modules but should not implement them in V1.

V1 may include student-facing competency-like dimensions such as communication, creativity, leadership potential, study behaviour, executive functioning, and development-support indicators, but these remain education/counselling indicators and not employment decision tools.

## 31. Student-Report Generation Architecture

Approved V1 report:

- Provisional 30-40 page report.
- Version-controlled interpretation library.
- No autonomous AI-generated narrative.
- No diagnosis.
- No final career guarantee.
- Sensitive indicators require counsellor approval.

Report access:

- Student: student-friendly summary and approved recommendations.
- Parent/guardian: full approved report.
- Counsellor: complete results, review controls, and confidential counselling notes.
- School: aggregate analytics and only specifically authorised student reports.
- Private counselling notes: not visible to schools unless separately authorised.

The report should be generated from structured facts and approved components, with web and PDF using the same source facts.

## 32. Employee-Report Generation Architecture

Employee and HR report generation is deferred. The architecture should preserve future compatibility with employability, employee potential, promotion readiness, 360-degree feedback, and 9-box modules, but no V1 implementation should create corporate HR decision workflows.

No automated adverse employment decision is permitted in any phase.

## 33. Counsellor Review And Report-Release Workflow

Counsellor governance:

- Counsellors must be approved by EduMall and trained on the assessment framework.
- Qualification requirements remain configurable.
- Sensitive alerts cannot be released without human review.

Workflow:

- Counsellor sees assigned cases, completion status, validity flags, and sensitive indicators.
- Counsellor reviews complete results and adds notes/action plan.
- Confidential counselling notes remain counsellor-visible unless separately authorised.
- Report release records actor, recipients, report version, timestamp, and purpose.
- Overrides or recommendation adjustments require reason and preserve the original algorithmic output.

## 34. Sensitive-Alert Review Controls

Sensitive indicators include development-support indicators, severe response-quality concerns, wellbeing-related indicators, and other high-impact flags.

Controls:

- Human counsellor review is mandatory before release.
- Student-facing wording must be developmental and non-diagnostic.
- No psychiatric diagnosis.
- No automatic accusation of cheating.
- No automated adverse education or employment decision.
- Serious indicators cannot be released solely by generated narrative.
- Review decisions are audited.

## 35. PDF Generation Approach

Approved approach:

- Internal Playwright-based rendering worker.
- No dependency on a proprietary external PDF platform.
- Server-side deterministic HTML/CSS rendering.
- Embedded fonts for English and Indian-language readiness.
- Report ID, page numbers, confidentiality marking, and QR/verification support.
- Private object storage with signed downloads.
- Download audit logs.
- Same structured report facts for web and PDF.

PDF generation should run asynchronously through BullMQ.

## 36. File And Object-Storage Approach

Approved object-storage controls:

- S3-compatible private object storage.
- Private by default.
- Encryption at rest.
- Short-lived signed URLs.
- Download audit logs.
- No secrets or credentials committed to the repository.
- Object keys must not expose PII.
- Generated reports and media files are tracked in PostgreSQL with owner, tenant, purpose, hash, retention, and deletion status.

## 37. Redis And Queue Usage

Use Redis and BullMQ for:

- Scoring jobs.
- PDF rendering jobs.
- Notification jobs.
- Bulk import validation jobs.
- Audit/event fanout.
- Operational retries and dead-letter queues.

Jobs must be idempotent, retryable, observable, and linked to correlation IDs.

## 38. Audit Logging

Audit logging must cover:

- Login/session/security events.
- Tenant and permission changes.
- Consent and assent events.
- Candidate profile changes.
- Assessment authoring and publication events.
- Attempt lifecycle and submission events.
- Integrity events.
- Scoring and interpretation version use.
- Counsellor review, notes, overrides, and release events.
- Report access and download logs.
- Support access and data exports.

Audit logs must be immutable and protected from tenant tampering.

## 39. Security And Privacy Controls

Security and ethics requirements:

- Security assessment required before pilot release.
- Security assessment required before public production release.
- Managed secrets service only.
- No secrets committed to the repository.
- Encryption in transit and at rest.
- Least-privilege access.
- Automated cross-tenant access tests.
- No copied proprietary questions, scoring rules, or report narratives.
- No autonomous AI-generated report narrative in V1.
- No automated adverse education or employment decision.
- No psychiatric diagnosis.

## 40. Encryption Approach

Recommended approach:

- TLS for all external and internal service traffic where practical.
- Managed database encryption at rest.
- Object-storage encryption at rest.
- Managed secrets service for credentials and signing keys.
- Separate secrets per environment.
- Key rotation policy before production.
- Field-level protection or tokenisation for high-risk identifiers if legal/security review requires it.

Avoid custom cryptography.

## 41. Backup And Disaster-Recovery Approach

Approved direction:

- Multi-zone database deployment.
- Point-in-time recovery.
- Encrypted backups.
- Regular restoration tests.
- Cross-region disaster recovery before full-scale production.

Redis should not be the only store for critical business state. Critical job inputs and immutable snapshots belong in PostgreSQL.

## 42. Development, Staging And Production Environments

Environment model:

- Local development with synthetic data only.
- CI/test with ephemeral services.
- Staging with production-like controls and synthetic or approved anonymised data.
- Production with managed cloud infrastructure, India primary storage/processing, protected secrets, monitoring, backups, and restricted access.

Feature flags should control pilot-only functionality, unfinished modules, scoring versions, report templates, and tenant onboarding.

## 43. Docker Strategy

Docker is approved for development and deployment packaging.

Future implementation should use:

- Separate images for web, API, and worker.
- Docker Compose for local PostgreSQL, Redis, object-storage emulator, API, worker, and web.
- Multi-stage builds.
- Non-root runtime users.
- Health checks.
- Container scanning in CI.

This document creates no Docker files.

## 44. GitHub Actions CI/CD Strategy

GitHub Actions should enforce:

- Format check.
- Lint.
- Type-check.
- Unit tests.
- Integration tests.
- Tenant-isolation tests.
- OpenAPI contract validation.
- Accessibility checks once UI exists.
- Playwright E2E checks once flows exist.
- Security scans.
- Migration validation once migrations exist.

Deployment workflows should be added after environment and provider details are finalised.

## 45. Monitoring And Error-Tracking Approach

Approved monitoring:

- Structured logs.
- Correlation IDs.
- OpenTelemetry-compatible instrumentation.
- Error tracking.
- Operational alerts.

Monitor:

- API latency and errors.
- Auth/security events.
- Autosave failures.
- Submission failures.
- Queue depth and failures.
- PDF rendering failures.
- Notification delivery failures.
- Cross-tenant access denials.
- Report download activity.
- Backup/restore health.

## 46. Automated Testing Strategy

V1 testing must include:

- Permission and tenant-isolation tests.
- Consent and minor-data tests.
- Autosave/resume/submission tests.
- Timer-state tests.
- Report-release visibility tests.
- Counsellor-note confidentiality tests.
- Object-storage signed URL tests.
- Audit-log tests.
- Accessibility checks.
- PDF rendering checks for layout and language readiness.
- Security tests before pilot release.

Scoring tests require approved golden fixtures before live scoring release.

## 47. Accessibility Requirements

The platform should target WCAG 2.2 AA.

Requirements:

- Keyboard-accessible assessment player and dashboards.
- Screen-reader labels and semantic structure.
- Visible focus states.
- Non-colour-only status indicators.
- Readable typography for English and Gujarati-ready layouts.
- Mobile support down to a 360 x 640 assessment viewport.
- Accessible PDF/report structure where feasible.
- Accommodations workflow that does not penalise scores.

## 48. Performance And Scaling Approach

V1 pilot scale is 100-300 students, but the architecture should be ready for institutional test windows.

Design choices:

- Lightweight autosave endpoint.
- Queue-based scoring/PDF/notification work.
- Indexed PostgreSQL access paths.
- Backpressure and retry for queues.
- Low-bandwidth-friendly assessment delivery.
- Static asset caching.
- Clear load-test plan before public production.

Large-scale concurrency targets should be validated after pilot learnings.

## 49. Data-Retention And Deletion Approach

Approved default:

- Three years after last active service.
- Then deletion or anonymisation unless legal hold, renewed consent, or contractual requirements apply.
- Retention periods must be configurable.
- Final legal approval is still required.

Deletion/anonymisation must coordinate PostgreSQL records, object storage, report artifacts, audit records, and legal-hold state. Soft deletion alone is insufficient for privacy deletion.

## 50. First 10 Implementation Pull Requests

Recommended first PRs after this documentation baseline:

1. Documentation and ADR foundation: architecture baseline, decision log, open questions, threat-model outline, data classification, and contribution rules.
2. Monorepo skeleton: package manager, TypeScript, lint, format, test, and CI smoke workflow.
3. Local Docker foundation: PostgreSQL, Redis, object-storage emulator, health checks, and environment templates.
4. NestJS API skeleton: modular layout, config validation, health endpoints, structured logging, correlation IDs, and OpenAPI setup.
5. Next.js web skeleton: route groups, design-system wiring, accessibility baseline, and i18n infrastructure.
6. Prisma foundation: tenant/user/audit schema planning, migration workflow documentation, and synthetic fixtures.
7. Identity and tenant policy: managed identity adapter boundary, role/membership model, guards, and tenant-isolation tests.
8. Consent and minor-data workflow: guardian consent, student assent, consent versioning, and privacy events.
9. Assessment authoring contracts: instrument/form/item/language/version lifecycle contracts without live questions.
10. Attempt lifecycle contracts: assignment, attempt state machine, autosave, resume, submit, integrity events, and tests with synthetic placeholders.

## 51. Major Technical Risks

- Cross-tenant data leakage.
- Weak minor-data and consent enforcement.
- Autosave/submission race conditions.
- Historical score/report mutation after version changes.
- PDF layout failures in Gujarati-ready and future Hindi/Marathi rendering.
- Object-storage misconfiguration exposing reports.
- Incomplete audit logs for release, support, or downloads.
- Over-customisation that undermines validated scoring or disclaimers.
- Weak monitoring before pilot.
- Security gaps discovered late because testing is delayed.

## 52. Major Psychometric Risks

- Pilot/provisional results being presented as validated.
- Inadequate validation plan, item-count plan, or norm-sample plan.
- Translation equivalence issues once Gujarati content is introduced.
- False precision in stream/career-cluster suitability.
- Sensitive indicators interpreted as diagnosis.
- Development-support indicators released without counsellor review.
- Recommendation logic based on incomplete or low-quality evidence.
- Counsellor edits confused with raw scores.
- Third-party proprietary material copied into questions, scoring, or reports.

## 53. Major Ethical And Legal Risks

- Missing or weak guardian consent/student assent.
- Report access beyond approved audience.
- Schools accessing private counselling notes without separate authorisation.
- Unsupported career guarantees.
- Psychiatric diagnosis language.
- Automated adverse education or employment decisions.
- Accusing candidates of cheating based only on integrity events.
- Retention periods applied without final legal approval.
- Candidate data used for research or AI training without lawful basis and approval.
- Inaccessible UI or reports excluding target users.

## 54. Approved Decisions

Approved decisions are recorded in `docs/DECISION_LOG.md`.

## 55. Remaining Open Questions

Only unresolved matters are recorded in `docs/OPEN_QUESTIONS.md`. Approved decisions are not repeated as open questions.

## 56. Recommended Immediate Next Step

Begin Phase 0 with documentation and foundation PRs only. Before application code begins, create ADRs for managed identity, tenant isolation/RLS, data classification, consent/minor-data policy, secrets management, object storage, PDF worker, observability, and environment strategy.
