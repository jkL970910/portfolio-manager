ALTER TABLE "holding_positions"
ADD COLUMN "quote_provider" varchar(32),
ADD COLUMN "quote_source_mode" varchar(32),
ADD COLUMN "quote_status" varchar(32),
ADD COLUMN "quote_currency" varchar(3),
ADD COLUMN "quote_exchange" varchar(64),
ADD COLUMN "quote_provider_timestamp" timestamp with time zone,
ADD COLUMN "last_quote_attempted_at" timestamp with time zone,
ADD COLUMN "last_quote_success_at" timestamp with time zone,
ADD COLUMN "last_quote_error_code" varchar(64),
ADD COLUMN "last_quote_error_message" text,
ADD COLUMN "market_data_refresh_run_id" uuid;

ALTER TABLE "security_price_history"
ADD COLUMN "provider" varchar(32),
ADD COLUMN "source_mode" varchar(32) DEFAULT 'provider' NOT NULL,
ADD COLUMN "freshness" varchar(24) DEFAULT 'fresh' NOT NULL,
ADD COLUMN "refresh_run_id" uuid,
ADD COLUMN "is_reference" boolean DEFAULT false NOT NULL,
ADD COLUMN "fallback_reason" text;

ALTER TABLE "portfolio_snapshots"
ADD COLUMN "source_mode" varchar(32) DEFAULT 'snapshot' NOT NULL,
ADD COLUMN "freshness" varchar(24) DEFAULT 'fresh' NOT NULL,
ADD COLUMN "refresh_run_id" uuid,
ADD COLUMN "is_reference" boolean DEFAULT false NOT NULL,
ADD COLUMN "fallback_reason" text;

CREATE INDEX "holding_positions_quote_status_idx"
ON "holding_positions" ("user_id", "quote_status", "last_quote_attempted_at");

CREATE INDEX "security_price_history_source_idx"
ON "security_price_history" ("symbol", "exchange", "currency", "source_mode", "freshness");
