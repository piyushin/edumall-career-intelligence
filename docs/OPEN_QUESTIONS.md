# Open Questions

**Repository:** piyushin/edumall-career-intelligence  
**Date:** 2026-07-30  
**Purpose:** Track genuinely unresolved matters after the approved architecture and product decisions. Approved decisions are recorded in `docs/DECISION_LOG.md` and are not repeated here as open questions.

## Psychometric

1. What is the final V1 instrument blueprint for Classes 9-10, including construct list, section structure, item counts, timing, and administration rules?
2. What scoring models, scale definitions, missing-response rules, validity indicators, and confidence rules will the Psychometric Director approve for V1?
3. What signed golden scoring fixtures will be used to validate implementation before pilot scoring?
4. What norm strategy applies to the pilot report: purely criterion-referenced, provisional local norms, or another approved approach?
5. What thresholds determine when a development-support indicator becomes counsellor-review mandatory?
6. What evidence is required before moving from provisional report language to validated commercial claims?
7. How will Gujarati translation equivalence be evaluated before Gujarati assessment content is released?

## Legal And Privacy

1. What exact age threshold and verification workflow define minor status and guardian authority?
2. What final consent, assent, privacy-notice, withdrawal, and grievance wording is legally approved for the pilot?
3. What report-sharing consent language is required for schools, DiLCe Centres, counsellors, students, and parents/guardians?
4. What legal approval is required before applying the three-year retention default to pilot data?
5. What deletion/anonymisation procedure is legally acceptable for raw responses, reports, counselling notes, audit logs, and object-storage artifacts?
6. What data-processing agreement terms are required for schools and DiLCe Centres?
7. What restrictions apply to using pilot data for psychometric validation, research, analytics, or future model improvement?

## Commercial

1. What pilot commercial model applies: free pilot, paid school contract, coupon/credit allocation, or another arrangement?
2. What specific packages, report tiers, and price points apply after the pilot?
3. What billing party owns each pilot relationship: parent, school, DiLCe Centre, or EduMall Head Office?
4. What support SLA and counselling-session model are included in the V1 pilot?
5. What success criteria determine expansion beyond the Gandhinagar/Gujarat pilot?

## Content And Licensing

1. Who owns final approval for V1 assessment items, interpretation text, stream descriptions, and career-cluster content?
2. What source list is approved for stream, career-cluster, course, and occupation information?
3. What licence/attribution rules apply to any external career, education, or government-source references?
4. What terminology style guide applies for student-friendly, parent-friendly, and counsellor-facing report language?
5. What review workflow confirms that no proprietary third-party questions, scoring rules, or report narratives are copied?
6. What Gujarati terminology glossary should be prepared before Gujarati report/content release?

## Infrastructure

1. Which managed cloud provider and India region will be used?
2. Which managed identity provider will be selected?
3. Which managed secrets service will be selected?
4. Which S3-compatible object-storage provider will be selected?
5. Which email, SMS, and WhatsApp providers will be used for pilot notifications?
6. Which error tracking and observability vendors will be used?
7. Which PostgreSQL deployment option supports the approved multi-zone, PITR, encrypted-backup strategy?
8. Which parts of PostgreSQL Row-Level Security are practical for V1 versus later hardening?

## Operations

1. Who is the named owner for pilot operations, support triage, and incident response?
2. What is the pre-pilot security-assessment scope, reviewer, and acceptance threshold?
3. What restoration-test schedule and evidence are required before pilot and before public production?
4. What counsellor training curriculum, assessment, and approval record are required before report release permissions are granted?
5. What operational dashboards are required for EduMall Head Office during the pilot?
6. What escalation path applies for sensitive indicators, parent concerns, school requests, and data-subject requests?
7. What launch checklist gates must be signed by product, psychometric, legal/privacy, and CTO owners before pilot release?
