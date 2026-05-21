CREATE TABLE IF NOT EXISTS "external_service_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "service" varchar(64) NOT NULL,
  "client_id" varchar(240),
  "encrypted_secret" text,
  "secret_iv" varchar(64),
  "secret_auth_tag" varchar(64),
  "secret_last4" varchar(8),
  "secret_updated_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_service_credentials_user_service_idx"
  ON "external_service_credentials" ("user_id", "service");
