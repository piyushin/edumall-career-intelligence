import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260911000000_r20_report_platform_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("R20 report platform additive schema", () => {
  it("keeps historical users valid while adding indexed non-unique canonical phone", () => {
    const user = Prisma.dmmf.datamodel.models.find((model) => model.name === "User");
    expect(user?.fields.find((field) => field.name === "phoneE164")?.isRequired).toBe(false);
    expect(migration).toContain('ADD COLUMN "phone_e164" VARCHAR(16)');
    expect(migration).toContain('CREATE INDEX "users_phone_e164_idx"');
    expect(migration).not.toContain('UNIQUE INDEX "users_phone_e164');
  });

  it("enforces exactly one wallet/grant owner and non-negative balances", () => {
    expect(migration).toContain('CONSTRAINT "commerce_credit_wallets_owner_check"');
    expect(migration).toContain('CONSTRAINT "commerce_report_access_grants_principal_check"');
    expect(migration).toContain('CHECK ("current_balance" >= 0)');
  });

  it("protects single active grants/configurations and duplicate consumption", () => {
    expect(migration).toContain('"assessment_report_configurations_active_version_key"');
    expect(migration).toContain('"commerce_report_access_grants_active_user_key"');
    expect(migration).toContain('"commerce_credit_ledger_entries_consumption_key"');
    expect(migration).toContain('"report_access_grant_id" UUID');
  });

  it("makes the credit ledger append-only", () => {
    expect(migration).toContain("prevent_commerce_credit_ledger_mutation");
    expect(migration).toContain('BEFORE UPDATE ON "commerce_credit_ledger_entries"');
    expect(migration).toContain('BEFORE DELETE ON "commerce_credit_ledger_entries"');
  });

  it("leaves legacy assessment report release schema intact", () => {
    expect(
      Prisma.dmmf.datamodel.models.some((model) => model.name === "AssessmentReportRelease"),
    ).toBe(true);
    expect(migration).not.toMatch(/DROP|ALTER TABLE "assessment_report_releases"/i);
  });
});
