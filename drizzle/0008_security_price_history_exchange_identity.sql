ALTER TABLE "security_price_history"
ADD COLUMN IF NOT EXISTS "exchange" varchar(64) NOT NULL DEFAULT '';

UPDATE "security_price_history"
SET "exchange" = ''
WHERE "exchange" IS NULL;

DROP INDEX IF EXISTS "security_price_history_symbol_date_idx";

CREATE UNIQUE INDEX "security_price_history_symbol_date_idx"
ON "security_price_history" USING btree ("symbol", "exchange", "currency", "price_date");
