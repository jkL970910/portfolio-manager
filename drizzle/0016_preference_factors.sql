ALTER TABLE "preference_profiles"
ADD COLUMN IF NOT EXISTS "preference_factors" jsonb DEFAULT '{}'::jsonb NOT NULL;
