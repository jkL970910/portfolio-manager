CREATE TABLE IF NOT EXISTS "security_research_dossiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "security_id" uuid NOT NULL REFERENCES "securities"("id"),
  "thesis_summary" text,
  "role" varchar(32) DEFAULT 'watch' NOT NULL,
  "max_allocation_pct" numeric(5, 2),
  "review_triggers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "exit_triggers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "confidence_level" varchar(16) DEFAULT 'medium' NOT NULL,
  "last_reviewed_at" timestamp with time zone,
  "next_review_at" timestamp with time zone,
  "source" varchar(24) DEFAULT 'user' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "security_research_dossiers_user_security_idx"
  ON "security_research_dossiers" ("user_id", "security_id");

CREATE INDEX IF NOT EXISTS "security_research_dossiers_user_updated_idx"
  ON "security_research_dossiers" ("user_id", "updated_at");

CREATE INDEX IF NOT EXISTS "security_research_dossiers_security_idx"
  ON "security_research_dossiers" ("security_id");
