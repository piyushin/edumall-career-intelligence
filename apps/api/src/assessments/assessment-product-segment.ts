export type AssessmentProductSegment =
  "SCHOOL_6_8" | "SCHOOL_9_10" | "SCHOOL_11_12" | "COLLEGE" | "PROFESSIONAL" | "SKILLED_WORKFORCE";

export const COUNSELOR_VALIDATION_NOTICE =
  "This inference is based on your responses to this assessment. Please get these findings validated by your Counselor before making important educational, career or employment decisions.";

export const EMPLOYMENT_DECISION_NOTICE =
  "These results must not be used as the sole basis for recruitment, rejection, promotion, termination or any other employment decision.";

export interface AssessmentProductSegmentProfile {
  segment: AssessmentProductSegment;
  label: string;
  templateId: string;
  recommendationTitle: string;
  deepDiveTitle: string;
  decisionMatrixTitle: string;
  roadmapTitle: string;
  roadmapSubtitle: string;
  decisionPhrase: string;
}

const PROFILES: Record<AssessmentProductSegment, AssessmentProductSegmentProfile> = {
  SCHOOL_6_8: {
    segment: "SCHOOL_6_8",
    label: "School Discovery • Classes 6–8",
    templateId: "career-intelligence-student",
    recommendationTitle: "Career Exploration Directions",
    deepDiveTitle: "Exploration Deep Dive",
    decisionMatrixTitle: "Exploration Decision Matrix",
    roadmapTitle: "Discovery & Exploration Roadmap",
    roadmapSubtitle: "Turn strengths and interests into age-appropriate exploration",
    decisionPhrase: "learning and exploration choice",
  },
  SCHOOL_9_10: {
    segment: "SCHOOL_9_10",
    label: "School Career Guidance • Classes 9–10",
    templateId: "career-intelligence-student",
    recommendationTitle: "Career Path Recommendations",
    deepDiveTitle: "Career Deep Dive",
    decisionMatrixTitle: "Career Decision Matrix",
    roadmapTitle: "Stream & Career Roadmap",
    roadmapSubtitle: "Connect assessment evidence with stream and career exploration",
    decisionPhrase: "stream, subject or education decision",
  },
  SCHOOL_11_12: {
    segment: "SCHOOL_11_12",
    label: "School Career Guidance • Classes 11–12",
    templateId: "career-intelligence-student",
    recommendationTitle: "Career Path Recommendations",
    deepDiveTitle: "Career Deep Dive",
    decisionMatrixTitle: "Career Decision Matrix",
    roadmapTitle: "Education & Career Roadmap",
    roadmapSubtitle: "Translate assessment evidence into informed higher-education exploration",
    decisionPhrase: "course, education or career decision",
  },
  COLLEGE: {
    segment: "COLLEGE",
    label: "College & Graduate Career Intelligence",
    templateId: "career-intelligence-college",
    recommendationTitle: "Career & Role Recommendations",
    deepDiveTitle: "Career & Role Deep Dive",
    decisionMatrixTitle: "Career & Employability Decision Matrix",
    roadmapTitle: "Career & Employability Roadmap",
    roadmapSubtitle: "Turn assessment evidence into employability and career experiments",
    decisionPhrase: "career, higher-education or employability decision",
  },
  PROFESSIONAL: {
    segment: "PROFESSIONAL",
    label: "Professional Career Intelligence",
    templateId: "career-intelligence-professional",
    recommendationTitle: "Career Direction Recommendations",
    deepDiveTitle: "Career Direction Deep Dive",
    decisionMatrixTitle: "Career Transition Decision Matrix",
    roadmapTitle: "Career Growth & Transition Roadmap",
    roadmapSubtitle: "Use assessment evidence to plan career growth, reskilling or transition",
    decisionPhrase: "career-growth, reskilling or transition decision",
  },
  SKILLED_WORKFORCE: {
    segment: "SKILLED_WORKFORCE",
    label: "Skilled Workforce & Blue-Collar Career Intelligence",
    templateId: "career-intelligence-skilled-workforce",
    recommendationTitle: "Job-Family & Role-Fit Recommendations",
    deepDiveTitle: "Job-Family Deep Dive",
    decisionMatrixTitle: "Role-Fit Decision Matrix",
    roadmapTitle: "Job-Fit & Skill-Upgradation Roadmap",
    roadmapSubtitle: "Turn work-profile evidence into role exploration and skill development",
    decisionPhrase: "job-family, training or skill-upgradation decision",
  },
};

export function isAssessmentProductSegment(value: unknown): value is AssessmentProductSegment {
  return (
    value === "SCHOOL_6_8" ||
    value === "SCHOOL_9_10" ||
    value === "SCHOOL_11_12" ||
    value === "COLLEGE" ||
    value === "PROFESSIONAL" ||
    value === "SKILLED_WORKFORCE"
  );
}

export function resolveAssessmentProductSegment(
  assessmentDefinitionCode: string,
  edition: string,
): AssessmentProductSegment {
  const fingerprint = `${assessmentDefinitionCode} ${edition}`.trim().toUpperCase();

  if (/SKILLED|BLUE[_ -]?COLLAR|WORKFORCE|VOCATIONAL/.test(fingerprint)) {
    return "SKILLED_WORKFORCE";
  }

  if (/PROFESSIONAL|WORKING[_ -]?PROFESSIONAL|CAREER[_ -]?TRANSITION/.test(fingerprint)) {
    return "PROFESSIONAL";
  }

  if (
    /COLLEGE|UNIVERSITY|GRADUATE|UNDERGRADUATE|POSTGRADUATE|\\bUG\\b|\\bPG\\b/.test(fingerprint)
  ) {
    return "COLLEGE";
  }

  if (
    /SCHOOL[_ -]?6[_ -]?8|CLASS(?:ES)?[_ -]?6[_ -]?8|6[_ -]?TO[_ -]?8|6–8|6-8/.test(fingerprint)
  ) {
    return "SCHOOL_6_8";
  }

  if (
    /SCHOOL[_ -]?9[_ -]?10|CLASS(?:ES)?[_ -]?9[_ -]?10|9[_ -]?TO[_ -]?10|9–10|9-10/.test(
      fingerprint,
    )
  ) {
    return "SCHOOL_9_10";
  }

  return "SCHOOL_11_12";
}

export function assessmentProductSegmentProfile(
  segment: AssessmentProductSegment,
): AssessmentProductSegmentProfile {
  return PROFILES[segment];
}

export function isEmploymentProductSegment(segment: AssessmentProductSegment): boolean {
  return segment === "PROFESSIONAL" || segment === "SKILLED_WORKFORCE";
}
