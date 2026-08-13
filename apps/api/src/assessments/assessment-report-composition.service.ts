import { ConflictException, Injectable } from "@nestjs/common";
import {
  getAssessmentReportSchemaVersion,
  hasAssessmentReportDataRequirement,
  isAssessmentReportPayloadV3,
  type AssessmentReportCompositionPlan,
  type AssessmentReportSectionKey,
  type AssessmentReportTemplateDefinition,
} from "./assessment-report-composition.types";
import {
  ASSESSMENT_REPORT_TEMPLATES,
  LEGACY_GOVERNED_REPORT_TEMPLATE_V1,
} from "./assessment-report-template";

@Injectable()
export class AssessmentReportCompositionService {
  public compose(payload: unknown): AssessmentReportCompositionPlan {
    const schemaVersion = getAssessmentReportSchemaVersion(payload);

    if (!schemaVersion) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_SCHEMA_UNSUPPORTED",
        message: "The report snapshot schema is not supported for report composition.",
      });
    }

    if (
      schemaVersion === "assessment-report-data-v1" ||
      schemaVersion === "assessment-report-data-v2"
    ) {
      return this.planFromTemplate(schemaVersion, LEGACY_GOVERNED_REPORT_TEMPLATE_V1, "en-IN");
    }

    if (!isAssessmentReportPayloadV3(payload)) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_SNAPSHOT_INVALID",
        message:
          "The v3 report snapshot does not contain a valid report composition configuration.",
      });
    }

    const template = ASSESSMENT_REPORT_TEMPLATES.find(
      (candidate) => candidate.templateId === payload.reportComposition.templateId,
    );

    if (!template || template.templateVersion !== payload.reportComposition.templateVersion) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_TEMPLATE_UNSUPPORTED",
        message: "The report template and version are not supported by this application build.",
      });
    }

    if (template.audience !== payload.reportComposition.audience) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_TEMPLATE_AUDIENCE_MISMATCH",
        message: "The report template does not match the requested report audience.",
      });
    }

    const enabledSections = payload.reportComposition.enabledSections
      ? new Set<AssessmentReportSectionKey>(payload.reportComposition.enabledSections)
      : null;

    const sections = template.sections.filter((section) => {
      if (section.required) {
        return true;
      }

      if (enabledSections && !enabledSections.has(section.key)) {
        return false;
      }

      return hasAssessmentReportDataRequirement(payload, section.dataRequirement);
    });

    return {
      schemaVersion,
      templateId: template.templateId,
      templateVersion: template.templateVersion,
      audience: template.audience,
      locale: payload.reportComposition.locale,
      sections: sections.map((section) => ({ ...section })),
    };
  }

  private planFromTemplate(
    schemaVersion: "assessment-report-data-v1" | "assessment-report-data-v2",
    template: AssessmentReportTemplateDefinition,
    locale: string,
  ): AssessmentReportCompositionPlan {
    return {
      schemaVersion,
      templateId: template.templateId,
      templateVersion: template.templateVersion,
      audience: template.audience,
      locale,
      sections: template.sections.map((section) => ({ ...section })),
    };
  }
}
