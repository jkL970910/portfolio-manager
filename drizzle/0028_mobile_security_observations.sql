CREATE TABLE IF NOT EXISTS "mobile_security_observations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "security_id" uuid,
  "symbol" varchar(32) NOT NULL,
  "exchange" varchar(64) NOT NULL DEFAULT '',
  "currency" varchar(3) NOT NULL DEFAULT '',
  "name" varchar(240),
  "source" varchar(32) NOT NULL DEFAULT 'security-detail',
  "observation_count" integer NOT NULL DEFAULT 1,
  "last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "mobile_security_observations"
  ADD CONSTRAINT "mobile_security_observations_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "mobile_security_observations"
  ADD CONSTRAINT "mobile_security_observations_security_id_securities_id_fk"
  FOREIGN KEY ("security_id") REFERENCES "securities"("id")
  ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_security_observations_user_identity_idx"
  ON "mobile_security_observations"
  USING btree ("user_id", "symbol", "exchange", "currency");

CREATE INDEX IF NOT EXISTS "mobile_security_observations_user_recent_idx"
  ON "mobile_security_observations"
  USING btree ("user_id", "last_observed_at");

CREATE INDEX IF NOT EXISTS "mobile_security_observations_security_idx"
  ON "mobile_security_observations"
  USING btree ("security_id");
