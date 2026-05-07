import assert from "node:assert/strict";
import test from "node:test";
import {
  PORTFOLIO_ANALYZER_DISCLAIMER,
  PORTFOLIO_ANALYZER_VERSION,
  portfolioAnalyzerGptEnhancementRequestSchema,
  portfolioAnalyzerGptEnhancementSchema,
  portfolioAnalyzerRequestSchema,
  portfolioAnalyzerResultSchema
} from "@/lib/backend/portfolio-analyzer-contracts";
import { sanitizeGptEnhancementPayloadForTest } from "@/lib/backend/portfolio-analyzer-service";

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
      sourceMode: "local",
      freshnessLabel: "仅本地资料",
      reliabilityScore: 68,
      limitationSummary: "本结果只使用本地资料。"
    },
    evidenceTrail: [
      {
        id: "portfolio-data",
        label: "组合/持仓资料",
        sourceType: "portfolio-data",
        sourceMode: "local",
        confidence: "high",
        freshness: "fresh",
        asOf: generatedAt,
        detail: "来自项目内已保存的账户、持仓、偏好和组合配置。"
      },
      {
        id: "rule-engine",
        label: "Loo国规则引擎",
        sourceType: "derived",
        sourceMode: "derived",
        confidence: "medium",
        freshness: "fresh",
        asOf: generatedAt,
        detail: "由确定性规则生成。"
      }
    ],
    summary: {
      title: "AMZN 快速分析",
      thesis: "本轮只使用本地组合、行情缓存和推荐上下文生成结构化分析。",
      confidence: "medium"
    },
    securityDecision: {
      lens: "existing-holding-review",
      verdict: "review-existing",
      decisionLabel: "更适合持仓复核",
      confidenceScore: 72,
      directAnswer: "AMZN 适合先复核现有仓位，而不是无条件加仓。",
      primaryAction: {
        priority: "P0",
        label: "复核现有仓位",
        detail: "确认集中度、账户位置和目标配置。"
      },
      whyNow: ["当前组合已有 AMZN 暴露。"],
      portfolioFit: ["影响 US Equity 配置。"],
      keyBlockers: ["单一标的集中度需要确认。"],
      guardrails: [
        {
          id: "single-security-concentration",
          category: "duplicate-exposure",
          severity: "high",
          title: "单一标的权重偏高",
          detail: "AMZN 当前约占组合 18%，新增前应先复核集中度。",
          blocking: false,
          source: "portfolio-holdings"
        }
      ],
      fit: {
        score: 68,
        targetGapPct: 4,
        currentSleevePct: 56,
        targetPct: 60,
        heldWeightPct: 18,
        duplicateExposurePct: 18,
        accountFitScore: 73,
        taxFitScore: 62,
        fxFitScore: 58,
        liquidityFitScore: 70,
        summary: "组合适配分 68/100。",
        strengths: ["偏好因素整体匹配度较好。"],
        concerns: ["该标的/同身份持仓已有约 18%。"],
        accountNotes: ["当前匹配持仓账户：TFSA。"]
      },
      decisionGates: ["确认集中度。"],
      nextSteps: ["对比当前持仓权重。"],
      boundary: "本结果由确定性规则生成。",
      positionSizingIdea: "重点是复核现有仓位。",
      watchlistTriggers: ["刷新报价后再看。"],
      evidence: ["使用本地持仓和报价缓存。"],
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

test("portfolio analyzer GPT enhancement request preserves quick scan defaults", () => {
  const parsed = portfolioAnalyzerGptEnhancementRequestSchema.parse({
    scope: "security",
    security: { symbol: "VFV", exchange: "TSX", currency: "CAD" },
  });

  assert.equal(parsed.cacheStrategy, "prefer-cache");
  assert.equal(parsed.forceFreshBaseAnalysis, false);
});

test("portfolio analyzer GPT enhancement result requires non-advice disclaimer", () => {
  const parsed = portfolioAnalyzerGptEnhancementSchema.parse({
    generatedAt,
    title: "VFV GPT 增强解读",
    directAnswer: "VFV 可以作为候选观察，但仍要结合组合目标和数据新鲜度确认。",
    reasoning: ["它影响美股核心暴露。"],
    decisionGates: ["确认当前价格和目标配置缺口。"],
    boundary: "只基于智能快扫结果，没有实时新闻。",
    nextStep: "先刷新报价，再决定是否纳入观察。",
    sourceLabel: "GPT 增强解读 · 基于本地规则 + 缓存资料",
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER,
  });

  assert.equal(parsed.sourceLabel, "GPT 增强解读 · 基于本地规则 + 缓存资料");
});

test("portfolio analyzer GPT enhancement result rejects non-normalized provider dates", () => {
  const parsed = portfolioAnalyzerGptEnhancementSchema.safeParse({
    generatedAt: "2026-05-06",
    title: "VFV GPT 增强解读",
    directAnswer: "VFV 可以作为候选观察。",
    reasoning: ["它影响美股核心暴露。"],
    decisionGates: ["确认当前价格。"],
    boundary: null,
    nextStep: null,
    sourceLabel: "GPT 增强解读 · 基于本地规则 + 缓存资料",
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER,
  });

  assert.equal(parsed.success, false);
});

test("portfolio analyzer GPT enhancement sanitizer clamps provider arrays", () => {
  const normalized = sanitizeGptEnhancementPayloadForTest({
    generatedAt: "2026-05-06",
    title: "VFV GPT 增强解读",
    directAnswer: "VFV 可以作为候选观察。",
    reasoning: [
      "理由 1",
      "理由 2",
      "理由 3",
      "理由 4",
      "理由 5",
      "理由 6",
      "理由 7",
    ],
    decisionGates: "确认报价。\n确认账户。\n确认现金。",
    boundary: "只基于智能快扫结果。",
    nextStep: "刷新报价后再复核。",
    sourceLabel: "GPT 增强解读 · 基于本地规则 + 缓存资料",
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER,
  });

  const parsed = portfolioAnalyzerGptEnhancementSchema.parse(normalized);

  assert.equal(parsed.reasoning.length, 6);
  assert.deepEqual(parsed.decisionGates, [
    "确认报价。",
    "确认账户。",
    "确认现金。",
  ]);
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

test("portfolio analyzer result accepts security-specific decision structure", () => {
  const parsed = portfolioAnalyzerResultSchema.parse(makeResult());

  assert.equal(parsed.securityDecision?.verdict, "review-existing");
  assert.ok(parsed.securityDecision?.keyBlockers.includes("单一标的集中度需要确认。"));
  assert.equal(parsed.securityDecision?.guardrails[0]?.category, "duplicate-exposure");
  assert.equal(parsed.securityDecision?.fit?.score, 68);
  assert.equal(parsed.dataFreshness.reliabilityScore, 68);
  assert.equal(parsed.evidenceTrail?.[0]?.label, "组合/持仓资料");
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
