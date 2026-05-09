import assert from "node:assert/strict";
import test from "node:test";
import type {
  ExternalResearchDocumentRecord,
  HoldingPosition,
  InvestmentAccount,
  MarketSentimentSnapshot,
  PreferenceProfile,
  RecommendationRun,
  SecurityPriceHistoryPoint
} from "@/lib/backend/models";
import { DEFAULT_PREFERENCE_FACTORS } from "@/lib/backend/preference-factors";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";
import {
  buildAccountAnalyzerQuickScan,
  buildPortfolioAnalyzerQuickScan,
  buildRecommendationRunAnalyzerQuickScan,
  buildSecurityAnalyzerQuickScan
} from "@/lib/backend/portfolio-analyzer";
import {
  buildPortfolioAnalyzerCacheKey,
  isAnalyzerCacheOlderThanMarketData
} from "@/lib/backend/portfolio-analyzer-service";

const generatedAt = "2026-04-28T04:00:00.000Z";

function makeExternalResearchDocument(
  overrides: Partial<ExternalResearchDocumentRecord> = {},
): ExternalResearchDocumentRecord {
  return {
    id: "external_doc_test",
    userId: "user_test",
    providerDocumentId: "alpha-vantage-profile:security_tsm_us:2026-04-28",
    sourceType: "institutional",
    providerId: "alpha-vantage-profile",
    sourceName: "Alpha Vantage 标的资料",
    title: "TSM 基本资料快照",
    summary: "市盈率：24.5；分析师目标价：215；52周区间：120 - 205",
    url: null,
    publishedAt: "2026-03-31T00:00:00.000Z",
    capturedAt: generatedAt,
    expiresAt: "2026-04-29T04:00:00.000Z",
    language: "zh",
    security: {
      securityId: "security_tsm_us",
      symbol: "TSM",
      exchange: "NYSE",
      currency: "USD",
      name: "Taiwan Semiconductor Manufacturing",
      provider: "alpha-vantage-profile",
      securityType: "Common Stock",
    },
    underlyingId: null,
    confidence: "high",
    sentiment: "neutral",
    relevanceScore: 82,
    sourceReliability: 76,
    keyPoints: [
      "资产类型：Common Stock",
      "行业板块：Technology",
      "市盈率：24.5",
      "分析师目标价：215",
      "52周区间：120 - 205",
      "市值：950000000000",
    ],
    riskFlags: [],
    tags: ["profile", "alpha-vantage"],
    rawPayload: {},
    createdAt: generatedAt,
    updatedAt: generatedAt,
    ...overrides,
  };
}

function makeMarketSentimentSnapshot(
  overrides: Partial<MarketSentimentSnapshot> = {},
): MarketSentimentSnapshot {
  return {
    id: "sentiment_test",
    provider: "loo-market-pulse-vix-live",
    indexName: "US Market Pulse",
    score: 32,
    rating: "fear",
    fgiScore: 28,
    fgiLevel: "fear",
    vixValue: 24.6,
    vixLevel: "normal",
    quadrant: "D",
    quadrantLabel: "恐惧 + 正常波动",
    strategyLabel: "分批优先",
    strategyDetail: "市场偏恐惧但波动未失控，适合小额分批而不是一次性重仓。",
    asOf: generatedAt,
    sourceMode: "cached-external",
    sourceUrl: "https://www.cnn.com/markets/fear-and-greed",
    components: [
      {
        id: "fgi",
        label: "CNN FGI",
        score: 28,
        detail: "恐惧区间。",
      },
      {
        id: "vix",
        label: "VIX 波动率",
        score: 45,
        detail: "正常波动。",
      },
    ],
    summary: "市场偏恐惧。",
    buySignal: "accumulate",
    riskNote: "市场脉搏只作为低权重 timing 参考。",
    rawPayload: {},
    expiresAt: "2026-04-29T04:00:00.000Z",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    ...overrides,
  };
}

const accounts: InvestmentAccount[] = [
  {
    id: "acct_tfsa",
    userId: "user_test",
    institution: "Test Broker",
    type: "TFSA",
    nickname: "TFSA",
    currency: "CAD",
    marketValueCad: 70000,
    contributionRoomCad: 10000
  },
  {
    id: "acct_rrsp",
    userId: "user_test",
    institution: "Test Broker",
    type: "RRSP",
    nickname: "RRSP",
    currency: "USD",
    marketValueCad: 30000,
    contributionRoomCad: 5000
  }
];

const holdings: HoldingPosition[] = [
  {
    id: "holding_us_amzn",
    securityId: "security_amzn_us",
    userId: "user_test",
    accountId: "acct_tfsa",
    symbol: "AMZN",
    name: "Amazon.com",
    assetClass: "US Equity",
    sector: "Consumer Discretionary",
    currency: "USD",
    securityTypeOverride: "Common Stock",
    exchangeOverride: "NASDAQ",
    marketValueCad: 18000,
    lastPriceAmount: 180,
    quoteProvider: "twelve-data",
    quoteSourceMode: "cached-external",
    quoteStatus: "success",
    lastQuoteSuccessAt: generatedAt,
    weightPct: 18,
    gainLossPct: 6,
    updatedAt: generatedAt
  },
  {
    id: "holding_cad_amzn",
    securityId: "security_amzn_cad",
    userId: "user_test",
    accountId: "acct_rrsp",
    symbol: "AMZN",
    name: "Amazon CDR",
    assetClass: "US Equity",
    sector: "Consumer Discretionary",
    currency: "CAD",
    securityTypeOverride: "Common Stock",
    exchangeOverride: "NEO",
    marketValueCad: 2000,
    quoteProvider: "yahoo-finance",
    quoteSourceMode: "cached-external",
    quoteStatus: "success",
    lastQuoteSuccessAt: generatedAt,
    weightPct: 2,
    gainLossPct: 1,
    updatedAt: generatedAt
  },
  {
    id: "holding_xef",
    userId: "user_test",
    accountId: "acct_tfsa",
    symbol: "XEF",
    name: "iShares Core MSCI EAFE IMI Index ETF",
    assetClass: "International Equity",
    sector: "Diversified",
    currency: "CAD",
    securityTypeOverride: "ETF",
    exchangeOverride: "TSX",
    marketValueCad: 20000,
    weightPct: 20,
    gainLossPct: 3,
    updatedAt: generatedAt
  }
];

const priceHistory: SecurityPriceHistoryPoint[] = [
  {
    id: "history_us_amzn",
    securityId: "security_amzn_us",
    symbol: "AMZN",
    exchange: "NASDAQ",
    priceDate: "2026-04-27",
    close: 180,
    adjustedClose: 180,
    currency: "USD",
    source: "provider",
    provider: "twelve-data",
    sourceMode: "cached-external",
    freshness: "fresh",
    refreshRunId: "run_1",
    isReference: false,
    fallbackReason: null,
    createdAt: generatedAt
  },
  {
    id: "history_cad_amzn",
    securityId: "security_amzn_cad",
    symbol: "AMZN",
    exchange: "NEO",
    priceDate: "2026-04-27",
    close: 30,
    adjustedClose: 30,
    currency: "CAD",
    source: "provider",
    provider: "yahoo-finance",
    sourceMode: "cached-external",
    freshness: "fresh",
    refreshRunId: "run_1",
    isReference: false,
    fallbackReason: null,
    createdAt: generatedAt
  }
];

function makeProfile(overrides: Partial<PreferenceProfile> = {}): PreferenceProfile {
  return {
    id: "pref_test",
    userId: "user_test",
    riskProfile: "Growth",
    targetAllocation: [
      { assetClass: "Canadian Equity", targetPct: 10 },
      { assetClass: "US Equity", targetPct: 60 },
      { assetClass: "International Equity", targetPct: 20 },
      { assetClass: "Fixed Income", targetPct: 5 },
      { assetClass: "Cash", targetPct: 5 }
    ],
    accountFundingPriority: ["TFSA", "RRSP", "Taxable"],
    taxAwarePlacement: true,
    cashBufferTargetCad: 10000,
    transitionPreference: "gradual",
    recommendationStrategy: "balanced",
    source: "manual",
    rebalancingTolerancePct: 5,
    watchlistSymbols: [],
    recommendationConstraints: DEFAULT_RECOMMENDATION_CONSTRAINTS,
    preferenceFactors: DEFAULT_PREFERENCE_FACTORS,
    ...overrides
  };
}

test("security analyzer quick scan matches by full identity, not ticker alone", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_amzn_cad",
      symbol: "AMZN",
      exchange: "NEO",
      currency: "CAD",
      name: "Amazon CDR"
    },
    accounts,
    holdings,
    profile: makeProfile(),
    generatedAt
  });

  assert.equal(result.identity?.symbol, "AMZN");
  assert.equal(result.identity?.exchange, "NEO");
  assert.equal(result.identity?.currency, "CAD");
  assert.match(result.summary.thesis, /2%/);
  assert.ok(result.portfolioFit.some((item) => item.includes("symbol、exchange、currency")));
});

test("security analyzer quick scan consumes cached market data by identity", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_amzn_cad",
      symbol: "AMZN",
      exchange: "NEO",
      currency: "CAD",
      name: "Amazon CDR"
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: { priceHistory },
    generatedAt
  });

  assert.equal(result.dataFreshness.sourceMode, "cached-external");
  assert.equal(result.dataFreshness.priceHistoryPointCount, 1);
  assert.match(result.dataFreshness.quoteSourceSummary ?? "", /Yahoo Finance/);
  assert.ok(
    result.sources.some((source) =>
      source.title.includes("缓存价格历史")
    )
  );
  assert.ok(
    result.scorecards.some((card) => card.id === "market-data-freshness")
  );
  assert.ok(
    (result.scorecards.find((card) => card.id === "market-data-freshness")
      ?.score ?? 0) > 45
  );
});

test("security analyzer quick scan separates listing identity from economic exposure", () => {
  const zqqHolding: HoldingPosition = {
    id: "holding_zqq",
    securityId: "security_zqq_cad",
    userId: "user_test",
    accountId: "acct_tfsa",
    symbol: "ZQQ",
    name: "BMO Nasdaq 100 Equity Hedged to CAD Index ETF",
    assetClass: "Canadian Equity",
    sector: "Technology",
    currency: "CAD",
    securityTypeOverride: "ETF",
    exchangeOverride: "TSX",
    marketValueCad: 17200,
    quoteProvider: "yahoo-finance",
    quoteSourceMode: "cached-external",
    quoteStatus: "success",
    lastQuoteSuccessAt: generatedAt,
    weightPct: 17.2,
    gainLossPct: 4,
    updatedAt: generatedAt,
  };
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_zqq_cad",
      symbol: "ZQQ",
      exchange: "TSX",
      currency: "CAD",
      name: "BMO Nasdaq 100 Equity Hedged to CAD Index ETF",
    },
    accounts,
    holdings: [...holdings, zqqHolding],
    profile: makeProfile(),
    marketData: {
      priceHistory: [
        {
          ...priceHistory[1]!,
          id: "history_zqq_tsx",
          securityId: "security_zqq_cad",
          symbol: "ZQQ",
          exchange: "TSX",
          currency: "CAD",
          provider: "yahoo-finance",
          source: "quote-refresh-yahoo-finance",
        },
      ],
    },
    generatedAt,
  });

  const targetFit = result.scorecards.find((card) => card.id === "target-fit");
  assert.match(targetFit?.rationale ?? "", /底层经济暴露按 US Equity/);
  assert.match(targetFit?.rationale ?? "", /目标约 60%/);
  assert.ok(
    result.portfolioFit.some((item) =>
      item.includes("交易身份仍保留 ZQQ · TSX · CAD"),
    ),
  );
});

test("security analyzer quick scan treats CGL.C as precious metals exposure", () => {
  const cglHolding: HoldingPosition = {
    id: "holding_cgl",
    securityId: "security_cgl_cad",
    userId: "user_test",
    accountId: "acct_tfsa",
    symbol: "CGL.C",
    name: "iShares Gold Bullion ETF",
    assetClass: "Canadian Equity",
    sector: "Materials",
    currency: "CAD",
    securityTypeOverride: "Commodity ETF",
    exchangeOverride: "TSX",
    marketValueCad: 1600,
    quoteProvider: "yahoo-finance",
    quoteSourceMode: "cached-external",
    quoteStatus: "success",
    lastQuoteSuccessAt: generatedAt,
    weightPct: 1.6,
    gainLossPct: 0,
    updatedAt: generatedAt,
  };
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_cgl_cad",
      symbol: "CGL.C",
      exchange: "TSX",
      currency: "CAD",
      name: "iShares Gold Bullion ETF",
      securityType: "Commodity ETF",
    },
    accounts,
    holdings: [...holdings, cglHolding],
    profile: makeProfile(),
    marketData: {
      priceHistory: [
        {
          ...priceHistory[1]!,
          id: "history_cgl_tsx",
          securityId: "security_cgl_cad",
          symbol: "CGL.C",
          exchange: "TSX",
          currency: "CAD",
          provider: "yahoo-finance",
          source: "quote-refresh-yahoo-finance",
        },
      ],
    },
    generatedAt,
  });

  const targetFit = result.scorecards.find((card) => card.id === "target-fit");
  assert.match(targetFit?.rationale ?? "", /底层经济暴露按 Commodity/);
  assert.doesNotMatch(targetFit?.rationale ?? "", /加拿大股票整体配置|Canadian Equity/);
  assert.ok(
    result.portfolioFit.some((item) =>
      item.includes("不是按 Canadian Equity 或交易币种简单归类"),
    ),
  );
});

test("security analyzer quick scan returns reader-friendly market data wording", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_amzn_cad",
      symbol: "AMZN",
      exchange: "NEO",
      currency: "CAD",
      name: "Amazon CDR",
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: { priceHistory },
    generatedAt,
  });
  const rendered = JSON.stringify(result);

  assert.match(result.dataFreshness.quoteSourceSummary ?? "", /报价来自/);
  assert.match(result.dataFreshness.quoteFreshnessSummary ?? "", /报价较新/);
  assert.doesNotMatch(rendered, /quoteStatus=/);
  assert.doesNotMatch(rendered, /historyAsOf=/);
  assert.doesNotMatch(rendered, /historyPoints=/);
  assert.doesNotMatch(rendered, /Cached holding quotes/);
});

test("security analyzer quick scan shows conclusions instead of identity check when identity is complete", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_amzn_cad",
      symbol: "AMZN",
      exchange: "NEO",
      currency: "CAD",
      name: "Amazon CDR",
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: { priceHistory },
    generatedAt,
  });

  assert.equal(
    result.actionItems.some((item) => item.title === "确认标的身份"),
    false,
  );
  assert.ok(
    result.actionItems.some(
      (item) => item.title === "当前判断" || item.title === "买入前确认" || item.title === "评估集中度",
    ),
  );
});

test("security analyzer quick scan evaluates unheld candidates with portfolio target context", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_tsm_us",
      symbol: "TSM",
      exchange: "NYSE",
      currency: "USD",
      name: "Taiwan Semiconductor Manufacturing Company",
      securityType: "Common Stock",
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: {
      priceHistory: Array.from({ length: 5 }, (_, index) => ({
          id: `history_tsm_us_${index}`,
          securityId: "security_tsm_us",
          symbol: "TSM",
          exchange: "NYSE",
          priceDate: `2026-04-${String(index + 23).padStart(2, "0")}`,
          close: 176 + index,
          adjustedClose: 176 + index,
          currency: "USD",
          source: "provider",
          provider: "twelve-data",
          sourceMode: "cached-external",
          freshness: "fresh",
          refreshRunId: "run_tsm",
          isReference: false,
          fallbackReason: null,
          createdAt: generatedAt,
        })),
    },
    generatedAt,
  });

  const targetFit = result.scorecards.find((card) => card.id === "target-fit");
  assert.ok((targetFit?.score ?? 0) >= 65);
  assert.match(targetFit?.rationale ?? "", /未持有候选标的/);
  assert.match(targetFit?.rationale ?? "", /US Equity/);
  assert.match(targetFit?.rationale ?? "", /目标约 60%/);
  assert.doesNotMatch(targetFit?.rationale ?? "", /没有足够.*持仓上下文/);
  assert.match(result.summary.thesis, /新增候选标的/);
  assert.match(result.summary.thesis, /可以进入候选观察|可继续观察|适合先观察/);
  assert.ok(
    result.scorecards.some((card) => card.id === "preference-fit"),
  );
  assert.ok(
    result.portfolioFit.some((item) =>
      item.includes("当前 0% 只代表尚未持有，不代表无法分析"),
    ),
  );
  assert.ok(
    result.actionItems.some((item) => item.title === "当前判断"),
  );
  assert.ok(
    result.actionItems.some((item) => item.title === "买入前确认"),
  );
  assert.equal(result.securityDecision?.lens, "candidate-new-buy");
  assert.ok((result.securityDecision?.fit?.score ?? 0) >= 65);
  assert.equal(result.securityDecision?.fit?.targetPct, 60);
  assert.ok((result.securityDecision?.fit?.targetGapPct ?? 0) > 0);
  assert.ok(result.securityDecision?.directAnswer.includes("候选观察"));
  assert.ok(result.securityDecision?.whyNow.some((item) => item.includes("目标约 60%")));
  assert.equal(result.securityResearchDecision?.version, "security-research-v1");
  assert.equal(result.securityResearchDecision?.security.assetType, "stock");
  assert.equal(result.securityResearchDecision?.valuationEvidence.method, "unavailable");
  assert.ok(
    result.securityResearchDecision?.valuationEvidence.summary.includes("不声称已完成 DCF"),
  );
  assert.ok(
    (result.securityResearchDecision?.entryTiming.keyLevels.length ?? 0) >= 1,
  );
});

test("security research decision uses cached valuation evidence for stock candidates", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_tsm_us",
      symbol: "TSM",
      exchange: "NYSE",
      currency: "USD",
      name: "Taiwan Semiconductor Manufacturing Company",
      securityType: "Common Stock",
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: {
      priceHistory: [
        {
          id: "history_tsm_us",
          securityId: "security_tsm_us",
          symbol: "TSM",
          exchange: "NYSE",
          priceDate: "2026-04-27",
          close: 180,
          adjustedClose: 180,
          currency: "USD",
          source: "provider",
          provider: "twelve-data",
          sourceMode: "cached-external",
          freshness: "fresh",
          refreshRunId: "run_tsm",
          isReference: false,
          fallbackReason: null,
          createdAt: generatedAt,
        },
      ],
    },
    valuationDocuments: [makeExternalResearchDocument()],
    generatedAt,
  });

  assert.equal(result.dataFreshness.externalResearchAsOf, generatedAt);
  assert.equal(result.securityResearchDecision?.valuationEvidence.method, "analyst_consensus");
  assert.equal(result.securityResearchDecision?.valuationEvidence.confidence, "high");
  assert.ok(
    result.securityResearchDecision?.valuationEvidence.anchors.some(
      (anchor) => anchor.label === "分析师目标价" && anchor.value === "215",
    ),
  );
  assert.ok(
    result.securityResearchDecision?.entryTiming.keyLevels.some(
      (level) => level.label === "分析师目标价" && level.type === "VALUATION_ANCHOR",
    ),
  );
  assert.equal(result.securityResearchDecision?.actionPlans[0]?.type, "value_pullback");
  assert.equal(result.securityResearchDecision?.actionPlans[0]?.status, "wait");
  assert.ok(
    result.securityResearchDecision?.actionPlans[0]?.evidenceLabels.includes("分析师目标价"),
  );
  assert.ok(
    result.securityResearchDecision?.valuationEvidence.summary.includes("不等同于自动 DCF"),
  );
  assert.ok(
    result.sources.some((source) => source.title.includes("Alpha Vantage 标的资料")),
  );
});

test("security research decision routes ETF candidates through macro proxy", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_vfv_cad",
      symbol: "VFV",
      exchange: "TSX",
      currency: "CAD",
      name: "Vanguard S&P 500 Index ETF",
      securityType: "ETF",
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: {
      priceHistory: Array.from({ length: 25 }, (_, index) => ({
        id: `history_vfv_cad_${index}`,
        securityId: "security_vfv_cad",
        symbol: "VFV",
        exchange: "TSX",
        priceDate: `2026-04-${String(index + 1).padStart(2, "0")}`,
        close: 145 + index * 0.4,
        adjustedClose: 145 + index * 0.4,
        currency: "CAD" as const,
        source: "provider",
        provider: "yahoo-finance",
        sourceMode: "cached-external",
        freshness: "fresh",
        refreshRunId: "run_vfv",
        isReference: false,
        fallbackReason: null,
        createdAt: generatedAt,
      })),
    },
    valuationDocuments: [
      makeExternalResearchDocument({
        id: "external_doc_vfv",
        providerDocumentId: "alpha-vantage-profile:security_vfv_cad:2026-04-28",
        title: "VFV 基本资料快照",
        summary: "费用率：0.09；分红/收益率：0.011；52周区间：112 - 148",
        security: {
          securityId: "security_vfv_cad",
          symbol: "VFV",
          exchange: "TSX",
          currency: "CAD",
          name: "Vanguard S&P 500 Index ETF",
          provider: "alpha-vantage-profile",
          securityType: "ETF",
        },
        keyPoints: [
          "资产类型：ETF",
          "费用率：0.09",
          "分红/收益率：0.011",
          "52周区间：112 - 148",
        ],
      }),
    ],
    marketSentiment: makeMarketSentimentSnapshot(),
    generatedAt,
  });

  assert.equal(result.securityResearchDecision?.security.assetType, "etf");
  assert.equal(result.securityResearchDecision?.valuationEvidence.method, "etf_macro_proxy");
  assert.ok(
    result.securityResearchDecision?.valuationEvidence.anchors.some((anchor) =>
      anchor.label === "费用率",
    ),
  );
  assert.ok(
    result.securityResearchDecision?.valuationEvidence.anchors.some((anchor) =>
      anchor.label === "市场脉搏" && anchor.value.includes("FGI 28/100"),
    ),
  );
  assert.ok(
    result.securityResearchDecision?.valuationEvidence.summary.includes("分批优先"),
  );
  assert.ok(
    result.securityResearchDecision?.entryTiming.keyLevels.some((level) =>
      level.label === "市场脉搏",
    ),
  );
  assert.ok(
    result.securityResearchDecision?.actionPlans[0]?.detail.includes("小额分批"),
  );
  assert.equal(result.securityResearchDecision?.actionPlans[0]?.status, "ready");
  assert.ok(
    result.securityResearchDecision?.actionPlans[0]?.evidenceLabels.includes("市场脉搏"),
  );
  assert.ok(
    result.securityResearchDecision?.valuationEvidence.sanityChecks.some((check) =>
      check.detail.includes("不应直接套用单公司 DCF"),
    ),
  );
  assert.equal(result.securityResearchDecision?.actionPlans[0]?.type, "dca_accumulate");
  assert.ok(
    result.securityResearchDecision?.entryTiming.keyLevels.some((level) =>
      level.label === "52周/样本高点",
    ),
  );
});

test("security analyzer quick scan asks for identity repair only when listing fields are missing", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      symbol: "AMZN",
      name: "Amazon",
    },
    accounts,
    holdings,
    profile: makeProfile(),
    generatedAt,
  });

  assert.equal(result.actionItems[0]?.title, "补全交易身份");
  assert.match(result.actionItems[0]?.detail ?? "", /symbol、exchange、currency/);
});

test("security analyzer quick scan surfaces preference blockers before overconfident buy language", () => {
  const cautiousProfile = makeProfile({
    preferenceFactors: {
      ...DEFAULT_PREFERENCE_FACTORS,
      behavior: {
        ...DEFAULT_PREFERENCE_FACTORS.behavior,
        riskCapacity: "low",
      },
      sectorTilts: {
        ...DEFAULT_PREFERENCE_FACTORS.sectorTilts,
        avoidedSectors: ["Technology"],
      },
      lifeGoals: {
        ...DEFAULT_PREFERENCE_FACTORS.lifeGoals,
        homePurchase: {
          enabled: true,
          horizonYears: 2,
          downPaymentTargetCad: 120000,
          priority: "high",
        },
      },
      taxStrategy: {
        ...DEFAULT_PREFERENCE_FACTORS.taxStrategy,
        usdFundingPath: "avoid",
      },
    },
  });

  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_tsm_us",
      symbol: "TSM",
      exchange: "NYSE",
      currency: "USD",
      name: "Taiwan Semiconductor Manufacturing Company",
      securityType: "Common Stock",
    },
    accounts,
    holdings,
    profile: cautiousProfile,
    marketData: {
      priceHistory: [
        {
          id: "history_tsm_us",
          securityId: "security_tsm_us",
          symbol: "TSM",
          exchange: "NYSE",
          priceDate: "2026-04-27",
          close: 180,
          adjustedClose: 180,
          currency: "USD",
          source: "provider",
          provider: "twelve-data",
          sourceMode: "cached-external",
          freshness: "fresh",
          refreshRunId: "run_tsm",
          isReference: false,
          fallbackReason: null,
          createdAt: generatedAt,
        },
      ],
    },
    generatedAt,
  });

  assert.match(result.summary.thesis, /但暂时不应只因为配置缺口就直接加仓/);
  assert.ok(result.risks.some((risk) => risk.title === "偏好护栏"));
  assert.match(JSON.stringify(result), /规避列表|买房目标|风险容量偏低|USD 路径/);
  assert.equal(result.securityDecision?.verdict, "needs-more-data");
  assert.ok(
    (result.securityDecision?.keyBlockers ?? []).some((item) =>
      /规避列表|买房目标|风险容量偏低|USD 路径/.test(item),
    ),
  );
});

test("security research decision keeps key levels visible when portfolio guardrails dominate", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_tsm_us",
      symbol: "TSM",
      exchange: "NYSE",
      currency: "USD",
      name: "Taiwan Semiconductor Manufacturing Company",
      securityType: "Common Stock",
    },
    accounts,
    holdings: [
      {
        ...holdings[0],
        id: "holding_tsm_us",
        securityId: "security_tsm_us",
        symbol: "TSM",
        name: "Taiwan Semiconductor Manufacturing Company",
        assetClass: "US Equity",
        sector: "Technology",
        exchangeOverride: "NYSE",
        currency: "USD",
        marketValueCad: 12000,
        weightPct: 12,
      },
      holdings[2]!,
    ],
    profile: makeProfile({
      targetAllocation: [
        { assetClass: "Canadian Equity", targetPct: 20 },
        { assetClass: "US Equity", targetPct: 5 },
        { assetClass: "International Equity", targetPct: 20 },
        { assetClass: "Fixed Income", targetPct: 25 },
        { assetClass: "Cash", targetPct: 10 },
      ],
    }),
    marketData: {
      priceHistory: Array.from({ length: 5 }, (_, index) => ({
        id: `history_tsm_us_${index}`,
        securityId: "security_tsm_us",
        symbol: "TSM",
        exchange: "NYSE",
        priceDate: `2026-04-${23 + index}`,
        close: 176 + index,
        adjustedClose: 176 + index,
        currency: "USD",
        source: "provider",
        provider: "twelve-data",
        sourceMode: "cached-external" as const,
        freshness: "fresh" as const,
        refreshRunId: "run_tsm",
        isReference: false,
        fallbackReason: null,
        createdAt: generatedAt,
      })),
    },
    valuationDocuments: [makeExternalResearchDocument()],
    generatedAt,
  });

  assert.equal(result.securityDecision?.verdict, "weak-fit");
  assert.equal(result.securityResearchProfile?.version, "security-research-profile-v1");
  assert.equal(result.securityResearchProfile?.security.symbol, "TSM");
  assert.equal(result.securityResearchProfile?.valuationEvidence.method, "analyst_consensus");
  assert.ok(
    result.securityResearchProfile?.keyLevels.some(
      (level) => level.label === "分析师目标价" && level.type === "VALUATION_ANCHOR",
    ),
  );
  assert.equal(result.securityResearchDecision?.entryTiming.posture, "portfolio_guardrail");
  assert.ok(
    result.securityResearchDecision?.entryTiming.keyLevels.some(
      (level) => level.label === "分析师目标价" && level.type === "VALUATION_ANCHOR",
    ),
  );
  assert.ok(
    result.securityResearchDecision?.entryTiming.keyLevels.some(
      (level) => level.label === "最近收盘价",
    ),
  );
});

test("security analyzer quick scan uses security id when provider exchange labels differ", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      securityId: "security_xbb_cad",
      symbol: "XBB",
      exchange: "Toronto Stock Exchange",
      currency: "CAD",
      name: "iShares Core Canadian Universe Bond Index ETF"
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: {
      priceHistory: [
        {
          ...priceHistory[0],
          id: "history_xbb_tsx",
          securityId: "security_xbb_cad",
          symbol: "XBB",
          exchange: "TSX",
          currency: "CAD",
          provider: "yahoo-finance",
          source: "quote-refresh-yahoo-finance",
          freshness: "fresh",
          isReference: false,
          createdAt: generatedAt
        }
      ]
    },
    generatedAt
  });

  const freshness = result.scorecards.find(
    (card) => card.id === "market-data-freshness"
  );
  assert.equal(result.dataFreshness.priceHistoryPointCount, 1);
  assert.match(result.dataFreshness.quoteSourceSummary ?? "", /Yahoo Finance/);
  assert.ok((freshness?.score ?? 0) > 45);
});

test("security analyzer quick scan does not fall back across currency", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: {
      symbol: "XBB",
      exchange: "Toronto Stock Exchange",
      currency: "USD",
      name: "iShares Core Canadian Universe Bond Index ETF"
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: {
      priceHistory: [
        {
          ...priceHistory[0],
          id: "history_xbb_tsx_cad",
          securityId: "security_xbb_cad",
          symbol: "XBB",
          exchange: "TSX",
          currency: "CAD",
          provider: "yahoo-finance",
          source: "quote-refresh-yahoo-finance",
          freshness: "fresh",
          isReference: false,
          createdAt: generatedAt
        }
      ]
    },
    generatedAt
  });

  assert.equal(result.dataFreshness.priceHistoryPointCount, 0);
});

test("portfolio analyzer cache key preserves security listing identity", () => {
  const usdCommon = buildPortfolioAnalyzerCacheKey({
    scope: "security",
    mode: "quick",
    security: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" },
    cacheStrategy: "prefer-cache",
    maxCacheAgeSeconds: 900,
    includeExternalResearch: false
  });
  const cadListed = buildPortfolioAnalyzerCacheKey({
    scope: "security",
    mode: "quick",
    security: { symbol: "AMZN", exchange: "NEO", currency: "CAD" },
    cacheStrategy: "prefer-cache",
    maxCacheAgeSeconds: 900,
    includeExternalResearch: false
  });

  assert.notEqual(usdCommon, cadListed);
});

test("portfolio analyzer cache is stale when refreshed market data is newer", () => {
  assert.equal(
    isAnalyzerCacheOlderThanMarketData("2026-04-30T12:00:00.000Z", {
      holdings: [
        {
          ...holdings[0],
          lastQuoteSuccessAt: "2026-04-30T12:10:00.000Z",
        },
      ],
      marketData: { priceHistory: [], portfolioSnapshots: [] },
    }),
    true,
  );

  assert.equal(
    isAnalyzerCacheOlderThanMarketData("2026-04-30T12:10:00.000Z", {
      holdings: [],
      marketData: {
        priceHistory: [
          {
            ...priceHistory[0],
            createdAt: "2026-04-30T12:09:00.000Z",
          },
        ],
        portfolioSnapshots: [],
      },
    }),
    false,
  );

  assert.equal(
    isAnalyzerCacheOlderThanMarketData("2026-04-30T12:00:00.000Z", {
      holdings: [],
      marketData: { priceHistory: [], portfolioSnapshots: [] },
    externalResearchDocuments: [
      makeExternalResearchDocument({
        capturedAt: "2026-04-30T12:15:00.000Z",
        updatedAt: "2026-04-30T12:15:00.000Z",
      }),
    ],
  }),
  true,
  );

  assert.equal(
    isAnalyzerCacheOlderThanMarketData("2026-04-30T12:00:00.000Z", {
      holdings: [],
      marketData: { priceHistory: [], portfolioSnapshots: [] },
      marketSentiment: makeMarketSentimentSnapshot({
        asOf: "2026-04-30T12:20:00.000Z",
        updatedAt: "2026-04-30T12:20:00.000Z",
      }),
    }),
    true,
  );
});

test("portfolio analyzer quick scan returns local structured analysis with disclaimers", () => {
  const result = buildPortfolioAnalyzerQuickScan({
    accounts,
    holdings,
    profile: makeProfile(),
    generatedAt
  });

  assert.equal(result.scope, "portfolio");
  assert.equal(result.dataFreshness.sourceMode, "cached-external");
  assert.ok(result.scorecards.length > 0);
  assert.ok(result.risks.some((risk) => risk.title.includes("集中度")));
  assert.match(result.disclaimer.zh, /不构成投资建议/);
});

test("account analyzer quick scan returns account-scoped health explanation", () => {
  const result = buildAccountAnalyzerQuickScan({
    account: accounts[0]!,
    accounts,
    holdings,
    profile: makeProfile(),
    generatedAt
  });

  assert.equal(result.scope, "account");
  assert.match(result.summary.title, /TFSA/);
  assert.ok(result.scorecards.some((card) => card.id === "account-health"));
  assert.ok(result.portfolioFit.some((item) => item.includes("账户类型")));
  assert.match(result.disclaimer.zh, /不构成投资建议/);
});

test("recommendation analyzer quick scan surfaces constraints in local explanation", () => {
  const run: RecommendationRun = {
    id: "run_test",
    userId: "user_test",
    contributionAmountCad: 5000,
    createdAt: generatedAt,
    confidenceScore: 76,
    objective: "Route new money toward the largest allocation gap.",
    assumptions: ["优先补足目标配置缺口。"],
    notes: ["当前使用本地推荐引擎。"],
    items: [
      {
        assetClass: "US Equity",
        amountCad: 5000,
        targetAccountType: "RRSP",
        tickerOptions: ["VFV"],
        explanation: "优先补 US Equity 缺口。",
        securitySymbol: "VFV",
        securityScore: 82
      }
    ]
  };
  const result = buildRecommendationRunAnalyzerQuickScan({
    run,
    profile: makeProfile({
      recommendationConstraints: {
        ...DEFAULT_RECOMMENDATION_CONSTRAINTS,
        excludedSymbols: ["AMZN"],
        allowedSecurityTypes: ["ETF"]
      }
    }),
    generatedAt
  });

  assert.equal(result.scope, "recommendation-run");
  assert.ok(result.risks.some((risk) => risk.detail.includes("AMZN")));
  assert.ok(result.risks.some((risk) => risk.detail.includes("ETF")));
  assert.ok(result.actionItems[0]?.detail.includes("US Equity"));
});
