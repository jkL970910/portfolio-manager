CREATE TABLE "portfolio_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "symbol" varchar(32),
  "event_type" varchar(32) NOT NULL,
  "quantity" numeric(18, 6),
  "price_amount" numeric(14, 4),
  "currency" varchar(3),
  "booked_at" date NOT NULL,
  "effective_at" timestamp with time zone NOT NULL,
  "source" varchar(32) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "security_price_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "symbol" varchar(32) NOT NULL,
  "price_date" date NOT NULL,
  "close" numeric(14, 4) NOT NULL,
  "adjusted_close" numeric(14, 4),
  "currency" varchar(3) DEFAULT 'CAD' NOT NULL,
  "source" varchar(32) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "portfolio_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "snapshot_date" date NOT NULL,
  "total_value_cad" numeric(14, 2) NOT NULL,
  "account_breakdown_json" jsonb NOT NULL,
  "holding_breakdown_json" jsonb NOT NULL,
  "source_version" varchar(32) DEFAULT 'v1' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "portfolio_events" ADD CONSTRAINT "portfolio_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "portfolio_events" ADD CONSTRAINT "portfolio_events_account_id_investment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "security_price_history_symbol_date_idx" ON "security_price_history" USING btree ("symbol","price_date");
CREATE UNIQUE INDEX "portfolio_snapshots_user_date_idx" ON "portfolio_snapshots" USING btree ("user_id","snapshot_date");
