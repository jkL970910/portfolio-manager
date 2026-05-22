CREATE TABLE IF NOT EXISTS "registered_account_rooms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "account_type" varchar(24) NOT NULL,
  "tax_year" integer NOT NULL,
  "remaining_room_cad" numeric(14, 2) DEFAULT '0' NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "registered_account_rooms_user_type_year_idx"
  ON "registered_account_rooms" ("user_id", "account_type", "tax_year");
