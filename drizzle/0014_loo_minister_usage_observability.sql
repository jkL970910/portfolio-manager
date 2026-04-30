ALTER TABLE "loo_minister_usage_logs"
ADD COLUMN IF NOT EXISTS "retry_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "loo_minister_usage_logs"
ADD COLUMN IF NOT EXISTS "failure_kind" varchar(40);
