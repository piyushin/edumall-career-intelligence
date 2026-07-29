# Decision Log

**Repository:** piyushin/edumall-career-intelligence  
**Status:** Approved architecture and product decision baseline  
**Date:** 2026-07-30  

## D-001 - V1 Product Name

- **Decision ID:** D-001
- **Date:** 2026-07-30
- **Decision:** The V1 product name is EduMall Career Intelligence Assessment - Classes 9-10.
- **Reason:** The first release needs a clear, audience-specific scope aligned with the approved pilot.
- **Alternatives considered:** Generic EduMall Career Intelligence Platform; broader school assessment brand.
- **Consequences:** Product copy, report titles, campaign setup, and pilot communications should use the approved V1 name.
- **Status:** Approved
- **Revisit trigger:** Product owner approves expansion beyond Classes 9-10 or a broader brand architecture.

## D-002 - Initial Pilot

- **Decision ID:** D-002
- **Date:** 2026-07-30
- **Decision:** Initial pilot covers 100-300 students in Gandhinagar/Gujarat, Classes 9 and 10, CBSE and GSEB English-medium students initially.
- **Reason:** A bounded cohort reduces operational, language, validation, and support risk.
- **Alternatives considered:** Pan-India launch; all boards; all language mediums; larger institutional rollout.
- **Consequences:** V1 workflows, reporting, support, and validation planning should prioritise this cohort.
- **Status:** Approved
- **Revisit trigger:** Pilot completion, product-owner expansion approval, or psychometric evidence requiring cohort changes.

## D-003 - Language Approach

- **Decision ID:** D-003
- **Date:** 2026-07-30
- **Decision:** English assessment content comes first; Gujarati-ready interface and report architecture are required from the beginning; Hindi and Marathi remain architecture-ready; all translations require independent review and versioning.
- **Reason:** The pilot needs English content first while avoiding a later localisation rewrite.
- **Alternatives considered:** Full four-language launch; English-only architecture; runtime machine translation.
- **Consequences:** UI, report, content, and database models must support versioned locales and review states from Phase 0.
- **Status:** Approved
- **Revisit trigger:** Gujarati content pilot approval, Hindi/Marathi rollout approval, or language-equivalence findings.

## D-004 - Initial Tenant Types

- **Decision ID:** D-004
- **Date:** 2026-07-30
- **Decision:** V1 supports EduMall Head Office, School, DiLCe Centre, and Approved Counsellor tenant types.
- **Reason:** These tenant types are sufficient for the Classes 9-10 pilot.
- **Alternatives considered:** Include colleges, ITIs, employers, or public B2C as V1 tenants.
- **Consequences:** Tenant data model must support future extension but V1 UI and permissions focus on approved tenant types.
- **Status:** Approved
- **Revisit trigger:** Pilot channel expansion or business approval of additional tenant categories.

## D-005 - Deferred Tenant Types

- **Decision ID:** D-005
- **Date:** 2026-07-30
- **Decision:** Colleges, universities, ITIs, polytechnics, employers, and corporate HR clients are deferred.
- **Reason:** These tenants introduce distinct workflows, legal risks, and report families outside the V1 pilot.
- **Alternatives considered:** Build all tenant types into V1; implement corporate HR early.
- **Consequences:** Architecture remains extensible but no V1 implementation should optimise for deferred tenants.
- **Status:** Approved
- **Revisit trigger:** Separate business approval for higher education, vocational, or employer modules.

## D-006 - V1 Assessment Coverage

- **Decision ID:** D-006
- **Date:** 2026-07-30
- **Decision:** V1 covers career-planning readiness, personality, career interests, values/motivators, emotional intelligence, cognitive abilities, aptitudes, study behaviour, executive functioning, achievement motivation, communication/social skills, creativity, leadership potential, resilience, development-support indicators, stream suitability, career-cluster suitability, and career roadmap.
- **Reason:** These domains match the Classes 9-10 stream-selection and career-exploration use case.
- **Alternatives considered:** Narrow stream-only report; full SRS catalogue; employability/HR modules.
- **Consequences:** Authoring, scoring, interpretation, and report architecture must support these domains without inventing formulas or content.
- **Status:** Approved
- **Revisit trigger:** Psychometric director revises the V1 instrument blueprint.

## D-007 - V1 Report

- **Decision ID:** D-007
- **Date:** 2026-07-30
- **Decision:** V1 report is a provisional 30-40 page report with version-controlled interpretation library, no autonomous AI-generated narrative, no diagnosis, no final career guarantee, and counsellor approval for sensitive indicators.
- **Reason:** The pilot needs a rich but controlled report before validated commercial claims are available.
- **Alternatives considered:** Short summary report; full premium 40-page validated report; AI-generated narrative.
- **Consequences:** Report generation must be deterministic and reviewable, with provisional language and release controls.
- **Status:** Approved
- **Revisit trigger:** Psychometric validation, legal approval, or product approval for report-format changes.

## D-008 - Student Report Access

- **Decision ID:** D-008
- **Date:** 2026-07-30
- **Decision:** Students receive student-friendly summary and approved recommendations.
- **Reason:** Student-facing information should be age-appropriate and avoid sensitive or overly technical content.
- **Alternatives considered:** Full raw report for students; counsellor-only release.
- **Consequences:** Report components need audience-specific visibility rules.
- **Status:** Approved
- **Revisit trigger:** Legal/product changes to minor report access policy.

## D-009 - Parent/Guardian Report Access

- **Decision ID:** D-009
- **Date:** 2026-07-30
- **Decision:** Parent/guardian receives the full approved report.
- **Reason:** Guardians need enough context to support minors while release remains controlled.
- **Alternatives considered:** Student-only report; parent summary only.
- **Consequences:** Guardian identity, consent, linkage, and release state must be enforced.
- **Status:** Approved
- **Revisit trigger:** Legal or product changes to guardian access policy.

## D-010 - Counsellor Report Access

- **Decision ID:** D-010
- **Date:** 2026-07-30
- **Decision:** Counsellors receive complete results, review controls, and confidential counselling notes.
- **Reason:** Counsellors need full evidence and private workspace to review sensitive indicators.
- **Alternatives considered:** Same report view as parents; no confidential notes.
- **Consequences:** Counsellor permissions and note visibility require explicit access rules.
- **Status:** Approved
- **Revisit trigger:** Counsellor governance policy changes or audit findings.

## D-011 - School Report Access

- **Decision ID:** D-011
- **Date:** 2026-07-30
- **Decision:** Schools receive aggregate analytics and only specifically authorised student reports.
- **Reason:** Schools need cohort insight without broad individual-data access.
- **Alternatives considered:** Full school access to all reports; aggregate-only access.
- **Consequences:** Aggregate privacy thresholds and report authorisation workflows are required.
- **Status:** Approved
- **Revisit trigger:** School contract model or legal/privacy policy changes.

## D-012 - Private Counselling Notes

- **Decision ID:** D-012
- **Date:** 2026-07-30
- **Decision:** Private counselling notes are not visible to schools unless separately authorised.
- **Reason:** Counselling notes may contain sensitive context outside school reporting purpose.
- **Alternatives considered:** School-visible notes by default; no private notes.
- **Consequences:** Notes need visibility categories and explicit release controls.
- **Status:** Approved
- **Revisit trigger:** Legal approval for a different school-note-sharing policy.

## D-013 - Candidates Under 18

- **Decision ID:** D-013
- **Date:** 2026-07-30
- **Decision:** Candidates under 18 require verified guardian consent, student assent, and stored consent version/timestamp.
- **Reason:** The pilot serves minors and must protect consent evidence.
- **Alternatives considered:** Guardian consent only; student assent only; school-level blanket consent.
- **Consequences:** Onboarding must include guardian verification, assent capture, consent versioning, and audit trails.
- **Status:** Approved
- **Revisit trigger:** Final legal policy changes or age-threshold changes.

## D-014 - Retention Default

- **Decision ID:** D-014
- **Date:** 2026-07-30
- **Decision:** Initial retention default is three years after last active service, followed by deletion or anonymisation unless legal hold, renewed consent, or contractual requirements apply.
- **Reason:** This balances counselling continuity with data minimisation.
- **Alternatives considered:** One-year retention; indefinite retention; tenant-specific retention only.
- **Consequences:** Retention jobs, policy configuration, and deletion/anonymisation workflows are required.
- **Status:** Approved
- **Revisit trigger:** Final legal approval, contract requirements, or regulatory change.

## D-015 - Retention Configurability

- **Decision ID:** D-015
- **Date:** 2026-07-30
- **Decision:** Retention periods must be configurable and marked as requiring final legal approval.
- **Reason:** Different contracts and legal requirements may require different retention periods.
- **Alternatives considered:** Hard-coded global retention; tenant-controlled retention without legal review.
- **Consequences:** Retention policy must be data-driven and approval-gated.
- **Status:** Approved
- **Revisit trigger:** Legal signs off default periods or introduces product-specific requirements.

## D-016 - Counsellor Approval And Training

- **Decision ID:** D-016
- **Date:** 2026-07-30
- **Decision:** Counsellors must be approved by EduMall and trained on the assessment framework.
- **Reason:** Human review quality is central to sensitive indicator handling and report release.
- **Alternatives considered:** Open counsellor registration; school-appointed counsellors without EduMall approval.
- **Consequences:** Counsellor onboarding, training state, and approval status must exist before release permissions.
- **Status:** Approved
- **Revisit trigger:** Counsellor partner model changes.

## D-017 - Counsellor Qualification Configurability

- **Decision ID:** D-017
- **Date:** 2026-07-30
- **Decision:** Counsellor qualification requirements remain configurable.
- **Reason:** Requirements may vary by programme, geography, and legal/psychometric guidance.
- **Alternatives considered:** Hard-code one qualification rule; no qualification tracking.
- **Consequences:** Permission rules should depend on configurable approval and qualification metadata.
- **Status:** Approved
- **Revisit trigger:** EduMall approves fixed certification requirements.

## D-018 - Sensitive Alert Release

- **Decision ID:** D-018
- **Date:** 2026-07-30
- **Decision:** Sensitive alerts cannot be released without human review.
- **Reason:** Sensitive indicators can affect minors and must not be automatically disclosed.
- **Alternatives considered:** Automatic release; suppress all sensitive indicators.
- **Consequences:** Report release workflow must block sensitive indicators pending counsellor approval.
- **Status:** Approved
- **Revisit trigger:** Safeguarding, legal, or psychometric review changes the release model.

## D-019 - Modular Monolith

- **Decision ID:** D-019
- **Date:** 2026-07-30
- **Decision:** Use a modular monolith for V1 with strong module boundaries.
- **Reason:** V1 needs speed, consistency, and transactional safety without premature distributed-system complexity.
- **Alternatives considered:** Microservices; single unstructured application.
- **Consequences:** Modules should have explicit contracts and remain extractable later.
- **Status:** Approved
- **Revisit trigger:** Scale, team size, or bounded-context pressure justifies service extraction.

## D-020 - Background Jobs And Internal Events

- **Decision ID:** D-020
- **Date:** 2026-07-30
- **Decision:** Use background jobs and internal events for asynchronous processing.
- **Reason:** Scoring, PDF generation, imports, notifications, and audit fanout should not block user requests.
- **Alternatives considered:** Synchronous processing; external event bus in V1.
- **Consequences:** BullMQ, idempotent jobs, retries, dead-letter handling, and correlation IDs are required.
- **Status:** Approved
- **Revisit trigger:** Scale requires managed queues or event streaming.

## D-021 - Preferred Technology Stack

- **Decision ID:** D-021
- **Date:** 2026-07-30
- **Decision:** Use Next.js, React, TypeScript, Tailwind CSS, accessible UI component library, NestJS, PostgreSQL, Prisma, Redis, BullMQ, S3-compatible private object storage, Playwright PDF worker, Docker, and GitHub Actions.
- **Reason:** The stack aligns with the SRS and supports a TypeScript monorepo with strong web/API/reporting foundations.
- **Alternatives considered:** Separate frontend/backend languages; external PDF SaaS; non-PostgreSQL database.
- **Consequences:** Initial PRs should establish TypeScript, NestJS, Next.js, Prisma, Redis/BullMQ, Docker, and CI foundations.
- **Status:** Approved
- **Revisit trigger:** CTO approves a stack exception due to operational constraints.

## D-022 - Hosting

- **Decision ID:** D-022
- **Date:** 2026-07-30
- **Decision:** Use managed cloud infrastructure with primary storage and processing in India.
- **Reason:** Managed services reduce operational risk while supporting data-location expectations.
- **Alternatives considered:** Self-hosting; non-India primary hosting.
- **Consequences:** Infrastructure selection must prioritise India-region services and managed operational controls.
- **Status:** Approved
- **Revisit trigger:** Legal, cost, or provider constraints require a different hosting model.

## D-023 - Authentication

- **Decision ID:** D-023
- **Date:** 2026-07-30
- **Decision:** Managed identity provider is preferred; application roles, permissions, tenant memberships, and consent records remain in PostgreSQL.
- **Reason:** Identity should use mature provider controls while business permissions stay application-owned.
- **Alternatives considered:** Fully custom auth; identity provider owns all app roles and consent.
- **Consequences:** Architecture needs an identity adapter and separate application authorization model.
- **Status:** Approved
- **Revisit trigger:** CTO selects a provider or approves internal auth due to constraints.

## D-024 - Tenant Isolation

- **Decision ID:** D-024
- **Date:** 2026-07-30
- **Decision:** Use application-layer tenant enforcement, PostgreSQL Row-Level Security where practical, and automated cross-tenant access tests.
- **Reason:** Tenant isolation is a critical security and privacy boundary.
- **Alternatives considered:** Application-only enforcement; database-only RLS; separate database per tenant.
- **Consequences:** Access policies must be tested at service and persistence boundaries.
- **Status:** Approved
- **Revisit trigger:** Security review or scale requirements change the isolation model.

## D-025 - Object Storage

- **Decision ID:** D-025
- **Date:** 2026-07-30
- **Decision:** Object storage is private by default, encrypted at rest, accessed through short-lived signed URLs, and covered by download audit logs.
- **Reason:** Reports and media may contain sensitive data and must not be public.
- **Alternatives considered:** Public buckets with obscure URLs; database-only file storage.
- **Consequences:** Object metadata, signing, audit, retention, and deletion workflows are required.
- **Status:** Approved
- **Revisit trigger:** Storage provider or compliance requirements change.

## D-026 - Secrets

- **Decision ID:** D-026
- **Date:** 2026-07-30
- **Decision:** Use managed secrets service only; no secrets committed to the repository.
- **Reason:** Secret leakage is a high-impact security risk.
- **Alternatives considered:** Environment files in repository; manual server secrets.
- **Consequences:** Environments need secret injection, rotation, and secret scanning.
- **Status:** Approved
- **Revisit trigger:** CTO selects a provider-specific secrets approach.

## D-027 - PDF Rendering

- **Decision ID:** D-027
- **Date:** 2026-07-30
- **Decision:** Use an internal Playwright-based rendering worker and do not depend on a proprietary external PDF platform.
- **Reason:** Reports require deterministic rendering, privacy control, and layout ownership.
- **Alternatives considered:** External PDF SaaS; client-side PDF generation.
- **Consequences:** Worker queues, browser dependencies, font packaging, layout tests, and object-storage output are required.
- **Status:** Approved
- **Revisit trigger:** Scale or operational evidence requires a managed rendering service.

## D-028 - Monitoring

- **Decision ID:** D-028
- **Date:** 2026-07-30
- **Decision:** Monitoring uses structured logs, correlation IDs, OpenTelemetry-compatible instrumentation, error tracking, and operational alerts.
- **Reason:** The platform needs traceability, audit support, and pilot readiness.
- **Alternatives considered:** Logs only; vendor-specific instrumentation only.
- **Consequences:** Correlation IDs and telemetry conventions must be part of the first backend foundations.
- **Status:** Approved
- **Revisit trigger:** CTO selects observability vendors or changes retention requirements.

## D-029 - Backup And Recovery

- **Decision ID:** D-029
- **Date:** 2026-07-30
- **Decision:** Use multi-zone database deployment, point-in-time recovery, encrypted backups, regular restoration tests, and cross-region DR before full-scale production.
- **Reason:** Candidate/report data needs recoverability and tested restoration.
- **Alternatives considered:** Single-zone database; backup without restore drills; cross-region DR from day one.
- **Consequences:** Production readiness requires documented restore tests and DR planning.
- **Status:** Approved
- **Revisit trigger:** Production scale, legal requirement, or provider architecture changes.

## D-030 - Deferred Technical Scope

- **Decision ID:** D-030
- **Date:** 2026-07-30
- **Decision:** Enterprise SSO, native mobile apps, advanced proctoring, AI narrative personalisation, corporate HR modules, 360-degree feedback, 9-box grid, and overseas country-readiness modules are deferred.
- **Reason:** These features add complexity and risk outside the V1 pilot.
- **Alternatives considered:** Include them in V1; build platform-wide modules upfront.
- **Consequences:** Architecture remains extensible, but initial implementation must not build deferred modules.
- **Status:** Approved
- **Revisit trigger:** Product owner approves a later-phase roadmap item.

## D-031 - Security Assessment

- **Decision ID:** D-031
- **Date:** 2026-07-30
- **Decision:** Security assessment is required before pilot release and before public production release.
- **Reason:** The platform handles minors, sensitive reports, and multi-tenant data.
- **Alternatives considered:** Security review after pilot; annual-only review.
- **Consequences:** Security testing must be scheduled into release gates.
- **Status:** Approved
- **Revisit trigger:** CTO/security changes release governance.

## D-032 - Integrity Event Language

- **Decision ID:** D-032
- **Date:** 2026-07-30
- **Decision:** Integrity events may identify unusual behaviour but must not automatically accuse a candidate of cheating.
- **Reason:** Integrity signals can be noisy and require careful interpretation.
- **Alternatives considered:** Automatic cheating labels; no integrity event tracking.
- **Consequences:** UI, reports, and audit labels must use neutral wording and review workflows.
- **Status:** Approved
- **Revisit trigger:** Psychometric/security review approves a revised integrity policy.

## D-033 - No Automated Adverse Decision

- **Decision ID:** D-033
- **Date:** 2026-07-30
- **Decision:** No automated adverse education or employment decision is permitted.
- **Reason:** High-impact decisions require human review, legal safeguards, and contestability.
- **Alternatives considered:** Automated stream rejection; automated hiring or promotion decisions.
- **Consequences:** Recommendations must be advisory, explainable, and counsellor-reviewable.
- **Status:** Approved
- **Revisit trigger:** Legal and ethics board approve a specific human-reviewed workflow.

## D-034 - No Psychiatric Diagnosis

- **Decision ID:** D-034
- **Date:** 2026-07-30
- **Decision:** The platform must not provide psychiatric diagnosis.
- **Reason:** The platform is for career intelligence and developmental support, not clinical diagnosis.
- **Alternatives considered:** Mental-health screening labels; clinical referral diagnosis.
- **Consequences:** Wellbeing/resilience/support indicators must use non-clinical language and review controls.
- **Status:** Approved
- **Revisit trigger:** Product scope changes with qualified clinical/legal governance.

## D-035 - No Copied Proprietary Material

- **Decision ID:** D-035
- **Date:** 2026-07-30
- **Decision:** No copied proprietary questions, scoring rules, or report narratives may be used.
- **Reason:** The platform must avoid IP infringement and preserve original psychometric governance.
- **Alternatives considered:** Adapt third-party materials without licence; copy market-reference report language.
- **Consequences:** Content sourcing, licensing, and approval evidence are mandatory.
- **Status:** Approved
- **Revisit trigger:** Legal approves a licensed content arrangement with documented usage rights.
