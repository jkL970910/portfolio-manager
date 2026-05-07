import assert from "node:assert/strict";
import test from "node:test";
import type {
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
  SecurityPriceHistoryPoint,
} from "@/lib/backend/models";
import { DEFAULT_PREFERENCE_FACTORS } from "@/lib/backend/preference-factors";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";
import {
  buildSecurityDecisionContext,
  buildSecurityDecisionNarrative,
} from "@/lib/backend/security-decision/context";
import { evaluateSecurityGuardrails } from "@/lib/backend/security-decision/guardrails";

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
    contributionRoomCad: 10000,
  },
  {
    id: "acct_rrsp",
    userId: "user_test",
    institution: "Test Broker",
    type: "RRSP",
    nickname: "RRSP",
    currency: "USD",
    marketValueCad: 30000,
    contributionRoomCad: 5000,
  },
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
      { assetClass: "Cash", targetPct: 5 },
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
    ...overrides,
  };
}

const priceHistory: SecurityPriceHistoryPoint[] = [
  {
    id: "history_amzn_us",
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
    createdAt: generatedAt,
  },
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
    updatedAt: generatedAt,
  },
  {
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
  },
];

test("security decision context preserves full identity and economic exposure", () => {
  const context = buildSecurityDecisionContext({
    identity: {
      securityId: "security_cgl_cad",
      symbol: "CGL.C",
      exchange: "TSX",
      currency: "CAD",
      name: "iShares Gold Bullion ETF",
      securityType: "Commodity ETF",
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: {
      priceHistory,
    },
    generatedAt,
  });

  const narrative = buildSecurityDecisionNarrative(context);

  assert.equal(context.normalizedSymbol, "CGL.C");
  assert.equal(context.economicAssetClass, "Commodity");
  assert.match(narrative.decision.detail, /Commodity/);
  assert.match(narrative.portfolioFit.join(" "), /交易身份仍保留 CGL.C · TSX · CAD/);
});

test("security decision context treats 0% candidate as analyzable", () => {
  const context = buildSecurityDecisionContext({
    identity: {
      securityId: "security_xbb_cad",
      symbol: "XBB",
      exchange: "TSX",
      currency: "CAD",
      name: "iShares Core Canadian Universe Bond Index ETF",
      securityType: "ETF",
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: {
      priceHistory: [],
    },
    generatedAt,
  });

  const narrative = buildSecurityDecisionNarrative(context);

  assert.equal(context.heldWeightPct, 0);
  assert.equal(narrative.verdict, "needs-more-data");
  assert.match(narrative.decision.detail, /0%/);
});

test("security decision guardrails block missing identity and thin history", () => {
  const context = buildSecurityDecisionContext({
    identity: {
      symbol: "RKLB",
      name: "Rocket Lab USA",
      securityType: "Common Stock",
    },
    accounts,
    holdings,
    profile: makeProfile(),
    marketData: {
      priceHistory: [],
    },
    generatedAt,
  });

  const result = evaluateSecurityGuardrails(context);

  assert.equal(result.blocked, true);
  assert.ok(result.hard.some((item) => item.id === "identity-incomplete"));
  assert.ok(result.hard.some((item) => item.id === "thin-price-history"));
});

test("security decision guardrails collect soft preference and liquidity diagnostics", () => {
  const context = buildSecurityDecisionContext({
    identity: {
      securityId: "security_amzn_us",
      symbol: "AMZN",
      exchange: "NASDAQ",
      currency: "USD",
      name: "Amazon.com",
      securityType: "Common Stock",
    },
    accounts,
    holdings,
    profile: makeProfile({
      preferenceFactors: {
        ...DEFAULT_PREFERENCE_FACTORS,
        sectorTilts: {
          ...DEFAULT_PREFERENCE_FACTORS.sectorTilts,
          avoidedSectors: ["Consumer Discretionary"],
        },
        taxStrategy: {
          ...DEFAULT_PREFERENCE_FACTORS.taxStrategy,
          usdFundingPath: "avoid",
        },
        liquidity: {
          ...DEFAULT_PREFERENCE_FACTORS.liquidity,
          liquidityNeed: "high",
        },
      },
    }),
    marketData: {
      priceHistory,
    },
    generatedAt,
  });

  const result = evaluateSecurityGuardrails(context);

  assert.equal(result.blocked, true);
  assert.ok(result.soft.some((item) => item.category === "preference-conflict"));
  assert.ok(result.soft.some((item) => item.id === "usd-funding-avoid"));
  assert.ok(result.soft.some((item) => item.id === "liquidity-priority-high"));
});
