ALTER TABLE "external_research_documents"
  ALTER COLUMN "user_id" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "external_research_documents_global_provider_doc_idx"
  ON "external_research_documents" ("provider_id", "provider_document_id")
  WHERE "user_id" IS NULL;

CREATE INDEX IF NOT EXISTS "external_research_documents_global_news_expires_idx"
  ON "external_research_documents" ("expires_at")
  WHERE "user_id" IS NULL AND "source_type" = 'news';
