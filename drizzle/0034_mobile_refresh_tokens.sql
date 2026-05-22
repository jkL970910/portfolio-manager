CREATE TABLE IF NOT EXISTS "mobile_refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "token_id" varchar(64) NOT NULL,
  "token_hash" varchar(128) NOT NULL,
  "revoked_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_refresh_tokens_token_id_idx"
  ON "mobile_refresh_tokens" ("token_id");

CREATE INDEX IF NOT EXISTS "mobile_refresh_tokens_user_active_idx"
  ON "mobile_refresh_tokens" ("user_id", "revoked_at", "expires_at");
