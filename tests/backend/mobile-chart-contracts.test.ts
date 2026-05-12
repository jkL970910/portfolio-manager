import assert from "node:assert/strict";
import test from "node:test";
import type {
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
  PortfolioSnapshot,
  ExternalResearchJob,
  ExternalResearchDocumentRecord,
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
import { buildMobileResearchRefreshActions } from "@/lib/backend/mobile-views";
import { getExternalResearchPolicy } from "@/lib/backend/portfolio-external-research";
import { mapExternalResearchJobForMobile } from "@/lib/backend/external-research-jobs";

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
  assert.notEqual(chart.freshness.status, "fallback");
  assert.equal(chart.freshness.latestDate, "2026-04-26");
  assert.equal(chart.points[0]?.displayValue, "$140");
});

test("security detail chart contract preserves intraday price timestamps", () => {
  const intradayHistory: SecurityPriceHistoryPoint[] = [
    {
      id: "price_intraday_1",
      symbol: "VFV",
      exchange: "TSX",
      priceDate: "2026-04-26",
      priceTime: "2026-04-26T13:30:00.000Z",
      close: 140.5,
      adjustedClose: null,
      currency: "CAD",
      source: "test-cache",
      createdAt: "2026-04-26T13:30:00.000Z",
    },
    {
      id: "price_intraday_2",
      symbol: "VFV",
      exchange: "TSX",
      priceDate: "2026-04-26",
      priceTime: "2026-04-26T14:30:00.000Z",
      close: 141.25,
      adjustedClose: null,
      currency: "CAD",
      source: "test-cache",
      createdAt: "2026-04-26T14:30:00.000Z",
    },
  ];

  const detail = buildPortfolioSecurityDetailData({
    language: "zh",
    accounts,
    holdings,
    priceHistory: intradayHistory,
    profile,
    display,
    symbol: "VFV",
    exchange: "TSX",
    currency: "CAD",
  });

  const chart = detail?.chartSeries?.priceHistory;
  assert.ok(chart);
  assert.equal(chart.points.length, 2);
  assert.equal(chart.points[0]?.rawDate, "2026-04-26T13:30:00.000Z");
  assert.equal(chart.points[1]?.rawDate, "2026-04-26T14:30:00.000Z");
  assert.equal(chart.points[0]?.displayValue, "$140.50");
  assert.equal(chart.points[1]?.displayValue, "$141.25");
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

test("mobile security refresh actions require confirmation for fresh external cache", () => {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE = "enabled";

  const detail = buildPortfolioSecurityDetailData({
    language: "zh",
    accounts,
    holdings: [
      {
        ...holdings[0],
        assetClass: "US Equity",
        sector: "Technology",
        symbol: "AMZN",
        name: "Amazon.com Inc",
        exchangeOverride: "NASDAQ",
        currency: "USD",
        securityId: "security_amzn_resolved_later",
      },
    ],
    priceHistory,
    profile,
    display,
    symbol: "AMZN",
    exchange: "NASDAQ",
    currency: "USD",
  });
  assert.ok(detail);
  detail.security.securityId = "security_amzn_resolved_later";
  detail.security.exchange = "未知交易所";

  const policy = getExternalResearchPolicy();
  const now = new Date("2026-04-28T12:00:00.000Z");
  const job: ExternalResearchJob = {
    id: "job_profile_amzn",
    userId: "user_test",
    scope: "security",
    targetKey: "security:quick:security:AMZN:NASDAQ:USD:_",
    request: {
      scope: "security",
      security: {
        symbol: "AMZN",
        exchange: "NASDAQ",
        currency: "USD",
        name: "Amazon.com Inc",
      },
    },
    status: "succeeded",
    sourceMode: "cached-external",
    sourceAllowlist: [{ id: "profile", label: "标的基本资料", enabled: true }],
    priority: 5,
    attemptCount: 1,
    maxAttempts: 3,
    runAfter: now.toISOString(),
    lockedAt: null,
    lockedBy: null,
    startedAt: "2026-04-28T10:00:00.000Z",
    finishedAt: "2026-04-28T10:01:00.000Z",
    errorMessage: null,
    resultRunId: "run_1",
    createdAt: "2026-04-28T10:00:00.000Z",
    updatedAt: "2026-04-28T10:01:00.000Z",
  };

  const actions = buildMobileResearchRefreshActions({
    data: detail,
    jobs: [mapExternalResearchJobForMobile(job)],
    policy,
    usage: {
      usedRuns: 1,
      remainingRuns: 24,
      usedSymbols: 1,
      dailyRunLimit: 25,
      maxSymbolsPerRun: 12,
      counters: [],
    },
    now,
  });

  const profileAction = actions.find((action) => action.id === "profile");
  assert.equal(profileAction?.enabled, true);
  assert.equal(profileAction?.cache.status, "fresh");
  assert.equal(profileAction?.cache.confirmationRequired, true);
  assert.match(profileAction?.cache.confirmationMessage ?? "", /消耗 1 次/);

  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE;
});

test("mobile security refresh actions prefer fresh persisted documents over latest skipped jobs", () => {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE = "enabled";

  const detail = buildPortfolioSecurityDetailData({
    language: "zh",
    accounts,
    holdings: [
      {
        ...holdings[0],
        assetClass: "US Equity",
        sector: "Technology",
        symbol: "MSFT",
        name: "Microsoft",
        exchangeOverride: "NASDAQ",
        currency: "USD",
      },
    ],
    priceHistory,
    profile,
    display,
    symbol: "MSFT",
    exchange: "NASDAQ",
    currency: "USD",
  });
  assert.ok(detail);

  const now = new Date("2026-04-28T12:00:00.000Z");
  const skippedJob: ExternalResearchJob = {
    id: "job_profile_msft_skipped",
    userId: "user_test",
    scope: "security",
    targetKey: "security:MSFT:NASDAQ:USD",
    request: {
      scope: "security",
      security: {
        symbol: "MSFT",
        exchange: "NASDAQ",
        currency: "USD",
      },
    },
    status: "skipped",
    sourceMode: "cached-external",
    sourceAllowlist: [{ id: "profile", label: "标的基本资料", enabled: true }],
    priority: 5,
    attemptCount: 1,
    maxAttempts: 3,
    runAfter: now.toISOString(),
    lockedAt: null,
    lockedBy: null,
    startedAt: "2026-04-28T11:00:00.000Z",
    finishedAt: "2026-04-28T11:01:00.000Z",
    errorMessage: "Alpha Vantage provider limit reached.",
    resultRunId: null,
    createdAt: "2026-04-28T11:00:00.000Z",
    updatedAt: "2026-04-28T11:01:00.000Z",
  };
  const document: ExternalResearchDocumentRecord = {
    id: "document_profile_msft",
    userId: "user_test",
    providerDocumentId: "alpha-vantage-profile:msft",
    sourceType: "institutional",
    providerId: "alpha-vantage-profile",
    sourceName: "Alpha Vantage 标的资料",
    title: "MSFT 基本资料快照",
    summary: "MSFT profile.",
    url: null,
    publishedAt: null,
    capturedAt: "2026-04-28T10:00:00.000Z",
    expiresAt: "2026-04-28T18:00:00.000Z",
    language: "zh",
    security: {
      securityId: null,
      symbol: "MSFT",
      exchange: "NASDAQ",
      currency: "USD",
      name: "Microsoft",
      provider: "alpha-vantage-profile",
      securityType: "Common Stock",
    },
    underlyingId: null,
    confidence: "medium",
    sentiment: "neutral",
    relevanceScore: 70,
    sourceReliability: 75,
    keyPoints: [],
    riskFlags: [],
    tags: ["profile"],
    rawPayload: {},
    createdAt: "2026-04-28T10:00:00.000Z",
    updatedAt: "2026-04-28T10:00:00.000Z",
  };

  const actions = buildMobileResearchRefreshActions({
    data: detail,
    jobs: [mapExternalResearchJobForMobile(skippedJob)],
    freshDocuments: [document],
    policy: getExternalResearchPolicy(),
    usage: {
      usedRuns: 2,
      remainingRuns: 23,
      usedSymbols: 2,
      dailyRunLimit: 25,
      maxSymbolsPerRun: 12,
      counters: [],
    },
    now,
  });

  const profileAction = actions.find((action) => action.id === "profile");
  assert.equal(profileAction?.cache.status, "fresh");
  assert.equal(profileAction?.cache.confirmationRequired, true);
  assert.match(profileAction?.cache.detail ?? "", /Alpha Vantage 标的资料/);

  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE;
});

test("mobile security refresh actions match fresh documents by listing when securityId was resolved later", () => {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE = "enabled";

  const detail = buildPortfolioSecurityDetailData({
    language: "zh",
    accounts,
    holdings: [
      {
        ...holdings[0],
        assetClass: "US Equity",
        sector: "Technology",
        symbol: "AMZN",
        name: "Amazon",
        exchangeOverride: "NASDAQ",
        currency: "USD",
        securityId: "security_amzn_resolved_later",
      },
    ],
    priceHistory,
    profile,
    display,
    symbol: "AMZN",
    exchange: "NASDAQ",
    currency: "USD",
  });
  assert.ok(detail);
  detail.security.securityId = "security_amzn_resolved_later";

  const now = new Date("2026-04-28T12:00:00.000Z");
  const document: ExternalResearchDocumentRecord = {
    id: "document_profile_amzn",
    userId: "user_test",
    providerDocumentId: "alpha-vantage-profile:amzn",
    sourceType: "institutional",
    providerId: "alpha-vantage-profile",
    sourceName: "Alpha Vantage 标的资料",
    title: "AMZN 基本资料快照",
    summary: "AMZN profile.",
    url: null,
    publishedAt: null,
    capturedAt: "2026-04-28T10:00:00.000Z",
    expiresAt: "2026-04-28T18:00:00.000Z",
    language: "zh",
    security: {
      securityId: null,
      symbol: "AMZN",
      exchange: "NASDAQ",
      currency: "USD",
      name: "Amazon",
      provider: "alpha-vantage-profile",
      securityType: "Common Stock",
    },
    underlyingId: null,
    confidence: "medium",
    sentiment: "neutral",
    relevanceScore: 70,
    sourceReliability: 75,
    keyPoints: [],
    riskFlags: [],
    tags: ["profile"],
    rawPayload: {},
    createdAt: "2026-04-28T10:00:00.000Z",
    updatedAt: "2026-04-28T10:00:00.000Z",
  };

  const actions = buildMobileResearchRefreshActions({
    data: detail,
    jobs: [],
    freshDocuments: [document],
    policy: getExternalResearchPolicy(),
    usage: {
      usedRuns: 1,
      remainingRuns: 24,
      usedSymbols: 1,
      dailyRunLimit: 25,
      maxSymbolsPerRun: 12,
      counters: [],
    },
    now,
  });

  const profileAction = actions.find((action) => action.id === "profile");
  assert.equal(profileAction?.cache.status, "fresh");
  assert.equal(profileAction?.cache.confirmationRequired, true);

  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE;
});

test("mobile security refresh actions do not expose ETF profile as enabled before EODHD", () => {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_INSTITUTIONAL = "enabled";

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
  assert.ok(detail);

  const actions = buildMobileResearchRefreshActions({
    data: detail,
    jobs: [],
    policy: getExternalResearchPolicy(),
    usage: {
      usedRuns: 0,
      remainingRuns: 25,
      usedSymbols: 0,
      dailyRunLimit: 25,
      maxSymbolsPerRun: 12,
      counters: [],
    },
    now: new Date("2026-04-28T12:00:00.000Z"),
  });

  const profileAction = actions.find((action) => action.id === "profile");
  const institutionalAction = actions.find(
    (action) => action.id === "institutional",
  );
  assert.equal(profileAction?.enabled, false);
  assert.match(profileAction?.disabledReason ?? "", /EODHD/);
  assert.equal(institutionalAction?.enabled, false);
  assert.equal(institutionalAction?.cache.status, "not-applicable");

  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_INSTITUTIONAL;
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
  assert.equal(chart.freshness.latestDate, "2026-04-26");
  assert.notEqual(chart.freshness.status, "fallback");
  assert.equal(chart.points.at(-1)?.rawDate, "2026-04-26");
  assert.equal(chart.points.at(-1)?.value, 1410);
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
  assert.equal(chart.freshness.latestDate, "2026-04-26");
  assert.equal(chart.points.at(-1)?.rawDate, "2026-04-26");
  assert.equal(chart.points.at(-1)?.value, 1410);
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

test("portfolio aggregates the same security across accounts for mobile holdings", () => {
  const multiAccountAccounts: InvestmentAccount[] = [
    ...accounts,
    {
      id: "acct_rrsp",
      userId: "user_test",
      institution: "Wealthsimple",
      type: "RRSP",
      nickname: "RRSP",
      currency: "CAD",
      marketValueCad: 5000,
      contributionRoomCad: 2000,
    },
  ];
  const multiAccountHoldings: HoldingPosition[] = [
    {
      ...holdings[0]!,
      id: "holding_zqq_tfsa",
      accountId: "acct_tfsa",
      securityId: "security_zqq",
      symbol: "ZQQ",
      name: "BMO Nasdaq 100 Equity Hedged to CAD Index ETF",
      exchangeOverride: "TSX",
      quantity: 10,
      avgCostPerShareCad: 100,
      avgCostPerShareAmount: 100,
      costBasisCad: 1000,
      costBasisAmount: 1000,
      marketValueCad: 1200,
      marketValueAmount: 1200,
      weightPct: 8,
      gainLossPct: 20,
    },
    {
      ...holdings[0]!,
      id: "holding_zqq_rrsp",
      accountId: "acct_rrsp",
      securityId: "security_zqq",
      symbol: "ZQQ",
      name: "BMO Nasdaq 100 Equity Hedged to CAD Index ETF",
      exchangeOverride: "TSX",
      quantity: 5,
      avgCostPerShareCad: 90,
      avgCostPerShareAmount: 90,
      costBasisCad: 450,
      costBasisAmount: 450,
      marketValueCad: 600,
      marketValueAmount: 600,
      weightPct: 4,
      gainLossPct: 33.3,
    },
  ];
  const portfolio = buildPortfolioData({
    language: "zh",
    accounts: multiAccountAccounts,
    holdings: multiAccountHoldings,
    profile,
    display,
  });
  const dashboard = buildDashboardData({
    viewer: {
      id: "user_test",
      email: "test@example.com",
      displayName: "Tester",
      displayLanguage: "zh",
      baseCurrency: "CAD",
    },
    accounts: multiAccountAccounts,
    holdings: multiAccountHoldings,
    transactions: [],
    profile,
    latestRun: null,
    display,
  });

  assert.equal(portfolio.holdings.length, 2);
  assert.equal(portfolio.securityHoldings.length, 1);
  assert.equal(portfolio.securityHoldings[0]?.symbol, "ZQQ");
  assert.equal(portfolio.securityHoldings[0]?.accountCount, "2");
  assert.equal(portfolio.securityHoldings[0]?.lotCount, "2");
  assert.equal(portfolio.securityHoldings[0]?.quantity, "15");
  assert.match(portfolio.securityHoldings[0]?.value ?? "", /\$1,800/);
  assert.equal(dashboard.topHoldings.length, 1);
  assert.equal(dashboard.topHoldings[0]?.id, portfolio.securityHoldings[0]?.id);
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
