CREATE TABLE IF NOT EXISTS "provider_usage_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(64) NOT NULL,
  "endpoint" varchar(120) NOT NULL,
  "usage_date" date NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "success_count" integer DEFAULT 0 NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "estimated_cost_micros" integer DEFAULT 0 NOT NULL,
  "quota_limit" integer,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "provider_usage_ledger_provider_endpoint_date_idx"
  ON "provider_usage_ledger" USING btree ("provider","endpoint","usage_date");
CREATE INDEX IF NOT EXISTS "provider_usage_ledger_provider_date_idx"
  ON "provider_usage_ledger" USING btree ("provider","usage_date");

CREATE TABLE IF NOT EXISTS "security_metadata_refresh_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" varchar(24) NOT NULL,
  "triggered_by" varchar(32) DEFAULT 'worker' NOT NULL,
  "worker_id" varchar(120),
  "sampled_security_count" integer DEFAULT 0 NOT NULL,
  "updated_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "provider_ids_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "provider_usage_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status_note" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "security_metadata_refresh_runs_status_created_idx"
  ON "security_metadata_refresh_runs" USING btree ("status","created_at");
CREATE INDEX IF NOT EXISTS "security_metadata_refresh_runs_worker_created_idx"
  ON "security_metadata_refresh_runs" USING btree ("worker_id","created_at");
