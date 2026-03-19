CREATE TABLE "allocation_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preference_profile_id" uuid NOT NULL,
	"asset_class" varchar(64) NOT NULL,
	"target_pct" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashflow_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"booked_at" date NOT NULL,
	"merchant" varchar(160) NOT NULL,
	"category" varchar(64) NOT NULL,
	"amount_cad" numeric(14, 2) NOT NULL,
	"direction" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holding_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"name" varchar(160) NOT NULL,
	"asset_class" varchar(64) NOT NULL,
	"sector" varchar(64) NOT NULL,
	"market_value_cad" numeric(14, 2) NOT NULL,
	"weight_pct" numeric(7, 2) NOT NULL,
	"gain_loss_pct" numeric(7, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(24) NOT NULL,
	"source_type" varchar(24) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"institution" varchar(120) NOT NULL,
	"type" varchar(24) NOT NULL,
	"nickname" varchar(120) NOT NULL,
	"market_value_cad" numeric(14, 2) NOT NULL,
	"contribution_room_cad" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preference_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"risk_profile" varchar(32) NOT NULL,
	"account_funding_priority" jsonb NOT NULL,
	"tax_aware_placement" boolean DEFAULT true NOT NULL,
	"cash_buffer_target_cad" numeric(14, 2) NOT NULL,
	"transition_preference" varchar(32) NOT NULL,
	"recommendation_strategy" varchar(32) NOT NULL,
	"rebalancing_tolerance_pct" integer NOT NULL,
	"watchlist_symbols" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_run_id" uuid NOT NULL,
	"asset_class" varchar(64) NOT NULL,
	"amount_cad" numeric(14, 2) NOT NULL,
	"target_account_type" varchar(24) NOT NULL,
	"ticker_options" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contribution_amount_cad" numeric(14, 2) NOT NULL,
	"assumptions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"base_currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allocation_targets" ADD CONSTRAINT "allocation_targets_preference_profile_id_preference_profiles_id_fk" FOREIGN KEY ("preference_profile_id") REFERENCES "public"."preference_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD CONSTRAINT "cashflow_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD CONSTRAINT "cashflow_transactions_account_id_investment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_positions" ADD CONSTRAINT "holding_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_positions" ADD CONSTRAINT "holding_positions_account_id_investment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_accounts" ADD CONSTRAINT "investment_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_profiles" ADD CONSTRAINT "preference_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_recommendation_run_id_recommendation_runs_id_fk" FOREIGN KEY ("recommendation_run_id") REFERENCES "public"."recommendation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "preference_profiles_user_id_idx" ON "preference_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");