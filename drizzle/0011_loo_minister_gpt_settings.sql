CREATE TABLE "loo_minister_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" varchar(24) DEFAULT 'local' NOT NULL,
	"model" varchar(64) DEFAULT 'gpt-5.5' NOT NULL,
	"encrypted_api_key" text,
	"api_key_iv" varchar(64),
	"api_key_auth_tag" varchar(64),
	"api_key_last4" varchar(8),
	"api_key_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loo_minister_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"page" varchar(40) NOT NULL,
	"mode" varchar(24) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"model" varchar(64) NOT NULL,
	"status" varchar(24) NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loo_minister_settings" ADD CONSTRAINT "loo_minister_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loo_minister_usage_logs" ADD CONSTRAINT "loo_minister_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loo_minister_settings_user_id_idx" ON "loo_minister_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "loo_minister_usage_user_created_idx" ON "loo_minister_usage_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "loo_minister_usage_user_status_created_idx" ON "loo_minister_usage_logs" USING btree ("user_id","status","created_at");
