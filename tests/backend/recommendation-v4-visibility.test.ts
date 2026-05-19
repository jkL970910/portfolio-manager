import assert from "node:assert/strict";
import test from "node:test";
import type {
  MobileSecurityObservation,
  PreferenceProfile,
  RecommendationRun,
} from "@/lib/backend/models";
import { DEFAULT_PREFERENCE_FACTORS } from "@/lib/backend/preference-factors";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";
import { buildRecommendationV4Visibility } from "@/lib/backend/recommendation-v4/visibility";
import type { RecommendationsData } from "@/lib/contracts";

function makeProfile(
  overrides: Partial<PreferenceProfile> = {},
): PreferenceProfile {
  return {
    id: "pref_test",
    userId: "user_test",
    riskProfile: "Growth",
    targetAllocation: [
      { assetClass: "US Equity", targetPct: 60 },
      { assetClass: "Fixed Income", targetPct: 20 },
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

function makeData(
  priorities: Partial<RecommendationsData["priorities"][number]>[] = [],
): RecommendationsData {
  return {
    contributionAmount: "CA$2,500",
    priorities: priorities.map((priority, index) => ({
      id: `priority_${index}`,
      assetClass: "US Equity",
      description: "补足 US Equity",
      amount: "CA$2,500",
      account: "TFSA",
      security: "VFV - Vanguard S&P 500",
      securityId: "sec_vfv_cad",
      securitySymbol: "VFV",
      securityExchange: "TSX",
      securityCurrency: "CAD",
      tickers: "VFV",
      accountFit: "",
      scoreline: "",
      gapSummary: "",
      alternatives: [],
      intelligenceRefs: [],
      whyThis: [],
      whyNot: [],
      constraints: [],
      execution: [],
      ...priority,
    })),
  } as unknown as RecommendationsData;
}

function observation(
  symbol: string,
  exchange: string | null,
  currency: "CAD" | "USD" | null,
): MobileSecurityObservation {
  return {
    id: `obs_${symbol}`,
    userId: "user_test",
    securityId: exchange && currency ? `sec_${symbol.toLowerCase()}` : null,
    symbol,
    exchange,
    currency,
    name: symbol,
    source: "search",
    observationCount: 1,
    lastObservedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("V4 visibility keeps selected priority eligible and dedupes watchlist", () => {
  const visibility = buildRecommendationV4Visibility({
    data: makeData([
      {
        security: "VFV - Vanguard S&P 500",
        securitySymbol: "VFV",
        securityExchange: "TSX",
        securityCurrency: "CAD",
      },
    ]),
    profile: makeProfile({ watchlistSymbols: ["VFV:TSX:CAD"] }),
    observations: [],
  });

  assert.ok(visibility.poolSnapshot.rawCount >= 1);
  assert.ok(visibility.poolSnapshot.eligibleCount >= 1);
  assert.ok(
    visibility.poolSnapshot.sourceBreakdown.some(
      (item) => item.source === "core_pool" && item.count > 0,
    ),
  );
});

test("V4 visibility exposes watchlist candidates that were not selected", () => {
  const visibility = buildRecommendationV4Visibility({
    data: makeData(),
    profile: makeProfile({ watchlistSymbols: ["AMZN:NASDAQ:USD"] }),
    observations: [],
  });

  assert.ok(visibility.poolSnapshot.rawCount > 1);
  assert.ok(visibility.poolSnapshot.eligibleCount > 0);
  assert.ok(
    visibility.poolSnapshot.sourceBreakdown.some(
      (item) => item.source === "watchlist" && item.count > 0,
    ),
  );
  assert.ok(
    visibility.rejectedCandidates.some(
      (candidate) => candidate.identity.symbol === "AMZN",
    ),
  );
  assert.equal(visibility.emptyState, null);
});

test("V4 visibility blocks incomplete watchlist identity", () => {
  const visibility = buildRecommendationV4Visibility({
    data: makeData(),
    profile: makeProfile({ watchlistSymbols: ["RY"] }),
    observations: [],
  });

  assert.equal(visibility.poolSnapshot.needsIdentityCount, 1);
  assert.equal(
    visibility.rejectedCandidates[0]?.reasons[0]?.code,
    "identity_missing",
  );
});

test("V4 visibility includes recent observations in raw pool", () => {
  const visibility = buildRecommendationV4Visibility({
    data: makeData(),
    profile: makeProfile(),
    observations: [observation("GEV", "NYSE", "USD")],
  });

  assert.ok(visibility.poolSnapshot.rawCount > 1);
  assert.ok(
    visibility.poolSnapshot.sourceBreakdown.some(
      (item) => item.source === "recent_observation" && item.count > 0,
    ),
  );
  assert.ok(
    visibility.rejectedCandidates.some(
      (candidate) => candidate.identity.symbol === "GEV",
    ),
  );
});

test("V4 visibility uses persisted pool evaluation when available", () => {
  const poolEvaluation: RecommendationRun["poolEvaluation"] = {
    version: "v4-pool-evaluation",
    generatedAt: new Date().toISOString(),
    rawCount: 2,
    eligibleCount: 1,
    rejectedCount: 1,
    evaluations: [
      {
        assetClass: "US Equity",
        policy: {
          includeRoles: ["core"],
          excludeRoles: ["cash_parking"],
          minProviderConfidence: "medium",
          minLiquidityScore: 50,
        },
        eligibleCandidates: [
          {
            symbol: "VFV",
            name: "Vanguard S&P 500",
            exchange: "TSX",
            currency: "CAD",
            source: "core_pool",
            role: "core",
            providerConfidence: "high",
          },
        ],
        rejectedCandidates: [
          {
            symbol: "AMZN",
            name: "Amazon",
            exchange: "NASDAQ",
            currency: "USD",
            source: "watchlist",
            role: "satellite",
            providerConfidence: "high",
            reasons: ["当前进货规矩排除 satellite 候选"],
          },
        ],
        poolStatus: { status: "ok" },
      },
    ],
  };
  const visibility = buildRecommendationV4Visibility({
    data: makeData(),
    profile: makeProfile({ watchlistSymbols: ["GEV:NYSE:USD"] }),
    observations: [observation("PLTR", "NYSE", "USD")],
    poolEvaluation,
  });

  assert.equal(visibility.poolSnapshot.rawCount, 2);
  assert.equal(visibility.poolSnapshot.eligibleCount, 1);
  assert.deepEqual(visibility.policy.includeRoles, ["core"]);
  assert.deepEqual(visibility.policy.excludeRoles, ["cash_parking"]);
  assert.ok(
    visibility.rejectedCandidates.some(
      (candidate) => candidate.identity.symbol === "AMZN",
    ),
  );
  assert.equal(
    visibility.rejectedCandidates.some(
      (candidate) => candidate.identity.symbol === "GEV",
    ),
    false,
  );
});
