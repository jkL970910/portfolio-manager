import assert from "node:assert/strict";
import test from "node:test";
import type {
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
} from "@/lib/backend/models";
import { DEFAULT_PREFERENCE_FACTORS } from "@/lib/backend/preference-factors";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";
import { buildSecurityDecisionContext } from "@/lib/backend/security-decision/context";
import { evaluateSecurityPortfolioFit } from "@/lib/backend/security-decision/portfolio-fit";

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

test("portfolio fit engine highlights target gap and concentration", () => {
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
    profile: makeProfile(),
    generatedAt,
  });

  const fit = evaluateSecurityPortfolioFit(context);

  assert.ok(fit.score > 0);
  assert.equal(fit.targetPct, 60);
  assert.equal(fit.currentSleevePct, 18);
  assert.equal(fit.heldWeightPct, 18);
  assert.ok(fit.concerns.some((item) => item.includes("18%")));
});

test("portfolio fit engine penalizes USD avoid path and liquidity pressure", () => {
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
        taxStrategy: {
          ...DEFAULT_PREFERENCE_FACTORS.taxStrategy,
          usdFundingPath: "avoid",
        },
        liquidity: {
          ...DEFAULT_PREFERENCE_FACTORS.liquidity,
          liquidityNeed: "high",
          cashDuringUncertainty: "high",
        },
      },
    }),
    generatedAt,
  });

  const fit = evaluateSecurityPortfolioFit(context);

  assert.ok(fit.taxFitScore < 70);
  assert.ok(fit.fxFitScore < 70);
  assert.ok(fit.liquidityFitScore < 70);
  assert.ok(fit.concerns.some((item) => item.includes("USD/CAD")));
});

test("portfolio fit engine gives candidate context a readable summary", () => {
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
    holdings: [],
    profile: makeProfile(),
    generatedAt,
  });

  const fit = evaluateSecurityPortfolioFit(context);

  assert.equal(context.heldWeightPct, 0);
  assert.match(fit.summary, /当前未持有/);
  assert.equal(fit.duplicateExposurePct, 0);
});

