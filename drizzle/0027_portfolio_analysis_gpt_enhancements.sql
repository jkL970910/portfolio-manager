CREATE TABLE "portfolio_analysis_gpt_enhancements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "scope" varchar(32) NOT NULL,
  "mode" varchar(16) NOT NULL,
  "target_key" varchar(240) NOT NULL,
  "enhancement_key" varchar(360) NOT NULL,
  "base_generated_at" timestamp with time zone NOT NULL,
  "model" varchar(80) NOT NULL,
  "reasoning_effort" varchar(24) NOT NULL,
  "prompt_version" varchar(32) NOT NULL,
  "request_json" jsonb NOT NULL,
  "enhancement_json" jsonb NOT NULL,
  "generated_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "portfolio_analysis_gpt_enhancements"
  ADD CONSTRAINT "portfolio_analysis_gpt_enhancements_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE no action ON UPDATE no action;

CREATE INDEX "portfolio_analysis_gpt_enhancements_lookup_idx"
  ON "portfolio_analysis_gpt_enhancements"
  USING btree ("user_id", "enhancement_key", "expires_at");

CREATE UNIQUE INDEX "portfolio_analysis_gpt_enhancements_key_idx"
  ON "portfolio_analysis_gpt_enhancements"
  USING btree ("user_id", "enhancement_key");
