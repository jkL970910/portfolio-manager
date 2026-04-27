ALTER TABLE "preference_profiles"
ADD COLUMN "recommendation_constraints" jsonb DEFAULT '{}'::jsonb NOT NULL;
