import assert from "node:assert/strict";
import test from "node:test";
import { preferenceProfileInputSchema } from "@/lib/backend/payload-schemas";

function makePreferencePayload(overrides: Record<string, unknown> = {}) {
  return {
    riskProfile: "Growth",
    targetAllocation: [
      { assetClass: "Canadian Equity", targetPct: 10 },
      { assetClass: "US Equity", targetPct: 60 },
      { assetClass: "International Equity", targetPct: 15 },
      { assetClass: "Fixed Income", targetPct: 10 },
      { assetClass: "Cash", targetPct: 5 }
    ],
    accountFundingPriority: ["TFSA", "RRSP", "Taxable"],
    taxAwarePlacement: true,
    cashBufferTargetCad: 10000,
    transitionPreference: "gradual",
    recommendationStrategy: "balanced",
    source: "manual",
    rebalancingTolerancePct: 5,
    watchlistSymbols: ["VFV"],
    ...overrides
  };
}

test("preference schema remains backward compatible without recommendation constraints", () => {
  const parsed = preferenceProfileInputSchema.safeParse(makePreferencePayload());

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.recommendationConstraints, undefined);
    assert.equal(parsed.data.preferenceFactors, undefined);
  }
});

test("preference schema accepts richer preference factors for V3 planning", () => {
  const parsed = preferenceProfileInputSchema.safeParse(makePreferencePayload({
    preferenceFactors: {
      behavior: {
        riskCapacity: "high",
        maxDrawdownComfortPct: 35,
        volatilityComfort: "high",
        concentrationTolerance: "high",
        leverageAllowed: false,
        optionsAllowed: false,
        cryptoAllowed: false
      },
      sectorTilts: {
        preferredSectors: ["Technology", "Energy"],
        avoidedSectors: ["Tobacco"],
        styleTilts: ["Growth", "Quality"],
        thematicInterests: ["AI infrastructure"]
      },
      lifeGoals: {
        homePurchase: {
          enabled: true,
          horizonYears: 4,
          downPaymentTargetCad: 180000,
          priority: "high"
        },
        emergencyFundTargetCad: 30000,
        expectedLargeExpenses: ["Home down payment"],
        retirementHorizonYears: 30
      },
      taxStrategy: {
        province: "ON",
        marginalTaxBracket: "medium",
        rrspDeductionPriority: "medium",
        tfsaGrowthPriority: "high",
        fhsaHomeGoalPriority: "high",
        taxableTaxSensitivity: "high",
        dividendWithholdingSensitivity: "medium",
        usdFundingPath: "available"
      },
      liquidity: {
        monthlyContributionCad: 2500,
        minimumTradeSizeCad: 500,
        liquidityNeed: "medium",
        cashDuringUncertainty: "low"
      },
      externalInfo: {
        allowNewsSignals: true,
        allowInstitutionalSignals: true,
        allowCommunitySignals: false,
        preferredFreshnessHours: 12,
        maxDailyExternalCalls: 10
      }
    }
  }));

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.preferenceFactors?.behavior?.riskCapacity, "high");
    assert.equal(parsed.data.preferenceFactors?.taxStrategy?.usdFundingPath, "available");
  }
});

test("preference schema rejects invalid preference factor bounds", () => {
  const parsed = preferenceProfileInputSchema.safeParse(makePreferencePayload({
    preferenceFactors: {
      behavior: { maxDrawdownComfortPct: 120 },
      sectorTilts: {
        preferredSectors: Array.from({ length: 21 }, (_, index) => `Sector${index}`)
      }
    }
  }));

  assert.equal(parsed.success, false);
});

test("preference schema accepts resolved recommendation security identities", () => {
  const parsed = preferenceProfileInputSchema.safeParse(makePreferencePayload({
    recommendationConstraints: {
      excludedSymbols: ["AMZN"],
      preferredSymbols: ["VFV"],
      excludedSecurities: [
        { symbol: "AMZN", exchange: "NASDAQ", currency: "USD", name: "Amazon.com", provider: "twelve-data" }
      ],
      preferredSecurities: [
        { symbol: "VFV", exchange: "TSX", currency: "CAD", name: "Vanguard S&P 500 Index ETF", provider: "yahoo" }
      ],
      assetClassBands: [{ assetClass: "US Equity", minPct: 20, maxPct: 55 }],
      avoidAccountTypes: ["Taxable"],
      preferredAccountTypes: ["TFSA"],
      allowedSecurityTypes: ["ETF", "Common Stock"]
    }
  }));

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.recommendationConstraints?.excludedSecurities[0]?.currency, "USD");
    assert.equal(parsed.data.recommendationConstraints?.preferredSecurities[0]?.exchange, "TSX");
  }
});

test("preference schema rejects malformed recommendation security identity currency", () => {
  const parsed = preferenceProfileInputSchema.safeParse(makePreferencePayload({
    recommendationConstraints: {
      excludedSecurities: [
        { symbol: "7203", exchange: "TSE", currency: "JPY" }
      ]
    }
  }));

  assert.equal(parsed.success, false);
});

test("preference schema rejects asset-class bands where minimum exceeds maximum", () => {
  const parsed = preferenceProfileInputSchema.safeParse(makePreferencePayload({
    recommendationConstraints: {
      assetClassBands: [{ assetClass: "US Equity", minPct: 70, maxPct: 30 }]
    }
  }));

  assert.equal(parsed.success, false);
});

test("preference schema rejects oversized recommendation constraint lists", () => {
  const parsed = preferenceProfileInputSchema.safeParse(makePreferencePayload({
    recommendationConstraints: {
      excludedSymbols: Array.from({ length: 51 }, (_, index) => `TEST${index}`)
    }
  }));

  assert.equal(parsed.success, false);
});
