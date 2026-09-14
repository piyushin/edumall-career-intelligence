import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConsentAcceptorRole, ConsentDocumentType, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentService, isMinor } from "./consent.service";

const userId = "11111111-1111-4111-8111-111111111111";
const privacyDocumentId = "22222222-2222-4222-8222-222222222222";
const assessmentDocumentId = "33333333-3333-4333-8333-333333333333";

function createPrisma() {
  return {
    user: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    consentDocument: {
      findMany: vi.fn(),
    },
    userConsentRecord: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  };
}

describe("isMinor", () => {
  it("is not a minor the day of an 18th birthday", () => {
    const dob = new Date("2008-06-15T00:00:00Z");
    const now = new Date("2026-06-15T12:00:00Z");

    expect(isMinor(dob, now)).toBe(false);
  });

  it("is a minor the day before an 18th birthday", () => {
    const dob = new Date("2008-06-15T00:00:00Z");
    const now = new Date("2026-06-14T12:00:00Z");

    expect(isMinor(dob, now)).toBe(true);
  });

  it("is a minor well under 18", () => {
    const dob = new Date("2012-01-01T00:00:00Z");
    const now = new Date("2026-01-01T00:00:00Z");

    expect(isMinor(dob, now)).toBe(true);
  });
});

describe("ConsentService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: ConsentService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new ConsentService(prisma as unknown as PrismaClient);
  });

  describe("getRequirements", () => {
    it("requires date of birth first when unknown", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ dateOfBirth: null });

      const result = await service.getRequirements(userId);

      expect(result).toEqual({
        dateOfBirthRequired: true,
        dateOfBirth: null,
        isMinor: null,
        requirements: [],
        complete: false,
      });
    });

    it("requires two SELF acceptances for an adult", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        dateOfBirth: new Date("2000-01-01T00:00:00Z"),
      });
      prisma.consentDocument.findMany.mockResolvedValue([
        {
          id: privacyDocumentId,
          type: ConsentDocumentType.PRIVACY_NOTICE,
          version: "v1",
          title: "Privacy Notice",
          bodyText: "...",
        },
        {
          id: assessmentDocumentId,
          type: ConsentDocumentType.ASSESSMENT_DATA_PROCESSING,
          version: "v1",
          title: "Assessment Data Processing",
          bodyText: "...",
        },
      ]);
      prisma.userConsentRecord.findMany.mockResolvedValue([]);

      const result = await service.getRequirements(userId);

      expect(result.isMinor).toBe(false);
      expect(result.requirements).toHaveLength(2);
      expect(result.requirements.every((requirement) => requirement.role === "SELF")).toBe(true);
      expect(result.complete).toBe(false);
    });

    it("requires guardian consent and student assent for a minor", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        dateOfBirth: new Date("2015-01-01T00:00:00Z"),
      });
      prisma.consentDocument.findMany.mockResolvedValue([]);
      prisma.userConsentRecord.findMany.mockResolvedValue([]);

      const result = await service.getRequirements(userId);

      expect(result.isMinor).toBe(true);
      expect(result.requirements.map((requirement) => requirement.role).sort()).toEqual(
        ["GUARDIAN", "GUARDIAN", "STUDENT_ASSENT"].sort(),
      );
      expect(result.complete).toBe(false);
    });

    it("is complete once every requirement has a matching published+accepted document", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        dateOfBirth: new Date("2000-01-01T00:00:00Z"),
      });
      prisma.consentDocument.findMany.mockResolvedValue([
        {
          id: privacyDocumentId,
          type: ConsentDocumentType.PRIVACY_NOTICE,
          version: "v1",
          title: "Privacy Notice",
          bodyText: "...",
        },
        {
          id: assessmentDocumentId,
          type: ConsentDocumentType.ASSESSMENT_DATA_PROCESSING,
          version: "v1",
          title: "Assessment Data Processing",
          bodyText: "...",
        },
      ]);
      prisma.userConsentRecord.findMany.mockResolvedValue([
        { consentDocumentId: privacyDocumentId, acceptedByRole: ConsentAcceptorRole.SELF },
        { consentDocumentId: assessmentDocumentId, acceptedByRole: ConsentAcceptorRole.SELF },
      ]);

      const result = await service.getRequirements(userId);

      expect(result.complete).toBe(true);
    });
  });

  describe("recordDateOfBirth", () => {
    it("rejects a future date", async () => {
      await expect(
        service.recordDateOfBirth(userId, new Date(Date.now() + 24 * 60 * 60 * 1000)),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects when already set", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ dateOfBirth: new Date("2000-01-01") });

      await expect(
        service.recordDateOfBirth(userId, new Date("2001-01-01")),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("records a valid date of birth once", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ dateOfBirth: null });

      const dob = new Date("2000-01-01T00:00:00Z");

      await service.recordDateOfBirth(userId, dob);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { dateOfBirth: dob },
      });
    });
  });

  describe("acceptConsentDocument", () => {
    function mockAdultWithPublishedDocuments() {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        dateOfBirth: new Date("2000-01-01T00:00:00Z"),
      });
      prisma.consentDocument.findMany.mockResolvedValue([
        {
          id: privacyDocumentId,
          type: ConsentDocumentType.PRIVACY_NOTICE,
          version: "v1",
          title: "Privacy Notice",
          bodyText: "...",
        },
        {
          id: assessmentDocumentId,
          type: ConsentDocumentType.ASSESSMENT_DATA_PROCESSING,
          version: "v1",
          title: "Assessment Data Processing",
          bodyText: "...",
        },
      ]);
      prisma.userConsentRecord.findMany.mockResolvedValue([]);
    }

    it("rejects a document/role combination that is not required", async () => {
      mockAdultWithPublishedDocuments();

      await expect(
        service.acceptConsentDocument(userId, {
          consentDocumentId: privacyDocumentId,
          acceptedByRole: ConsentAcceptorRole.GUARDIAN,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.userConsentRecord.create).not.toHaveBeenCalled();
    });

    it("requires guardian details for a GUARDIAN acceptance", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        dateOfBirth: new Date("2015-01-01T00:00:00Z"),
      });
      prisma.consentDocument.findMany.mockResolvedValue([
        {
          id: privacyDocumentId,
          type: ConsentDocumentType.PRIVACY_NOTICE,
          version: "v1",
          title: "Privacy Notice",
          bodyText: "...",
        },
      ]);
      prisma.userConsentRecord.findMany.mockResolvedValue([]);

      await expect(
        service.acceptConsentDocument(userId, {
          consentDocumentId: privacyDocumentId,
          acceptedByRole: ConsentAcceptorRole.GUARDIAN,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("records a SELF acceptance for an adult", async () => {
      mockAdultWithPublishedDocuments();
      prisma.userConsentRecord.create.mockResolvedValue({});

      await service.acceptConsentDocument(
        userId,
        {
          consentDocumentId: privacyDocumentId,
          acceptedByRole: ConsentAcceptorRole.SELF,
        },
        "127.0.0.1",
      );

      expect(prisma.userConsentRecord.create).toHaveBeenCalledWith({
        data: {
          userId,
          consentDocumentId: privacyDocumentId,
          acceptedByRole: ConsentAcceptorRole.SELF,
          guardianName: null,
          guardianEmail: null,
          guardianRelationship: null,
          ipAddress: "127.0.0.1",
        },
      });
    });

    it("treats a duplicate acceptance as a no-op success", async () => {
      mockAdultWithPublishedDocuments();
      prisma.userConsentRecord.create.mockRejectedValue({ code: "P2002" });

      await expect(
        service.acceptConsentDocument(userId, {
          consentDocumentId: privacyDocumentId,
          acceptedByRole: ConsentAcceptorRole.SELF,
        }),
      ).resolves.toBeUndefined();
    });

    it("completes a minor's requirements once the guardian and the candidate have both accepted the shared document", async () => {
      // Regression test for a real bug: GUARDIAN and STUDENT_ASSENT acceptances
      // land against the very same ASSESSMENT_DATA_PROCESSING document. If the
      // unique constraint the create() below simulates were keyed on
      // (userId, consentDocumentId) alone rather than including the role, the
      // second create would collide with the first and never be persisted,
      // leaving a minor's consent permanently incomplete. Prisma-level
      // enforcement of this is covered by the real-Postgres integration test;
      // this documents the service-level acceptance flow it depends on.
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        dateOfBirth: new Date("2015-01-01T00:00:00Z"),
      });
      prisma.consentDocument.findMany.mockResolvedValue([
        {
          id: privacyDocumentId,
          type: ConsentDocumentType.PRIVACY_NOTICE,
          version: "v1",
          title: "Privacy Notice",
          bodyText: "...",
        },
        {
          id: assessmentDocumentId,
          type: ConsentDocumentType.ASSESSMENT_DATA_PROCESSING,
          version: "v1",
          title: "Assessment Data Processing",
          bodyText: "...",
        },
      ]);

      const created: Array<{ consentDocumentId: string; acceptedByRole: ConsentAcceptorRole }> = [];
      prisma.userConsentRecord.findMany.mockImplementation(() => Promise.resolve(created));
      prisma.userConsentRecord.create.mockImplementation(
        ({
          data,
        }: {
          data: { consentDocumentId: string; acceptedByRole: ConsentAcceptorRole };
        }) => {
          created.push({
            consentDocumentId: data.consentDocumentId,
            acceptedByRole: data.acceptedByRole,
          });
          return Promise.resolve({});
        },
      );

      await service.acceptConsentDocument(userId, {
        consentDocumentId: privacyDocumentId,
        acceptedByRole: ConsentAcceptorRole.GUARDIAN,
        guardianName: "Priya Shah",
        guardianEmail: "guardian@example.test",
        guardianRelationship: "Mother",
      });

      await service.acceptConsentDocument(userId, {
        consentDocumentId: assessmentDocumentId,
        acceptedByRole: ConsentAcceptorRole.GUARDIAN,
        guardianName: "Priya Shah",
        guardianEmail: "guardian@example.test",
        guardianRelationship: "Mother",
      });

      await service.acceptConsentDocument(userId, {
        consentDocumentId: assessmentDocumentId,
        acceptedByRole: ConsentAcceptorRole.STUDENT_ASSENT,
      });

      expect(created).toContainEqual({
        consentDocumentId: assessmentDocumentId,
        acceptedByRole: ConsentAcceptorRole.GUARDIAN,
      });
      expect(created).toContainEqual({
        consentDocumentId: assessmentDocumentId,
        acceptedByRole: ConsentAcceptorRole.STUDENT_ASSENT,
      });

      const result = await service.getRequirements(userId);

      expect(result.complete).toBe(true);
    });
  });
});
