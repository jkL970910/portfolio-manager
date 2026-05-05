ALTER TABLE "market_sentiment_snapshots"
  ADD COLUMN IF NOT EXISTS "fgi_score" integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "fgi_level" varchar(24) NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS "vix_value" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "vix_level" varchar(24),
  ADD COLUMN IF NOT EXISTS "quadrant" varchar(4),
  ADD COLUMN IF NOT EXISTS "quadrant_label" varchar(120),
  ADD COLUMN IF NOT EXISTS "strategy_label" varchar(120) NOT NULL DEFAULT '中性定投',
  ADD COLUMN IF NOT EXISTS "strategy_detail" text NOT NULL DEFAULT '按计划执行，市场情绪只作为节奏参考。';
