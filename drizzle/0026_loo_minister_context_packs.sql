CREATE TABLE IF NOT EXISTS "loo_minister_context_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pack_key" varchar(360) NOT NULL,
  "pack_kind" varchar(40) NOT NULL,
  "payload_json" jsonb NOT NULL,
  "as_of" timestamp with time zone NOT NULL,
  "built_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "loo_minister_context_packs_key_idx"
  ON "loo_minister_context_packs" ("pack_key");

CREATE INDEX IF NOT EXISTS "loo_minister_context_packs_kind_expires_idx"
  ON "loo_minister_context_packs" ("pack_kind", "expires_at");

CREATE INDEX IF NOT EXISTS "loo_minister_context_packs_expires_idx"
  ON "loo_minister_context_packs" ("expires_at");
