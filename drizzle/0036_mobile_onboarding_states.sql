CREATE TABLE IF NOT EXISTS "mobile_onboarding_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "version" varchar(40) DEFAULT 'mvp-2026-05' NOT NULL,
  "checklist_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "coach_marks_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "skipped_all" boolean DEFAULT false NOT NULL,
  "completed_at" timestamp with time zone,
  "last_prompted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_onboarding_states_user_id_idx"
  ON "mobile_onboarding_states" ("user_id");
