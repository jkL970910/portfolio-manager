ALTER TABLE "investment_accounts"
  ADD COLUMN IF NOT EXISTS "import_source_provider" varchar(32),
  ADD COLUMN IF NOT EXISTS "import_source_account_id" varchar(160),
  ADD COLUMN IF NOT EXISTS "last_imported_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "investment_accounts_import_source_idx"
  ON "investment_accounts" ("user_id", "import_source_provider", "import_source_account_id")
  WHERE "import_source_provider" IS NOT NULL
    AND "import_source_account_id" IS NOT NULL;

ALTER TABLE "holding_positions"
  ADD COLUMN IF NOT EXISTS "import_source_provider" varchar(32),
  ADD COLUMN IF NOT EXISTS "import_source_account_id" varchar(160),
  ADD COLUMN IF NOT EXISTS "import_source_holding_key" varchar(256),
  ADD COLUMN IF NOT EXISTS "import_status" varchar(24) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "import_synced_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "import_closed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "import_close_reason" text;

CREATE INDEX IF NOT EXISTS "holding_positions_import_source_idx"
  ON "holding_positions" ("user_id", "import_source_provider", "import_source_account_id");

CREATE INDEX IF NOT EXISTS "holding_positions_import_holding_key_idx"
  ON "holding_positions" ("user_id", "import_source_provider", "import_source_account_id", "import_source_holding_key")
  WHERE "import_source_provider" IS NOT NULL
    AND "import_source_account_id" IS NOT NULL
    AND "import_source_holding_key" IS NOT NULL;
