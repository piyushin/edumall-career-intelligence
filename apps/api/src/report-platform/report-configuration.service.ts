import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentInterpretationSetStatus,
  AssessmentNormSetStatus,
  AssessmentReportConfigurationStatus,
  CareerFitModelStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type { ConfigureAutomaticReportDto } from "./report-platform.types";

@Injectable()
export class ReportConfigurationService {
  public constructor(@Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient) {}

  public async configure(context: AuthContext, input: ConfigureAutomaticReportDto) {
    const references = await this.validateReferences(input);
    this.assertVersionScope(
      context,
      references.assessmentVersion.assessmentDefinition.organizationId,
    );

    if (input.status === AssessmentReportConfigurationStatus.ACTIVE) {
      this.assertPublished(references);
    }

    return this.prisma.$transaction(
      async (tx) => {
        if (input.status === AssessmentReportConfigurationStatus.ACTIVE) {
          await tx.assessmentReportConfiguration.updateMany({
            where: {
              assessmentVersionId: input.assessmentVersionId,
              status: AssessmentReportConfigurationStatus.ACTIVE,
            },
            data: { status: AssessmentReportConfigurationStatus.INACTIVE },
          });
        }

        const configuration = await tx.assessmentReportConfiguration.create({
          data: {
            assessmentVersionId: input.assessmentVersionId,
            normGroupId: input.normGroupId,
            interpretationSetId: input.interpretationSetId,
            careerFitModelId: input.careerFitModelId,
            reportTemplateVersion: input.reportTemplateVersion.trim(),
            status: input.status ?? AssessmentReportConfigurationStatus.INACTIVE,
            configuredByUserId: context.userId,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: context.organizationId,
            actorUserId: context.userId,
            action: "report.configuration.created",
            entityType: "AssessmentReportConfiguration",
            entityId: configuration.id,
            metadata: {
              assessmentVersionId: input.assessmentVersionId,
              status: configuration.status,
            },
          },
        });
        return configuration;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async activate(context: AuthContext, configurationId: string) {
    const configuration = await this.prisma.assessmentReportConfiguration.findUnique({
      where: { id: configurationId },
    });
    if (!configuration)
      throw new NotFoundException({
        code: "REPORT_CONFIGURATION_NOT_FOUND",
        message: "Report configuration not found.",
      });

    const references = await this.validateReferences(configuration);
    this.assertVersionScope(
      context,
      references.assessmentVersion.assessmentDefinition.organizationId,
    );
    this.assertPublished(references);

    return this.prisma.$transaction(
      async (tx) => {
        await tx.assessmentReportConfiguration.updateMany({
          where: {
            assessmentVersionId: configuration.assessmentVersionId,
            status: AssessmentReportConfigurationStatus.ACTIVE,
            id: { not: configuration.id },
          },
          data: { status: AssessmentReportConfigurationStatus.INACTIVE },
        });
        const activated = await tx.assessmentReportConfiguration.update({
          where: { id: configuration.id },
          data: {
            status: AssessmentReportConfigurationStatus.ACTIVE,
            configuredByUserId: context.userId,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: context.organizationId,
            actorUserId: context.userId,
            action: "report.configuration.activated",
            entityType: "AssessmentReportConfiguration",
            entityId: activated.id,
            metadata: { assessmentVersionId: activated.assessmentVersionId },
          },
        });
        return activated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public list(context: AuthContext, assessmentVersionId?: string) {
    return this.prisma.assessmentReportConfiguration.findMany({
      where: {
        ...(assessmentVersionId ? { assessmentVersionId } : {}),
        ...(context.organizationId === null
          ? {}
          : {
              assessmentVersion: {
                assessmentDefinition: { organizationId: context.organizationId },
              },
            }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  public async readiness(context: AuthContext, assessmentVersionId: string) {
    const version = await this.prisma.assessmentVersion.findUnique({
      where: { id: assessmentVersionId },
      select: {
        id: true,
        normVersion: true,
        assessmentDefinition: { select: { organizationId: true } },
        reportConfigurations: {
          where: { status: AssessmentReportConfigurationStatus.ACTIVE },
          take: 2,
          select: {
            id: true,
            normGroup: {
              select: {
                normSet: {
                  select: { assessmentVersionId: true, normVersion: true, status: true },
                },
              },
            },
            interpretationSet: { select: { assessmentVersionId: true, status: true } },
            careerFitModel: { select: { assessmentVersionId: true, status: true } },
          },
        },
      },
    });
    if (!version) {
      throw new NotFoundException({
        code: "ASSESSMENT_VERSION_NOT_FOUND",
        message: "Assessment version not found.",
      });
    }
    this.assertVersionScope(context, version.assessmentDefinition.organizationId);
    const configuration =
      version.reportConfigurations.length === 1 ? version.reportConfigurations[0] : null;
    const normReady = Boolean(
      configuration &&
        configuration.normGroup.normSet.assessmentVersionId === version.id &&
        configuration.normGroup.normSet.normVersion === version.normVersion &&
        configuration.normGroup.normSet.status === AssessmentNormSetStatus.PUBLISHED,
    );
    const interpretationReady = Boolean(
      configuration &&
        configuration.interpretationSet.assessmentVersionId === version.id &&
        configuration.interpretationSet.status === AssessmentInterpretationSetStatus.PUBLISHED,
    );
    const careerFitReady = Boolean(
      configuration &&
        configuration.careerFitModel.assessmentVersionId === version.id &&
        configuration.careerFitModel.status === CareerFitModelStatus.PUBLISHED,
    );
    return {
      assessmentVersionId,
      status:
        configuration && normReady && interpretationReady && careerFitReady
          ? ("READY" as const)
          : ("CONFIGURATION_REQUIRED" as const),
      activeConfigurationId: configuration?.id ?? null,
      activeConfigurationCount: version.reportConfigurations.length,
      checks: {
        activeConfiguration: version.reportConfigurations.length === 1,
        publishedNormSource: normReady,
        publishedInterpretation: interpretationReady,
        publishedCareerFitModel: careerFitReady,
      },
    };
  }

  private async validateReferences(
    input: Pick<
      ConfigureAutomaticReportDto,
      "assessmentVersionId" | "normGroupId" | "interpretationSetId" | "careerFitModelId"
    >,
  ) {
    const [assessmentVersion, normGroup, interpretationSet, careerFitModel] = await Promise.all([
      this.prisma.assessmentVersion.findUnique({
        where: { id: input.assessmentVersionId },
        select: {
          id: true,
          normVersion: true,
          assessmentDefinition: { select: { organizationId: true } },
        },
      }),
      this.prisma.assessmentNormGroup.findUnique({
        where: { id: input.normGroupId },
        select: {
          id: true,
          normSet: { select: { assessmentVersionId: true, normVersion: true, status: true } },
        },
      }),
      this.prisma.assessmentInterpretationSet.findUnique({
        where: { id: input.interpretationSetId },
        select: { id: true, assessmentVersionId: true, status: true },
      }),
      this.prisma.careerFitModel.findUnique({
        where: { id: input.careerFitModelId },
        select: { id: true, assessmentVersionId: true, status: true },
      }),
    ]);
    if (!assessmentVersion || !normGroup || !interpretationSet || !careerFitModel) {
      throw new NotFoundException({
        code: "REPORT_CONFIGURATION_REFERENCE_NOT_FOUND",
        message: "One or more report configuration references were not found.",
      });
    }
    if (
      normGroup.normSet.assessmentVersionId !== assessmentVersion.id ||
      normGroup.normSet.normVersion !== assessmentVersion.normVersion ||
      interpretationSet.assessmentVersionId !== assessmentVersion.id ||
      careerFitModel.assessmentVersionId !== assessmentVersion.id
    ) {
      throw new BadRequestException({
        code: "REPORT_CONFIGURATION_VERSION_MISMATCH",
        message:
          "All report configuration references must belong to the same assessment and norm version.",
      });
    }
    return { assessmentVersion, normGroup, interpretationSet, careerFitModel };
  }

  private assertPublished(
    references: Awaited<ReturnType<ReportConfigurationService["validateReferences"]>>,
  ) {
    if (
      references.normGroup.normSet.status !== AssessmentNormSetStatus.PUBLISHED ||
      references.interpretationSet.status !== AssessmentInterpretationSetStatus.PUBLISHED ||
      references.careerFitModel.status !== CareerFitModelStatus.PUBLISHED
    ) {
      throw new BadRequestException({
        code: "REPORT_CONFIGURATION_UNPUBLISHED_REFERENCE",
        message: "Only published norm, interpretation, and CareerFit records may be activated.",
      });
    }
  }

  private assertVersionScope(context: AuthContext, ownerOrganizationId: string | null) {
    if (context.organizationId !== null && ownerOrganizationId !== context.organizationId) {
      throw new ForbiddenException({
        code: "ORGANIZATION_SCOPE_VIOLATION",
        message: "The assessment version is outside your administrative scope.",
      });
    }
  }
}
