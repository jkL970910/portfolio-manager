import assert from "node:assert/strict";
import test from "node:test";
import {
  PORTFOLIO_ANALYZER_DISCLAIMER,
  PORTFOLIO_ANALYZER_VERSION,
  portfolioAnalyzerRequestSchema,
  portfolioAnalyzerResultSchema
} from "@/lib/backend/portfolio-analyzer-contracts";

const generatedAt = "2026-04-28T04:00:00.000Z";

function makeResult(overrides: Record<string, unknown> = {}) {
  return {
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: "security",
    mode: "quick",
    generatedAt,
    identity: {
      symbol: "AMZN",
      exchange: "NASDAQ",
      currency: "USD",
      name: "Amazon.com",
      securityType: "Common Stock"
    },
    dataFreshness: {
      portfolioAsOf: generatedAt,
      quotesAsOf: generatedAt,
      externalResearchAsOf: null,
      sourceMode: "local"
    },
    summary: {
      title: "AMZN 快速分析",
      thesis: "本轮只使用本地组合、行情缓存和推荐上下文生成结构化分析。",
      confidence: "medium"
    },
    scorecards: [
      {
        id: "portfolio-fit",
        label: "组合适配",
        score: 72,
        rationale: "按当前持仓和目标配置判断，适配度中等。"
      }
    ],
    risks: [
      {
        severity: "medium",
        title: "币种暴露",
        detail: "该标的是 USD 交易，展示层需要转换为 CAD。"
      }
    ],
    taxNotes: ["RRSP/TFSA 的税务处理需要按账户类型分别展示。"],
    portfolioFit: ["该分析必须保留 symbol、exchange 和 currency。"],
    actionItems: [
      {
        priority: "P1",
        title: "检查账户位置",
        detail: "确认该标的是否放在最适合的账户类型中。"
      }
    ],
    sources: [
      {
        title: "Local portfolio data",
        sourceType: "portfolio-data"
      }
    ],
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER,
    ...overrides
  };
}

test("portfolio analyzer request preserves symbol, exchange, and currency identity", () => {
  const usdCommon = portfolioAnalyzerRequestSchema.parse({
    scope: "security",
    security: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" }
  });
  const cadListed = portfolioAnalyzerRequestSchema.parse({
    scope: "security",
    security: { symbol: "AMZN", exchange: "NEO", currency: "CAD" }
  });

  assert.equal(usdCommon.security?.symbol, cadListed.security?.symbol);
  assert.notDeepEqual(usdCommon.security, cadListed.security);
});

test("portfolio analyzer request defaults to bounded cache reuse", () => {
  const parsed = portfolioAnalyzerRequestSchema.parse({
    scope: "portfolio"
  });

  assert.equal(parsed.cacheStrategy, "prefer-cache");
  assert.equal(parsed.maxCacheAgeSeconds, 900);
  assert.equal(parsed.includeExternalResearch, false);
});

test("portfolio analyzer request rejects security scope without identity or holding id", () => {
  const parsed = portfolioAnalyzerRequestSchema.safeParse({
    scope: "security"
  });

  assert.equal(parsed.success, false);
});

test("portfolio analyzer request requires recommendation run id for run analysis", () => {
  const parsed = portfolioAnalyzerRequestSchema.safeParse({
    scope: "recommendation-run"
  });

  assert.equal(parsed.success, false);
});

test("portfolio analyzer request requires account id for account analysis", () => {
  const parsed = portfolioAnalyzerRequestSchema.safeParse({
    scope: "account"
  });

  assert.equal(parsed.success, false);
});

test("portfolio analyzer result requires disclaimer and local freshness honesty", () => {
  const parsed = portfolioAnalyzerResultSchema.safeParse(makeResult());

  assert.equal(parsed.success, true);
});

test("portfolio analyzer result rejects missing non-advice disclaimer", () => {
  const parsed = portfolioAnalyzerResultSchema.safeParse(makeResult({
    disclaimer: {
      zh: "仅供参考。",
      en: "For reference only."
    }
  }));

  assert.equal(parsed.success, false);
});

test("portfolio analyzer local result cannot claim external research freshness", () => {
  const parsed = portfolioAnalyzerResultSchema.safeParse(makeResult({
    dataFreshness: {
      portfolioAsOf: generatedAt,
      quotesAsOf: generatedAt,
      externalResearchAsOf: generatedAt,
      sourceMode: "local"
    }
  }));

  assert.equal(parsed.success, false);
});
