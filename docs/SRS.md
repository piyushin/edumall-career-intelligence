# Software Requirements Specification (SRS): EduMall Career & Psychometric Assessment Platform

**Domain:** career.theedumall.com  
**Version:** 2.0  
**Date:** 25 July 2026

> This file is a Codex-friendly companion to the signed/approved DOCX. The DOCX is the human baseline where conflicts occur.


Software Requirements Specification (SRS)

EduMall Career & Psychometric Assessment Platform

career.theedumall.com

|Purpose  Development-ready specification for OpenAI Codex and the engineering, psychometric, content, counselling, institutional and compliance teams.|
|---|

|Document field|Value|
|---|---|
|Product owner|Meetium Pvt. Ltd. / The EduMall|
|Prepared for|Codex-led software development with human engineering review|
|Version|2.0|
|Date|25 July 2026|
|Status|Baseline for architecture, backlog and implementation|
|Primary languages|English, Hindi, Gujarati and Marathi|
|Confidentiality|Internal / authorised implementation partners|

Discover • Learn • Succeed

## Document Control

|Version|Date|Owner|Change|
|---|---|---|---|
|1.0|25 July 2026|The EduMall|Initial complete SRS baseline|
|2.0|25 July 2026|The EduMall|Final consolidated SRS: premium reports, competency intelligence, 360-degree assessment, 9-box grid and Codex delivery controls|

### Approval Roles

|Approval|Required from|
|---|---|
|Business scope|Founder/Product Owner|
|Psychometric validity|Qualified psychometrician / psychologist and advisory board|
|Legal and privacy|Indian legal/privacy counsel|
|Technology and security|CTO / security lead|
|Language equivalence|Certified language reviewers|
|Employment use|HR/legal review for each employer programme|

|Critical limitation  The system may support decision-making, but it must not diagnose mental illness, guarantee a career, guarantee employability, determine visa eligibility, or make fully automated adverse employment decisions. High-impact outcomes require trained human review.|
|---|

## Table of Contents

1. Executive Summary

2. Product Vision, Scope and Principles

3. Stakeholders and User Roles

4. Assessment Product Catalogue

5. Psychometric Framework

6. Functional Requirements

7. Multilingual Content System

8. Reporting and Recommendation Engine

9. Career, Education and Occupation Knowledge Base

10. Employee and Employability Modules

11. Data Model

12. API Requirements

13. Non-functional Requirements

14. Security, Privacy and Ethical Safeguards

15. Architecture and Technology Stack

16. UX Requirements

17. Analytics and Administration

18. Testing and Validation

19. DevOps and Deployment

20. Codex Implementation Plan

21. Acceptance Criteria

22. Assumptions, Dependencies and Open Decisions

Appendices

## 1. Executive Summary

The EduMall Career & Psychometric Assessment Platform will be a multi-tenant, multilingual, web-based assessment, counselling and workforce decision-support platform hosted at career.theedumall.com. It will serve school students, college and university students, ITI and polytechnic trainees, job seekers, blue-collar workers, employees, employers, counsellors, institutions and administrators.

The platform will contain multiple independently governed assessment instruments rather than one universal test. Each instrument will have its own target population, item bank, scoring version, language versions, norms, reliability/validity evidence, report template and release approval. Recommendations will combine psychometric evidence with education, career, skills and occupation knowledge, while clearly distinguishing measured scores, inferred recommendations and counsellor judgement.

|Reference-platform interpretation  EduMilestones is treated as a functional inspiration for career-assessment workflows and reports. Bharat Skills is treated as an official reference for ITI/CTS/CITS/ATS learning, employability and trade taxonomies. No proprietary test questions, report text, scoring algorithms or protected content may be copied. Original content, lawful licences and source attribution are mandatory.|
|---|

### 1.1 Business Outcomes
- Provide age-appropriate career discovery and stream selection from Class 5 through Class 12.
- Provide discipline-specific career direction and employability analysis for higher education.
- Provide trade, apprenticeship, safety, job-fit and global-mobility readiness assessments for ITI/polytechnic and blue-collar candidates.
- Enable employers to assess hiring fit, employee potential, promotion readiness, skill gaps and development needs with appropriate safeguards.
- Generate high-quality, explainable, multilingual reports for students, parents, counsellors, institutions and employers.
- Create a scalable B2C, B2B, B2G and partner network platform with tenant branding, credits, campaigns and dashboards.

### 1.2 Success Metrics

|Area|Initial target|
|---|---|
|Completion|≥85% assessment completion for properly assigned tests|
|Reliability|Internal consistency and test–retest thresholds defined per construct before commercial release|
|Report usefulness|≥80% users/counsellors rate report useful or very useful|
|Language parity|No statistically material score distortion attributable to language version|
|Operational|<1% sessions require support intervention|
|Counselling|Counsellor can review and release a report in ≤10 minutes after auto-scoring|
|Security|No critical unresolved findings before production launch|

## 2. Product Vision, Scope and Principles

### 2.1 Vision

To create India’s trusted multilingual career, employability and workforce assessment ecosystem that converts psychometric evidence into practical education, skill and employment action plans for students and workers in India and abroad.

### 2.2 In Scope
- Responsive web application and installable PWA; future mobile apps through the same APIs.
- Multi-tenant institutions, schools, colleges, ITIs, employers, franchise/DiLCe centres and counsellor partners.
- Candidate registration, guardian consent, bulk import, test assignment, payment/credit, assessment delivery, scoring, reports and counselling.
- Original multilingual question banks in English, Hindi, Gujarati and Marathi.
- Psychometric, aptitude, situational judgement, knowledge, self-report, observer-rating and interview-assist modules.
- Career/course/skill/occupation recommendations mapped to school streams, degrees, vocational pathways, NSQF/NCO-like occupation structures and country-specific readiness requirements.
- Employee potential, promotion, upgradation, competency-gap, employability, safety and integrity-risk decision support.
- PDF and web reports, institutional analytics, benchmarks, exports and APIs.

### 2.3 Out of Scope for Initial Release
- Clinical diagnosis, therapy, psychiatric screening or medical fitness certification.
- Automated visa, immigration, licensing or work-permit decisions.
- Automated hiring rejection, termination, disciplinary action or promotion denial.
- Unproctored high-stakes cognitive testing presented as legally conclusive.
- Copying third-party proprietary questions, reports or algorithms.
- Full learning management system, job board or university admissions CRM; integrations may be provided.

### 2.4 Product Principles

|Principle|Requirement|
|---|---|
|Age appropriate|Vocabulary, duration, cognitive load and interpretation vary by cohort.|
|Evidence before claims|Every instrument version has technical documentation and approval status.|
|Human in the loop|Counsellor/HR review is mandatory for sensitive or high-impact use.|
|Explainable|Users see why a recommendation appears and what evidence is weak.|
|Strength based|Reports highlight strengths and development needs without labelling a person as inferior.|
|Language equivalent|Translations use adaptation, back-translation and statistical checks.|
|Configurable but governed|Tenants may configure workflows, not secretly alter validated scoring.|
|Privacy by design|Collect minimum data and obtain purpose-specific consent.|
|No false precision|Use bands, confidence intervals and caveats rather than absolute claims.|

## 3. Stakeholders and User Roles

|Role|Primary responsibilities|
|---|---|
|Platform Owner|Global configuration, subscriptions, tenants, security, releases|
|Psychometric Director|Instrument design, norms, validation, scoring approvals|
|Content Author|Draft items and translations; cannot publish own content|
|Translator/Language Reviewer|Translate, back-translate and approve language versions|
|Career Researcher|Manage career, course, college, skill and occupation taxonomies|
|Institution Admin|Manage organisation, centres, candidates, campaigns and reports|
|Counsellor|Assign tests, review results, add notes, conduct sessions, release reports|
|Employer/HR Admin|Create role profiles, campaigns, benchmarks and employee reports|
|Assessor/Proctor|Verify identity, supervise sessions, log incidents|
|Candidate/Student|Consent, profile, assessment, report and recommendations|
|Parent/Guardian|Consent for minors and controlled report access|
|Auditor/Support|Read-only diagnostics, audit trails and authorised support|

### 3.1 Permission Model

Use role-based access control with tenant, organisation, centre and campaign scopes. Privileged actions must use least privilege, MFA, approval workflows and audit logs. No counsellor or employer may access candidates outside an authorised assignment or campaign.
- Super-admin impersonation is disabled by default; authorised support access must be time-bound, reason-coded and audited.
- Content publication, scoring publication and report-template publication each require maker-checker approval.
- Employer users receive only employment-purpose reports and may not access unrelated education or family data.
- Parents receive minor-student reports only under configured consent and release rules.
- Candidates can view consent history, report access history and correction/deletion request status.

## 4. Assessment Product Catalogue

|ID|Audience|Product|Core domains|Duration|Primary output|
|---|---|---|---|---|---|
|S01|Classes 5–8|Foundation Discovery|Interests, learning preferences, multiple aptitudes, study habits, socio-emotional strengths, creativity, basic career exposure|45–60 min|Student + parent-friendly report|
|S02|Classes 9–10|Stream & Subject Choice|RIASEC interests, aptitude, personality, learning style, values, study behaviour, subject confidence, stream fit|75–100 min|Science/Commerce/Arts/Vocational fit and action plan|
|S03|Classes 11–12 Science|Science Career Mapper|PCM/PCB/PCMB aptitude, research/engineering/health interests, personality, values, exam readiness, work-style|90–120 min|Degree clusters, entrance pathways, career shortlist|
|S04|Classes 11–12 Commerce|Commerce Career Mapper|Numerical/business aptitude, finance/management/law interests, personality, values, entrepreneurial orientation|90–120 min|Commerce degree and career pathways|
|S05|Classes 11–12 Arts/Humanities|Humanities Career Mapper|Language/social reasoning, creative and public-service interests, personality, values, communication profile|90–120 min|Humanities, design, law, media, policy pathways|
|S06|Classes 11–12 Vocational|Vocational Pathway Mapper|Practical/mechanical/spatial aptitude, trade interest, safety orientation, work values, employability readiness|75–100 min|Trade, apprenticeship, diploma and job pathways|
|C01|College/University – General|Graduate Career Direction|Career interests, personality, values, cognitive/functional aptitudes, employability, domain confidence|75–110 min|Role families, internships, skills-gap plan|
|C02|College – Course-specific|Discipline Career Mapper|Course-specific competencies plus common psychometrics|60–100 min|Specialisations and role recommendations|
|T01|ITI/Polytechnic|Trade & Employability Assessment|Trade aptitude, practical reasoning, safety, digital, communication, work discipline, job mobility|60–90 min|Trade-role fit, NSQF-linked gaps, placement readiness|
|E01|Entry-level Employability|Employability Index|Communication, numerical, digital, problem solving, teamwork, adaptability, integrity, workplace readiness|45–75 min|Employability score and development plan|
|E02|Blue-collar Domestic|Job Fit & Safety|Physical/job demands, trade knowledge, safety, reliability, behavioural fit, literacy/numeracy|35–75 min|Job readiness and training requirements|
|E03|International Workforce|Global Mobility Readiness|Technical fit, safety, language, cultural adaptability, documentation awareness, reliability, country-role conditions|60–90 min|Country/occupation readiness; not visa eligibility|
|H01|Employee Assessment|Employee Potential & Performance|Competencies, personality, values, leadership potential, role fit, engagement risks, 180/360 inputs|45–120 min|Potential-performance matrix and development plan|
|H02|Promotion/Upgradation|Promotion Readiness|Current-role performance evidence, next-role competencies, judgement scenarios, leadership, learning agility|60–120 min|Readiness now/later/not yet; evidence and gaps|
|H03|Red Alert/Risk Screen|Workplace Risk Indicators|Integrity, safety attitude, counterproductive tendencies, stress flags, policy scenarios, response inconsistency|30–60 min|Flagged indicators requiring human review; never automatic adverse action|

### 4.1 Course-specific College Extensions

|Course family|Examples of extensions|
|---|---|
|Engineering & Technology|Programming logic, quantitative reasoning, systems thinking, engineering specialisation interests, project/work style|
|Medicine & Allied Health|Scientific reasoning, service orientation, emotional regulation, precision, ethical judgement; never clinical fitness|
|Management/Commerce|Business reasoning, numerical analysis, sales/operations/finance/HR interests, entrepreneurial orientation|
|Arts/Humanities/Social Sciences|Language, social analysis, creativity, public policy, education, media and research orientation|
|Law|Verbal reasoning, argument analysis, ethics, advocacy, detail orientation|
|Design/Architecture|Spatial, visual, creative ideation, user empathy and portfolio readiness|
|Agriculture/Life Sciences|Biological/environmental interests, field orientation, analytical and enterprise pathways|
|Computer Applications/Data|Logic, abstraction, data reasoning, digital fluency, technical persistence|
|Education|Communication, patience, instructional orientation, organisation and subject confidence|

## 5. Psychometric Framework

### 5.1 Construct Families

|Construct family|Examples|Typical method|
|---|---|---|
|Career interests|RIASEC-like domains; subject, sector and activity interests|Likert/forced-choice; age-adapted scenarios|
|Cognitive aptitudes|Verbal, numerical, abstract, spatial, mechanical, clerical, logical, scientific|Timed/untimed performance items|
|Personality/work style|Big Five-like traits, conscientiousness, sociability, openness, emotional regulation|Self-report; optional observer rating|
|Values and motivators|Achievement, service, security, autonomy, creativity, income, status, work-life, location|Ranking, forced choice and rating|
|Learning profile|Study habits, self-regulation, attention routines, preferred learning conditions|Self-report and behavioural checklist|
|Employability competencies|Communication, teamwork, problem solving, digital, adaptability, professionalism|SJT, knowledge and self/observer report|
|Leadership potential|Learning agility, judgement, influence, execution, strategic orientation, people development|SJT, caselets and multi-rater inputs|
|Risk/safety indicators|Safety attitude, rule adherence, integrity scenarios, response inconsistency|SJT and validity indices; human review only|
|Technical/trade readiness|Trade knowledge and practical reasoning|Job/trade-specific MCQ, multimedia and simulations|
|Context and constraints|Education, resources, mobility, language, disability accommodations, preferences|Profile questionnaire; excluded from trait score unless documented|

### 5.2 Instrument Versioning
- Every assessment has immutable identifiers: instrument_id, edition, form, language, scoring_version, norm_version and report_version.
- Published attempts preserve the exact item and scoring snapshots even after future updates.
- Pilot, beta, validated, suspended and retired statuses are explicit.
- Changing scoring keys, weights, norms or recommendation rules creates a new version; historical results are not silently recalculated.
- Comparable alternate forms require documented equating or are reported separately.

### 5.3 Item Types

|Type|Required capabilities|
|---|---|
|Single/multiple choice|Randomisation, option scoring, negative/no negative marking, “prefer not to answer” where appropriate|
|Likert and semantic differential|Configurable scale labels, reverse-keying, neutral option rules|
|Forced choice/ranking|Ipsative scoring clearly separated from normative scoring|
|Timed aptitude|Per-section/item timer, practice items, accessibility accommodations|
|Matrix/diagram/image|Secure media delivery, alt text, responsive layout|
|Audio/video SJT|Captions/transcript, bandwidth fallback, language variants|
|Numeric/text entry|Tolerance rules, sanitisation, manual review where needed|
|Observer/180/360 rating|Rater groups, anonymity thresholds, aggregation and self-vs-others comparison|
|Case simulation|Branching scenarios, partial credit and competency mapping|
|Practical checklist|Assessor rubric, evidence upload and sign-off|

### 5.4 Scoring Engine Requirements
1. Validate completion, timing, response integrity, form version and accommodations.
1. Compute raw scores according to item keys, weights, reverse scores and partial-credit rules.
1. Compute scale scores only when minimum answered-item and reliability conditions are met.
1. Apply norm conversion by eligible norm group; otherwise label result as criterion-referenced or provisional.
1. Calculate percentile/standard score/band, standard error and confidence interval when supported.
1. Calculate validity indicators: random responding, straight-lining, improbable patterns, excessive speed, inconsistency and missingness.
1. Run recommendation rules using versioned evidence weights and exclusion constraints.
1. Generate report facts separately from narrative text to support auditability and translation.
1. Create a signed result snapshot and prevent post-submission answer changes except through documented invalidation/retest workflow.

### 5.5 Norms and Validation

|Release gate  An assessment must not be marketed as psychometrically validated until the technical manual documents intended use, development sample, norm sample, reliability, validity, fairness/language analysis, limitations and review date. Pilot reports must display “pilot/provisional”.|
|---|
- Norm groups may include grade band, age, education level, course/trade, language, region and job level only when sample size and fairness justify segmentation.
- Minimum sample sizes and evidence thresholds are set by the Psychometric Director; the software enforces status and expiry, not scientific judgement.
- Conduct item analysis, distractor analysis, differential item functioning, factor analysis where appropriate, criterion validity and outcome studies.
- Validate translated/adapted versions independently and examine measurement invariance where feasible.
- Review norms periodically and when curriculum, occupation or population changes materially.

## 6. Functional Requirements

### 6.1 Authentication and Identity

|ID|Requirement|Priority|
|---|---|---|
|FR-AUTH-001|Email/mobile OTP and password authentication; optional Google/Microsoft SSO for institutions.|Must|
|FR-AUTH-002|MFA mandatory for platform admins, psychometric staff, counsellors and employer admins.|Must|
|FR-AUTH-003|Guardian-linked accounts and consent for users below configured age.|Must|
|FR-AUTH-004|Tenant-aware role and scope permissions.|Must|
|FR-AUTH-005|Account recovery, session/device management, login alerts and rate limiting.|Must|
|FR-AUTH-006|Optional Aadhaar/document verification only through lawful, approved integrations; never mandatory by default.|Should|

### 6.2 Candidate Profile and Onboarding
- Capture minimum personal data: name, DOB/age, gender optional/prefer-not-to-say, language, contact, location at district/state level, education and consent.
- School profile: class, board, medium, subjects, marks optional, interests, extracurriculars and constraints.
- College profile: institution, programme, semester/year, specialisation, backlogs optional, skills, internships and goals.
- ITI/polytechnic profile: trade/branch, year, certification, apprenticeship, technical exposure and job location preference.
- Employee profile: organisation, role, grade, tenure, job family and assessment purpose; sensitive HR data separated by purpose.
- Accessibility/accommodation request workflow without penalising scores.

### 6.3 Tenant, Institution and Campaign Management
- Create organisations, branches/centres, departments, classes, batches, job families and reporting hierarchies.
- Bulk candidate upload through validated CSV/XLSX template, API or invite links.
- Create campaigns with assessment bundle, eligible population, language, deadline, proctoring, report visibility, credits and consent text.
- Assign individual or bulk tests; resend reminders; track not-started/in-progress/completed/reviewed/released states.
- Tenant branding: logo, accent colours, contact, report cover and authorised co-branding without changing core disclaimers.
- Credit wallet, coupon, invoice and payment integration; pricing remains configurable and outside scoring logic.

### 6.4 Assessment Delivery

|ID|Requirement|
|---|---|
|FR-TEST-001|Pre-test instructions, consent confirmation, language selection, device check and practice section.|
|FR-TEST-002|Section-level navigation rules: free, forward-only or controlled review.|
|FR-TEST-003|Autosave after every response and on heartbeat; offline-tolerant local queue for brief network interruption.|
|FR-TEST-004|Server timer, pause rules, accommodations and expiry.|
|FR-TEST-005|Random item/option order where psychometrically permitted; form assembly blueprint.|
|FR-TEST-006|Full-screen/proctoring controls configurable; never claim cheat-proof.|
|FR-TEST-007|Incident log for tab changes, disconnections, copy attempts, webcam/proctor events if lawful and consented.|
|FR-TEST-008|Submit confirmation, unanswered warning, idempotent finalisation and locked attempt.|
|FR-TEST-009|Retest policy, cooling period, invalidation reason and approval.|
|FR-TEST-010|Accessible keyboard, text zoom, contrast and screen-reader experience.|

### 6.5 Counsellor Workflow
1. Counsellor dashboard lists assigned cases, completion status, validity flags and urgency.
1. Open a structured case view: profile, scores, evidence, recommendation rationale, contradictions and limitations.
1. Add private notes, student-visible notes, parent notes, action plan, career shortlist and follow-up date.
1. Override or reorder recommendations only with reason; original algorithmic output remains auditable.
1. Release report to student/guardian/institution according to consent and campaign configuration.
1. Book online/offline counselling, log attendance and upload session summary.
1. Create follow-up assessment or skill plan and track milestones.

### 6.6 Notifications
- Email, SMS, WhatsApp and in-app adapters with consent and template approval.
- Events: invitation, reminder, OTP, completion, counsellor review, report release, appointment, expiring link and data request.
- Language-specific templates; delivery logs; opt-out for promotional communication.

## 7. Multilingual Content System

### 7.1 Languages

The first production languages are English, Hindi, Gujarati and Marathi. Each assessment item, option, instruction, glossary term, report narrative and notification must be stored as a versioned locale resource. Language is not implemented as uncontrolled machine translation at runtime.

### 7.2 Translation Workflow
1. Author source item and construct rationale in controlled English or approved source language.
1. Forward translation by qualified translator familiar with education/psychometrics.
1. Independent review for reading level, cultural relevance and technical meaning.
1. Back-translation or bilingual reconciliation.
1. Pilot cognitive interviews with target users.
1. Psychometric review of language performance and differential item functioning.
1. Maker-checker approval and publication as a linked language version.
1. Periodic review when source wording changes; stale translations block publication.

### 7.3 Content Authoring Requirements
- Rich item editor with construct, subscale, difficulty, cognitive level, age band, board/course/trade tags, country/job tags, sensitivity and copyright source fields.
- Reading-level checker and forbidden/biased terminology warnings.
- Preview at desktop/mobile and in each language; Unicode font support and line-wrap review.
- Item lifecycle: draft → review → pilot → approved → published → suspended/retired.
- Import/export in controlled spreadsheet and JSON formats; validation report before commit.
- No generative AI item becomes publishable without human subject-matter and psychometric approval.
- Item exposure statistics and compromise flag; secure item bank access.

## 8. Reporting and Recommendation Engine

### 8.1 Report Variants

|Report|Audience|Content|
|---|---|---|
|Student discovery|Classes 5–8|Strengths, interests, learning habits, exploration activities; no rigid career ranking|
|Stream selection|Classes 9–10|Stream fit, subject considerations, aptitude-interest alignment, alternatives, action plan|
|Senior secondary career|Classes 11–12|Degree clusters, entrance routes, career families, skill gaps, backup pathways|
|College career|Higher education|Role families, specialisations, internships, portfolio/certification plan|
|ITI/polytechnic|Trainee/placement|Trade role fit, employability, safety, digital and language gaps, apprenticeship pathways|
|Employability|Candidate/institution|Competency profile, readiness band, interview areas and development plan|
|Employee potential|Employee/manager/HR|Role competencies, potential, development, succession and risks; visibility controls|
|Promotion readiness|HR/panel|Evidence by next-level competency, judgement, readiness timeline and development actions|
|Counsellor technical|Qualified counsellor|Detailed scores, confidence, validity, contradictions, norms and notes|
|Institution dashboard|Authorised leadership|Aggregated cohorts only; privacy thresholds and drill-down permissions|

### 8.2 Recommendation Logic

Recommendations use a versioned rule/weight engine. The platform must support transparent weighted evidence rather than a black-box label. A recommendation object contains target entity, fit score/band, confidence, supporting dimensions, contradicting dimensions, prerequisites, constraints, alternative pathways, data freshness and human-review status.
- Stream fit considers aptitude, interest, subject confidence, personality/work style, values and academic prerequisites separately.
- Career recommendations group occupations into families before presenting individual roles to reduce false precision.
- Low confidence, incomplete profile, validity flags or contradictory evidence reduces confidence and triggers counsellor review.
- Academic marks may inform prerequisite readiness but do not overwrite psychometric strengths.
- Socioeconomic constraints may be used for planning options, never to reduce an underlying capability score.
- Country recommendations for overseas jobs show readiness requirements and official-verification links; they do not promise eligibility or placement.

### 8.3 Report Sections
1. Cover, identity, assessment/version and important disclaimer.
1. How to read the report and confidence/validity status.
1. Executive summary and top strengths.
1. Dimension score cards with plain-language explanation and development suggestions.
1. Interest, aptitude, personality/work style, values and employability sections as applicable.
1. Fit matrix for streams/career families/job families with evidence and alternatives.
1. Education or skill pathways, prerequisites, exams/certifications and time horizon.
1. Personal 30/90/365-day action plan.
1. Counsellor notes and session recommendations.
1. Technical appendix: norms, score bands, limitations, version and contact/escalation.

### 8.4 PDF/Web Generation
- Reports render consistently as responsive web and downloadable PDF.
- Report content is generated from structured facts and approved language templates.
- Every PDF contains unique report ID, generated date, version, verification QR/link, confidentiality marking and access controls.
- Watermark and password protection are tenant configurable; do not rely on PDF controls as sole security.

## 9. Career, Education and Occupation Knowledge Base

### 9.1 Entity Model

|Entity|Key data|
|---|---|
|Career family|Name, description, interest/aptitude/value profile, sectors, advancement|
|Occupation/job role|Tasks, work context, competencies, qualifications, physical/safety demands, salary range source/date, country availability|
|School stream/subject|Board-agnostic stream plus board-specific subjects and prerequisites|
|Course/programme|Level, discipline, duration, mode, entrance, eligibility, skills, career outcomes|
|Institution|Verified institution and programme references; no ranking without declared methodology|
|Skill/competency|Definition, proficiency levels, evidence, learning resources|
|Certification/licence|Issuer, jurisdiction, eligibility, renewal and source date|
|Trade/qualification|ITI/CTS/CITS/ATS/NSQF-aligned identifiers and learning outcomes|
|Country mobility profile|Language, licensing, safety, documentation and official sources; reviewed date|
|Learning resource|Internal/external course, module, project and practice activity|

### 9.2 Taxonomy Governance
- Career and occupation records require source URLs, source authority, retrieval date, owner and next review date.
- Bharat Skills/DGT materials may be linked or lawfully referenced for ITI/trade and employability structures; usage must respect applicable rights and attribution.
- International occupation and immigration requirements must come from official/current government or licensing sources and expire automatically for review.
- Board mapping supports CBSE, CISCE/ICSE, GSEB English/Gujarati and configurable additional boards; psychometric constructs remain board-neutral unless evidence supports board-specific items.
- Recommendation rules never depend solely on commercial course inventory.

## 10. Employee and Employability Modules

### 10.1 Competency Framework Builder
- Create organisation/job-family/grade competencies with behavioural indicators and proficiency levels.
- Map test scales, SJT dimensions, interview questions, performance evidence and development resources to competencies.
- Version frameworks and effective dates; prevent retrospective silent changes.
- Build role success profiles from job analysis, not only current high performers.

### 10.2 Potential–Performance and Promotion

|Capability|Requirement|
|---|---|
|Performance input|Import manager ratings/KPIs with source and period; keep distinct from psychometric potential.|
|Potential input|Learning agility, judgement, leadership, motivation and role-fit evidence.|
|Nine-box view|Configurable visual aid; no automatic employment action.|
|Promotion readiness|Next-role gap analysis, readiness band, evidence sufficiency, assessor comments and panel decision.|
|Development plan|Competency action, learning resource, owner, due date, evidence and reassessment.|
|Fairness review|Compare selection/promotion patterns by legally permitted demographic groups with privacy safeguards.|

### 10.3 Red Alert and Integrity/Safety Screening

|High-risk use safeguard  “Red alert” outputs are indicators, not findings of misconduct or clinical risk. Reports must use neutral language such as “requires follow-up”, expose confidence and validity, and prohibit automatic rejection or disciplinary action.|
|---|
- Use job-relevant scenarios and validated constructs only; avoid invasive questions about protected or irrelevant personal matters.
- Require employer purpose statement, legal approval, candidate notice/consent and trained reviewer.
- Provide appeal/review route and document corroborating evidence.
- Disable individual-level export for unauthorised roles and maintain access history.

### 10.4 Blue-collar and International Workforce

|Domain|Measures/examples|
|---|---|
|Core literacy/numeracy|Workplace reading, measurements, arithmetic, instructions and forms|
|Trade aptitude|Mechanical/spatial reasoning, tools, troubleshooting and trade-specific knowledge|
|Safety|PPE, hazard recognition, lockout, working at height, electrical/fire/manual handling scenarios|
|Work behaviour|Reliability, attendance orientation, teamwork, supervisor communication and rule adherence|
|Digital readiness|Smartphone, messaging, digital forms, payments, basic cyber safety|
|Language|Job-specific English/Hindi/local language; CEFR-like claims only with valid mapping|
|Mobility/culture|Adaptability, accommodation, food/weather/shifts, cultural respect and help-seeking|
|Documentation awareness|Passport, contract, insurance, licence and official verification awareness; no legal advice|
|Country overlays|Gulf, Canada, Europe and USA role-specific requirements maintained from official sources|

## 11. Data Model

### 11.1 Core Tables / Aggregates

|Aggregate|Representative fields|
|---|---|
|Tenant|id, name, type, branding, settings, data_region, status|
|Organisation structure|organisation, branch, department, class/batch, job_family, grade|
|User and identity|user, profile, role_assignment, guardian_link, consent, accommodation|
|Assessment|instrument, edition, form, section, blueprint, language_version, publication_status|
|Item bank|item, option, locale, construct_map, scoring_key, media, review, exposure_stats|
|Norms/scoring|norm_set, norm_group, conversion_table/model, scoring_rule, reliability_metadata|
|Campaign/assignment|campaign, bundle, assignment, invitation, proctor_setting, deadline|
|Attempt|attempt, response, event_log, timer_state, incident, submission, validity_flag|
|Result|scale_score, score_band, confidence, recommendation, result_snapshot|
|Report/counselling|report, template_version, release, counsellor_case, note, action_plan, appointment|
|Knowledge base|career, occupation, course, stream, skill, competency, certification, country_requirement, source|
|HR assessment|role_profile, competency_framework, rater, rating, performance_input, panel_decision|
|Commerce|product, price, coupon, credit_wallet, order, payment, invoice|
|Governance|audit_event, approval_task, data_request, retention_job, security_event|

### 11.2 Data Rules
- Use UUID/ULID identifiers; timestamps stored in UTC; display in user timezone.
- Personally identifiable information separated logically from assessment response and analytics identifiers.
- Answer and result snapshots are append-only after final submission.
- Soft deletion is not sufficient for privacy deletion; implement controlled purge/anonymisation with legal-hold exceptions.
- Aggregate dashboards suppress small groups using configurable minimum count.
- No free-text sensitive notes are included in machine-learning training datasets by default.

## 12. API Requirements

Expose versioned REST APIs under /api/v1; use OpenAPI 3.1. Consider asynchronous events for report generation, notifications and analytics. GraphQL is optional for internal dashboards but not required for MVP.

|Domain|Example endpoints|
|---|---|
|Auth|POST /auth/otp, /auth/login, /auth/mfa/verify, GET /me|
|Tenants|/tenants, /organisations, /branches, /roles|
|Candidates|/candidates, /guardians, /consents, /accommodations|
|Assessments|/instruments, /forms, /sections, /items, /locales, /publish|
|Campaigns|/campaigns, /assignments, /invites, /bulk-imports|
|Attempts|POST /attempts, PUT /attempts/{id}/responses, POST /submit, GET /resume|
|Scoring|POST /scoring-jobs, GET /results/{id}, /validity-flags|
|Reports|POST /reports, GET /reports/{id}, /release, /verify/{code}|
|Counselling|/cases, /notes, /action-plans, /appointments|
|Knowledge|/careers, /occupations, /courses, /skills, /country-requirements|
|HR|/competency-frameworks, /role-profiles, /raters, /promotion-cases|
|Analytics|/dashboards, /cohorts, /exports|
|Webhooks|assessment.completed, result.ready, report.released, payment.completed|

### 12.1 API Standards
- OAuth2/OIDC for institutional integrations; short-lived access tokens; scoped service accounts.
- Idempotency keys for submission, payments, imports and report requests.
- Cursor pagination, filtering, sparse fields and standard error envelope.
- Request validation, tenant isolation and audit event at service boundary.
- Signed, retryable webhooks with replay protection and dead-letter handling.
- OpenAPI-generated SDK and Postman collection; contract tests in CI.

## 13. Non-functional Requirements

|Category|Requirement|
|---|---|
|Availability|99.5% monthly for MVP; target 99.9% after scale phase|
|Performance|95th percentile API response <500 ms for standard reads; question navigation <300 ms excluding network|
|Assessment resilience|Autosave every answer; restore interrupted sessions; idempotent submission; server-authoritative timer|
|Scale|Initial 25,000 registered users, 2,000 concurrent tests; horizontally scalable to 100,000 concurrent|
|Security|OWASP ASVS-aligned controls, MFA for privileged users, encryption in transit and at rest, secrets manager|
|Privacy|DPDP Act-aligned consent, purpose limitation, retention, correction/deletion workflows; parental consent for minors|
|Accessibility|WCAG 2.2 AA target, keyboard navigation, screen-reader labels, colour-independent charts|
|Localisation|English, Hindi, Gujarati and Marathi; Unicode; language switching; translated reports and UI|
|Auditability|Immutable audit events for content, scoring, report release, consent, access and administrative changes|
|Explainability|Every recommendation exposes contributing dimensions, confidence, limitations and human-review status|
|Portability|Containerised deployment; PostgreSQL-compatible data; object storage abstraction; documented APIs|
|Recovery|RPO ≤15 minutes and RTO ≤4 hours target after production hardening|

### 13.1 Browser/Device Support
- Latest two major versions of Chrome, Edge, Firefox and Safari; Android Chrome is priority.
- Minimum assessment viewport 360×640; warn for unsupported devices on spatial/diagram tests.
- Low-bandwidth mode: compressed assets, prefetch next question and resilient autosave.
- PWA caching must never expose another user’s assessment data on shared devices.

## 14. Security, Privacy and Ethical Safeguards

### 14.1 Security Controls
- TLS 1.2+; encryption at rest using managed keys; field-level protection for high-risk data.
- MFA, RBAC/ABAC scopes, secure cookies, CSRF protection, CSP, input validation and output encoding.
- SAST, dependency scanning, secret scanning, container scanning, DAST and annual penetration testing.
- Rate limits, bot protection, WAF, audit logs, central monitoring, alerting and incident response playbooks.
- Secure media URLs and item-bank segregation; no public object-storage access.
- Backups encrypted and restoration tested; production data prohibited in development environments unless anonymised.

### 14.2 Privacy and Consent
- Purpose-specific consent for career guidance, employment assessment, research/validation, communications and optional AI features.
- Guardian consent and age-appropriate assent for minors.
- Privacy notice in all four languages with data categories, purpose, recipients, retention and rights.
- Consent withdrawal affects future processing without invalidating lawful prior processing; document consequences.
- Data access, correction, deletion and grievance workflows with SLA and identity verification.
- Default retention: configurable by product/contract; raw responses retained only as necessary for reporting, validation and legal obligations.
- Data-processing agreements and subprocessor register for B2B tenants.

### 14.3 Responsible AI
- Generative AI may draft narratives from structured facts only through approved templates; it may not invent scores, careers, laws or country requirements.
- All AI-generated content is labelled internally, logged and reviewable; sensitive reports require deterministic templates or human approval.
- No model training on candidate data without explicit lawful basis and separate approval.
- Bias/fairness monitoring by language, gender and relevant groups where legally and statistically appropriate.
- Provide contestability: users can request human explanation or correction.

## 15. Architecture and Technology Stack

### 15.1 Recommended Architecture

|Layer|Recommendation|
|---|---|
|Frontend|Next.js 15+/React/TypeScript, server components where appropriate, accessible component system, PWA|
|Backend|NestJS/TypeScript modular monolith for MVP; split services only when scale requires|
|Database|PostgreSQL with row-level tenant safeguards; Redis for cache/session/rate limits|
|Jobs|BullMQ/Redis or managed queue for scoring, reports, imports and notifications|
|Object storage|S3-compatible encrypted storage for media, reports and evidence|
|Search|PostgreSQL full text initially; OpenSearch when career/content scale demands|
|Reporting|HTML/CSS templates rendered to PDF via Playwright/Chromium|
|Analytics|Event warehouse pipeline; start with PostgreSQL read replica/materialised views|
|Identity|Managed OIDC provider or robust internal auth with MFA; avoid custom crypto|
|Observability|OpenTelemetry, structured logs, metrics, traces and error monitoring|
|Deployment|Docker, CI/CD, managed Kubernetes or container platform; CDN/WAF before public traffic|
|Infrastructure|India-region hosting where commercially/legal appropriate; IaC with Terraform|

### 15.2 Modular Boundaries
- Identity & Tenancy
- Assessment Authoring
- Assessment Delivery
- Scoring & Norms
- Recommendations
- Reporting
- Counselling
- Career Knowledge
- HR/Employability
- Commerce
- Notifications
- Analytics & Governance

### 15.3 Repository Structure for Codex

|Path|Purpose|
|---|---|
|/apps/web|Next.js candidate/admin/counsellor application|
|/apps/api|NestJS API and domain modules|
|/apps/worker|Background jobs and report/scoring workers|
|/packages/ui|Design system and accessibility primitives|
|/packages/contracts|OpenAPI schemas, DTOs and generated clients|
|/packages/psychometrics|Pure scoring functions, validation and test fixtures|
|/packages/i18n|Locale resources and terminology checks|
|/packages/reporting|Structured report schemas and templates|
|/packages/config|Lint, TypeScript, test and environment configs|
|/infra|Terraform/deployment/monitoring|
|/docs|ADRs, threat model, data dictionary, technical manuals|

## 16. UX Requirements

### 16.1 Candidate Experience
- Simple onboarding with progress indicator and clear reason for each data field.
- Age-appropriate visual language: playful but not childish for Classes 5–8; professional for older candidates.
- One primary action per assessment screen; large targets; autosave and connection status.
- Practice section explains item type without revealing live content.
- Break prompts for long tests; configurable pause rules.
- Results emphasise understanding and next action, not only charts.

### 16.2 Admin/Counsellor Experience
- Operational dashboard with filters and bulk actions.
- Clear distinction between auto-generated evidence, validity flags and counsellor conclusions.
- Side-by-side candidate comparison only for authorised, same-purpose cohorts.
- No colour-only red/green decisions; include labels, icons and explanatory text.
- Every sensitive action displays purpose and creates an audit record.

### 16.3 Brand Direction

Use The EduMall’s professional red-and-blue identity with strong readability, restrained visual decoration and culturally inclusive illustrations. The product must appear credible to parents, institutions, government and employers—not like a casual online quiz.

## 17. Analytics and Administration

|Dashboard|Measures|
|---|---|
|Platform|Registrations, active tenants, attempts, completion, revenue/credits, incidents|
|Assessment quality|Item exposure, difficulty, discrimination, missingness, timing, reliability, validity flags|
|Language|Completion, timing, item functioning and report feedback by locale|
|Institution|Invited/started/completed/released, class/course cohorts, counselling status|
|Career outcomes|Recommendation distribution, chosen pathways, follow-up outcomes where consented|
|Employability|Competency gaps, training needs, placement readiness and later outcomes|
|HR|Role/grade cohorts, readiness and development progress with privacy thresholds|
|Support/security|Failed logins, suspicious attempts, errors, data requests and SLA|

### 17.1 Research Dataset Export
- De-identification/anonymisation rules and ethics approval workflow.
- Variable dictionary, instrument/version and norm metadata included.
- Minimum cohort threshold and export approval.
- No direct identifiers, free text or employer decisions by default.

## 18. Testing and Validation

### 18.1 Software Test Strategy

|Level|Coverage|
|---|---|
|Unit|Scoring functions, rules, permissions, validators, localisation helpers|
|Property-based|Score bounds, reverse scoring, missing rules, conversion monotonicity|
|Integration|Database, queue, object storage, auth, payment and notifications|
|Contract|OpenAPI request/response and webhook compatibility|
|End-to-end|Candidate, guardian, counsellor, institution, employer and admin journeys|
|Security|OWASP tests, tenant isolation, privilege escalation, IDOR, file handling|
|Performance|Concurrent tests, autosave, submission spikes, report queue|
|Accessibility|Automated checks plus keyboard and screen-reader manual testing|
|Visual|Report and UI snapshots across languages and devices|
|Disaster recovery|Backup restore and region/service outage exercises|

### 18.2 Psychometric QA
- Golden scoring fixtures independently computed and signed off.
- Item-level analysis and norm conversion verification.
- Language equivalence and differential item functioning review.
- Reliability/validity evidence attached to instrument release record.
- Recommendation back-testing against expert panels and outcome data.
- Adverse-impact monitoring for employment uses; investigate before deployment expansion.

### 18.3 UAT Personas
- Class 6 Gujarati-medium student with guardian
- Class 10 CBSE student choosing stream
- Class 12 science student exploring engineering/health alternatives
- BCom final-year student
- ITI electrician trainee in Hindi
- Marathi-speaking polytechnic candidate
- Gulf-bound welder with low bandwidth
- Institution counsellor handling 200 cases
- HR manager assessing supervisors
- Psychometric admin publishing a revised norm set

## 19. DevOps and Deployment
1. Use development, test, staging and production environments with separate accounts/databases.
1. All infrastructure is code; no undocumented manual production change.
1. Pull requests require lint, type-check, unit, integration, security and migration checks.
1. Database migrations are backward-compatible and include rollback/forward-fix plan.
1. Feature flags control incomplete modules, new instruments and scoring versions.
1. Canary/blue-green deployment for high-risk releases; health checks and automatic rollback.
1. Daily backups plus point-in-time recovery; quarterly restoration drill.
1. Incident severity, on-call ownership, communication and post-incident review defined before launch.

## 20. Codex Implementation Plan

### 20.1 Delivery Strategy

Codex should implement the system through small, reviewable pull requests. It must not attempt the entire platform in one generation. Each epic begins with an architecture decision record, database schema, API contract, tests and threat considerations. Human reviewers approve psychometric logic, security-sensitive code and production migrations.

### 20.2 Recommended Epics

|Epic|Deliverable|Exit criterion|
|---|---|---|
|E0 Foundation|Monorepo, CI, environments, design system, observability|Build/test/deploy skeleton passes|
|E1 Identity & Tenancy|Auth, MFA, organisations, RBAC, audit|Tenant isolation tests pass|
|E2 Candidate & Consent|Profiles, guardians, multilingual consent, imports|Minor and adult journeys pass|
|E3 Authoring|Instrument/item/locale workflow and approvals|Publish immutable test form|
|E4 Delivery|Assignments, player, autosave, timers, resume|Load and interruption tests pass|
|E5 Scoring|Versioned scoring library, norms, validity flags|Golden fixtures 100% pass|
|E6 Reports|Structured result schema, web/PDF templates, release|Four-language sample reports verified|
|E7 Counselling|Case review, notes, overrides, action plans|Counsellor end-to-end UAT|
|E8 Knowledge & Recommendations|Career/course/occupation graph and explainable rules|Expert-panel acceptance|
|E9 Institution/Commerce|Campaigns, credits, payments, dashboards|B2B pilot ready|
|E10 ITI/Employability|Trade, employability and blue-collar workflows|Pilot instrument ready|
|E11 HR|Competencies, 180/360, promotion and safeguards|Employer pilot and legal review|
|E12 Hardening|Security, accessibility, DR, performance, privacy|Production launch gate signed|

### 20.3 Codex Working Instructions
- Read /docs/SRS.md, /docs/ADRs and domain rules before coding.
- For each issue, write an implementation plan and list assumptions; do not change scope silently.
- Prefer pure, deterministic functions for scoring and recommendation facts.
- Never generate or alter live psychometric keys/norms without a reviewed fixture and approval.
- Add tests before or with code; no “TODO test later” for scoring, auth, consent or tenant isolation.
- Use migrations and seed only synthetic data; never commit secrets or real candidate data.
- Update OpenAPI, data dictionary and ADRs with every contract/architecture change.
- Run lint, type-check, unit, integration and relevant E2E tests before proposing a PR.
- Flag legal, psychometric, security or fairness uncertainty instead of inventing a rule.

### 20.4 Initial Codex Prompt

|Copy into Codex  Create a production-grade monorepo for career.theedumall.com according to docs/SRS.md. Start only with Epic E0 and E1. Use Next.js + TypeScript for the web app, NestJS + TypeScript for the API, PostgreSQL, Redis, Docker Compose for local development, OpenAPI, Vitest/Jest and Playwright. Implement tenant-aware authentication, MFA-ready privileged roles, RBAC, audit events, health checks, structured logging and CI. First produce ADRs, schema and task plan; then implement in small commits. Do not implement psychometric scoring or add test questions in this epic. Use synthetic seed data and include tenant-isolation/security tests.|
|---|

## 21. Acceptance Criteria

### 21.1 MVP Business Acceptance
- An institution can be created, branded and assigned authorised admins/counsellors.
- Candidates can be imported/invited, consent in one of four languages and complete an assigned assessment with resume/autosave.
- An approved, versioned instrument can be authored, translated, reviewed and published without developers editing code.
- Scoring reproduces signed golden fixtures and creates immutable result snapshots.
- Counsellor can review evidence, handle validity flags, add action plan and release a multilingual web/PDF report.
- Candidate/guardian accesses only authorised report; report access is audited.
- Admin sees aggregate completion and score-band dashboards with small-group privacy controls.
- Critical security, accessibility and load tests pass; backup restoration is demonstrated.

### 21.2 Launch Gate Checklist

|Gate|Required evidence|
|---|---|
|Psychometric|Technical manual, approvals, pilot status/norms and limitations|
|Content|Original/licensed items, four-language QA, cultural review|
|Legal/privacy|Terms, privacy notice, consent, DPA, retention and grievance process|
|Security|Threat model, penetration test, dependency status, incident plan|
|Accessibility|WCAG audit and remediation|
|Operations|Support SOP, monitoring, backup/restore and escalation|
|Commercial|Products, pricing/credits, invoice/payment and partner terms|
|Training|Admin, counsellor, proctor and support manuals|

## 22. Assumptions, Dependencies and Open Decisions

### 22.1 Baseline Assumptions
- career.theedumall.com will use a new secure application stack and not depend on Graphy for core assessment delivery.
- The EduMall will appoint qualified psychometric professionals and subject/domain experts to own instruments.
- Initial commercial release may use pilot/provisional status while normative studies continue, with clear labelling.
- Exact question counts, cut scores and weights are instrument-specific configuration and are not hard-coded in this SRS.
- Country/job requirements are maintained through reviewed official sources and expiry dates.
- Web-first delivery is preferred; native mobile apps are later phases.

### 22.2 Decisions Required Before Production

|Decision|Owner|Latest needed|
|---|---|---|
|Hosting provider, India data location and disaster-recovery design|CTO/legal|Before infrastructure build|
|Identity/OTP/SMS/WhatsApp/payment vendors|CTO/finance|Before integration epic|
|Age threshold and guardian-consent policy|Legal/product|Before candidate onboarding|
|Assessment names, pricing and report visibility|Product/business|Before B2C/B2B pilot|
|Psychometric frameworks, item counts and validation plan|Psychometric Director|Before authoring live instruments|
|Norm sample plan by language/cohort|Psychometric Director|Before validated claims|
|Career/occupation data sources and licensing|Research/legal|Before recommendation release|
|Employee assessment lawful-use policy and appeal workflow|HR/legal|Before HR pilot|
|Overseas countries, priority job roles and official sources|Global Skill Mission team|Before country overlays|
|Counsellor qualifications, certification and quality audits|Product/psychometric|Before report release|

## Appendix A — Detailed Requirement IDs

|ID|Requirement|Priority|
|---|---|---|
|FR-TEN-001|The system shall provide versioned, tenant-aware tenant and role capability with audited create/read/update/archive actions.|Must|
|FR-TEN-002|The system shall validate permissions and purpose before any tenant and role data access or export.|Must|
|FR-TEN-003|The system shall expose status, owner, timestamps and applicable version for every tenant and role record.|Must|
|FR-TEN-004|The system shall provide automated tests for critical tenant and role rules and failure conditions.|Must|
|FR-TEN-005|The system shall support configuration without allowing tenants to bypass platform governance for tenant and role.|Must|
|FR-CON-001|The system shall provide versioned, tenant-aware consent and privacy capability with audited create/read/update/archive actions.|Must|
|FR-CON-002|The system shall validate permissions and purpose before any consent and privacy data access or export.|Must|
|FR-CON-003|The system shall expose status, owner, timestamps and applicable version for every consent and privacy record.|Must|
|FR-CON-004|The system shall provide automated tests for critical consent and privacy rules and failure conditions.|Must|
|FR-CON-005|The system shall support configuration without allowing tenants to bypass platform governance for consent and privacy.|Must|
|FR-AUT-001|The system shall provide versioned, tenant-aware authoring capability with audited create/read/update/archive actions.|Must|
|FR-AUT-002|The system shall validate permissions and purpose before any authoring data access or export.|Must|
|FR-AUT-003|The system shall expose status, owner, timestamps and applicable version for every authoring record.|Must|
|FR-AUT-004|The system shall provide automated tests for critical authoring rules and failure conditions.|Must|
|FR-AUT-005|The system shall support configuration without allowing tenants to bypass platform governance for authoring.|Must|
|FR-DEL-001|The system shall provide versioned, tenant-aware delivery capability with audited create/read/update/archive actions.|Must|
|FR-DEL-002|The system shall validate permissions and purpose before any delivery data access or export.|Must|
|FR-DEL-003|The system shall expose status, owner, timestamps and applicable version for every delivery record.|Must|
|FR-DEL-004|The system shall provide automated tests for critical delivery rules and failure conditions.|Must|
|FR-DEL-005|The system shall support configuration without allowing tenants to bypass platform governance for delivery.|Must|
|FR-SCO-001|The system shall provide versioned, tenant-aware scoring capability with audited create/read/update/archive actions.|Must|
|FR-SCO-002|The system shall validate permissions and purpose before any scoring data access or export.|Must|
|FR-SCO-003|The system shall expose status, owner, timestamps and applicable version for every scoring record.|Must|
|FR-SCO-004|The system shall provide automated tests for critical scoring rules and failure conditions.|Must|
|FR-SCO-005|The system shall support configuration without allowing tenants to bypass platform governance for scoring.|Must|
|FR-REP-001|The system shall provide versioned, tenant-aware reporting capability with audited create/read/update/archive actions.|Must|
|FR-REP-002|The system shall validate permissions and purpose before any reporting data access or export.|Must|
|FR-REP-003|The system shall expose status, owner, timestamps and applicable version for every reporting record.|Must|
|FR-REP-004|The system shall provide automated tests for critical reporting rules and failure conditions.|Must|
|FR-REP-005|The system shall support configuration without allowing tenants to bypass platform governance for reporting.|Must|
|FR-REC-001|The system shall provide versioned, tenant-aware recommendation capability with audited create/read/update/archive actions.|Must|
|FR-REC-002|The system shall validate permissions and purpose before any recommendation data access or export.|Must|
|FR-REC-003|The system shall expose status, owner, timestamps and applicable version for every recommendation record.|Must|
|FR-REC-004|The system shall provide automated tests for critical recommendation rules and failure conditions.|Must|
|FR-REC-005|The system shall support configuration without allowing tenants to bypass platform governance for recommendation.|Must|
|FR-KNO-001|The system shall provide versioned, tenant-aware knowledge base capability with audited create/read/update/archive actions.|Must|
|FR-KNO-002|The system shall validate permissions and purpose before any knowledge base data access or export.|Must|
|FR-KNO-003|The system shall expose status, owner, timestamps and applicable version for every knowledge base record.|Must|
|FR-KNO-004|The system shall provide automated tests for critical knowledge base rules and failure conditions.|Must|
|FR-KNO-005|The system shall support configuration without allowing tenants to bypass platform governance for knowledge base.|Must|
|FR-COU-001|The system shall provide versioned, tenant-aware counselling capability with audited create/read/update/archive actions.|Must|
|FR-COU-002|The system shall validate permissions and purpose before any counselling data access or export.|Must|
|FR-COU-003|The system shall expose status, owner, timestamps and applicable version for every counselling record.|Must|
|FR-COU-004|The system shall provide automated tests for critical counselling rules and failure conditions.|Must|
|FR-COU-005|The system shall support configuration without allowing tenants to bypass platform governance for counselling.|Must|
|FR-EMP-001|The system shall provide versioned, tenant-aware employability/hr capability with audited create/read/update/archive actions.|Must|
|FR-EMP-002|The system shall validate permissions and purpose before any employability/hr data access or export.|Must|
|FR-EMP-003|The system shall expose status, owner, timestamps and applicable version for every employability/hr record.|Must|
|FR-EMP-004|The system shall provide automated tests for critical employability/hr rules and failure conditions.|Must|
|FR-EMP-005|The system shall support configuration without allowing tenants to bypass platform governance for employability/hr.|Must|
|FR-LOC-001|The system shall provide versioned, tenant-aware localisation capability with audited create/read/update/archive actions.|Must|
|FR-LOC-002|The system shall validate permissions and purpose before any localisation data access or export.|Must|
|FR-LOC-003|The system shall expose status, owner, timestamps and applicable version for every localisation record.|Must|
|FR-LOC-004|The system shall provide automated tests for critical localisation rules and failure conditions.|Must|
|FR-LOC-005|The system shall support configuration without allowing tenants to bypass platform governance for localisation.|Must|
|FR-ANA-001|The system shall provide versioned, tenant-aware analytics capability with audited create/read/update/archive actions.|Must|
|FR-ANA-002|The system shall validate permissions and purpose before any analytics data access or export.|Must|
|FR-ANA-003|The system shall expose status, owner, timestamps and applicable version for every analytics record.|Must|
|FR-ANA-004|The system shall provide automated tests for critical analytics rules and failure conditions.|Must|
|FR-ANA-005|The system shall support configuration without allowing tenants to bypass platform governance for analytics.|Must|
|FR-SEC-001|The system shall provide versioned, tenant-aware security capability with audited create/read/update/archive actions.|Must|
|FR-SEC-002|The system shall validate permissions and purpose before any security data access or export.|Must|
|FR-SEC-003|The system shall expose status, owner, timestamps and applicable version for every security record.|Must|
|FR-SEC-004|The system shall provide automated tests for critical security rules and failure conditions.|Must|
|FR-SEC-005|The system shall support configuration without allowing tenants to bypass platform governance for security.|Must|
|FR-OPS-001|The system shall provide versioned, tenant-aware operations capability with audited create/read/update/archive actions.|Must|
|FR-OPS-002|The system shall validate permissions and purpose before any operations data access or export.|Must|
|FR-OPS-003|The system shall expose status, owner, timestamps and applicable version for every operations record.|Must|
|FR-OPS-004|The system shall provide automated tests for critical operations rules and failure conditions.|Must|
|FR-OPS-005|The system shall support configuration without allowing tenants to bypass platform governance for operations.|Must|

## Appendix B — Example Score and Recommendation Schema

The implementation should use structured JSON facts similar to the following conceptual schema; actual schemas must be documented through OpenAPI/JSON Schema.

|result_id: UUID instrument: {id, edition, form, language, scoring_version, norm_version} validity: {status, flags[], completion_rate, timing_status} scales[]: {scale_id, raw, standard_score, percentile?, band, confidence_interval?, interpretation_key} recommendations[]: {entity_type, entity_id, fit_band, confidence, supporting_factors[], caution_factors[], prerequisites[], rule_version} action_plan[]: {horizon_days, action, owner, evidence} review: {required, reviewer_id?, override_reason?, released_at?}|
|---|

## Appendix C — Sources and Design References
- EduMilestones website — reviewed as a market/workflow reference for career assessment and counselling; no proprietary content is authorised for copying.
- Bharat Skills, Directorate General of Training, Ministry of Skill Development and Entrepreneurship — official repository reference for CTS/CITS/ATS, employability materials, question banks and mock-test structures.
- OpenAI Codex official product/help documentation — development-agent workflow reference.
- Applicable Indian privacy, employment, child-data and digital-service requirements must be verified by legal counsel at implementation time.

|Source freshness  External career, course, salary, certification, immigration and licensing data must display source and “last reviewed” date. Records past their review date must be flagged and may be excluded from recommendations.|
|---|

## Appendix D — Definition of Done
- Business requirement traced to issue and acceptance test.
- Architecture/security/privacy impact reviewed.
- Code reviewed; tests pass; coverage appropriate to risk.
- API and data dictionary updated.
- English and required locale strings complete; no hard-coded user-facing text.
- Accessibility checks pass.
- Audit event and permissions verified.
- Migrations and rollback/forward-fix documented.
- Observability and support diagnostics included.
- Demonstrated in staging with synthetic data and accepted by product owner.

# Appendix G — Premium Student Career Intelligence Report Specification

## G.1 Purpose

The platform shall generate a personalised, visually attractive and counsellor-reviewable Student Career Intelligence Report. The report shall normally contain 36–42 pages, with conditional sections based on age, class, stream, language, assessment package and result confidence. It shall not be a static PDF assembled from generic paragraphs. Every section shall be generated from versioned scores, norm groups, approved interpretation rules and a reusable report-component library.

The report must remain age-appropriate and strength-based. For minors, serious support indicators shall be visible first to an authorised counsellor and shall not be directly released to the student without review. The term “Red Alert” may be used internally as a workflow category, but the student-facing report shall use “Development Alerts and Support Priorities.”

## G.2 Report variants

|Variant|Target group|Normal length|Primary decision|
|---|---:|---:|---|
|SR-58|Classes 5–8|28–34 pages|Self-discovery, learning and early career exposure|
|SR-910|Classes 9–10|36–42 pages|Stream, subject and career-cluster exploration|
|SR-SCI|Classes 11–12 Science|36–42 pages|Degree, entrance and science-career direction|
|SR-COM|Classes 11–12 Commerce|36–42 pages|Commerce, management, finance, law and entrepreneurship routes|
|SR-HUM|Classes 11–12 Humanities|36–42 pages|Humanities, law, design, media, policy and social-science routes|
|SR-VOC|Vocational/ITI/Polytechnic|34–40 pages|Trade, diploma, apprenticeship and job readiness|
|SR-COL|College/University|34–40 pages|Specialisation, internship, employability and role-family direction|

## G.3 Mandatory page architecture

### Page 1 — Premium cover

Required components:
- Candidate name, optional photograph, class/course, board/university and institution.
- Assessment date, report ID, language, report version and QR verification code.
- EduMall/DMentor brand, product name and confidentiality mark.
- Counsellor name and credentials where assigned.
- Premium visual treatment using The EduMall red/blue identity, generous whitespace and a modern illustration system.

### Page 2 — Consent, purpose and limitations

The page shall show guardian consent status for minors, assessment purpose, privacy notice, validity period, retest conditions and a clear statement that no single assessment guarantees a career or determines academic admission.

### Page 3 — How to read the report

Explain percentile, standard score, score band, confidence interval, norm group, response-quality indicator, recommendation confidence and the difference between interest, personality, aptitude, skill, achievement and wellbeing indicators.

### Pages 4–5 — Executive career dashboard

The dashboard shall display:
- Career Readiness Index.
- Response Quality Index.
- Top personality strengths.
- Top three interests and motivators.
- Emotional Intelligence summary.
- Cognitive Ability summary.
- Strongest aptitudes.
- Top five career families.
- Recommended stream/course route where applicable.
- Study Behaviour Index.
- Parent–student alignment status where collected.
- Development priorities.
- Support-alert summary.
- Recommendation confidence.

Every summary value shall link to its detailed section in the web report.

### Page 6 — Career-planning maturity

Use the student-friendly stages:
1. Unaware
2. Exploring
3. Uncertain
4. Emerging Direction
5. Methodical
6. Career Ready

The output shall include current stage, evidence, risks, next milestone, recommended actions and suggested reassessment date.

### Pages 7–9 — Personality profile

The preferred core model is a validated five-factor trait model with optional behavioural preference overlays. Reportable dimensions may include:
- Openness/curiosity.
- Conscientiousness/self-management.
- Extraversion/social energy.
- Agreeableness/cooperation.
- Emotional stability.
- Assertiveness.
- Adaptability.
- Independence.
- Persistence.
- Structure preference.
- Practical versus conceptual orientation.

For each trait, the system shall provide score, percentile, behavioural meaning, likely strengths, possible blind spots, preferred learning environment, parent guidance and development action. Interpretation text must avoid negative labels and deterministic claims.

### Pages 10–11 — Career interest profile

Use a six-theme interest model: Realistic, Investigative, Artistic, Social, Enterprising and Conventional. The report shall show a radar chart, ranked bar chart, top-three code, activity preferences, engaging environments, associated career clusters and exploration suggestions.

### Page 12 — Career values and motivators

Assess and report, where included:
- Continuous learning.
- Financial security.
- Recognition.
- Independence.
- Social impact.
- Creativity.
- Stability.
- Competition.
- Adventure.
- Leadership.
- Work–life balance.
- Structured environment.
- Prestige.
- Technology exposure.
- Geographic mobility.

### Pages 13–15 — Emotional Intelligence

Report:
- Emotional self-awareness.
- Emotional expression.
- Self-regulation.
- Stress management.
- Empathy.
- Social awareness.
- Relationship management.
- Conflict handling.
- Optimism.
- Adaptability.
- Impulse control.
- Resilience.

Each domain must show an observable-behaviour interpretation, strength, possible difficulty and one practical intervention for home/school. The system must state that these are non-clinical developmental indicators.

### Pages 16–18 — Cognitive Ability profile

Potential domains:
- Verbal reasoning.
- Numerical reasoning.
- Abstract reasoning.
- Logical reasoning.
- Spatial reasoning.
- Mechanical reasoning.
- Processing speed.
- Working memory.
- Attention accuracy.
- Problem solving.

The report may show a General Reasoning Index or Cognitive Ability Index only after appropriate validation. It shall not use the term “IQ” unless the instrument has approved norms, documented reliability, validity, administration controls and professional sign-off. Where a global score is reported, include percentile and confidence interval.

### Pages 19–20 — Aptitude profile

Report relevant aptitudes such as numerical, verbal, scientific, mechanical, clerical accuracy, spatial, creative, social service, commercial, technology, leadership, administrative and practical/fine-motor aptitude. Each shall be categorised as Strength Zone, Usable Zone or Development Zone and connected to career significance and improvement activities.

### Page 21 — Learning and study profile

The report shall use a multimodal learning-preference model rather than declaring a student exclusively visual, auditory or kinesthetic. Include receiving-information preference, reading comprehension, note-taking, practical learning, visual organisation, memory strategy, revision habit, concentration pattern, study consistency and test-taking behaviour.

### Page 22 — Executive functioning

Assess planning, organisation, time management, task initiation, sustained attention, working memory, self-monitoring, flexibility, completion discipline and prioritisation. Provide a practical weekly routine recommendation.

### Page 23 — Academic behaviour and achievement orientation

Report achievement motivation, academic confidence, fear of failure, persistence, exam anxiety, help-seeking, curiosity, homework discipline, competitive orientation, self-directed learning and response to feedback.

### Page 24 — Communication and social skills

Include listening, verbal expression, written communication, presentation, collaboration, assertiveness, conflict resolution, respect for diversity, team participation and relationship building.

### Page 25 — Creativity, innovation and entrepreneurial potential

Include idea fluency, originality, curiosity, calculated risk-taking, initiative, opportunity recognition, problem reframing, resourcefulness, persuasion and execution orientation.

### Page 26 — Leadership and decision-making

Include initiative, influence, responsibility, decision confidence, ethical judgement, team mobilisation, delegation potential, accountability, crisis response and strategic thinking.

### Page 27 — Resilience and wellbeing indicators

Non-diagnostic indicators may include academic stress, emotional strain, social isolation, confidence, performance pressure, recovery after failure, support-seeking, optimism and institutional connectedness. Any high-severity output shall require counsellor review.

### Page 28 — Development alerts and support priorities

Possible indicators:
- Very low academic confidence.
- High examination stress.
- Low emotional regulation.
- Inconsistent or careless responding.
- Social-withdrawal indicators.
- Impulsivity.
- Low persistence.
- Severe career confusion.
- Parent–student mismatch.
- Very low motivation.
- Peer-pressure susceptibility.
- Excessive risk-taking.
- Low help-seeking.
- Concentration difficulty.
- Unrealistic career expectation.
- Interest–aptitude mismatch.

Display Green, Amber and Red workflow categories. Red means “mandatory professional review,” not diagnosis or automatic disclosure.

### Page 29 — Parent–student alignment

Where both questionnaires are available, compare student preference, parent expectation, performance evidence, aptitude, interests, financial/location constraints and readiness. Output: Aligned, Partially Aligned or Structured Discussion Required.

### Page 30 — Stream and subject recommendation

For Classes 8–10, compare Science–Mathematics, Science–Biology, Commerce with Mathematics, Commerce without Mathematics, Humanities, Vocational and Diploma/Technical pathways. Show suitability, supporting evidence, risk factors, subjects to strengthen and alternatives. Recommendations shall never be based on one domain alone.

### Pages 31–33 — Career clusters

Display top five clusters, emerging clusters and lower-alignment clusters. For each cluster show match explanation, required subjects, aptitudes, education routes and typical work environment.

### Pages 34–36 — Detailed career recommendations

Present 10–15 careers divided into:
- Top Fit.
- Strong Alternatives.
- Exploration Options.
- Development-Dependent Options.

For each career show overall fit, interest fit, personality fit, aptitude fit, EQ/work-style fit, academic requirements, stream/course route, entrance examinations, key skills, environment, risks and future progression. The recommendation engine shall show evidence and confidence, not merely a rank.

### Page 37 — Career roadmap

Generate an age-appropriate timeline from current class/course through subject choices, projects, competitions, entrance preparation, qualifications, internships and role destinations.

### Page 38 — 90-day development plan

Include measurable actions for academics, communication, EQ, digital skills, career exploration, reading, wellbeing, project work, parent action and counsellor follow-up.

### Page 39 — Counsellor interpretation

Editable but auditable fields:
- Key interpretation.
- Student aspiration.
- Parent concerns.
- Agreed direction.
- Alternative route.
- Further assessment needed.
- Follow-up date.
- Counsellor signature and registration/credential data.

### Page 40 — Final summary and verification

Show top strengths, development priorities, recommended route, top careers, three skills to build, support status, next action, QR verification, report version, assessment version and norm version.

## G.4 Conditional report rules

- Pages not applicable to the assigned battery shall be suppressed, not shown as blank.
- A report shall state “insufficient evidence” where a scale is unavailable or invalid.
- A serious alert shall never be released solely from an AI-generated narrative.
- Low response quality shall lower recommendation confidence and may block final release.
- Counsellor edits shall not change raw scores; they may add interpretation and documented overrides.
- All charts must remain readable in A4 print, mobile web view and monochrome printing.

# Appendix H — Employability, Employee and Competency Intelligence Report Specification

## H.1 Report families

|Code|Purpose|Normal length|
|---|---|---:|
|ER-ENTRY|Graduate/entry-level employability|30–36 pages|
|ER-TRADE|ITI, diploma and blue-collar role readiness|30–38 pages|
|ER-GLOBAL|Overseas workforce readiness|32–40 pages|
|ER-EMP|Current employee competency and development|34–42 pages|
|ER-PROMO|Promotion and upgradation readiness|34–42 pages|
|ER-LEAD|Leadership potential and succession|36–44 pages|

## H.2 Mandatory employee report architecture

1. Cover and QR verification.
2. Confidentiality, consent and permitted purpose.
3. Assessment methodology and evidence sources.
4. Executive workforce dashboard.
5. Overall Employability or Role Readiness Index.
6–7. Personality and work-style profile.
8. Work-interest profile.
9. Values and motivation.
10–12. Emotional Intelligence.
13–15. Cognitive and reasoning ability.
16. Communication.
17. Numerical and digital literacy.
18. Problem solving and critical thinking.
19. Teamwork and collaboration.
20. Customer orientation.
21. Adaptability and learning agility.
22. Planning and execution.
23. Productivity and time discipline.
24. Leadership/supervisory potential.
25. Integrity and reliability indicators.
26. Safety orientation.
27. Stress tolerance and resilience.
28. Risk and Verification Matrix.
29. Role-fit analysis.
30. Industry-fit analysis.
31. Job-family recommendations.
32. Domestic employability readiness.
33. Overseas readiness where applicable.
34. Competency-gap and training plan.
35. Interview/placement guidance.
36. Final HR/counsellor summary.

## H.3 Competency architecture builder

The platform shall allow authorised administrators to define:
- Organisational competencies.
- Department and function competencies.
- Role-family competencies.
- Technical competencies.
- Behavioural competencies.
- Leadership competencies.
- Safety competencies.
- Ethical and compliance competencies.
- Digital competencies.

Each competency record shall contain:
- Name and code.
- Definition.
- Category.
- Observable positive and negative behaviours.
- Five proficiency levels.
- Applicable role families.
- Assessment methods.
- Weight and criticality.
- Knockout status where legally and ethically acceptable.
- Trainable/non-trainable designation.
- Development resources.
- Version and approval state.

## H.4 Five-level competency proficiency scale

|Level|Label|Operational meaning|
|---:|---|---|
|1|Foundation|Understands basics; requires close supervision|
|2|Developing|Performs routine tasks with guidance|
|3|Proficient|Performs independently in normal situations|
|4|Advanced|Handles complex situations and guides others|
|5|Expert|Creates standards, mentors others and drives strategy|

## H.5 Role–competency mapping

Every job role shall support:
- Essential and desirable competencies.
- Minimum and target proficiency.
- Competency weight.
- Evidence source.
- Criticality.
- Interview questions.
- Training mapping.
- Country or regulatory overlay.

The system shall compare Assessed Level versus Required Level and calculate a transparent gap. A role-fit recommendation shall not be computed where mandatory evidence is missing.

## H.6 Multidimensional competency scoring

A competency may combine multiple evidence sources. Example configurable formula:

```
Leadership Readiness =
20% personality alignment
+ 20% emotional intelligence
+ 20% situational judgement
+ 15% cognitive ability
+ 15% manager rating
+ 10% performance evidence
```

Weights shall be versioned by tenant, role and assessment programme. The report shall disclose evidence sources and missing evidence.

## H.7 360-degree feedback

Supported rater groups:
- Self.
- Reporting manager.
- Peers.
- Direct reports.
- Internal customers.
- External customers.
- HR reviewer.

Required outputs:
- Self versus others.
- Rater-group comparisons.
- Hidden strengths.
- Blind spots.
- Consistent strengths.
- Development priorities.
- Comment themes.
- Rater count and confidence.

Minimum anonymity thresholds must be configurable. Peer or direct-report comments shall not be shown where anonymity could be compromised.

## H.8 9-box talent grid

The system shall support performance versus potential placement:

|Performance|Potential|Suggested classification|
|---|---|---|
|High|High|Future Leader / Star|
|High|Medium|High-Value Professional|
|High|Low|Trusted Specialist|
|Medium|High|Emerging Talent|
|Medium|Medium|Core Contributor|
|Medium|Low|Effective in Current Role|
|Low|High|Untapped Potential|
|Low|Medium|Development Required|
|Low|Low|Role-Fit Review Required|

The grid shall combine evidence such as performance history, competency results, manager input, 360 feedback and psychometric data. It shall never independently trigger termination or promotion denial.

## H.9 Risk and Verification Matrix

Replace accusatory “red alert” language in external reports with a structured matrix.

Categories:
- Reliability concern.
- Rule-adherence concern.
- Safety concern.
- Conflict sensitivity.
- Feedback resistance.
- Impulse-control concern.
- Adaptability concern.
- Frustration tolerance.
- Accountability concern.
- Customer-handling risk.
- Documentation/quality risk.
- Supervisor resistance.
- Burnout vulnerability.
- Overseas adjustment risk.
- Response inconsistency.
- Social desirability/impression management.
- Rapid or random responding.

Every alert shall show evidence source, severity, confidence, required verification, suggested interview question and permitted action. Wording must state “possible indicator requiring verification,” never a definitive accusation.

## H.10 Promotion readiness

Output bands:
- Ready Now.
- Ready with Structured Support.
- Develop for 6–12 Months.
- Better Suited to Specialist Track.
- Further Evidence Required.

Required dimensions:
- Current-role performance.
- Next-role competencies.
- Technical readiness.
- People management.
- Decision maturity.
- Strategic thinking.
- Accountability.
- Change readiness.
- Learning agility.
- Leadership risk.

## H.11 Blue-collar and global mobility readiness

Assess, where relevant:
- Trade knowledge.
- Tool identification.
- Practical problem solving.
- Safety compliance.
- Physical work orientation.
- Shift readiness.
- Climate and accommodation adaptability.
- Cultural adaptability.
- Workplace English.
- Numeracy.
- Documentation discipline.
- Supervisor compliance.
- Reliability.
- Teamwork.
- Stress tolerance.
- Financial discipline.
- Legal/ethical awareness.
- SOP adherence.

Country output labels: Behaviourally Ready, Conditionally Ready, Training Required or Further Verification Required. The system shall not claim visa eligibility or guarantee placement.

# Appendix I — Report Rendering, Design and Content Engine

## I.1 Component model

Every report block shall be stored as a reusable component containing:
- Component ID and version.
- Applicable product/audience.
- Title and explanatory text.
- Data bindings.
- Score and percentile bindings.
- Norm group.
- Confidence rule.
- Interpretation rules.
- Strength/development/action fields.
- Chart type and options.
- Visibility condition.
- Counsellor-note allowance.
- Language variants.
- Accessibility metadata.

## I.2 Supported visualisations

- Horizontal and vertical bar charts.
- Radar charts.
- Percentile gauges.
- Heat maps.
- Strength cards.
- Career-fit matrices.
- Competency-gap ladders.
- 9-box grid.
- Parent–student alignment matrix.
- Skill-gap tables.
- Development roadmaps.
- 90-day action trackers.
- Confidence badges.

## I.3 PDF generation requirements

- Server-side deterministic rendering.
- A4 portrait default with optional landscape pages for dense matrices.
- Repeating branded header/footer, page number and report ID.
- Embedded fonts with Devanagari and Gujarati support.
- WCAG-aligned colour contrast and non-colour status indicators.
- Charts rendered as SVG or high-resolution vector-friendly assets.
- Signed URL download with expiration.
- Hash and QR verification endpoint.
- Watermark option for employer or draft reports.
- Print-safe margins and no clipped content.
- Same data must render consistently in web and PDF.

## I.4 Narrative generation controls

- Validated interpretation templates are the primary source.
- AI may personalise wording only within approved semantic boundaries.
- AI shall not modify scores, invent evidence or generate diagnoses.
- Serious risk, career rejection, promotion denial and clinical language are prohibited.
- Every generated paragraph shall retain source-rule IDs for audit.
- Human-edited text shall retain editor, timestamp and reason.

# Appendix J — Final Codex Delivery Plan

## J.1 Recommended repository structure

```
/apps/web                 Next.js candidate, counsellor, HR and admin UI
/apps/api                 NestJS REST/GraphQL API
/apps/worker              Queue workers for scoring, PDF, email and analytics
/packages/ui              Design system and report components
/packages/domain          Shared domain types and business rules
/packages/scoring         Versioned scoring engine
/packages/reporting       Report schema, renderers and templates
/packages/i18n            English, Hindi, Gujarati and Marathi resources
/packages/security        Auth, permissions, audit and encryption helpers
/packages/testing         Fixtures, factories and contract tests
/infra                    Docker, IaC, monitoring and deployment
/docs                     SRS, ADRs, API docs and psychometric governance
```

## J.2 Build sequence

### Phase 0 — Foundation and governance
- Monorepo, CI, environments and coding standards.
- Architecture decision records.
- Threat model and privacy data-flow map.
- Instrument schema and approval workflow.
- Design system and multilingual typography proof.

### Phase 1 — MVP assessment platform
- Tenant and user management.
- Candidate/guardian consent.
- Item bank and assessment builder.
- Assessment delivery, resume and autosave.
- Base scoring engine.
- Counsellor dashboard.
- Web and PDF report skeleton.
- Payments/credits and audit logs.

### Phase 2 — Student intelligence
- Class 5–8 and 9–10 products.
- Interest, personality, aptitude, study behaviour and stream fit.
- Student premium 40-page report.
- Parent and counsellor views.
- Career/course knowledge base.

### Phase 3 — Higher education, ITI and employability
- Science, commerce, humanities and vocational batteries.
- College and course-specific modules.
- ITI/polytechnic trade and safety modules.
- Employability and job-family recommendations.

### Phase 4 — Corporate competency intelligence
- Competency builder.
- Role mapping and benchmarks.
- Employee assessment.
- 360-degree feedback.
- 9-box grid.
- Promotion readiness.
- Risk and Verification Matrix.
- Learning and development plans.

### Phase 5 — Global workforce and enterprise scale
- Country/occupation overlays.
- Proctoring and identity controls.
- Enterprise SSO and APIs.
- Advanced analytics, bulk campaigns and data warehouse.
- Mobile apps if validated by product demand.

## J.3 Definition of done for every Codex task

A task is complete only when:
- Requirement IDs are referenced in the PR.
- Unit, integration and end-to-end tests pass.
- Permission and tenant-isolation tests pass.
- Accessibility checks pass.
- English plus at least one Indian-language test fixture passes where relevant.
- Database migration has rollback instructions.
- API contract and user-facing documentation are updated.
- No secrets or personal data appear in logs.
- Security review is completed for high-risk changes.
- Screenshots or rendered-PDF evidence is attached for UI/report changes.

## J.4 Initial Codex master prompt

```
You are the principal engineering agent for the EduMall Career & Psychometric Assessment Platform at career.theedumall.com.

Treat /docs/SRS.md as the authoritative product requirement. Do not implement proprietary third-party test content. Use original fixtures and placeholders until approved instruments are supplied.

Before coding:
1. Read the SRS, architecture decision records and contributing guide.
2. Produce a dependency-aware implementation plan.
3. Identify privacy, security, psychometric and multilingual risks.
4. Ask only questions that block safe implementation.

Architecture baseline:
- TypeScript monorepo.
- Next.js web application.
- NestJS API and worker services.
- PostgreSQL with tenant-safe row-level controls where appropriate.
- Redis-backed queues and caching.
- Object storage for report files.
- OpenAPI contracts.
- Automated tests and CI.

Engineering rules:
- Never hard-code scoring rules in UI code.
- Every instrument, scoring model, norm and report template is versioned.
- Sensitive outcomes require human review.
- Enforce tenant isolation and least privilege.
- Make all user-facing strings translatable.
- Maintain immutable audit history for score/report releases.
- No AI-generated diagnosis, hiring rejection or unverified red alert.

Start with Phase 0 and Phase 1 only. Create small reviewable pull requests. Include migrations, tests, documentation and acceptance evidence with every feature.
```

# Appendix K — Final Production Acceptance Gates

The system shall not be commercially released until all applicable gates are passed:

1. At least one qualified psychometric professional has approved each instrument and report interpretation library.
2. Reliability, validity, fairness and language-equivalence documentation exists for each published instrument version.
3. Guardian consent and minor-data workflows are tested.
4. Tenant isolation passes automated and independent security testing.
5. Serious alerts require human review and cannot trigger automated adverse action.
6. Report claims accurately reflect available evidence and show confidence/limitations.
7. English, Hindi, Gujarati and Marathi rendering has been visually inspected.
8. PDF reports pass print, accessibility, QR verification and tamper-detection tests.
9. Backup restoration and disaster recovery have been tested.
10. Data-retention, deletion and access-request procedures are operational.
11. Employer use cases have approved purpose limitations and legal review.
12. Production monitoring, incident response and audit exports are operational.
13. A pilot has been completed with representative users from the relevant norm group.
14. No copied proprietary questions, scoring rules or report text are present.
15. Product owner, psychometric director, privacy/legal lead and technology lead have signed release approval.
