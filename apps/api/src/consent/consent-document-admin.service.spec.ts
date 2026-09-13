import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  ConsentDocumentStatus,
  ConsentDocumentType,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentDocumentAdminService } from "./consent-document-admin.service";

const documentId = "11111111-1111-4111-8111-111111111111";

function createPrisma() {
  return {
    consentDocument: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("ConsentDocumentAdminService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: ConsentDocumentAdminService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new ConsentDocumentAdminService(prisma as unknown as PrismaClient);
  });

  it("creates a draft document", async () => {
    prisma.consentDocument.create.mockResolvedValue({});

    await service.create({
      type: ConsentDocumentType.PRIVACY_NOTICE,
      version: "v1",
      title: "Privacy Notice",
      bodyText: "Placeholder text.",
    });

    expect(prisma.consentDocument.create).toHaveBeenCalledWith({
      data: {
        type: ConsentDocumentType.PRIVACY_NOTICE,
        version: "v1",
        title: "Privacy Notice",
        bodyText: "Placeholder text.",
      },
    });
  });

  describe("publish", () => {
    it("rejects publishing a document that does not exist", async () => {
      prisma.consentDocument.findUnique.mockResolvedValue(null);

      await expect(service.publish(documentId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects publishing a document that is not a draft", async () => {
      prisma.consentDocument.findUnique.mockResolvedValue({
        id: documentId,
        status: ConsentDocumentStatus.PUBLISHED,
      });

      await expect(service.publish(documentId)).rejects.toBeInstanceOf(ConflictException);
    });

    it("publishes a draft document", async () => {
      prisma.consentDocument.findUnique.mockResolvedValue({
        id: documentId,
        status: ConsentDocumentStatus.DRAFT,
      });
      prisma.consentDocument.update.mockResolvedValue({});

      await service.publish(documentId);

      expect(prisma.consentDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: documentId },
          data: expect.objectContaining({ status: ConsentDocumentStatus.PUBLISHED }),
        }),
      );
    });

    it("surfaces a clear error when another document of the type is already published", async () => {
      prisma.consentDocument.findUnique.mockResolvedValue({
        id: documentId,
        status: ConsentDocumentStatus.DRAFT,
      });
      prisma.consentDocument.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

      await expect(service.publish(documentId)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("retire", () => {
    it("rejects retiring a document that is not published", async () => {
      prisma.consentDocument.findUnique.mockResolvedValue({
        id: documentId,
        status: ConsentDocumentStatus.DRAFT,
      });

      await expect(service.retire(documentId)).rejects.toBeInstanceOf(ConflictException);
    });

    it("retires a published document", async () => {
      prisma.consentDocument.findUnique.mockResolvedValue({
        id: documentId,
        status: ConsentDocumentStatus.PUBLISHED,
      });
      prisma.consentDocument.update.mockResolvedValue({});

      await service.retire(documentId);

      expect(prisma.consentDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: documentId },
          data: expect.objectContaining({ status: ConsentDocumentStatus.RETIRED }),
        }),
      );
    });
  });
});
