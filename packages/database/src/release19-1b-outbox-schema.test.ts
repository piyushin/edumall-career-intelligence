import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260825170000_release19_1b_admin_directories_outbox/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("R19.1B invitation outbox migration", () => {
  it("is additive and preserves invitation history", () => {
    expect(migration).toContain('ADD COLUMN "revoked_at"');
    expect(migration).toContain('CREATE TABLE "outbox_events"');
    expect(migration).toContain('CREATE TABLE "notification_deliveries"');
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  });

  it("enforces outbox idempotency and bounded worker lookup", () => {
    expect(migration).toContain('"outbox_events_idempotency_key_key"');
    expect(migration).toContain('"outbox_events_status_available_at_id_idx"');
  });
});
