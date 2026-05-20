CREATE TABLE IF NOT EXISTS "brokerage_import_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "provider" varchar(32) NOT NULL,
  "status" varchar(24) NOT NULL DEFAULT 'preview',
  "source_account_count" integer NOT NULL DEFAULT 0,
  "source_holding_count" integer NOT NULL DEFAULT 0,
  "preview_json" jsonb NOT NULL,
  "source_metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "expires_at" timestamp with time zone NOT NULL,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "brokerage_import_drafts_user_status_idx"
  ON "brokerage_import_drafts" ("user_id", "status", "expires_at");

CREATE INDEX IF NOT EXISTS "brokerage_import_drafts_expires_at_idx"
  ON "brokerage_import_drafts" ("expires_at");
