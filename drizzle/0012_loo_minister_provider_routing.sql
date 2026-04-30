ALTER TABLE "loo_minister_settings" ADD COLUMN "provider" varchar(40) DEFAULT 'official-openai' NOT NULL;
--> statement-breakpoint
ALTER TABLE "loo_minister_settings" ADD COLUMN "base_url" varchar(240);
--> statement-breakpoint
ALTER TABLE "loo_minister_settings" ALTER COLUMN "model" TYPE varchar(128);
--> statement-breakpoint
ALTER TABLE "loo_minister_usage_logs" ALTER COLUMN "model" TYPE varchar(128);
