import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260825120000_release19_1a_security_hardening/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("R19.1A additive security migration", () => {
  it("adds privileged session attribution without replacing existing session identity", () => {
    expect(migration).toContain('ADD COLUMN "membership_id" UUID');
    expect(migration).toContain('ADD COLUMN "admin_profile_id" UUID');
    expect(migration).toContain('ADD COLUMN "privilege_type"');
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  });

  it("preserves history while extending audit evidence and cursor indexes", () => {
    expect(migration).toContain('ADD COLUMN "subject_user_id" UUID');
    expect(migration).toContain('ADD COLUMN "correlation_id" VARCHAR(120)');
    expect(migration).toContain('ADD COLUMN "outcome"');
    expect(migration).toContain('"audit_logs_created_at_id_idx"');
  });
});
