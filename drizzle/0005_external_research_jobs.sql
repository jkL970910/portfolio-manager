CREATE TABLE "external_research_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "scope" varchar(32) NOT NULL,
  "target_key" varchar(240) NOT NULL,
  "request_json" jsonb NOT NULL,
  "status" varchar(24) DEFAULT 'queued' NOT NULL,
  "source_mode" varchar(32) DEFAULT 'cached-external' NOT NULL,
  "source_allowlist_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "run_after" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_by" varchar(120),
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "error_message" text,
  "result_run_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "external_research_jobs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "external_research_jobs_result_run_id_portfolio_analysis_runs_id_fk"
    FOREIGN KEY ("result_run_id") REFERENCES "portfolio_analysis_runs"("id")
);

CREATE INDEX "external_research_jobs_user_created_idx"
ON "external_research_jobs" ("user_id", "created_at");

CREATE INDEX "external_research_jobs_status_run_after_idx"
ON "external_research_jobs" ("status", "run_after");

CREATE TABLE "external_research_usage_counters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "counter_date" date NOT NULL,
  "scope" varchar(32) NOT NULL,
  "run_count" integer DEFAULT 0 NOT NULL,
  "symbol_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "external_research_usage_counters_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

CREATE UNIQUE INDEX "external_research_usage_user_date_scope_idx"
ON "external_research_usage_counters" ("user_id", "counter_date", "scope");
