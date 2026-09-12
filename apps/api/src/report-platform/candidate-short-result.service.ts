import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AssessmentAttemptStatus,
  AssessmentReportGenerationStatus,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function publishedText(value: unknown, keys: string[]): string | null {
  const source = record(value);
  if (!source) return null;
  for (const key of keys) {
    const candidate = stringValue(source[key]);
    if (candidate) return candidate;
  }
  return null;
}

@Injectable()
export class CandidateShortResultService {
  public constructor(@Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient) {}

  public async getOwnShortResult(context: AuthContext, attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: {
        id: attemptId,
        assignment: {
          userId: context.userId,
          ...(context.organizationId ? { organizationId: context.organizationId } : {}),
        },
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        assignment: { select: { assessmentVersion: { select: { title: true } } } },
        scoringRuns: { take: 1, orderBy: { calculatedAt: "desc" }, select: { id: true } },
        reportGeneration: {
          select: {
            status: true,
            lastErrorCode: true,
            reportDataSnapshot: { select: { payload: true } },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        code: "ASSESSMENT_RESULT_NOT_FOUND",
        message: "Assessment result not found.",
      });
    }

    const common = {
      attemptId: attempt.id,
      assessmentTitle: attempt.assignment.assessmentVersion.title,
      submittedAt: attempt.submittedAt,
    };

    if (attempt.status !== AssessmentAttemptStatus.SUBMITTED) {
      return { ...common, status: "ASSESSMENT_IN_PROGRESS" as const };
    }

    if (!attempt.scoringRuns[0]) {
      return { ...common, status: "SCORING" as const };
    }

    const generation = attempt.reportGeneration;
    if (
      !generation ||
      generation.status === AssessmentReportGenerationStatus.PENDING ||
      generation.status === AssessmentReportGenerationStatus.PROCESSING
    ) {
      return {
        ...common,
        status: "PROCESSING" as const,
        message: "Your Career Intelligence summary is being prepared.",
      };
    }

    if (generation.status === AssessmentReportGenerationStatus.BLOCKED_CONFIGURATION) {
      return {
        ...common,
        status: "CONFIGURATION_BLOCKED" as const,
        errorCode: generation.lastErrorCode,
        message:
          "Your result needs scientific configuration support. Please contact The EduMall support team.",
      };
    }

    if (generation.status === AssessmentReportGenerationStatus.FAILED) {
      return {
        ...common,
        status: "GENERATION_FAILED" as const,
        errorCode: generation.lastErrorCode,
        message: "Your result could not be prepared yet. Support can safely retry it.",
      };
    }

    const payload = record(generation.reportDataSnapshot?.payload);
    if (!payload || payload.schemaVersion !== "assessment-report-data-v3") {
      return {
        ...common,
        status: "PROCESSING" as const,
        message: "Your Career Intelligence summary is being prepared.",
      };
    }

    return { ...common, status: "AVAILABLE" as const, ...this.summarize(payload) };
  }

  private summarize(payload: JsonRecord) {
    const scoring = record(payload.scoring);
    const interpretation = record(payload.interpretation);
    const careerFit = record(payload.careerFit);
    const constructs = Array.isArray(scoring?.constructs) ? scoring.constructs : [];
    const norms = Array.isArray(payload.norms) ? payload.norms : [];
    const applications = Array.isArray(interpretation?.applications)
      ? interpretation.applications
      : [];
    const normByConstruct = new Map(
      norms
        .map(record)
        .filter((item): item is JsonRecord => item !== null)
        .map((item) => [stringValue(item.assessmentConstructId), item]),
    );
    const interpretationByConstruct = new Map(
      applications
        .map(record)
        .filter((item): item is JsonRecord => item !== null)
        .map((item) => [stringValue(item.assessmentConstructId), item]),
    );

    const indicators = constructs
      .map(record)
      .filter((item): item is JsonRecord => item !== null)
      .map((construct) => {
        const constructId = stringValue(construct.assessmentConstructId);
        const norm = normByConstruct.get(constructId) ?? null;
        const application = interpretationByConstruct.get(constructId) ?? null;
        const percentile = stringValue(norm?.percentile);
        const standardizedScore = stringValue(norm?.standardizedScore);
        return {
          name: stringValue(construct.name) ?? "Published construct",
          description: stringValue(construct.description),
          percentile,
          standardizedScore,
          interpretationLabel: publishedText(application?.outputData, ["label", "title", "band"]),
          interpretationSummary: publishedText(application?.outputData, [
            "summary",
            "description",
            "overview",
          ]),
          sortValue: Number(percentile ?? standardizedScore ?? application?.metricValue ?? 0),
        };
      })
      .sort((left, right) => right.sortValue - left.sortValue)
      .slice(0, 5)
      .map(({ sortValue: _sortValue, ...indicator }) => indicator);

    const rankedPaths = Array.isArray(careerFit?.rankedCareerPaths)
      ? careerFit.rankedCareerPaths
      : [];
    const careerDirections = rankedPaths
      .map(record)
      .filter((item): item is JsonRecord => item !== null)
      .sort((left, right) => Number(left.rank ?? 0) - Number(right.rank ?? 0))
      .slice(0, 5)
      .map((path) => {
        const band = record(path.recommendationBand);
        return {
          name: stringValue(path.careerPathName) ?? "Published career direction",
          description: stringValue(path.careerPathDescription),
          cluster: stringValue(path.careerClusterName),
          recommendationLabel: stringValue(band?.label),
          recommendationSummary: publishedText(band?.outputData, ["summary", "description"]),
        };
      });

    return {
      profileOverview:
        indicators.find((indicator) => indicator.interpretationSummary)?.interpretationSummary ??
        null,
      strongestIndicators: indicators,
      careerDirections,
      nextStep:
        "Your detailed Career Intelligence report is ready. Unlock or open it from your report access panel.",
    };
  }
}
