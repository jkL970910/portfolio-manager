ALTER TABLE "recommendation_runs"
  ADD COLUMN IF NOT EXISTS "pool_evaluation" jsonb;
