CREATE TABLE IF NOT EXISTS "registered_account_contribution_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "account_id" uuid NOT NULL REFERENCES "investment_accounts"("id"),
  "account_type" varchar(24) NOT NULL,
  "tax_year" integer NOT NULL,
  "net_contribution_ytd_cad" numeric(14, 2) NOT NULL DEFAULT '0',
  "source_label" varchar(80),
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "registered_account_contribution_snapshots_user_account_year_idx"
  ON "registered_account_contribution_snapshots" ("user_id", "account_id", "tax_year");
