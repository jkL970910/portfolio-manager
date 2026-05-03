import assert from "node:assert/strict";
import test from "node:test";
import type { InvestmentAccount, PreferenceProfile } from "@/lib/backend/models";
import { DEFAULT_PREFERENCE_FACTORS } from "@/lib/backend/preference-factors";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";
import { buildRecommendationV2, scoreCandidateSecurity } from "@/lib/backend/recommendation-v2";

const accounts: InvestmentAccount[] = [
  {
    id: "acct_tfsa",
    userId: "user_test",
    institution: "Test Broker",
    type: "TFSA",
    nickname: "TFSA",
    currency: "CAD",
    marketValueCad: 50000,
    contributionRoomCad: 10000
  },
  {
    id: "acct_rrsp",
    userId: "user_test",
    institution: "Test Broker",
    type: "RRSP",
    nickname: "RRSP",
    currency: "USD",
    marketValueCad: 50000,
    contributionRoomCad: 10000
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
    preferenceFactors: DEFAULT_PREFERENCE_FACTORS,
    ...overrides
  };
}

test("excluded symbols are removed from lead ticker options when alternatives exist", () => {
  const run = buildRecommendationV2({
    accounts,
    holdings: [],
    profile: makeProfile({
      recommendationConstraints: {
        ...DEFAULT_RECOMMENDATION_CONSTRAINTS,
        excludedSymbols: ["VTI"]
      }
    }),
    contributionAmountCad: 5000,
    language: "zh"
  });

  const usEquityItem = run.items.find((item) => item.assetClass === "US Equity");
  assert.ok(usEquityItem);
  assert.ok(!usEquityItem.tickerOptions.includes("VTI"));
});

test("preferred symbols improve candidate scoring without pinning absolute score", () => {
  const baseline = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile(),
    language: "zh",
    candidate: { symbol: "VFV", currency: "CAD", assetClass: "US Equity", securityType: "ETF" }
  });
  const preferred = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile({
      recommendationConstraints: {
        ...DEFAULT_RECOMMENDATION_CONSTRAINTS,
        preferredSymbols: ["VFV"]
      }
    }),
    language: "zh",
    candidate: { symbol: "VFV", currency: "CAD", assetClass: "US Equity", securityType: "ETF" }
  });

  assert.ok(preferred.securityScore > baseline.securityScore);
  assert.equal(preferred.preferredSymbolMatched, true);
});

test("advanced preference factors improve matching sector and style candidates", () => {
  const baseline = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile(),
    language: "zh",
    candidate: { symbol: "QQC", currency: "CAD", assetClass: "US Equity", securityType: "ETF" }
  });
  const tilted = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile({
      preferenceFactors: {
        ...DEFAULT_PREFERENCE_FACTORS,
        behavior: {
          ...DEFAULT_PREFERENCE_FACTORS.behavior,
          riskCapacity: "high"
        },
        sectorTilts: {
          ...DEFAULT_PREFERENCE_FACTORS.sectorTilts,
          preferredSectors: ["Technology"],
          styleTilts: ["Growth"]
        }
      }
    }),
    language: "zh",
    candidate: { symbol: "QQC", currency: "CAD", assetClass: "US Equity", securityType: "ETF" }
  });

  assert.ok(tilted.securityScore > baseline.securityScore);
  assert.ok(tilted.preferenceFitScore > baseline.preferenceFitScore);
});

test("economic exposure registry overrides misleading CAD-listed ETF asset class", () => {
  const result = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile(),
    language: "zh",
    candidate: {
      symbol: "ZQQ",
      name: "BMO Nasdaq 100 Equity Hedged to CAD Index ETF",
      currency: "CAD",
      assetClass: "Canadian Equity",
      securityType: "ETF"
    }
  });

  assert.equal(result.assetClass, "US Equity");
  assert.equal(result.assetClassSource, "known-universe");
});

test("economic exposure registry treats CGL.C as precious metals, not Canadian equity", () => {
  const result = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile(),
    language: "zh",
    candidate: {
      symbol: "CGL.C",
      name: "iShares Gold Bullion ETF",
      currency: "CAD",
      assetClass: "Canadian Equity",
      securityType: "Commodity ETF"
    }
  });

  assert.equal(result.assetClass, "Commodity");
  assert.equal(result.assetClassSource, "known-universe");
  assert.ok(
    result.drivers.some((driver) => driver.includes("账户落点")),
  );
});

test("advanced preference factors penalize avoided sector candidates", () => {
  const baseline = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile(),
    language: "zh",
    candidate: { symbol: "XEG", currency: "CAD", assetClass: "Canadian Equity", securityType: "ETF" }
  });
  const avoided = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile({
      preferenceFactors: {
        ...DEFAULT_PREFERENCE_FACTORS,
        sectorTilts: {
          ...DEFAULT_PREFERENCE_FACTORS.sectorTilts,
          avoidedSectors: ["Energy"]
        }
      }
    }),
    language: "zh",
    candidate: { symbol: "XEG", currency: "CAD", assetClass: "Canadian Equity", securityType: "ETF" }
  });

  assert.ok(avoided.securityScore < baseline.securityScore);
  assert.ok(avoided.warnings.some((warning) => warning.includes("回避")));
});

test("allowed security types penalize disallowed candidates without requiring fixed score snapshots", () => {
  const baseline = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile(),
    language: "zh",
    candidate: { symbol: "VFV", currency: "CAD", assetClass: "US Equity", securityType: "ETF" }
  });
  const restricted = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile({
      recommendationConstraints: {
        ...DEFAULT_RECOMMENDATION_CONSTRAINTS,
        allowedSecurityTypes: ["Common Stock"]
      }
    }),
    language: "zh",
    candidate: { symbol: "VFV", currency: "CAD", assetClass: "US Equity", securityType: "ETF" }
  });

  assert.ok(restricted.securityScore < baseline.securityScore);
});

test("asset-class bands constrain effective recommendation target percentages", () => {
  const run = buildRecommendationV2({
    accounts,
    holdings: [],
    profile: makeProfile({
      recommendationConstraints: {
        ...DEFAULT_RECOMMENDATION_CONSTRAINTS,
        assetClassBands: [{ assetClass: "US Equity", minPct: 0, maxPct: 35 }]
      }
    }),
    contributionAmountCad: 5000,
    language: "zh"
  });

  const usEquityItem = run.items.find((item) => item.assetClass === "US Equity");
  assert.ok(usEquityItem?.rationale);
  assert.equal(usEquityItem.rationale.targetPct, 35);
});
