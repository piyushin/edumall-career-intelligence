-- Phase 5C.1: career taxonomy and deterministic career-fit provenance foundation.
-- No scientific weights, thresholds, recommendation bands, career mappings, norms, or market data are seeded.

CREATE TYPE "CareerTaxonomyStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "CareerTaxonomyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "CareerFitModelStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "CareerFitFactorDirection" AS ENUM ('POSITIVE', 'NEGATIVE');

CREATE TABLE "career_taxonomies" (
    "id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "CareerTaxonomyStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    CONSTRAINT "career_taxonomies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "career_taxonomies_archive_state_check" CHECK (
      ("status" = 'ACTIVE' AND "archived_at" IS NULL)
      OR ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL)
    )
);

CREATE TABLE "career_taxonomy_versions" (
    "id" UUID NOT NULL,
    "career_taxonomy_id" UUID NOT NULL,
    "version" VARCHAR(60) NOT NULL,
    "edition" VARCHAR(60) NOT NULL,
    "locale" VARCHAR(20) NOT NULL,
    "status" "CareerTaxonomyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "source_reference" TEXT,
    "methodology" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    CONSTRAINT "career_taxonomy_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "career_taxonomy_versions_lifecycle_check" CHECK (
      ("status" = 'DRAFT' AND "published_at" IS NULL AND "retired_at" IS NULL)
      OR ("status" = 'PUBLISHED' AND "published_at" IS NOT NULL AND "retired_at" IS NULL)
      OR ("status" = 'RETIRED' AND "published_at" IS NOT NULL AND "retired_at" IS NOT NULL)
    )
);

CREATE TABLE "career_clusters" (
    "id" UUID NOT NULL,
    "career_taxonomy_version_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "career_clusters_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "career_clusters_order_index_check" CHECK ("order_index" >= 0)
);

CREATE TABLE "career_paths" (
    "id" UUID NOT NULL,
    "career_taxonomy_version_id" UUID NOT NULL,
    "career_cluster_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "career_paths_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "career_paths_order_index_check" CHECK ("order_index" >= 0)
);

CREATE TABLE "career_fit_models" (
    "id" UUID NOT NULL,
    "assessment_version_id" UUID NOT NULL,
    "career_taxonomy_version_id" UUID NOT NULL,
    "version" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "algorithm_key" VARCHAR(120) NOT NULL,
    "algorithm_version" VARCHAR(60) NOT NULL,
    "source_reference" TEXT,
    "methodology" JSONB,
    "status" "CareerFitModelStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    CONSTRAINT "career_fit_models_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "career_fit_models_lifecycle_check" CHECK (
      ("status" = 'DRAFT' AND "published_at" IS NULL AND "retired_at" IS NULL)
      OR ("status" = 'PUBLISHED' AND "published_at" IS NOT NULL AND "retired_at" IS NULL)
      OR ("status" = 'RETIRED' AND "published_at" IS NOT NULL AND "retired_at" IS NOT NULL)
    )
);

CREATE TABLE "career_fit_model_factors" (
    "id" UUID NOT NULL,
    "career_fit_model_id" UUID NOT NULL,
    "career_path_id" UUID NOT NULL,
    "assessment_construct_id" UUID NOT NULL,
    "weight" DECIMAL(20,8) NOT NULL,
    "direction" "CareerFitFactorDirection" NOT NULL DEFAULT 'POSITIVE',
    "configuration" JSONB,
    "rationale" TEXT,
    "source_reference" TEXT,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "career_fit_model_factors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "career_fit_model_factors_order_index_check" CHECK ("order_index" >= 0)
);

CREATE TABLE "career_fit_recommendation_bands" (
    "id" UUID NOT NULL,
    "career_fit_model_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "lower_bound" DECIMAL(20,8),
    "upper_bound" DECIMAL(20,8),
    "lower_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "upper_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "output_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "career_fit_recommendation_bands_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "career_fit_recommendation_bands_bounds_check" CHECK (
      "lower_bound" IS NULL OR "upper_bound" IS NULL OR "lower_bound" <= "upper_bound"
    )
);

CREATE TABLE "career_fit_runs" (
    "id" UUID NOT NULL,
    "scoring_run_id" UUID NOT NULL,
    "career_fit_model_id" UUID NOT NULL,
    "input_hash" CHAR(64) NOT NULL,
    "algorithm_key" VARCHAR(120) NOT NULL,
    "algorithm_version" VARCHAR(60) NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "career_fit_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "career_fit_results" (
    "career_fit_run_id" UUID NOT NULL,
    "career_path_id" UUID NOT NULL,
    "score" DECIMAL(20,8) NOT NULL,
    "rank" INTEGER NOT NULL,
    "recommendation_band_id" UUID,
    "evidence_data" JSONB NOT NULL,
    CONSTRAINT "career_fit_results_pkey" PRIMARY KEY ("career_fit_run_id", "career_path_id"),
    CONSTRAINT "career_fit_results_rank_check" CHECK ("rank" > 0)
);

CREATE UNIQUE INDEX "career_taxonomies_code_key" ON "career_taxonomies"("code");
CREATE INDEX "career_taxonomies_status_idx" ON "career_taxonomies"("status");
CREATE UNIQUE INDEX "career_taxonomy_versions_taxonomy_version_key" ON "career_taxonomy_versions"("career_taxonomy_id", "version");
CREATE INDEX "career_taxonomy_versions_taxonomy_status_idx" ON "career_taxonomy_versions"("career_taxonomy_id", "status");
CREATE INDEX "career_taxonomy_versions_status_published_at_idx" ON "career_taxonomy_versions"("status", "published_at");
CREATE UNIQUE INDEX "career_clusters_version_code_key" ON "career_clusters"("career_taxonomy_version_id", "code");
CREATE UNIQUE INDEX "career_clusters_version_order_key" ON "career_clusters"("career_taxonomy_version_id", "order_index");
CREATE UNIQUE INDEX "career_paths_version_code_key" ON "career_paths"("career_taxonomy_version_id", "code");
CREATE UNIQUE INDEX "career_paths_version_order_key" ON "career_paths"("career_taxonomy_version_id", "order_index");
CREATE INDEX "career_paths_cluster_id_idx" ON "career_paths"("career_cluster_id");
CREATE UNIQUE INDEX "career_fit_models_assessment_taxonomy_version_key" ON "career_fit_models"("assessment_version_id", "career_taxonomy_version_id", "version");
CREATE INDEX "career_fit_models_assessment_status_idx" ON "career_fit_models"("assessment_version_id", "status");
CREATE INDEX "career_fit_models_taxonomy_status_idx" ON "career_fit_models"("career_taxonomy_version_id", "status");
CREATE UNIQUE INDEX "career_fit_model_factors_model_path_construct_key" ON "career_fit_model_factors"("career_fit_model_id", "career_path_id", "assessment_construct_id");
CREATE UNIQUE INDEX "career_fit_model_factors_model_order_key" ON "career_fit_model_factors"("career_fit_model_id", "order_index");
CREATE INDEX "career_fit_model_factors_path_idx" ON "career_fit_model_factors"("career_path_id");
CREATE INDEX "career_fit_model_factors_construct_idx" ON "career_fit_model_factors"("assessment_construct_id");
CREATE UNIQUE INDEX "career_fit_recommendation_bands_model_code_key" ON "career_fit_recommendation_bands"("career_fit_model_id", "code");
CREATE INDEX "career_fit_recommendation_bands_model_priority_idx" ON "career_fit_recommendation_bands"("career_fit_model_id", "priority");
CREATE UNIQUE INDEX "career_fit_runs_scoring_model_hash_key" ON "career_fit_runs"("scoring_run_id", "career_fit_model_id", "input_hash");
CREATE INDEX "career_fit_runs_scoring_calculated_idx" ON "career_fit_runs"("scoring_run_id", "calculated_at");
CREATE INDEX "career_fit_runs_model_calculated_idx" ON "career_fit_runs"("career_fit_model_id", "calculated_at");
CREATE UNIQUE INDEX "career_fit_results_run_rank_key" ON "career_fit_results"("career_fit_run_id", "rank");
CREATE INDEX "career_fit_results_path_idx" ON "career_fit_results"("career_path_id");
CREATE INDEX "career_fit_results_band_idx" ON "career_fit_results"("recommendation_band_id");

ALTER TABLE "career_taxonomy_versions" ADD CONSTRAINT "career_taxonomy_versions_taxonomy_fkey" FOREIGN KEY ("career_taxonomy_id") REFERENCES "career_taxonomies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_clusters" ADD CONSTRAINT "career_clusters_version_fkey" FOREIGN KEY ("career_taxonomy_version_id") REFERENCES "career_taxonomy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_paths" ADD CONSTRAINT "career_paths_version_fkey" FOREIGN KEY ("career_taxonomy_version_id") REFERENCES "career_taxonomy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_paths" ADD CONSTRAINT "career_paths_cluster_fkey" FOREIGN KEY ("career_cluster_id") REFERENCES "career_clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_models" ADD CONSTRAINT "career_fit_models_assessment_version_fkey" FOREIGN KEY ("assessment_version_id") REFERENCES "assessment_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_models" ADD CONSTRAINT "career_fit_models_taxonomy_version_fkey" FOREIGN KEY ("career_taxonomy_version_id") REFERENCES "career_taxonomy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_model_factors" ADD CONSTRAINT "career_fit_model_factors_model_fkey" FOREIGN KEY ("career_fit_model_id") REFERENCES "career_fit_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_model_factors" ADD CONSTRAINT "career_fit_model_factors_path_fkey" FOREIGN KEY ("career_path_id") REFERENCES "career_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_model_factors" ADD CONSTRAINT "career_fit_model_factors_construct_fkey" FOREIGN KEY ("assessment_construct_id") REFERENCES "assessment_constructs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_recommendation_bands" ADD CONSTRAINT "career_fit_recommendation_bands_model_fkey" FOREIGN KEY ("career_fit_model_id") REFERENCES "career_fit_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_runs" ADD CONSTRAINT "career_fit_runs_scoring_run_fkey" FOREIGN KEY ("scoring_run_id") REFERENCES "assessment_scoring_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_runs" ADD CONSTRAINT "career_fit_runs_model_fkey" FOREIGN KEY ("career_fit_model_id") REFERENCES "career_fit_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_results" ADD CONSTRAINT "career_fit_results_run_fkey" FOREIGN KEY ("career_fit_run_id") REFERENCES "career_fit_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_results" ADD CONSTRAINT "career_fit_results_path_fkey" FOREIGN KEY ("career_path_id") REFERENCES "career_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career_fit_results" ADD CONSTRAINT "career_fit_results_band_fkey" FOREIGN KEY ("recommendation_band_id") REFERENCES "career_fit_recommendation_bands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cross-version integrity that ordinary foreign keys cannot express.
CREATE FUNCTION "validate_career_path_cluster_version"()
RETURNS TRIGGER AS $$
DECLARE cluster_version UUID;
BEGIN
  SELECT "career_taxonomy_version_id" INTO cluster_version FROM "career_clusters" WHERE "id" = NEW."career_cluster_id";
  IF cluster_version IS DISTINCT FROM NEW."career_taxonomy_version_id" THEN
    RAISE EXCEPTION 'Career path and career cluster must belong to the same taxonomy version';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "career_paths_version_guard"
BEFORE INSERT OR UPDATE ON "career_paths"
FOR EACH ROW EXECUTE FUNCTION "validate_career_path_cluster_version"();

CREATE FUNCTION "validate_career_fit_factor_scope"()
RETURNS TRIGGER AS $$
DECLARE model_assessment UUID;
DECLARE model_taxonomy UUID;
DECLARE construct_assessment UUID;
DECLARE path_taxonomy UUID;
BEGIN
  SELECT "assessment_version_id", "career_taxonomy_version_id"
    INTO model_assessment, model_taxonomy
    FROM "career_fit_models" WHERE "id" = NEW."career_fit_model_id";
  SELECT "assessment_version_id" INTO construct_assessment FROM "assessment_constructs" WHERE "id" = NEW."assessment_construct_id";
  SELECT "career_taxonomy_version_id" INTO path_taxonomy FROM "career_paths" WHERE "id" = NEW."career_path_id";
  IF construct_assessment IS DISTINCT FROM model_assessment THEN
    RAISE EXCEPTION 'Career-fit factor construct is outside model assessment version';
  END IF;
  IF path_taxonomy IS DISTINCT FROM model_taxonomy THEN
    RAISE EXCEPTION 'Career-fit factor career path is outside model taxonomy version';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "career_fit_model_factors_scope_guard"
BEFORE INSERT OR UPDATE ON "career_fit_model_factors"
FOR EACH ROW EXECUTE FUNCTION "validate_career_fit_factor_scope"();

-- Protect taxonomy/model history. Draft content may be authored; published content may only retire.
CREATE FUNCTION "protect_career_taxonomy_version_history"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Published or retired career taxonomy versions cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'RETIRED' THEN RAISE EXCEPTION 'Retired career taxonomy versions are immutable'; END IF;
  IF OLD."status" = 'DRAFT' AND NEW."status" = 'RETIRED' THEN RAISE EXCEPTION 'Draft career taxonomy versions must be published before retirement'; END IF;
  IF OLD."status" = 'PUBLISHED' AND NEW."status" <> 'RETIRED' THEN RAISE EXCEPTION 'Published career taxonomy versions may only transition to retired'; END IF;
  IF OLD."status" = 'PUBLISHED' AND (
    NEW."career_taxonomy_id" IS DISTINCT FROM OLD."career_taxonomy_id" OR
    NEW."version" IS DISTINCT FROM OLD."version" OR NEW."edition" IS DISTINCT FROM OLD."edition" OR
    NEW."locale" IS DISTINCT FROM OLD."locale" OR NEW."source_reference" IS DISTINCT FROM OLD."source_reference" OR
    NEW."methodology" IS DISTINCT FROM OLD."methodology" OR NEW."published_at" IS DISTINCT FROM OLD."published_at"
  ) THEN RAISE EXCEPTION 'Published career taxonomy version content is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "career_taxonomy_versions_history_guard"
BEFORE UPDATE OR DELETE ON "career_taxonomy_versions"
FOR EACH ROW EXECUTE FUNCTION "protect_career_taxonomy_version_history"();

CREATE FUNCTION "protect_career_fit_model_history"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Published or retired career-fit models cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'RETIRED' THEN RAISE EXCEPTION 'Retired career-fit models are immutable'; END IF;
  IF OLD."status" = 'DRAFT' AND NEW."status" = 'RETIRED' THEN RAISE EXCEPTION 'Draft career-fit models must be published before retirement'; END IF;
  IF OLD."status" = 'PUBLISHED' AND NEW."status" <> 'RETIRED' THEN RAISE EXCEPTION 'Published career-fit models may only transition to retired'; END IF;
  IF OLD."status" = 'PUBLISHED' AND (
    NEW."assessment_version_id" IS DISTINCT FROM OLD."assessment_version_id" OR
    NEW."career_taxonomy_version_id" IS DISTINCT FROM OLD."career_taxonomy_version_id" OR
    NEW."version" IS DISTINCT FROM OLD."version" OR NEW."name" IS DISTINCT FROM OLD."name" OR
    NEW."description" IS DISTINCT FROM OLD."description" OR NEW."algorithm_key" IS DISTINCT FROM OLD."algorithm_key" OR
    NEW."algorithm_version" IS DISTINCT FROM OLD."algorithm_version" OR NEW."source_reference" IS DISTINCT FROM OLD."source_reference" OR
    NEW."methodology" IS DISTINCT FROM OLD."methodology" OR NEW."published_at" IS DISTINCT FROM OLD."published_at"
  ) THEN RAISE EXCEPTION 'Published career-fit model content is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "career_fit_models_history_guard"
BEFORE UPDATE OR DELETE ON "career_fit_models"
FOR EACH ROW EXECUTE FUNCTION "protect_career_fit_model_history"();

-- Child content of a published/retired taxonomy is immutable.
CREATE FUNCTION "protect_career_taxonomy_child_history"()
RETURNS TRIGGER AS $$
DECLARE version_id UUID;
DECLARE version_status "CareerTaxonomyVersionStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    version_id := OLD."career_taxonomy_version_id";
  ELSE
    version_id := NEW."career_taxonomy_version_id";
  END IF;

  SELECT "status" INTO version_status FROM "career_taxonomy_versions" WHERE "id" = version_id;
  IF version_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Published or retired career taxonomy content is immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "career_clusters_history_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "career_clusters"
FOR EACH ROW EXECUTE FUNCTION "protect_career_taxonomy_child_history"();

CREATE TRIGGER "career_paths_history_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "career_paths"
FOR EACH ROW EXECUTE FUNCTION "protect_career_taxonomy_child_history"();

-- Factors and bands may be authored only while their parent fit model is DRAFT.
CREATE FUNCTION "protect_career_fit_model_child_history"()
RETURNS TRIGGER AS $$
DECLARE model_id UUID;
DECLARE model_status "CareerFitModelStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    model_id := OLD."career_fit_model_id";
  ELSE
    model_id := NEW."career_fit_model_id";
  END IF;
  SELECT "status" INTO model_status FROM "career_fit_models" WHERE "id" = model_id;
  IF model_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Published or retired career-fit model configuration is immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "career_fit_model_factors_history_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "career_fit_model_factors"
FOR EACH ROW EXECUTE FUNCTION "protect_career_fit_model_child_history"();

CREATE TRIGGER "career_fit_recommendation_bands_history_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "career_fit_recommendation_bands"
FOR EACH ROW EXECUTE FUNCTION "protect_career_fit_model_child_history"();

-- Immutable execution evidence.
CREATE FUNCTION "protect_career_fit_run_history"()
RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'Career-fit runs and results are immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "career_fit_runs_immutable_guard" BEFORE UPDATE OR DELETE ON "career_fit_runs" FOR EACH ROW EXECUTE FUNCTION "protect_career_fit_run_history"();
CREATE TRIGGER "career_fit_results_immutable_guard" BEFORE UPDATE OR DELETE ON "career_fit_results" FOR EACH ROW EXECUTE FUNCTION "protect_career_fit_run_history"();
