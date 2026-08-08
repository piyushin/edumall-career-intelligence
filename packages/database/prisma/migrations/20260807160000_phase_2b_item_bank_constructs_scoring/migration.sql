-- Phase 2B: item bank, constructs/subscales, response options, and explicit scoring keys.

CREATE TYPE "AssessmentItemType" AS ENUM (
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'LIKERT',
    'BOOLEAN',
    'NUMERIC',
    'TEXT'
);

CREATE TABLE "assessment_constructs" (
    "id" UUID NOT NULL,
    "assessment_version_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_constructs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_constructs_order_index_check" CHECK ("order_index" >= 0)
);

CREATE TABLE "assessment_items" (
    "id" UUID NOT NULL,
    "assessment_version_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "type" "AssessmentItemType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "help_text" TEXT,
    "order_index" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_items_order_index_check" CHECK ("order_index" >= 0)
);

CREATE TABLE "assessment_item_options" (
    "id" UUID NOT NULL,
    "assessment_item_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_item_options_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_item_options_order_index_check" CHECK ("order_index" >= 0)
);

CREATE TABLE "assessment_item_constructs" (
    "assessment_item_id" UUID NOT NULL,
    "assessment_construct_id" UUID NOT NULL,
    "weight" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "reverse_scored" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "assessment_item_constructs_pkey"
        PRIMARY KEY ("assessment_item_id", "assessment_construct_id")
);

CREATE TABLE "assessment_option_scores" (
    "assessment_item_option_id" UUID NOT NULL,
    "assessment_construct_id" UUID NOT NULL,
    "score" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "assessment_option_scores_pkey"
        PRIMARY KEY ("assessment_item_option_id", "assessment_construct_id")
);

CREATE UNIQUE INDEX "assessment_constructs_assessment_version_id_code_key"
    ON "assessment_constructs"("assessment_version_id", "code");

CREATE UNIQUE INDEX "assessment_constructs_assessment_version_id_order_index_key"
    ON "assessment_constructs"("assessment_version_id", "order_index");

CREATE INDEX "assessment_constructs_assessment_version_id_idx"
    ON "assessment_constructs"("assessment_version_id");

CREATE UNIQUE INDEX "assessment_items_assessment_version_id_code_key"
    ON "assessment_items"("assessment_version_id", "code");

CREATE UNIQUE INDEX "assessment_items_assessment_version_id_order_index_key"
    ON "assessment_items"("assessment_version_id", "order_index");

CREATE INDEX "assessment_items_assessment_version_id_type_idx"
    ON "assessment_items"("assessment_version_id", "type");

CREATE UNIQUE INDEX "assessment_item_options_assessment_item_id_code_key"
    ON "assessment_item_options"("assessment_item_id", "code");

CREATE UNIQUE INDEX "assessment_item_options_assessment_item_id_order_index_key"
    ON "assessment_item_options"("assessment_item_id", "order_index");

CREATE INDEX "assessment_item_options_assessment_item_id_idx"
    ON "assessment_item_options"("assessment_item_id");

CREATE INDEX "assessment_item_constructs_assessment_construct_id_idx"
    ON "assessment_item_constructs"("assessment_construct_id");

CREATE INDEX "assessment_option_scores_assessment_construct_id_idx"
    ON "assessment_option_scores"("assessment_construct_id");

ALTER TABLE "assessment_constructs"
    ADD CONSTRAINT "assessment_constructs_assessment_version_id_fkey"
    FOREIGN KEY ("assessment_version_id")
    REFERENCES "assessment_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_items"
    ADD CONSTRAINT "assessment_items_assessment_version_id_fkey"
    FOREIGN KEY ("assessment_version_id")
    REFERENCES "assessment_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_item_options"
    ADD CONSTRAINT "assessment_item_options_assessment_item_id_fkey"
    FOREIGN KEY ("assessment_item_id")
    REFERENCES "assessment_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_item_constructs"
    ADD CONSTRAINT "assessment_item_constructs_assessment_item_id_fkey"
    FOREIGN KEY ("assessment_item_id")
    REFERENCES "assessment_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_item_constructs"
    ADD CONSTRAINT "assessment_item_constructs_assessment_construct_id_fkey"
    FOREIGN KEY ("assessment_construct_id")
    REFERENCES "assessment_constructs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_option_scores"
    ADD CONSTRAINT "assessment_option_scores_assessment_item_option_id_fkey"
    FOREIGN KEY ("assessment_item_option_id")
    REFERENCES "assessment_item_options"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_option_scores"
    ADD CONSTRAINT "assessment_option_scores_assessment_construct_id_fkey"
    FOREIGN KEY ("assessment_construct_id")
    REFERENCES "assessment_constructs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cross-version protection:
-- an item may only link to constructs from its own assessment version,
-- and an option may only score constructs from the item's assessment version.
CREATE FUNCTION "validate_assessment_scoring_scope"()
RETURNS TRIGGER AS $$
DECLARE
    item_version UUID;
    construct_version UUID;
BEGIN
    IF TG_TABLE_NAME = 'assessment_item_constructs' THEN
        SELECT "assessment_version_id"
          INTO item_version
          FROM "assessment_items"
         WHERE "id" = NEW."assessment_item_id";

        SELECT "assessment_version_id"
          INTO construct_version
          FROM "assessment_constructs"
         WHERE "id" = NEW."assessment_construct_id";
    ELSE
        SELECT i."assessment_version_id"
          INTO item_version
          FROM "assessment_item_options" o
          JOIN "assessment_items" i ON i."id" = o."assessment_item_id"
         WHERE o."id" = NEW."assessment_item_option_id";

        SELECT "assessment_version_id"
          INTO construct_version
          FROM "assessment_constructs"
         WHERE "id" = NEW."assessment_construct_id";
    END IF;

    IF item_version IS NULL
       OR construct_version IS NULL
       OR item_version IS DISTINCT FROM construct_version THEN
        RAISE EXCEPTION 'Assessment scoring relationships must remain within one assessment version';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_item_constructs_scope_guard"
BEFORE INSERT OR UPDATE ON "assessment_item_constructs"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_scoring_scope"();

CREATE TRIGGER "assessment_option_scores_scope_guard"
BEFORE INSERT OR UPDATE ON "assessment_option_scores"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_scoring_scope"();

-- Content immutability:
-- child records may be modified only while their owning AssessmentVersion is DRAFT.
CREATE FUNCTION "protect_published_assessment_content"()
RETURNS TRIGGER AS $$
DECLARE
    version_status "AssessmentVersionStatus";
    version_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'assessment_constructs'
       OR TG_TABLE_NAME = 'assessment_items' THEN
        version_id := COALESCE(NEW."assessment_version_id", OLD."assessment_version_id");

    ELSIF TG_TABLE_NAME = 'assessment_item_options' THEN
        SELECT "assessment_version_id"
          INTO version_id
          FROM "assessment_items"
         WHERE "id" = COALESCE(NEW."assessment_item_id", OLD."assessment_item_id");

    ELSIF TG_TABLE_NAME = 'assessment_item_constructs' THEN
        SELECT "assessment_version_id"
          INTO version_id
          FROM "assessment_items"
         WHERE "id" = COALESCE(NEW."assessment_item_id", OLD."assessment_item_id");

    ELSIF TG_TABLE_NAME = 'assessment_option_scores' THEN
        SELECT i."assessment_version_id"
          INTO version_id
          FROM "assessment_item_options" o
          JOIN "assessment_items" i ON i."id" = o."assessment_item_id"
         WHERE o."id" = COALESCE(
             NEW."assessment_item_option_id",
             OLD."assessment_item_option_id"
         );
    END IF;

    SELECT "status"
      INTO version_status
      FROM "assessment_versions"
     WHERE "id" = version_id;

    IF version_status IS DISTINCT FROM 'DRAFT'::"AssessmentVersionStatus" THEN
        RAISE EXCEPTION 'Published or retired assessment content is immutable';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_constructs_content_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "assessment_constructs"
FOR EACH ROW EXECUTE FUNCTION "protect_published_assessment_content"();

CREATE TRIGGER "assessment_items_content_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "assessment_items"
FOR EACH ROW EXECUTE FUNCTION "protect_published_assessment_content"();

CREATE TRIGGER "assessment_item_options_content_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "assessment_item_options"
FOR EACH ROW EXECUTE FUNCTION "protect_published_assessment_content"();

CREATE TRIGGER "assessment_item_constructs_content_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "assessment_item_constructs"
FOR EACH ROW EXECUTE FUNCTION "protect_published_assessment_content"();

CREATE TRIGGER "assessment_option_scores_content_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "assessment_option_scores"
FOR EACH ROW EXECUTE FUNCTION "protect_published_assessment_content"();
