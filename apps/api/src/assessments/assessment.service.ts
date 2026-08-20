import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentAssignmentStatus,
  AssessmentAttemptStatus,
  AssessmentItemType,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import { AssessmentScoringService } from "./assessment-scoring.service";
import type { SaveAssessmentResponseDto } from "./assessment.types";

@Injectable()
export class AssessmentService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
    @Inject(AssessmentScoringService)
    private readonly scoring: AssessmentScoringService,
  ) {}

  public async listAssignments(context: AuthContext) {
    const organizationId = this.requireOrganization(context);

    return this.prisma.assessmentAssignment.findMany({
      where: {
        organizationId,
        userId: context.userId,
      },
      orderBy: {
        assignedAt: "desc",
      },
      select: {
        id: true,
        assignedAt: true,
        availableFrom: true,
        expiresAt: true,
        maxAttempts: true,
        status: true,
        assessmentVersion: {
          select: {
            id: true,
            title: true,
            description: true,
            instructions: true,
            versionNumber: true,
            edition: true,
            form: true,
            language: true,
          },
        },
        attempts: {
          orderBy: {
            attemptNumber: "desc",
          },
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            startedAt: true,
            lastActivityAt: true,
            submittedAt: true,
            abandonedAt: true,
            reportReleases: {
              orderBy: {
                releasedAt: "desc",
              },
              take: 1,
              select: {
                id: true,
                releasedAt: true,
                reportDataSnapshot: {
                  select: {
                    reportVersion: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  public async startOrResumeAttempt(context: AuthContext, assignmentId: string) {
    const organizationId = this.requireOrganization(context);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const assignment = await tx.assessmentAssignment.findFirst({
            where: {
              id: assignmentId,
              organizationId,
              userId: context.userId,
            },
            select: {
              id: true,
              status: true,
              maxAttempts: true,
              availableFrom: true,
              expiresAt: true,
            },
          });

          if (!assignment) {
            throw new NotFoundException({
              code: "ASSESSMENT_ASSIGNMENT_NOT_FOUND",
              message: "Assessment assignment not found.",
            });
          }

          this.assertAssignmentAvailable(assignment);

          const existing = await tx.assessmentAttempt.findFirst({
            where: {
              assignmentId,
              status: AssessmentAttemptStatus.IN_PROGRESS,
            },
            orderBy: {
              attemptNumber: "desc",
            },
            select: {
              id: true,
              assignmentId: true,
              attemptNumber: true,
              status: true,
              startedAt: true,
              lastActivityAt: true,
              submittedAt: true,
            },
          });

          if (existing) {
            return existing;
          }

          const latest = await tx.assessmentAttempt.findFirst({
            where: {
              assignmentId,
            },
            orderBy: {
              attemptNumber: "desc",
            },
            select: {
              attemptNumber: true,
            },
          });

          const attemptNumber = (latest?.attemptNumber ?? 0) + 1;

          if (attemptNumber > assignment.maxAttempts) {
            throw new ConflictException({
              code: "ASSESSMENT_ATTEMPT_LIMIT_REACHED",
              message: "Assessment attempt limit reached.",
            });
          }

          return tx.assessmentAttempt.create({
            data: {
              assignmentId,
              attemptNumber,
            },
            select: {
              id: true,
              assignmentId: true,
              attemptNumber: true,
              status: true,
              startedAt: true,
              lastActivityAt: true,
              submittedAt: true,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034")
      ) {
        throw new ConflictException({
          code: "ASSESSMENT_ATTEMPT_CONFLICT",
          message: "Another assessment attempt was created concurrently. Please retry.",
        });
      }

      throw error;
    }
  }

  public async getAttempt(context: AuthContext, attemptId: string) {
    const organizationId = this.requireOrganization(context);

    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: {
        id: attemptId,
        assignment: {
          organizationId,
          userId: context.userId,
        },
      },
      select: {
        id: true,
        attemptNumber: true,
        status: true,
        startedAt: true,
        lastActivityAt: true,
        submittedAt: true,
        assignment: {
          select: {
            id: true,
            assessmentVersion: {
              select: {
                id: true,
                title: true,
                description: true,
                instructions: true,
                versionNumber: true,
                edition: true,
                form: true,
                language: true,
                items: {
                  orderBy: {
                    orderIndex: "asc",
                  },
                  select: {
                    id: true,
                    code: true,
                    type: true,
                    prompt: true,
                    helpText: true,
                    orderIndex: true,
                    required: true,
                    options: {
                      orderBy: {
                        orderIndex: "asc",
                      },
                      select: {
                        id: true,
                        code: true,
                        label: true,
                        orderIndex: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          select: {
            id: true,
            itemId: true,
            textValue: true,
            numericValue: true,
            booleanValue: true,
            answeredAt: true,
            updatedAt: true,
            selections: {
              select: {
                optionId: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        code: "ASSESSMENT_ATTEMPT_NOT_FOUND",
        message: "Assessment attempt not found.",
      });
    }

    return {
      ...attempt,
      responses: attempt.responses.map((response) => ({
        ...response,
        numericValue: response.numericValue?.toString() ?? null,
        optionIds: response.selections.map((selection) => selection.optionId),
        selections: undefined,
      })),
    };
  }

  public async saveResponse(
    context: AuthContext,
    attemptId: string,
    itemId: string,
    input: SaveAssessmentResponseDto,
  ) {
    const organizationId = this.requireOrganization(context);

    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.assessmentAttempt.findFirst({
        where: {
          id: attemptId,
          assignment: {
            organizationId,
            userId: context.userId,
          },
        },
        select: {
          id: true,
          status: true,
          assignment: {
            select: {
              assessmentVersionId: true,
            },
          },
        },
      });

      if (!attempt) {
        throw new NotFoundException({
          code: "ASSESSMENT_ATTEMPT_NOT_FOUND",
          message: "Assessment attempt not found.",
        });
      }

      if (attempt.status !== AssessmentAttemptStatus.IN_PROGRESS) {
        throw new ConflictException({
          code: "ASSESSMENT_ATTEMPT_FINALIZED",
          message: "Responses can only be changed while an assessment attempt is in progress.",
        });
      }

      const item = await tx.assessmentItem.findFirst({
        where: {
          id: itemId,
          assessmentVersionId: attempt.assignment.assessmentVersionId,
        },
        select: {
          id: true,
          type: true,
          options: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!item) {
        throw new NotFoundException({
          code: "ASSESSMENT_ITEM_NOT_FOUND",
          message: "Assessment item does not belong to this attempt.",
        });
      }

      const normalized = this.validateResponseInput(item, input);

      const response = await tx.assessmentResponse.upsert({
        where: {
          attemptId_itemId: {
            attemptId,
            itemId,
          },
        },
        create: {
          attemptId,
          itemId,
          textValue: normalized.textValue,
          numericValue: normalized.numericValue,
          booleanValue: normalized.booleanValue,
          answeredAt: new Date(),
        },
        update: {
          textValue: normalized.textValue,
          numericValue: normalized.numericValue,
          booleanValue: normalized.booleanValue,
          answeredAt: new Date(),
        },
        select: {
          id: true,
        },
      });

      await tx.assessmentResponseOption.deleteMany({
        where: {
          responseId: response.id,
        },
      });

      if (normalized.optionIds.length > 0) {
        await tx.assessmentResponseOption.createMany({
          data: normalized.optionIds.map((optionId) => ({
            optionId,
            responseId: response.id,
          })),
        });
      }

      await tx.assessmentAttempt.update({
        where: {
          id: attemptId,
        },
        data: {
          lastActivityAt: new Date(),
        },
      });

      return {
        status: "saved" as const,
        responseId: response.id,
      };
    });
  }

  public async submitAttempt(context: AuthContext, attemptId: string) {
    const organizationId = this.requireOrganization(context);

    const submission = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.assessmentAttempt.findFirst({
        where: {
          id: attemptId,
          assignment: {
            organizationId,
            userId: context.userId,
          },
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          assignment: {
            select: {
              assessmentVersion: {
                select: {
                  items: {
                    where: {
                      required: true,
                    },
                    select: {
                      id: true,
                      type: true,
                    },
                  },
                },
              },
            },
          },
          responses: {
            select: {
              itemId: true,
              textValue: true,
              numericValue: true,
              booleanValue: true,
              selections: {
                select: {
                  optionId: true,
                },
              },
            },
          },
        },
      });

      if (!attempt) {
        throw new NotFoundException({
          code: "ASSESSMENT_ATTEMPT_NOT_FOUND",
          message: "Assessment attempt not found.",
        });
      }

      if (attempt.status === AssessmentAttemptStatus.SUBMITTED) {
        return {
          status: "submitted" as const,
          submittedAt: attempt.submittedAt,
        };
      }

      if (attempt.status !== AssessmentAttemptStatus.IN_PROGRESS) {
        throw new ConflictException({
          code: "ASSESSMENT_ATTEMPT_FINALIZED",
          message: "This assessment attempt can no longer be submitted.",
        });
      }

      const responseMap = new Map(attempt.responses.map((response) => [response.itemId, response]));

      for (const item of attempt.assignment.assessmentVersion.items) {
        const response = responseMap.get(item.id);

        if (!response || !this.hasRequiredAnswer(item.type, response)) {
          throw new BadRequestException({
            code: "ASSESSMENT_INCOMPLETE",
            message: "All required assessment items must be answered before submission.",
          });
        }
      }

      const submittedAt = new Date();

      await tx.assessmentAttempt.update({
        where: {
          id: attemptId,
        },
        data: {
          status: AssessmentAttemptStatus.SUBMITTED,
          submittedAt,
          lastActivityAt: submittedAt,
        },
      });

      return {
        status: "submitted" as const,
        submittedAt,
      };
    });

    await this.scoring.scoreSubmittedAttempt(attemptId);

    return submission;
  }

  private requireOrganization(context: AuthContext): string {
    if (!context.organizationId) {
      throw new ForbiddenException({
        code: "ORGANIZATION_CONTEXT_REQUIRED",
        message: "An organization-scoped session is required.",
      });
    }

    return context.organizationId;
  }

  private assertAssignmentAvailable(assignment: {
    status: AssessmentAssignmentStatus;
    availableFrom: Date | null;
    expiresAt: Date | null;
  }): void {
    const now = new Date();

    if (assignment.status !== AssessmentAssignmentStatus.ACTIVE) {
      throw new ConflictException({
        code: "ASSESSMENT_ASSIGNMENT_INACTIVE",
        message: "Assessment assignment is not active.",
      });
    }

    if (assignment.availableFrom && now < assignment.availableFrom) {
      throw new ConflictException({
        code: "ASSESSMENT_NOT_YET_AVAILABLE",
        message: "Assessment assignment is not yet available.",
      });
    }

    if (assignment.expiresAt && now >= assignment.expiresAt) {
      throw new ConflictException({
        code: "ASSESSMENT_ASSIGNMENT_EXPIRED",
        message: "Assessment assignment has expired.",
      });
    }
  }

  private validateResponseInput(
    item: {
      type: AssessmentItemType;
      options: Array<{ id: string }>;
    },
    input: SaveAssessmentResponseDto,
  ): {
    textValue: string | null;
    numericValue: string | null;
    booleanValue: boolean | null;
    optionIds: string[];
  } {
    const optionIds = [...new Set(input.optionIds ?? [])];
    const hasText = input.textValue !== undefined && input.textValue.trim().length > 0;
    const hasNumeric = input.numericValue !== undefined;
    const hasBoolean = input.booleanValue !== undefined;

    const rejectMixedScalarValues = (): void => {
      if (hasText || hasNumeric || hasBoolean) {
        throw this.invalidResponse();
      }
    };

    if (item.type === AssessmentItemType.SINGLE_CHOICE || item.type === AssessmentItemType.LIKERT) {
      rejectMixedScalarValues();

      if (optionIds.length !== 1) {
        throw this.invalidResponse();
      }
    } else if (item.type === AssessmentItemType.MULTIPLE_CHOICE) {
      rejectMixedScalarValues();

      if (optionIds.length === 0) {
        throw this.invalidResponse();
      }
    } else if (item.type === AssessmentItemType.BOOLEAN) {
      if (!hasBoolean || optionIds.length > 0 || hasText || hasNumeric) {
        throw this.invalidResponse();
      }
    } else if (item.type === AssessmentItemType.NUMERIC) {
      if (!hasNumeric || optionIds.length > 0 || hasText || hasBoolean) {
        throw this.invalidResponse();
      }
    } else if (item.type === AssessmentItemType.TEXT) {
      if (!hasText || optionIds.length > 0 || hasNumeric || hasBoolean) {
        throw this.invalidResponse();
      }
    }

    if (optionIds.length > 0) {
      const allowed = new Set(item.options.map((option) => option.id));

      if (optionIds.some((id) => !allowed.has(id))) {
        throw new BadRequestException({
          code: "ASSESSMENT_OPTION_INVALID",
          message: "One or more selected options do not belong to this assessment item.",
        });
      }
    }

    return {
      textValue: item.type === AssessmentItemType.TEXT ? (input.textValue?.trim() ?? null) : null,
      numericValue: item.type === AssessmentItemType.NUMERIC ? (input.numericValue ?? null) : null,
      booleanValue: item.type === AssessmentItemType.BOOLEAN ? (input.booleanValue ?? null) : null,
      optionIds,
    };
  }

  private hasRequiredAnswer(
    type: AssessmentItemType,
    response: {
      textValue: string | null;
      numericValue: Prisma.Decimal | null;
      booleanValue: boolean | null;
      selections: Array<{ optionId: string }>;
    },
  ): boolean {
    if (type === AssessmentItemType.SINGLE_CHOICE || type === AssessmentItemType.LIKERT) {
      return response.selections.length === 1;
    }

    if (type === AssessmentItemType.MULTIPLE_CHOICE) {
      return response.selections.length > 0;
    }

    if (type === AssessmentItemType.BOOLEAN) {
      return response.booleanValue !== null;
    }

    if (type === AssessmentItemType.NUMERIC) {
      return response.numericValue !== null;
    }

    if (type === AssessmentItemType.TEXT) {
      return response.textValue !== null && response.textValue.trim().length > 0;
    }

    return false;
  }

  private invalidResponse(): BadRequestException {
    return new BadRequestException({
      code: "ASSESSMENT_RESPONSE_INVALID",
      message: "Response format does not match the assessment item type.",
    });
  }
}
