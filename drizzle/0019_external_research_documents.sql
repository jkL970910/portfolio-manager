CREATE TABLE IF NOT EXISTS "external_research_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "provider_document_id" varchar(160) NOT NULL,
  "source_type" varchar(32) NOT NULL,
  "provider_id" varchar(64) NOT NULL,
  "source_name" varchar(120) NOT NULL,
  "title" varchar(240) NOT NULL,
  "summary" text NOT NULL,
  "url" text,
  "published_at" timestamp with time zone,
  "captured_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "language" varchar(16) DEFAULT 'unknown' NOT NULL,
  "security_id" uuid REFERENCES "securities"("id"),
  "symbol" varchar(32),
  "exchange" varchar(64),
  "currency" varchar(3),
  "security_name" varchar(160),
  "security_provider" varchar(64),
  "security_type" varchar(64),
  "underlying_id" varchar(120),
  "confidence" varchar(16) NOT NULL,
  "sentiment" varchar(16) NOT NULL,
  "relevance_score" integer NOT NULL,
  "source_reliability" integer NOT NULL,
  "key_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_research_documents_provider_doc_idx"
ON "external_research_documents" ("user_id", "provider_id", "provider_document_id");

CREATE INDEX IF NOT EXISTS "external_research_documents_user_expires_idx"
ON "external_research_documents" ("user_id", "expires_at");

CREATE INDEX IF NOT EXISTS "external_research_documents_security_idx"
ON "external_research_documents" ("security_id");

CREATE INDEX IF NOT EXISTS "external_research_documents_identity_idx"
ON "external_research_documents" ("symbol", "exchange", "currency");

CREATE INDEX IF NOT EXISTS "external_research_documents_underlying_idx"
ON "external_research_documents" ("underlying_id");
