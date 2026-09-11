import { BadRequestException } from "@nestjs/common";
import {
  AssessmentInterpretationSetStatus,
  AssessmentNormSetStatus,
  AssessmentReportConfigurationStatus,
  CareerFitModelStatus,
  MembershipRole,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { ReportConfigurationService } from "./report-configuration.service";

const versionId = "11111111-1111-4111-8111-111111111111";
const context: AuthContext = {
  userId: "22222222-2222-4222-8222-222222222222",
  organizationId: null,
  membershipId: null,
  role: MembershipRole.SUPER_ADMIN,
  sessionId: "session",
  permissions: ["*"],
};

function prisma(
  overrides: {
    normVersionId?: string;
    normStatus?: AssessmentNormSetStatus;
    interpretationVersionId?: string;
    interpretationStatus?: AssessmentInterpretationSetStatus;
    careerVersionId?: string;
    careerStatus?: CareerFitModelStatus;
  } = {},
) {
  return {
    assessmentVersion: {
      findUnique: vi.fn().mockResolvedValue({
        id: versionId,
        normVersion: "N1",
        assessmentDefinition: { organizationId: null },
      }),
    },
    assessmentNormGroup: {
      findUnique: vi.fn().mockResolvedValue({
        id: "norm",
        normSet: {
          assessmentVersionId: overrides.normVersionId ?? versionId,
          normVersion: "N1",
          status: overrides.normStatus ?? AssessmentNormSetStatus.PUBLISHED,
        },
      }),
    },
    assessmentInterpretationSet: {
      findUnique: vi.fn().mockResolvedValue({
        id: "interpretation",
        assessmentVersionId: overrides.interpretationVersionId ?? versionId,
        status: overrides.interpretationStatus ?? AssessmentInterpretationSetStatus.PUBLISHED,
      }),
    },
    careerFitModel: {
      findUnique: vi.fn().mockResolvedValue({
        id: "career",
        assessmentVersionId: overrides.careerVersionId ?? versionId,
        status: overrides.careerStatus ?? CareerFitModelStatus.PUBLISHED,
      }),
    },
  };
}

const input = {
  assessmentVersionId: versionId,
  normGroupId: "33333333-3333-4333-8333-333333333333",
  interpretationSetId: "44444444-4444-4444-8444-444444444444",
  careerFitModelId: "55555555-5555-4555-8555-555555555555",
  reportTemplateVersion: "R20",
  status: AssessmentReportConfigurationStatus.ACTIVE,
};

describe("ReportConfigurationService", () => {
  it("rejects cross-assessment scientific references", async () => {
    const client = prisma({ careerVersionId: "99999999-9999-4999-8999-999999999999" });
    await expect(
      new ReportConfigurationService(client as unknown as PrismaClient).configure(context, input),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    { normStatus: AssessmentNormSetStatus.DRAFT },
    { interpretationStatus: AssessmentInterpretationSetStatus.DRAFT },
    { careerStatus: CareerFitModelStatus.DRAFT },
  ])("rejects activation with an unpublished reference", async (override) => {
    const client = prisma(override);
    await expect(
      new ReportConfigurationService(client as unknown as PrismaClient).configure(context, input),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "REPORT_CONFIGURATION_UNPUBLISHED_REFERENCE" }),
    });
  });
});
