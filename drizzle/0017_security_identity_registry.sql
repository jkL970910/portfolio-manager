CREATE TABLE IF NOT EXISTS "securities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "symbol" varchar(32) NOT NULL,
  "canonical_exchange" varchar(64) NOT NULL,
  "mic_code" varchar(16),
  "currency" varchar(3) NOT NULL,
  "name" varchar(240) NOT NULL,
  "security_type" varchar(64),
  "market_sector" varchar(64),
  "country" varchar(64),
  "underlying_id" varchar(120),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "security_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "security_id" uuid NOT NULL REFERENCES "securities"("id"),
  "alias_type" varchar(32) NOT NULL,
  "alias_value" varchar(160) NOT NULL,
  "provider" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "securities_listing_unique_idx"
ON "securities" ("symbol", "canonical_exchange", "currency");

CREATE UNIQUE INDEX IF NOT EXISTS "securities_mic_symbol_currency_idx"
ON "securities" ("mic_code", "symbol", "currency");

CREATE INDEX IF NOT EXISTS "securities_underlying_idx"
ON "securities" ("underlying_id");

CREATE UNIQUE INDEX IF NOT EXISTS "security_aliases_value_unique_idx"
ON "security_aliases" ("alias_type", "alias_value", "provider");

CREATE INDEX IF NOT EXISTS "security_aliases_security_idx"
ON "security_aliases" ("security_id");
