import assert from "node:assert/strict";
import test from "node:test";
import type {
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
  SecurityPriceHistoryPoint,
} from "@/lib/backend/models";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";
import { buildPortfolioSecurityDetailData } from "@/lib/backend/view-builders";

const accounts: InvestmentAccount[] = [
  {
    id: "acct_tfsa",
    userId: "user_test",
    institution: "Wealthsimple",
    type: "TFSA",
    nickname: "TFSA",
    currency: "CAD",
    marketValueCad: 10000,
    contributionRoomCad: 1000,
  },
];

const holdings: HoldingPosition[] = [
  {
    id: "holding_vfv",
    userId: "user_test",
    accountId: "acct_tfsa",
    symbol: "VFV",
    name: "Vanguard S&P 500 Index ETF",
    assetClass: "US Equity",
    sector: "Multi-sector",
    currency: "CAD",
    exchangeOverride: "TSX",
    quantity: 10,
    marketValueCad: 10000,
    marketValueAmount: 10000,
    weightPct: 100,
    gainLossPct: 5,
    updatedAt: "2026-04-28T00:00:00.000Z",
  },
];

const profile: PreferenceProfile = {
  id: "pref_test",
  userId: "user_test",
  riskProfile: "Growth",
  targetAllocation: [{ assetClass: "US Equity", targetPct: 80 }],
  accountFundingPriority: ["TFSA", "RRSP", "Taxable"],
  taxAwarePlacement: true,
  cashBufferTargetCad: 5000,
  transitionPreference: "gradual",
  recommendationStrategy: "balanced",
  source: "manual",
  rebalancingTolerancePct: 5,
  watchlistSymbols: [],
  recommendationConstraints: DEFAULT_RECOMMENDATION_CONSTRAINTS,
};

const priceHistory: SecurityPriceHistoryPoint[] = [
  {
    id: "price_1",
    symbol: "VFV",
    priceDate: "2026-04-25",
    close: 140,
    adjustedClose: null,
    currency: "CAD",
    source: "test-cache",
    createdAt: "2026-04-25T00:00:00.000Z",
  },
  {
    id: "price_2",
    symbol: "VFV",
    priceDate: "2026-04-26",
    close: 141,
    adjustedClose: null,
    currency: "CAD",
    source: "test-cache",
    createdAt: "2026-04-26T00:00:00.000Z",
  },
];

test("security detail chart contract preserves identity and freshness", () => {
  const detail = buildPortfolioSecurityDetailData({
    language: "zh",
    accounts,
    holdings,
    priceHistory,
    profile,
    display: { currency: "CAD", cadToDisplayRate: 1 },
    symbol: "VFV",
    exchange: "TSX",
    currency: "CAD",
  });

  const chart = detail?.chartSeries?.priceHistory;
  assert.ok(chart);
  assert.equal(chart.identity?.symbol, "VFV");
  assert.equal(chart.identity?.exchange, "TSX");
  assert.equal(chart.identity?.currency, "CAD");
  assert.equal(chart.valueType, "money");
  assert.equal(chart.currency, "CAD");
  assert.equal(chart.freshness.status, "fresh");
  assert.equal(chart.freshness.latestDate, "2026-04-26");
  assert.equal(chart.points[0]?.displayValue, "$140");
});

test("security detail chart contract labels shallow history as fallback", () => {
  const detail = buildPortfolioSecurityDetailData({
    language: "zh",
    accounts,
    holdings,
    priceHistory: [],
    profile,
    display: { currency: "CAD", cadToDisplayRate: 1 },
    symbol: "VFV",
    exchange: "TSX",
    currency: "CAD",
  });

  const chart = detail?.chartSeries?.priceHistory;
  assert.ok(chart);
  assert.equal(chart.freshness.status, "fallback");
  assert.match(chart.freshness.detail, /不能当作真实价格走势|缓存历史不足/);
  assert.ok(chart.notes.some((note) => note.includes("不代表真实价格走势")));
});
