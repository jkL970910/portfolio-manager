CREATE TABLE IF NOT EXISTS "market_data_provider_limits" (
  "provider" varchar(64) PRIMARY KEY NOT NULL,
  "reason" text NOT NULL,
  "limited_until" timestamp with time zone NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "market_data_provider_limits_until_idx"
ON "market_data_provider_limits" USING btree ("limited_until");
