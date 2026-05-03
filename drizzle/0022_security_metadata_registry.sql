ALTER TABLE "securities"
ADD COLUMN IF NOT EXISTS "economic_asset_class" varchar(64),
ADD COLUMN IF NOT EXISTS "economic_sector" varchar(64),
ADD COLUMN IF NOT EXISTS "exposure_region" varchar(64),
ADD COLUMN IF NOT EXISTS "metadata_source" varchar(64) NOT NULL DEFAULT 'heuristic',
ADD COLUMN IF NOT EXISTS "metadata_confidence" integer NOT NULL DEFAULT 45,
ADD COLUMN IF NOT EXISTS "metadata_as_of" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "metadata_confirmed_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "metadata_notes" text;
