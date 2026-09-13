import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260913020000_r20_c2c_credit_operations/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

const ledger = Prisma.dmmf.datamodel.models.find(
  (model) => model.name === "CommerceCreditLedgerEntry",
)!;

describe("R20-C2c strict credit accounting schema", () => {
  it("records the consumption principal and enforces one charge per wallet, attempt and principal", () => {
    expect(ledger.fields.some((field) => field.name === "principalKey")).toBe(true);
    expect(migration).toContain('"commerce_credit_ledger_entries_consumption_principal_key"');
    expect(migration).toContain('("wallet_id", "attempt_id", "principal_key")');
    expect(migration).toContain(`WHERE "event_type" = 'CONSUMPTION' AND "attempt_id" IS NOT NULL`);
    expect(migration).toContain(
      `CHECK ("event_type" <> 'CONSUMPTION' OR "principal_key" IS NOT NULL)`,
    );
    // Historical consumptions are backfilled before the stricter rule applies.
    expect(migration).toMatch(/UPDATE "commerce_credit_ledger_entries" l\s+SET "principal_key"/);
  });

  it("links sponsored candidate entitlements to exactly one ledger entry", () => {
    const entitlement = ledger.fields.find((field) => field.name === "entitlement");
    expect(entitlement?.relationName).toBe("LedgerSponsoredEntitlement");
    expect(ledger.fields.find((field) => field.name === "entitlementId")?.isUnique).toBe(true);
    expect(migration).toContain('"commerce_credit_ledger_entries_entitlement_id_key"');
    expect(migration).toContain(
      'REFERENCES "commerce_entitlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    );
  });

  it("makes transfers atomic pairs with a shared, unique transfer id per leg", () => {
    expect(ledger.fields.some((field) => field.name === "transferId")).toBe(true);
    expect(migration).toContain('"commerce_credit_ledger_entries_transfer_leg_key"');
    expect(migration).toContain('("transfer_id", "event_type")');
    expect(migration).toContain(
      `CHECK (("event_type" IN ('TRANSFER_IN', 'TRANSFER_OUT')) = ("transfer_id" IS NOT NULL))`,
    );
  });

  it("stays additive and keeps the ledger append-only", () => {
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|DROP TRIGGER|DROP FUNCTION/i);
    expect(migration).not.toContain("prevent_commerce_credit_ledger_mutation");
    // The only replaced object is the narrower consumption index.
    expect(migration.match(/DROP INDEX/g)).toHaveLength(1);
    expect(migration).toContain(
      'DROP INDEX IF EXISTS "commerce_credit_ledger_entries_consumption_key"',
    );
  });
});
