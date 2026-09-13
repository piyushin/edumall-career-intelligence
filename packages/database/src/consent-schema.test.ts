import { readFileSync } from "node:fs";
import {
  ConsentAcceptorRole,
  ConsentDocumentStatus,
  ConsentDocumentType,
  Prisma,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Phase 5B consent schema", () => {
  it("generates the consent document and acceptance-record models", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

    expect(modelNames).toContain("ConsentDocument");
    expect(modelNames).toContain("UserConsentRecord");

    expect(Object.values(ConsentDocumentType)).toEqual([
      "PRIVACY_NOTICE",
      "ASSESSMENT_DATA_PROCESSING",
    ]);

    expect(Object.values(ConsentDocumentStatus)).toEqual(["DRAFT", "PUBLISHED", "RETIRED"]);

    expect(Object.values(ConsentAcceptorRole)).toEqual(["SELF", "GUARDIAN", "STUDENT_ASSENT"]);
  });

  it("adds date of birth to users and keeps one acceptance per user per document", () => {
    const user = Prisma.dmmf.datamodel.models.find((model) => model.name === "User");
    const record = Prisma.dmmf.datamodel.models.find((model) => model.name === "UserConsentRecord");

    expect(user?.fields.some((field) => field.name === "dateOfBirth")).toBe(true);
    expect(record?.uniqueFields).toContainEqual(["userId", "consentDocumentId"]);
  });

  it("ships lifecycle, one-published-per-type, guardian-field, and immutability guards without seeding legal text", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260913200000_phase_5b_consent/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("consent_documents_lifecycle_check");
    expect(migration).toContain("consent_documents_one_published_per_type");
    expect(migration).toContain("user_consent_records_guardian_fields_check");
    expect(migration).toContain("Only a published consent document may be accepted");
    expect(migration).toContain("Published consent documents may only transition to retired");
    expect(migration).toContain("Consent acceptance records are immutable");
    expect(migration).toContain("users_date_of_birth_not_future_check");
    expect(migration).not.toContain("INSERT INTO");
  });
});
