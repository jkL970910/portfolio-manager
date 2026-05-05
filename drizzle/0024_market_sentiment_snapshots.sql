CREATE TABLE IF NOT EXISTS "market_sentiment_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(64) NOT NULL,
  "index_name" varchar(120) NOT NULL,
  "score" integer NOT NULL,
  "rating" varchar(32) NOT NULL,
  "as_of" timestamp with time zone NOT NULL,
  "source_mode" varchar(32) NOT NULL,
  "source_url" text,
  "components" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "summary" text NOT NULL,
  "buy_signal" varchar(32) NOT NULL,
  "risk_note" text NOT NULL,
  "raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "market_sentiment_provider_index_asof_idx"
  ON "market_sentiment_snapshots" ("provider", "index_name", "as_of");

CREATE INDEX IF NOT EXISTS "market_sentiment_expires_idx"
  ON "market_sentiment_snapshots" ("expires_at");
