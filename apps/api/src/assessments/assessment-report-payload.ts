/**
 * Shape written by AssessmentReportDataService.createSnapshot. Only the fields the
 * student-friendly summary reads are declared here.
 */
export interface AssessmentReportSnapshotPayload {
  assessment: {
    title: string;
    edition: string;
    form: string;
    language: string;
  };
  scoring: {
    constructs: Array<{
      assessmentConstructId: string;
      code: string;
      name: string;
    }>;
  };
  interpretation: {
    applications: Array<{
      assessmentConstructId: string;
      ruleCode: string;
      outputData: unknown;
    }>;
  };
}

export interface AssessmentReleasedReportSummary {
  assessment: {
    title: string;
    edition: string;
    form: string;
    language: string;
  };
  results: Array<{
    constructCode: string | null;
    constructName: string | null;
    outputData: unknown;
  }>;
}

/**
 * Reduces a full report-data snapshot payload to the student-friendly summary: construct
 * name plus the published interpretation rule's approved output. Never returns
 * raw/standardized scores, percentiles, or norm/interpretation provenance ids (D-008).
 */
export function summarizeReportPayload(
  payload: AssessmentReportSnapshotPayload,
): AssessmentReleasedReportSummary {
  const constructsById = new Map(
    payload.scoring.constructs.map((construct) => [construct.assessmentConstructId, construct]),
  );

  return {
    assessment: {
      title: payload.assessment.title,
      edition: payload.assessment.edition,
      form: payload.assessment.form,
      language: payload.assessment.language,
    },
    results: payload.interpretation.applications.map((application) => {
      const construct = constructsById.get(application.assessmentConstructId);

      return {
        constructCode: construct?.code ?? null,
        constructName: construct?.name ?? null,
        outputData: application.outputData,
      };
    }),
  };
}
