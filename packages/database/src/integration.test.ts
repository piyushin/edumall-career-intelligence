import { randomUUID } from "node:crypto";
import {
  AssessmentAttemptStatus,
  AssessmentInterpretationMetric,
  AssessmentInterpretationSetStatus,
  AssessmentNormSetStatus,
  AssessmentReportReleaseStatus,
  AssessmentVersionStatus,
  ConsentAcceptorRole,
  ConsentDocumentStatus,
  ConsentDocumentType,
  MembershipRole,
  MembershipStatus,
  OrganizationType,
  Prisma,
  UserStatus,
  type PrismaClient,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptInvitation,
  AuthenticationErrorCode,
  checkDatabaseConnection,
  createPrismaClient,
  hashOpaqueToken,
  validateSessionToken,
} from "./index";

const runIntegrationTests = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
const integrationDatabaseUrl = process.env.DATABASE_INTEGRATION_URL;

describe.skipIf(!runIntegrationTests)("PostgreSQL authentication integration", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!integrationDatabaseUrl) {
      throw new Error(
        "DATABASE_INTEGRATION_URL is required when RUN_DATABASE_INTEGRATION_TESTS=true",
      );
    }

    prisma = createPrismaClient(integrationDatabaseUrl);
    await checkDatabaseConnection(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("runs the Phase 1B schema and enforces live session membership state", async () => {
    const suffix = randomUUID();
    const rawToken = `integration-session-${suffix}`;
    const expiredRawToken = `expired-integration-session-${suffix}`;
    const invitationRawToken = `integration-invitation-${suffix}`;

    const columns = await prisma.$queryRaw<Array<{ is_nullable: string }>>`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'password_hash'
    `;
    expect(columns).toEqual([{ is_nullable: "YES" }]);

    const invitationTable = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'invitation_tokens'
    `;
    expect(invitationTable).toEqual([{ table_name: "invitation_tokens" }]);

    const organization = await prisma.organization.create({
      data: {
        name: `Phase 1B Integration ${suffix}`,
        slug: `phase-1b-${suffix}`,
        type: OrganizationType.SCHOOL,
      },
    });
    const invitedUser = await prisma.user.create({
      data: {
        email: `phase-1b-${suffix}@example.test`,
        normalizedEmail: `phase-1b-${suffix}@example.test`,
        passwordHash: null,
        firstName: "Integration",
        lastName: "User",
        status: UserStatus.INVITED,
      },
    });

    try {
      expect(invitedUser.passwordHash).toBeNull();

      await prisma.invitationToken.create({
        data: {
          userId: invitedUser.id,
          tokenHash: hashOpaqueToken(invitationRawToken),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await acceptInvitation(prisma, invitationRawToken, "Integration password 2026!");
      const membership = await prisma.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: invitedUser.id,
          role: MembershipRole.STUDENT,
          status: MembershipStatus.ACTIVE,
        },
      });
      const activeSession = await prisma.session.create({
        data: {
          organizationId: organization.id,
          userId: invitedUser.id,
          tokenHash: hashOpaqueToken(rawToken),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await expect(validateSessionToken(prisma, rawToken)).resolves.toEqual({
        userId: invitedUser.id,
        organizationId: organization.id,
        membershipId: membership.id,
        role: MembershipRole.STUDENT,
        sessionId: activeSession.id,
      });

      await prisma.organizationMembership.update({
        where: { id: membership.id },
        data: { status: MembershipStatus.SUSPENDED },
      });
      await expect(validateSessionToken(prisma, rawToken)).rejects.toMatchObject({
        code: AuthenticationErrorCode.INACTIVE_MEMBERSHIP,
      });

      await prisma.session.create({
        data: {
          organizationId: organization.id,
          userId: invitedUser.id,
          tokenHash: hashOpaqueToken(expiredRawToken),
          expiresAt: new Date(Date.now() - 1),
        },
      });
      await expect(validateSessionToken(prisma, expiredRawToken)).rejects.toMatchObject({
        code: AuthenticationErrorCode.EXPIRED_SESSION,
      });
    } finally {
      await prisma.session.deleteMany({ where: { userId: invitedUser.id } });
      await prisma.organizationMembership.deleteMany({
        where: { userId: invitedUser.id },
      });
      await prisma.auditLog.deleteMany({ where: { actorUserId: invitedUser.id } });
      await prisma.user.delete({ where: { id: invitedUser.id } });
      await prisma.organization.delete({ where: { id: organization.id } });
    }
  });
});

describe.skipIf(!runIntegrationTests)("Phase 2 assessment database integration", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!integrationDatabaseUrl) {
      throw new Error(
        "DATABASE_INTEGRATION_URL is required when RUN_DATABASE_INTEGRATION_TESTS=true",
      );
    }

    prisma = createPrismaClient(integrationDatabaseUrl);
    await checkDatabaseConnection(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("enforces assessment scoring, norm, interpretation, and report provenance", async () => {
    const suffix = randomUUID();

    const organization = await prisma.organization.create({
      data: {
        name: `Phase 2 Integration ${suffix}`,
        slug: `phase-2-${suffix}`,
        type: OrganizationType.SCHOOL,
      },
    });

    const user = await prisma.user.create({
      data: {
        email: `phase-2-${suffix}@example.test`,
        normalizedEmail: `phase-2-${suffix}@example.test`,
        firstName: "Phase",
        lastName: "Two",
        status: UserStatus.ACTIVE,
      },
    });

    const definition = await prisma.assessmentDefinition.create({
      data: {
        organizationId: organization.id,
        code: `phase-2-${suffix}`,
        createdByUserId: user.id,
      },
    });

    const version = await prisma.assessmentVersion.create({
      data: {
        assessmentDefinitionId: definition.id,
        versionNumber: 1,
        title: "Phase 2 Integration Assessment",
        edition: "2026",
        form: "A",
        language: "en",
        scoringVersion: "score-v1",
        normVersion: "norm-v1",
        reportVersion: "report-v1",
        createdByUserId: user.id,
      },
    });

    const construct = await prisma.assessmentConstruct.create({
      data: {
        assessmentVersionId: version.id,
        code: "construct-1",
        name: "Integration Construct",
        orderIndex: 1,
      },
    });

    await prisma.assessmentVersion.update({
      where: { id: version.id },
      data: {
        status: AssessmentVersionStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedByUserId: user.id,
      },
    });

    await expect(
      prisma.assessmentVersion.update({
        where: { id: version.id },
        data: {
          status: AssessmentVersionStatus.RETIRED,
          retiredAt: new Date(),
          title: "Mutated published assessment",
        },
      }),
    ).rejects.toThrow(/Published assessment version content is immutable/);

    const draftVersion = await prisma.assessmentVersion.create({
      data: {
        assessmentDefinitionId: definition.id,
        versionNumber: 2,
        title: "Draft Assessment",
        edition: "2026",
        form: "B",
        language: "en",
        scoringVersion: "score-v2",
        normVersion: "norm-v2",
        reportVersion: "report-v2",
      },
    });

    await expect(
      prisma.assessmentAssignment.create({
        data: {
          organizationId: organization.id,
          assessmentVersionId: draftVersion.id,
          userId: user.id,
        },
      }),
    ).rejects.toThrow(/Only published assessment versions may be assigned/);

    const assignment = await prisma.assessmentAssignment.create({
      data: {
        organizationId: organization.id,
        assessmentVersionId: version.id,
        userId: user.id,
        assignedByUserId: user.id,
        maxAttempts: 1,
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        assignmentId: assignment.id,
        attemptNumber: 1,
      },
    });

    await expect(
      prisma.assessmentScoringRun.create({
        data: {
          attemptId: attempt.id,
          scoringVersion: "score-v1",
          algorithmVersion: "integration-v1",
          inputHash: "1".repeat(64),
        },
      }),
    ).rejects.toThrow(/Only submitted assessment attempts may be scored/);

    await prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: AssessmentAttemptStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    await expect(
      prisma.assessmentScoringRun.create({
        data: {
          attemptId: attempt.id,
          scoringVersion: "wrong-version",
          algorithmVersion: "integration-v1",
          inputHash: "2".repeat(64),
        },
      }),
    ).rejects.toThrow(/Scoring run version must match the assessment version scoring identifier/);

    const scoringRun = await prisma.assessmentScoringRun.create({
      data: {
        attemptId: attempt.id,
        scoringVersion: "score-v1",
        algorithmVersion: "integration-v1",
        inputHash: "3".repeat(64),
      },
    });

    const constructScore = await prisma.assessmentConstructScore.create({
      data: {
        scoringRunId: scoringRun.id,
        assessmentConstructId: construct.id,
        rawScore: new Prisma.Decimal("12"),
        answeredItemCount: 3,
        contributionCount: 3,
      },
    });

    await expect(
      prisma.assessmentConstructScore.update({
        where: {
          scoringRunId_assessmentConstructId: {
            scoringRunId: scoringRun.id,
            assessmentConstructId: construct.id,
          },
        },
        data: {
          rawScore: new Prisma.Decimal("13"),
        },
      }),
    ).rejects.toThrow(/Assessment scoring history is immutable/);

    const normSet = await prisma.assessmentNormSet.create({
      data: {
        assessmentVersionId: version.id,
        normVersion: "norm-v1",
        name: "Integration Norm Set",
      },
    });

    const normGroup = await prisma.assessmentNormGroup.create({
      data: {
        normSetId: normSet.id,
        code: "integration-group",
        name: "Integration Group",
      },
    });

    const normTable = await prisma.assessmentConstructNormTable.create({
      data: {
        normGroupId: normGroup.id,
        assessmentConstructId: construct.id,
      },
    });

    const lookupRow = await prisma.assessmentNormLookupRow.create({
      data: {
        constructNormTableId: normTable.id,
        rawScoreMin: new Prisma.Decimal("10"),
        rawScoreMax: new Prisma.Decimal("15"),
        standardizedScore: new Prisma.Decimal("55"),
        percentile: new Prisma.Decimal("72.5"),
      },
    });

    await prisma.assessmentNormSet.update({
      where: { id: normSet.id },
      data: {
        status: AssessmentNormSetStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    await expect(
      prisma.assessmentNormApplication.create({
        data: {
          scoringRunId: scoringRun.id,
          assessmentConstructId: construct.id,
          normSetId: normSet.id,
          normGroupId: normGroup.id,
          constructNormTableId: normTable.id,
          normLookupRowId: lookupRow.id,
          rawScore: new Prisma.Decimal("13"),
          standardizedScore: new Prisma.Decimal("55"),
          percentile: new Prisma.Decimal("72.5"),
        },
      }),
    ).rejects.toThrow(/Norm application raw score must match the stored construct raw score/);

    const normApplication = await prisma.assessmentNormApplication.create({
      data: {
        scoringRunId: scoringRun.id,
        assessmentConstructId: construct.id,
        normSetId: normSet.id,
        normGroupId: normGroup.id,
        constructNormTableId: normTable.id,
        normLookupRowId: lookupRow.id,
        rawScore: constructScore.rawScore,
        standardizedScore: new Prisma.Decimal("55"),
        percentile: new Prisma.Decimal("72.5"),
      },
    });

    const interpretationSet = await prisma.assessmentInterpretationSet.create({
      data: {
        assessmentVersionId: version.id,
        version: "interpret-v1",
        name: "Integration Interpretation Set",
      },
    });

    const interpretationRule = await prisma.assessmentInterpretationRule.create({
      data: {
        interpretationSetId: interpretationSet.id,
        assessmentConstructId: construct.id,
        code: "integration-rule",
        metric: AssessmentInterpretationMetric.PERCENTILE,
        lowerBound: new Prisma.Decimal("70"),
        upperBound: new Prisma.Decimal("80"),
        priority: 10,
        outputData: {
          band: "integration-band",
        },
      },
    });

    await prisma.assessmentInterpretationSet.update({
      where: { id: interpretationSet.id },
      data: {
        status: AssessmentInterpretationSetStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    await expect(
      prisma.assessmentInterpretationApplication.create({
        data: {
          normApplicationId: normApplication.id,
          interpretationRuleId: interpretationRule.id,
          metricValue: new Prisma.Decimal("71"),
          outputData: {
            band: "integration-band",
          },
        },
      }),
    ).rejects.toThrow(/Interpretation metric value must match the normalized result/);

    const interpretationApplication = await prisma.assessmentInterpretationApplication.create({
      data: {
        normApplicationId: normApplication.id,
        interpretationRuleId: interpretationRule.id,
        metricValue: new Prisma.Decimal("72.5"),
        outputData: {
          band: "integration-band",
        },
      },
    });

    expect(interpretationApplication.id).toBeTruthy();

    await expect(
      prisma.assessmentReportDataSnapshot.create({
        data: {
          scoringRunId: scoringRun.id,
          assessmentVersionId: version.id,
          interpretationSetId: interpretationSet.id,
          reportVersion: "wrong-report-version",
          inputHash: "4".repeat(64),
          payload: {
            schemaVersion: "integration-v1",
          },
        },
      }),
    ).rejects.toThrow(/Report data version must match the assessment report identifier/);

    const reportSnapshot = await prisma.assessmentReportDataSnapshot.create({
      data: {
        scoringRunId: scoringRun.id,
        assessmentVersionId: version.id,
        interpretationSetId: interpretationSet.id,
        reportVersion: "report-v1",
        inputHash: "5".repeat(64),
        payload: {
          schemaVersion: "integration-v1",
        },
      },
    });

    await expect(
      prisma.assessmentReportDataSnapshot.update({
        where: {
          id: reportSnapshot.id,
        },
        data: {
          payload: {
            schemaVersion: "mutated",
          },
        },
      }),
    ).rejects.toThrow(/Assessment interpretation and report-data history is immutable/);
  });

  it("enforces report release scope, lifecycle, and counsellor note guards (Phase 5A)", async () => {
    const suffix = randomUUID();

    const organization = await prisma.organization.create({
      data: {
        name: `Phase 5A Integration ${suffix}`,
        slug: `phase-5a-${suffix}`,
        type: OrganizationType.SCHOOL,
      },
    });

    const otherOrganization = await prisma.organization.create({
      data: {
        name: `Phase 5A Other ${suffix}`,
        slug: `phase-5a-other-${suffix}`,
        type: OrganizationType.SCHOOL,
      },
    });

    const candidate = await prisma.user.create({
      data: {
        email: `phase-5a-candidate-${suffix}@example.test`,
        normalizedEmail: `phase-5a-candidate-${suffix}@example.test`,
        firstName: "Phase",
        lastName: "Candidate",
        status: UserStatus.ACTIVE,
      },
    });

    const counsellor = await prisma.user.create({
      data: {
        email: `phase-5a-counsellor-${suffix}@example.test`,
        normalizedEmail: `phase-5a-counsellor-${suffix}@example.test`,
        firstName: "Phase",
        lastName: "Counsellor",
        status: UserStatus.ACTIVE,
      },
    });

    const definition = await prisma.assessmentDefinition.create({
      data: {
        organizationId: organization.id,
        code: `phase-5a-${suffix}`,
        createdByUserId: candidate.id,
      },
    });

    const version = await prisma.assessmentVersion.create({
      data: {
        assessmentDefinitionId: definition.id,
        versionNumber: 1,
        title: "Phase 5A Integration Assessment",
        edition: "2026",
        form: "A",
        language: "en",
        scoringVersion: "score-v1",
        normVersion: "norm-v1",
        reportVersion: "report-v1",
        createdByUserId: candidate.id,
      },
    });

    const construct = await prisma.assessmentConstruct.create({
      data: {
        assessmentVersionId: version.id,
        code: "construct-1",
        name: "Integration Construct",
        orderIndex: 1,
      },
    });

    await prisma.assessmentVersion.update({
      where: { id: version.id },
      data: {
        status: AssessmentVersionStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedByUserId: candidate.id,
      },
    });

    const assignment = await prisma.assessmentAssignment.create({
      data: {
        organizationId: organization.id,
        assessmentVersionId: version.id,
        userId: candidate.id,
        assignedByUserId: candidate.id,
        maxAttempts: 1,
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        assignmentId: assignment.id,
        attemptNumber: 1,
        status: AssessmentAttemptStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    const scoringRun = await prisma.assessmentScoringRun.create({
      data: {
        attemptId: attempt.id,
        scoringVersion: "score-v1",
        algorithmVersion: "integration-v1",
        inputHash: "6".repeat(64),
      },
    });

    await prisma.assessmentConstructScore.create({
      data: {
        scoringRunId: scoringRun.id,
        assessmentConstructId: construct.id,
        rawScore: new Prisma.Decimal("12"),
        answeredItemCount: 3,
        contributionCount: 3,
      },
    });

    const normSet = await prisma.assessmentNormSet.create({
      data: {
        assessmentVersionId: version.id,
        normVersion: "norm-v1",
        name: "Integration Norm Set",
      },
    });

    const normGroup = await prisma.assessmentNormGroup.create({
      data: {
        normSetId: normSet.id,
        code: "integration-group",
        name: "Integration Group",
      },
    });

    const normTable = await prisma.assessmentConstructNormTable.create({
      data: {
        normGroupId: normGroup.id,
        assessmentConstructId: construct.id,
      },
    });

    const lookupRow = await prisma.assessmentNormLookupRow.create({
      data: {
        constructNormTableId: normTable.id,
        rawScoreMin: new Prisma.Decimal("10"),
        rawScoreMax: new Prisma.Decimal("15"),
        standardizedScore: new Prisma.Decimal("55"),
        percentile: new Prisma.Decimal("72.5"),
      },
    });

    await prisma.assessmentNormSet.update({
      where: { id: normSet.id },
      data: {
        status: AssessmentNormSetStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    const normApplication = await prisma.assessmentNormApplication.create({
      data: {
        scoringRunId: scoringRun.id,
        assessmentConstructId: construct.id,
        normSetId: normSet.id,
        normGroupId: normGroup.id,
        constructNormTableId: normTable.id,
        normLookupRowId: lookupRow.id,
        rawScore: new Prisma.Decimal("12"),
        standardizedScore: new Prisma.Decimal("55"),
        percentile: new Prisma.Decimal("72.5"),
      },
    });

    const interpretationSet = await prisma.assessmentInterpretationSet.create({
      data: {
        assessmentVersionId: version.id,
        version: "interpret-v1",
        name: "Integration Interpretation Set",
      },
    });

    const interpretationRule = await prisma.assessmentInterpretationRule.create({
      data: {
        interpretationSetId: interpretationSet.id,
        assessmentConstructId: construct.id,
        code: "integration-rule",
        metric: AssessmentInterpretationMetric.PERCENTILE,
        lowerBound: new Prisma.Decimal("70"),
        upperBound: new Prisma.Decimal("80"),
        priority: 10,
        outputData: {
          band: "integration-band",
        },
      },
    });

    await prisma.assessmentInterpretationSet.update({
      where: { id: interpretationSet.id },
      data: {
        status: AssessmentInterpretationSetStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    await prisma.assessmentInterpretationApplication.create({
      data: {
        normApplicationId: normApplication.id,
        interpretationRuleId: interpretationRule.id,
        metricValue: new Prisma.Decimal("72.5"),
        outputData: {
          band: "integration-band",
        },
      },
    });

    const reportSnapshot = await prisma.assessmentReportDataSnapshot.create({
      data: {
        scoringRunId: scoringRun.id,
        assessmentVersionId: version.id,
        interpretationSetId: interpretationSet.id,
        reportVersion: "report-v1",
        inputHash: "7".repeat(64),
        payload: {
          schemaVersion: "integration-v1",
        },
      },
    });

    await expect(
      prisma.assessmentReportRelease.create({
        data: {
          attemptId: attempt.id,
          organizationId: otherOrganization.id,
          reportDataSnapshotId: reportSnapshot.id,
        },
      }),
    ).rejects.toThrow(/Report release organization must match the attempt tenant/);

    const release = await prisma.assessmentReportRelease.create({
      data: {
        attemptId: attempt.id,
        organizationId: organization.id,
        reportDataSnapshotId: reportSnapshot.id,
      },
    });

    expect(release.status).toBe(AssessmentReportReleaseStatus.PENDING_REVIEW);
    expect(release.reviewedByUserId).toBeNull();

    await expect(
      prisma.assessmentReportRelease.update({
        where: { id: release.id },
        data: {
          status: AssessmentReportReleaseStatus.WITHDRAWN,
        },
      }),
    ).rejects.toThrow(
      /Report release status may only move PENDING_REVIEW -> RELEASED -> WITHDRAWN/,
    );

    await expect(
      prisma.assessmentReportRelease.update({
        where: { id: release.id },
        data: {
          attemptId: randomUUID(),
        },
      }),
    ).rejects.toThrow(/Report release identity fields are immutable/);

    await expect(
      prisma.assessmentReportRelease.update({
        where: { id: release.id },
        data: {
          status: AssessmentReportReleaseStatus.RELEASED,
        },
      }),
    ).rejects.toThrow(/assessment_report_releases_lifecycle_check/);

    const releasedAt = new Date();

    const released = await prisma.assessmentReportRelease.update({
      where: { id: release.id },
      data: {
        status: AssessmentReportReleaseStatus.RELEASED,
        reviewedByUserId: counsellor.id,
        reviewedAt: releasedAt,
        releasedAt,
      },
    });

    expect(released.status).toBe(AssessmentReportReleaseStatus.RELEASED);

    await expect(
      prisma.assessmentReportRelease.update({
        where: { id: release.id },
        data: {
          status: AssessmentReportReleaseStatus.PENDING_REVIEW,
        },
      }),
    ).rejects.toThrow(
      /Report release status may only move PENDING_REVIEW -> RELEASED -> WITHDRAWN/,
    );

    const withdrawn = await prisma.assessmentReportRelease.update({
      where: { id: release.id },
      data: {
        status: AssessmentReportReleaseStatus.WITHDRAWN,
        withdrawnAt: new Date(),
        withdrawnReason: "Integration test withdrawal",
      },
    });

    expect(withdrawn.status).toBe(AssessmentReportReleaseStatus.WITHDRAWN);

    await expect(
      prisma.assessmentCounsellorNote.create({
        data: {
          attemptId: attempt.id,
          organizationId: otherOrganization.id,
          authorUserId: counsellor.id,
          body: "Mismatched organization note",
        },
      }),
    ).rejects.toThrow(/Counsellor note organization must match the attempt tenant/);

    const note = await prisma.assessmentCounsellorNote.create({
      data: {
        attemptId: attempt.id,
        organizationId: organization.id,
        authorUserId: counsellor.id,
        body: "Candidate shows strong analytical aptitude.",
      },
    });

    const updatedNote = await prisma.assessmentCounsellorNote.update({
      where: { id: note.id },
      data: {
        body: "Candidate shows strong analytical aptitude; recommend follow-up.",
      },
    });

    expect(updatedNote.body).toContain("recommend follow-up");

    await expect(
      prisma.assessmentCounsellorNote.update({
        where: { id: note.id },
        data: {
          authorUserId: candidate.id,
        },
      }),
    ).rejects.toThrow(/Counsellor note identity fields are immutable/);
  });

  it("enforces consent document lifecycle and acceptance-record guards (Phase 5B)", async () => {
    const suffix = randomUUID();

    const candidate = await prisma.user.create({
      data: {
        email: `phase-5b-candidate-${suffix}@example.test`,
        normalizedEmail: `phase-5b-candidate-${suffix}@example.test`,
        firstName: "Phase",
        lastName: "Candidate",
        status: UserStatus.ACTIVE,
      },
    });

    await expect(
      prisma.user.update({
        where: { id: candidate.id },
        data: { dateOfBirth: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      }),
    ).rejects.toThrow(/users_date_of_birth_not_future_check/);

    // The "one published per type" index is a global singleton, not scoped to this
    // test's suffix — retire any document a previous run left published so this run
    // starts from a clean slate.
    await prisma.consentDocument.updateMany({
      where: {
        type: ConsentDocumentType.PRIVACY_NOTICE,
        status: ConsentDocumentStatus.PUBLISHED,
      },
      data: {
        status: ConsentDocumentStatus.RETIRED,
        retiredAt: new Date(),
      },
    });

    const document = await prisma.consentDocument.create({
      data: {
        type: ConsentDocumentType.PRIVACY_NOTICE,
        version: `v1-${suffix}`,
        title: "Privacy Notice",
        bodyText: "Placeholder privacy notice text pending legal review.",
      },
    });

    await expect(
      prisma.userConsentRecord.create({
        data: {
          userId: candidate.id,
          consentDocumentId: document.id,
          acceptedByRole: ConsentAcceptorRole.SELF,
        },
      }),
    ).rejects.toThrow(/Only a published consent document may be accepted/);

    await prisma.consentDocument.update({
      where: { id: document.id },
      data: {
        status: ConsentDocumentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    await expect(
      prisma.consentDocument.create({
        data: {
          type: ConsentDocumentType.PRIVACY_NOTICE,
          version: `v2-${suffix}`,
          title: "Privacy Notice v2",
          bodyText: "A second version.",
          status: ConsentDocumentStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/Unique constraint failed/);

    await expect(
      prisma.consentDocument.update({
        where: { id: document.id },
        data: { title: "Mutated title" },
      }),
    ).rejects.toThrow(/Published consent documents may only transition to retired/);

    await expect(
      prisma.userConsentRecord.create({
        data: {
          userId: candidate.id,
          consentDocumentId: document.id,
          acceptedByRole: ConsentAcceptorRole.GUARDIAN,
        },
      }),
    ).rejects.toThrow(/user_consent_records_guardian_fields_check/);

    const record = await prisma.userConsentRecord.create({
      data: {
        userId: candidate.id,
        consentDocumentId: document.id,
        acceptedByRole: ConsentAcceptorRole.GUARDIAN,
        guardianName: "Priya Shah",
        guardianEmail: `guardian-${suffix}@example.test`,
        guardianRelationship: "Mother",
      },
    });

    expect(record.acceptedByRole).toBe(ConsentAcceptorRole.GUARDIAN);

    await expect(
      prisma.userConsentRecord.update({
        where: { id: record.id },
        data: { guardianName: "Someone else" },
      }),
    ).rejects.toThrow(/Consent acceptance records are immutable/);

    await expect(
      prisma.consentDocument.update({
        where: { id: document.id },
        data: {
          status: ConsentDocumentStatus.RETIRED,
          retiredAt: new Date(),
          title: "Mutated on retire",
        },
      }),
    ).rejects.toThrow(/Published consent document content is immutable/);

    await prisma.consentDocument.update({
      where: { id: document.id },
      data: {
        status: ConsentDocumentStatus.RETIRED,
        retiredAt: new Date(),
      },
    });

    await expect(
      prisma.consentDocument.update({
        where: { id: document.id },
        data: { status: ConsentDocumentStatus.PUBLISHED },
      }),
    ).rejects.toThrow(/Retired consent documents are immutable/);
  });
});
