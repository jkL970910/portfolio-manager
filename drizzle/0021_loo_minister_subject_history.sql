ALTER TABLE "loo_minister_chat_sessions"
ADD COLUMN IF NOT EXISTS "subject_history_json" jsonb NOT NULL DEFAULT '[]'::jsonb;
