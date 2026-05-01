import assert from "node:assert/strict";
import test from "node:test";
import type {
  HoldingPosition,
  InvestmentAccount,
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
      (item) => item.title === "核对目标配置" || item.title === "评估集中度",
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
