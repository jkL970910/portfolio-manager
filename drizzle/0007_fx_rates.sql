CREATE TABLE IF NOT EXISTS "fx_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "base_currency" varchar(3) NOT NULL,
  "quote_currency" varchar(3) NOT NULL,
  "rate_date" date NOT NULL,
  "rate" numeric(18, 8) NOT NULL,
  "source" varchar(32) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "fx_rates_pair_date_idx"
ON "fx_rates" USING btree ("base_currency", "quote_currency", "rate_date");

CREATE INDEX IF NOT EXISTS "fx_rates_pair_idx"
ON "fx_rates" USING btree ("base_currency", "quote_currency");
