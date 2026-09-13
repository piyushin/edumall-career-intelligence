import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ConsentDocumentStatus,
  Prisma,
  type ConsentDocumentType,
  type PrismaClient,
} from "@prisma/client";
import { DATABASE_PRISMA } from "../database/database.tokens";

/**
 * Consent document authoring. Central-only (SUPER_ADMIN): legal text is not a
 * per-tenant concern. Publishing/retiring a document does not automatically manage
 * the previous PUBLISHED document of the same type — the DB enforces at most one
 * PUBLISHED document per type, so retiring the old one is a deliberate, separate step.
 */
@Injectable()
export class ConsentDocumentAdminService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public list(type?: ConsentDocumentType) {
    return this.prisma.consentDocument.findMany({
      ...(type ? { where: { type } } : {}),
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });
  }

  public async create(input: {
    type: ConsentDocumentType;
    version: string;
    title: string;
    bodyText: string;
  }) {
    return this.prisma.consentDocument.create({
      data: {
        type: input.type,
        version: input.version,
        title: input.title,
        bodyText: input.bodyText,
      },
    });
  }

  public async publish(id: string) {
    const document = await this.findDraft(id);

    try {
      return await this.prisma.consentDocument.update({
        where: { id: document.id },
        data: {
          status: ConsentDocumentStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "CONSENT_DOCUMENT_TYPE_ALREADY_PUBLISHED",
          message:
            "Another document of this type is already published. Retire it before publishing a new version.",
        });
      }

      throw error;
    }
  }

  public async retire(id: string) {
    const document = await this.prisma.consentDocument.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!document) {
      throw new NotFoundException({
        code: "CONSENT_DOCUMENT_NOT_FOUND",
        message: "Consent document not found.",
      });
    }

    if (document.status !== ConsentDocumentStatus.PUBLISHED) {
      throw new ConflictException({
        code: "CONSENT_DOCUMENT_NOT_PUBLISHED",
        message: "Only a published document may be retired.",
      });
    }

    return this.prisma.consentDocument.update({
      where: { id: document.id },
      data: {
        status: ConsentDocumentStatus.RETIRED,
        retiredAt: new Date(),
      },
    });
  }

  private async findDraft(id: string) {
    const document = await this.prisma.consentDocument.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!document) {
      throw new NotFoundException({
        code: "CONSENT_DOCUMENT_NOT_FOUND",
        message: "Consent document not found.",
      });
    }

    if (document.status !== ConsentDocumentStatus.DRAFT) {
      throw new ConflictException({
        code: "CONSENT_DOCUMENT_NOT_DRAFT",
        message: "Only a draft document may be published.",
      });
    }

    return document;
  }
}
