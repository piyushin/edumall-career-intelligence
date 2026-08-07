-- Session scope is explicit so a detached tenant session can never become a platform session.
CREATE TYPE "SessionScope" AS ENUM ('ORGANIZATION', 'PLATFORM');
ALTER TABLE "sessions" ADD COLUMN "scope" "SessionScope" NOT NULL DEFAULT 'ORGANIZATION';
UPDATE "sessions" SET "scope" = 'PLATFORM' WHERE "organization_id" IS NULL;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_scope_organization_check" CHECK (
    ("scope" = 'ORGANIZATION' AND "organization_id" IS NOT NULL)
    OR ("scope" = 'PLATFORM' AND "organization_id" IS NULL)
);
CREATE INDEX "sessions_scope_expires_at_idx" ON "sessions"("scope", "expires_at");
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_organization_id_fkey";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 1B allows invited users to exist before password credentials are established.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- Invitation tokens are opaque to the database; only their SHA-256 hashes are stored.
CREATE TABLE "invitation_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitation_tokens_token_hash_key" ON "invitation_tokens"("token_hash");
CREATE INDEX "invitation_tokens_expires_at_idx" ON "invitation_tokens"("expires_at");
CREATE INDEX "invitation_tokens_user_id_expires_at_idx" ON "invitation_tokens"("user_id", "expires_at");

ALTER TABLE "invitation_tokens" ADD CONSTRAINT "invitation_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
