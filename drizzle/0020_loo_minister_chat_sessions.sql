CREATE TABLE IF NOT EXISTS "loo_minister_chat_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" varchar(160) NOT NULL,
  "page" varchar(40) NOT NULL,
  "page_context_json" jsonb NOT NULL,
  "summary" text,
  "message_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loo_minister_chat_sessions_user_updated_idx"
ON "loo_minister_chat_sessions" ("user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "loo_minister_chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "loo_minister_chat_sessions"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "role" varchar(16) NOT NULL,
  "content" text NOT NULL,
  "page_context_json" jsonb,
  "answer_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loo_minister_chat_messages_session_created_idx"
ON "loo_minister_chat_messages" ("session_id", "created_at");

CREATE INDEX IF NOT EXISTS "loo_minister_chat_messages_user_created_idx"
ON "loo_minister_chat_messages" ("user_id", "created_at");
