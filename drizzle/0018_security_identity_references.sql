ALTER TABLE "holding_positions"
ADD COLUMN IF NOT EXISTS "security_id" uuid REFERENCES "securities"("id");

ALTER TABLE "security_price_history"
ADD COLUMN IF NOT EXISTS "security_id" uuid REFERENCES "securities"("id");

ALTER TABLE "recommendation_items"
ADD COLUMN IF NOT EXISTS "security_id" uuid REFERENCES "securities"("id");

ALTER TABLE "recommendation_items"
ADD COLUMN IF NOT EXISTS "security_exchange" varchar(64);

ALTER TABLE "recommendation_items"
ADD COLUMN IF NOT EXISTS "security_mic_code" varchar(16);

ALTER TABLE "recommendation_items"
ADD COLUMN IF NOT EXISTS "security_currency" varchar(3);

CREATE INDEX IF NOT EXISTS "holding_positions_security_idx"
ON "holding_positions" ("security_id");

CREATE INDEX IF NOT EXISTS "security_price_history_security_idx"
ON "security_price_history" ("security_id");

CREATE INDEX IF NOT EXISTS "security_price_history_security_date_idx"
ON "security_price_history" ("security_id", "price_date")
WHERE "security_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "recommendation_items_security_idx"
ON "recommendation_items" ("security_id");
