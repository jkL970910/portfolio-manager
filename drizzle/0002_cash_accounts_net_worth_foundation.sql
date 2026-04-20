CREATE TABLE "cash_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "institution" varchar(120) NOT NULL,
  "nickname" varchar(120) NOT NULL,
  "currency" varchar(3) DEFAULT 'CAD' NOT NULL,
  "current_balance_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "current_balance_cad" numeric(14, 2) DEFAULT '0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "cash_account_balance_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "cash_account_id" uuid NOT NULL,
  "booked_at" date NOT NULL,
  "balance_amount" numeric(14, 2) NOT NULL,
  "balance_cad" numeric(14, 2) NOT NULL,
  "source" varchar(32) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cash_account_balance_events" ADD CONSTRAINT "cash_account_balance_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cash_account_balance_events" ADD CONSTRAINT "cash_account_balance_events_cash_account_id_cash_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."cash_accounts"("id") ON DELETE no action ON UPDATE no action;
