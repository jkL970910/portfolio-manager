CREATE TABLE "portfolio_analysis_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "scope" varchar(32) NOT NULL,
  "mode" varchar(16) NOT NULL,
  "target_key" varchar(240) NOT NULL,
  "request_json" jsonb NOT NULL,
  "result_json" jsonb NOT NULL,
  "source_mode" varchar(32) NOT NULL,
  "generated_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "portfolio_analysis_runs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

CREATE INDEX "portfolio_analysis_runs_lookup_idx"
ON "portfolio_analysis_runs" ("user_id", "scope", "mode", "target_key", "expires_at");
