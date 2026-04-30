ALTER TABLE "loo_minister_settings"
ADD COLUMN IF NOT EXISTS "reasoning_effort" varchar(16) DEFAULT 'medium' NOT NULL;
