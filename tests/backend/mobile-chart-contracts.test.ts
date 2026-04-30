import assert from "node:assert/strict";
import test from "node:test";
import type {
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
  PortfolioSnapshot,
  SecurityPriceHistoryPoint,
} from "@/lib/backend/models";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";
import {
  buildDashboardData,
  buildPortfolioAccountDetailData,
  buildPortfolioData,
  buildPortfolioHoldingDetailData,
  buildPortfolioSecurityDetailData,
} from "@/lib/backend/view-builders";
import { DEFAULT_PREFERENCE_FACTORS } from "@/lib/backend/preference-factors";

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
  preferenceFactors: DEFAULT_PREFERENCE_FACTORS,
};

const priceHistory: SecurityPriceHistoryPoint[] = [
  {
    id: "price_1",
    symbol: "VFV",
    exchange: "TSX",
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
    exchange: "TSX",
    priceDate: "2026-04-26",
    close: 141,
    adjustedClose: null,
    currency: "CAD",
    source: "test-cache",
    createdAt: "2026-04-26T00:00:00.000Z",
  },
];

const display = {
  currency: "CAD" as const,
  cadToDisplayRate: 1,
  usdToCadRate: 1.38,
  fxRateDate: "2026-04-28",
  fxRateSource: "test-cache",
  fxRateFreshness: "fresh" as const,
};

const today = new Date().toISOString().slice(0, 10);

const snapshots: PortfolioSnapshot[] = [
  {
    id: "snapshot_1",
    userId: "user_test",
    snapshotDate: "2026-04-25",
    totalValueCad: 9900,
    accountBreakdown: { acct_tfsa: 9900 },
    holdingBreakdown: { holding_vfv: 9900 },
    sourceVersion: "test",
    createdAt: "2026-04-25T00:00:00.000Z",
  },
  {
    id: "snapshot_2",
    userId: "user_test",
    snapshotDate: "2026-04-26",
    totalValueCad: 10000,
    accountBreakdown: { acct_tfsa: 10000 },
    holdingBreakdown: { holding_vfv: 10000 },
    sourceVersion: "test",
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
    display,
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
    display,
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

test("portfolio overview chart contract labels reference curves as fallback", () => {
  const portfolio = buildPortfolioData({
    language: "zh",
    accounts,
    holdings,
    portfolioEvents: [],
    priceHistory: [],
    snapshots: [],
    profile,
    display,
  });

  const chart = portfolio.chartSeries?.portfolioValue;
  assert.ok(chart);
  assert.equal(chart.id, "portfolio-value-history");
  assert.equal(chart.valueType, "money");
  assert.equal(chart.currency, "CAD");
  assert.equal(chart.freshness.status, "fallback");
  assert.match(chart.freshness.detail, /参考形状|真实组合历史不足/);
  assert.ok(chart.notes.some((note) => note.includes("不代表真实组合走势")));
});

test("portfolio overview chart contract uses local history freshness when available", () => {
  const portfolio = buildPortfolioData({
    language: "zh",
    accounts,
    holdings,
    portfolioEvents: [],
    priceHistory,
    snapshots: [],
    profile,
    display,
  });

  const chart = portfolio.chartSeries?.portfolioValue;
  assert.ok(chart);
  assert.equal(chart.freshness.latestDate, today);
  assert.notEqual(chart.freshness.status, "fallback");
  assert.equal(chart.points.at(-1)?.rawDate, today);
  assert.equal(chart.points.at(-1)?.value, 10000);
  assert.ok(chart.notes.some((note) => note.includes("缓存价格历史回放")));
});

test("mobile home overview chart contract exposes net worth freshness", () => {
  const dashboard = buildDashboardData({
    viewer: {
      id: "user_test",
      email: "tester@example.com",
      displayName: "Tester",
      baseCurrency: "CAD",
      displayLanguage: "zh",
    },
    accounts,
    holdings,
    transactions: [],
    portfolioEvents: [],
    priceHistory,
    snapshots: [],
    profile,
    latestRun: null,
    display,
  });

  const chart = dashboard.chartSeries?.netWorth;
  assert.ok(chart);
  assert.equal(chart.id, "overview-net-worth-history");
  assert.equal(chart.title, "总资产走势");
  assert.equal(chart.freshness.latestDate, today);
  assert.equal(chart.points.at(-1)?.rawDate, today);
  assert.equal(chart.points.at(-1)?.value, 10000);
  assert.equal(chart.sourceMode, "local");
});

test("portfolio account context chart contract exposes account freshness", () => {
  const portfolio = buildPortfolioData({
    language: "zh",
    accounts,
    holdings,
    portfolioEvents: [],
    priceHistory,
    snapshots: [],
    profile,
    display,
  });

  const accountContext = portfolio.accountContexts.find(
    (entry) => entry.id === "acct_tfsa",
  );
  const chart = accountContext?.chartSeries?.accountValue;
  assert.ok(chart);
  assert.equal(chart.id, "account-value-history");
  assert.equal(chart.title, "Wealthsimple TFSA 资产走势");
  assert.equal(chart.freshness.latestDate, "2026-04-26");
  assert.notEqual(chart.freshness.status, "fallback");
  assert.match(chart.freshness.detail, /账户历史日期/);
});

test("account detail chart contract falls back honestly when only snapshots exist", () => {
  const detail = buildPortfolioAccountDetailData({
    language: "zh",
    accounts,
    holdings,
    snapshots,
    profile,
    display,
    accountId: "acct_tfsa",
  });

  const chart = detail?.chartSeries?.accountValue;
  assert.ok(chart);
  assert.equal(chart.freshness.latestDate, "2026-04-26");
  assert.notEqual(chart.freshness.status, "fallback");
  assert.ok(chart.notes.some((note) => note.includes("本地账户快照")));
});

test("asset class drilldown chart contract exposes sleeve freshness", () => {
  const portfolio = buildPortfolioData({
    language: "zh",
    accounts,
    holdings,
    portfolioEvents: [],
    priceHistory,
    snapshots: [],
    profile,
    display,
  });

  const sleeve = portfolio.assetClassDrilldown.find(
    (entry) => entry.id === "US Equity",
  );
  const chart = sleeve?.chartSeries?.valueHistory;
  assert.ok(chart);
  assert.equal(chart.id, "asset-class-value-history");
  assert.match(chart.title, /资产走势/);
  assert.equal(chart.freshness.latestDate, "2026-04-26");
  assert.notEqual(chart.freshness.status, "fallback");
  assert.ok(chart.notes.some((note) => note.includes("缓存价格历史回放")));
});

test("holding detail chart contract exposes holding value freshness", () => {
  const detail = buildPortfolioHoldingDetailData({
    language: "zh",
    accounts,
    holdings,
    portfolioEvents: [],
    priceHistory,
    snapshots,
    profile,
    display,
    holdingId: "holding_vfv",
  });

  const chart = detail?.chartSeries?.holdingValue;
  assert.ok(chart);
  assert.equal(chart.id, "holding-value-history-holding_vfv");
  assert.equal(chart.title, "VFV 持仓价值走势");
  assert.equal(chart.valueType, "money");
  assert.equal(chart.currency, "CAD");
  assert.equal(chart.freshness.latestDate, "2026-04-26");
  assert.notEqual(chart.freshness.status, "fallback");
  assert.ok(chart.notes.some((note) => note.includes("缓存价格历史回放")));
});
