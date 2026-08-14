import type { AssessmentReportTemplateDefinition } from "./assessment-report-composition.types";

export const LEGACY_GOVERNED_REPORT_TEMPLATE_V1 = {
  templateId: "governed-assessment-report",
  templateVersion: "1",
  audience: "COUNSELOR",
  sections: [
    {
      key: "COVER",
      title: "Psychometric Assessment",
      required: true,
      dataRequirement: "ALWAYS",
    },
    {
      key: "ASSESSMENT_RESULTS",
      title: "Assessment Results",
      required: true,
      dataRequirement: "ALWAYS",
    },
    {
      key: "PROVENANCE",
      title: "Report Provenance",
      required: true,
      dataRequirement: "ALWAYS",
    },
  ],
} as const satisfies AssessmentReportTemplateDefinition;

export const CAREER_INTELLIGENCE_STUDENT_TEMPLATE_V1 = {
  templateId: "career-intelligence-student",
  templateVersion: "1",
  audience: "CANDIDATE",
  sections: [
    {
      key: "COVER",
      title: "Career Intelligence Report",
      required: true,
      dataRequirement: "ALWAYS",
    },
    {
      key: "EXECUTIVE_SNAPSHOT",
      title: "Career Intelligence Snapshot",
      required: true,
      dataRequirement: "ALWAYS",
    },
    {
      key: "HOW_TO_USE",
      title: "How to Use This Report",
      required: true,
      dataRequirement: "ALWAYS",
    },
    {
      key: "PLANNING_READINESS",
      title: "Career Planning Readiness",
      required: false,
      dataRequirement: "PLANNING_READINESS",
    },
    { key: "PERSONALITY", title: "Career Personality", required: true, dataRequirement: "ALWAYS" },
    { key: "INTERESTS", title: "Career Interests", required: true, dataRequirement: "ALWAYS" },
    { key: "MOTIVATORS", title: "Career Motivators", required: true, dataRequirement: "ALWAYS" },
    {
      key: "LEARNING_PROFILE",
      title: "Learning Profile",
      required: true,
      dataRequirement: "ALWAYS",
    },
    {
      key: "APTITUDE_AND_ABILITIES",
      title: "Aptitude, Skills and Abilities",
      required: true,
      dataRequirement: "ALWAYS",
    },
    {
      key: "INTEGRATED_STRENGTH_MAP",
      title: "Integrated Strength Map",
      required: false,
      dataRequirement: "CAREER_FIT",
    },
    {
      key: "CAREER_CLUSTERS",
      title: "Career Cluster Map",
      required: false,
      dataRequirement: "CAREER_FIT",
    },
    {
      key: "CAREER_PATHS",
      title: "Career Path Recommendations",
      required: false,
      dataRequirement: "CAREER_FIT",
    },
    {
      key: "PRIORITY_CAREER_DEEP_DIVE",
      title: "Priority Career Deep Dive",
      required: false,
      dataRequirement: "GUIDANCE_CONTENT",
    },
    {
      key: "SUBJECT_STREAM_GUIDANCE",
      title: "Subject and Stream Guidance",
      required: false,
      dataRequirement: "GUIDANCE_CONTENT",
    },
    {
      key: "EDUCATION_ROADMAP",
      title: "Education Roadmap",
      required: false,
      dataRequirement: "GUIDANCE_CONTENT",
    },
    {
      key: "CAREER_ENVIRONMENT",
      title: "Career Environment Snapshot",
      required: false,
      dataRequirement: "MARKET_SNAPSHOT",
    },
    {
      key: "DEVELOPMENT_PLAN",
      title: "90-Day Development Plan",
      required: false,
      dataRequirement: "GUIDANCE_CONTENT",
    },
    {
      key: "COUNSELOR_DISCUSSION",
      title: "Counselor Discussion Page",
      required: false,
      dataRequirement: "COUNSELOR_ANNOTATION",
    },
    {
      key: "PROVENANCE",
      title: "Scientific and Technical Provenance",
      required: true,
      dataRequirement: "ALWAYS",
    },
  ],
} as const satisfies AssessmentReportTemplateDefinition;

export const ASSESSMENT_REPORT_TEMPLATES = [
  LEGACY_GOVERNED_REPORT_TEMPLATE_V1,
  CAREER_INTELLIGENCE_STUDENT_TEMPLATE_V1,
] as const;
