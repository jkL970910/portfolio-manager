CREATE TABLE "market_data_refresh_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "scope" varchar(32) DEFAULT 'portfolio-quotes' NOT NULL,
  "status" varchar(24) NOT NULL,
  "triggered_by" varchar(32) DEFAULT 'worker' NOT NULL,
  "worker_id" varchar(120),
  "sampled_symbol_count" integer DEFAULT 0 NOT NULL,
  "refreshed_holding_count" integer DEFAULT 0 NOT NULL,
  "missing_quote_count" integer DEFAULT 0 NOT NULL,
  "history_point_count" integer DEFAULT 0 NOT NULL,
  "snapshot_recorded" boolean DEFAULT false NOT NULL,
  "fx_rate_label" text,
  "fx_as_of" date,
  "fx_source" varchar(64),
  "fx_freshness" varchar(24),
  "provider_status_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_message" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "market_data_refresh_runs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

CREATE INDEX "market_data_refresh_runs_user_created_idx"
ON "market_data_refresh_runs" ("user_id", "created_at");

CREATE INDEX "market_data_refresh_runs_status_created_idx"
ON "market_data_refresh_runs" ("status", "created_at");
