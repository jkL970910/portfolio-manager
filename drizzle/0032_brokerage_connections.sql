CREATE TABLE IF NOT EXISTS "brokerage_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "provider" varchar(32) NOT NULL,
  "display_name" varchar(160) NOT NULL,
  "status" varchar(24) NOT NULL DEFAULT 'active',
  "query_id" varchar(64) NOT NULL,
  "encrypted_token" text NOT NULL,
  "token_iv" varchar(64) NOT NULL,
  "token_auth_tag" varchar(64) NOT NULL,
  "token_last4" varchar(8),
  "token_expires_at" timestamp with time zone NOT NULL,
  "auto_sync_enabled" boolean NOT NULL DEFAULT false,
  "last_synced_at" timestamp with time zone,
  "last_sync_status" varchar(24),
  "last_sync_error" text,
  "last_draft_id" uuid REFERENCES "brokerage_import_drafts"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "brokerage_connections_user_provider_idx"
  ON "brokerage_connections" ("user_id", "provider");

CREATE INDEX IF NOT EXISTS "brokerage_connections_user_status_idx"
  ON "brokerage_connections" ("user_id", "status");

CREATE INDEX IF NOT EXISTS "brokerage_connections_token_expiry_idx"
  ON "brokerage_connections" ("token_expires_at");
