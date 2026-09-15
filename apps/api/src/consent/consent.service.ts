import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import {
  ConsentAcceptorRole,
  ConsentDocumentStatus,
  ConsentDocumentType,
  type PrismaClient,
} from "@prisma/client";
import { DATABASE_PRISMA } from "../database/database.tokens";

/** D-013: candidates under 18 require guardian consent and their own assent. */
const MINOR_AGE_THRESHOLD_YEARS = 18;

interface RequiredAcceptance {
  documentType: ConsentDocumentType;
  role: ConsentAcceptorRole;
}

/**
 * Per D-013: an adult accepts PRIVACY_NOTICE and ASSESSMENT_DATA_PROCESSING
 * themselves. A minor's guardian accepts both on the candidate's behalf, and the
 * candidate additionally gives their own assent to ASSESSMENT_DATA_PROCESSING (the
 * assessment-specific processing, not the general privacy notice). This split is an
 * engineering interpretation of D-013's text pending explicit legal sign-off — see
 * docs/OPEN_QUESTIONS.md Legal Q1.
 */
function requiredAcceptancesFor(isMinorCandidate: boolean): RequiredAcceptance[] {
  if (!isMinorCandidate) {
    return [
      { documentType: ConsentDocumentType.PRIVACY_NOTICE, role: ConsentAcceptorRole.SELF },
      {
        documentType: ConsentDocumentType.ASSESSMENT_DATA_PROCESSING,
        role: ConsentAcceptorRole.SELF,
      },
    ];
  }

  return [
    { documentType: ConsentDocumentType.PRIVACY_NOTICE, role: ConsentAcceptorRole.GUARDIAN },
    {
      documentType: ConsentDocumentType.ASSESSMENT_DATA_PROCESSING,
      role: ConsentAcceptorRole.GUARDIAN,
    },
    {
      documentType: ConsentDocumentType.ASSESSMENT_DATA_PROCESSING,
      role: ConsentAcceptorRole.STUDENT_ASSENT,
    },
  ];
}

export function isMinor(dateOfBirth: Date, now: Date = new Date()): boolean {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const hasNotHadBirthdayYet =
    now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      now.getUTCDate() < dateOfBirth.getUTCDate());

  if (hasNotHadBirthdayYet) {
    age -= 1;
  }

  return age < MINOR_AGE_THRESHOLD_YEARS;
}

export interface ConsentRequirementItem {
  documentType: ConsentDocumentType;
  role: ConsentAcceptorRole;
  documentId: string | null;
  documentVersion: string | null;
  documentTitle: string | null;
  documentBodyText: string | null;
  satisfied: boolean;
}

export interface ConsentRequirementsView {
  dateOfBirthRequired: boolean;
  dateOfBirth: Date | null;
  isMinor: boolean | null;
  requirements: ConsentRequirementItem[];
  complete: boolean;
}

@Injectable()
export class ConsentService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async getRequirements(userId: string): Promise<ConsentRequirementsView> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { dateOfBirth: true },
    });

    if (!user.dateOfBirth) {
      return {
        dateOfBirthRequired: true,
        dateOfBirth: null,
        isMinor: null,
        requirements: [],
        complete: false,
      };
    }

    const minor = isMinor(user.dateOfBirth);
    const required = requiredAcceptancesFor(minor);

    const [documents, acceptedRecords] = await Promise.all([
      this.prisma.consentDocument.findMany({
        where: {
          type: { in: required.map((requirement) => requirement.documentType) },
          status: ConsentDocumentStatus.PUBLISHED,
        },
        select: { id: true, type: true, version: true, title: true, bodyText: true },
      }),
      this.prisma.userConsentRecord.findMany({
        where: { userId },
        select: { consentDocumentId: true, acceptedByRole: true },
      }),
    ]);

    const publishedByType = new Map(documents.map((document) => [document.type, document]));
    const acceptedKeys = new Set(
      acceptedRecords.map((record) => `${record.consentDocumentId}:${record.acceptedByRole}`),
    );

    const requirements: ConsentRequirementItem[] = required.map((requirement) => {
      const document = publishedByType.get(requirement.documentType) ?? null;
      const satisfied = document ? acceptedKeys.has(`${document.id}:${requirement.role}`) : false;

      return {
        documentType: requirement.documentType,
        role: requirement.role,
        documentId: document?.id ?? null,
        documentVersion: document?.version ?? null,
        documentTitle: document?.title ?? null,
        documentBodyText: document?.bodyText ?? null,
        satisfied,
      };
    });

    return {
      dateOfBirthRequired: false,
      dateOfBirth: user.dateOfBirth,
      isMinor: minor,
      requirements,
      complete: requirements.every((requirement) => requirement.satisfied),
    };
  }

  public async isComplete(userId: string): Promise<boolean> {
    const requirements = await this.getRequirements(userId);

    return requirements.complete;
  }

  public async recordDateOfBirth(userId: string, dateOfBirth: Date): Promise<void> {
    if (Number.isNaN(dateOfBirth.getTime())) {
      throw new BadRequestException({
        code: "CONSENT_DATE_OF_BIRTH_INVALID",
        message: "A valid date of birth is required.",
      });
    }

    if (dateOfBirth.getTime() > Date.now()) {
      throw new BadRequestException({
        code: "CONSENT_DATE_OF_BIRTH_IN_FUTURE",
        message: "Date of birth cannot be in the future.",
      });
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { dateOfBirth: true },
    });

    if (user.dateOfBirth) {
      throw new ConflictException({
        code: "CONSENT_DATE_OF_BIRTH_ALREADY_SET",
        message: "Date of birth has already been recorded for this account.",
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { dateOfBirth },
    });
  }

  public async acceptConsentDocument(
    userId: string,
    input: {
      consentDocumentId: string;
      acceptedByRole: ConsentAcceptorRole;
      guardianName?: string | undefined;
      guardianEmail?: string | undefined;
      guardianRelationship?: string | undefined;
    },
    ipAddress?: string,
  ): Promise<void> {
    const requirements = await this.getRequirements(userId);

    const matched = requirements.requirements.find(
      (requirement) =>
        requirement.documentId === input.consentDocumentId &&
        requirement.role === input.acceptedByRole,
    );

    if (!matched) {
      throw new BadRequestException({
        code: "CONSENT_ACCEPTANCE_NOT_REQUIRED",
        message: "This consent document and role is not currently required for your account.",
      });
    }

    let guardianFields: {
      guardianName: string;
      guardianEmail: string;
      guardianRelationship: string;
    } | null = null;

    if (input.acceptedByRole === ConsentAcceptorRole.GUARDIAN) {
      if (!input.guardianName || !input.guardianEmail || !input.guardianRelationship) {
        throw new BadRequestException({
          code: "CONSENT_GUARDIAN_DETAILS_REQUIRED",
          message: "Guardian name, email, and relationship are required for guardian consent.",
        });
      }

      guardianFields = {
        guardianName: input.guardianName,
        guardianEmail: input.guardianEmail,
        guardianRelationship: input.guardianRelationship,
      };
    }

    try {
      await this.prisma.userConsentRecord.create({
        data: {
          userId,
          consentDocumentId: input.consentDocumentId,
          acceptedByRole: input.acceptedByRole,
          guardianName: guardianFields?.guardianName ?? null,
          guardianEmail: guardianFields?.guardianEmail ?? null,
          guardianRelationship: guardianFields?.guardianRelationship ?? null,
          ipAddress: ipAddress ?? null,
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        // Already accepted this exact document/role combination; treat as success.
        return;
      }

      throw error;
    }
  }
}
