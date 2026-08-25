CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'BLOCKED_CONFIGURATION', 'CANCELLED');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BLOCKED_CONFIGURATION', 'CANCELLED');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

ALTER TABLE "invitation_tokens" ADD COLUMN "revoked_at" TIMESTAMP(3);

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_type" VARCHAR(120) NOT NULL,
  "aggregate_type" VARCHAR(120) NOT NULL,
  "aggregate_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "last_error_code" VARCHAR(120),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "invitation_token_id" UUID,
  "channel" "NotificationChannel" NOT NULL,
  "template_code" VARCHAR(120) NOT NULL,
  "destination" VARCHAR(320) NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "provider" VARCHAR(120),
  "provider_message_id" VARCHAR(200),
  "failure_code" VARCHAR(120),
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_events_idempotency_key_key" ON "outbox_events"("idempotency_key");
CREATE INDEX "outbox_events_status_available_at_id_idx" ON "outbox_events"("status", "available_at", "id");
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_created_at_idx" ON "outbox_events"("aggregate_type", "aggregate_id", "created_at");
CREATE UNIQUE INDEX "notification_deliveries_invitation_token_id_key" ON "notification_deliveries"("invitation_token_id");
CREATE INDEX "notification_deliveries_user_id_requested_at_id_idx" ON "notification_deliveries"("user_id", "requested_at", "id");
CREATE INDEX "notification_deliveries_status_requested_at_id_idx" ON "notification_deliveries"("status", "requested_at", "id");
CREATE INDEX "invitation_tokens_user_id_revoked_at_used_at_idx" ON "invitation_tokens"("user_id", "revoked_at", "used_at");

ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_invitation_token_id_fkey" FOREIGN KEY ("invitation_token_id") REFERENCES "invitation_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
