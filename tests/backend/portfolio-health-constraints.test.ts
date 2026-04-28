import assert from "node:assert/strict";
import test from "node:test";
import type { HoldingPosition, InvestmentAccount, PreferenceProfile } from "@/lib/backend/models";
import { buildPortfolioHealthSummary } from "@/lib/backend/portfolio-health";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";

const accounts: InvestmentAccount[] = [
  {
    id: "acct_tfsa",
    userId: "user_test",
    institution: "Test Broker",
    type: "TFSA",
    nickname: "TFSA",
    currency: "CAD",
    marketValueCad: 100000,
    contributionRoomCad: 10000
  }
];

const holdings: HoldingPosition[] = [
  {
    id: "holding_us",
    userId: "user_test",
    accountId: "acct_tfsa",
    symbol: "VFV",
    name: "Vanguard S&P 500 Index ETF",
    assetClass: "US Equity",
    sector: "Diversified",
    currency: "CAD",
    marketValueCad: 35000,
    weightPct: 35,
    gainLossPct: 0
  },
  {
    id: "holding_ca",
    userId: "user_test",
    accountId: "acct_tfsa",
    symbol: "VCN",
    name: "Vanguard FTSE Canada All Cap Index ETF",
    assetClass: "Canadian Equity",
    sector: "Diversified",
    currency: "CAD",
    marketValueCad: 10000,
    weightPct: 10,
    gainLossPct: 0
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
    marketValueCad: 20000,
    weightPct: 20,
    gainLossPct: 0
  },
  {
    id: "holding_zag",
    userId: "user_test",
    accountId: "acct_tfsa",
    symbol: "ZAG",
    name: "BMO Aggregate Bond Index ETF",
    assetClass: "Fixed Income",
    sector: "Fixed Income",
    currency: "CAD",
    marketValueCad: 25000,
    weightPct: 25,
    gainLossPct: 0
  },
  {
    id: "holding_cash",
    userId: "user_test",
    accountId: "acct_tfsa",
    symbol: "CASH",
    name: "Cash",
    assetClass: "Cash",
    sector: "Cash",
    currency: "CAD",
    marketValueCad: 10000,
    weightPct: 10,
    gainLossPct: 0
  }
];

function makeProfile(overrides: Partial<PreferenceProfile> = {}): PreferenceProfile {
  return {
    id: "pref_test",
    userId: "user_test",
    riskProfile: "Growth",
    targetAllocation: [
      { assetClass: "Canadian Equity", targetPct: 10 },
      { assetClass: "US Equity", targetPct: 70 },
      { assetClass: "International Equity", targetPct: 10 },
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

test("health score uses asset-class bands as effective target constraints", () => {
  const unconstrained = buildPortfolioHealthSummary({
    accounts,
    holdings,
    profile: makeProfile(),
    language: "zh"
  });
  const constrained = buildPortfolioHealthSummary({
    accounts,
    holdings,
    profile: makeProfile({
      recommendationConstraints: {
        ...DEFAULT_RECOMMENDATION_CONSTRAINTS,
        assetClassBands: [{ assetClass: "US Equity", minPct: 0, maxPct: 35 }]
      }
    }),
    language: "zh"
  });
  const unconstrainedAllocation = unconstrained.dimensions.find((item) => item.id === "allocation");
  const constrainedAllocation = constrained.dimensions.find((item) => item.id === "allocation");

  assert.ok(unconstrainedAllocation);
  assert.ok(constrainedAllocation);
  assert.ok(constrainedAllocation.score > unconstrainedAllocation.score);
  assert.ok(constrained.score > unconstrained.score);
  assert.ok(constrainedAllocation.drivers.some((driver) => driver.includes("资产区间约束")));
});

test("health score describes overweight target gaps without saying only", () => {
  const health = buildPortfolioHealthSummary({
    accounts,
    holdings,
    profile: makeProfile({
      targetAllocation: [
        { assetClass: "Canadian Equity", targetPct: 1 },
        { assetClass: "US Equity", targetPct: 35 },
        { assetClass: "International Equity", targetPct: 20 },
        { assetClass: "Fixed Income", targetPct: 25 },
        { assetClass: "Cash", targetPct: 10 }
      ]
    }),
    language: "zh"
  });
  const allocation = health.dimensions.find((item) => item.id === "allocation");

  assert.ok(allocation);
  assert.ok(allocation.drivers[0]?.includes("高于目标"));
  assert.ok(!allocation.drivers[0]?.includes("只有"));
});

test("account health exposes account-fit and portfolio-target reference lenses", () => {
  const health = buildPortfolioHealthSummary({
    accounts,
    holdings,
    profile: makeProfile(),
    language: "zh",
    scopeLevel: "account"
  });

  assert.equal(health.scopeLevel, "account");
  assert.match(health.scopeLabel, /账户内适配/);
  assert.ok(health.dimensions.some((item) => item.label === "账户内适配"));
  assert.ok(health.dimensions.some((item) => item.label === "全组合目标参考"));
  assert.ok(health.dimensions.find((item) => item.id === "allocation")?.drivers.some((driver) => driver.includes("不要求单个账户复制全组合目标")));
});
