DROP INDEX IF EXISTS "security_price_history_symbol_date_idx";

CREATE UNIQUE INDEX "security_price_history_symbol_date_idx"
ON "security_price_history" USING btree ("symbol", "currency", "price_date");
