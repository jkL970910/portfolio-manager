import assert from "node:assert/strict";
import test from "node:test";
import type { InvestmentAccount, HoldingPosition, PreferenceProfile, RecommendationRun } from "@/lib/backend/models";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";
import {
  buildAccountAnalyzerQuickScan,
  buildPortfolioAnalyzerQuickScan,
  buildRecommendationRunAnalyzerQuickScan,
  buildSecurityAnalyzerQuickScan
} from "@/lib/backend/portfolio-analyzer";

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
    weightPct: 18,
    gainLossPct: 6,
    updatedAt: generatedAt
  },
  {
    id: "holding_cad_amzn",
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
    ...overrides
  };
}

test("security analyzer quick scan matches by full identity, not ticker alone", () => {
  const result = buildSecurityAnalyzerQuickScan({
    identity: { symbol: "AMZN", exchange: "NEO", currency: "CAD", name: "Amazon CDR" },
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

test("portfolio analyzer quick scan returns local structured analysis with disclaimers", () => {
  const result = buildPortfolioAnalyzerQuickScan({
    accounts,
    holdings,
    profile: makeProfile(),
    generatedAt
  });

  assert.equal(result.scope, "portfolio");
  assert.equal(result.dataFreshness.sourceMode, "local");
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
