CREATE TABLE IF NOT EXISTS "recommendation_dynamic_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "security_id" uuid REFERENCES "securities"("id"),
  "symbol" varchar(32) NOT NULL,
  "name" varchar(160) NOT NULL,
  "exchange" varchar(64),
  "currency" varchar(3),
  "asset_class" varchar(64) NOT NULL,
  "role" varchar(32) NOT NULL,
  "source" varchar(32) NOT NULL,
  "provider_confidence" varchar(16) NOT NULL DEFAULT 'medium',
  "liquidity_score" integer NOT NULL DEFAULT 65,
  "expense_bps" integer NOT NULL DEFAULT 75,
  "security_type" varchar(64),
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "source_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "last_refreshed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "recommendation_dynamic_candidates_user_asset_idx"
  ON "recommendation_dynamic_candidates" ("user_id", "asset_class", "expires_at");

CREATE UNIQUE INDEX IF NOT EXISTS "recommendation_dynamic_candidates_identity_idx"
  ON "recommendation_dynamic_candidates" ("user_id", "symbol", "exchange", "currency");

CREATE INDEX IF NOT EXISTS "recommendation_dynamic_candidates_security_idx"
  ON "recommendation_dynamic_candidates" ("security_id");
