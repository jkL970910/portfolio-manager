ALTER TABLE "investment_accounts"
  ADD COLUMN IF NOT EXISTS "import_source_account_aliases" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE "investment_accounts"
SET "import_source_account_aliases" = to_jsonb(ARRAY["import_source_account_id"])
WHERE "import_source_account_id" IS NOT NULL
  AND jsonb_array_length("import_source_account_aliases") = 0;
