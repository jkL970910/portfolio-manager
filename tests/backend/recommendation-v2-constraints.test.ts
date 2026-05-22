import assert from "node:assert/strict";
import test from "node:test";
import type {
  InvestmentAccount,
  PreferenceProfile,
  RegisteredAccountRoom,
} from "@/lib/backend/models";
import { DEFAULT_PREFERENCE_FACTORS } from "@/lib/backend/preference-factors";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";
import { buildRecommendationV2, scoreCandidateSecurity } from "@/lib/backend/recommendation-v2";
import { buildCandidateBrief } from "@/lib/backend/recommendation-v3/candidate-brief";
import {
  buildCandidatePoolPolicy,
  evaluateCandidatePool,
} from "@/lib/backend/recommendation-v3/candidate-pool-policy";
import { listRecommendationCandidates } from "@/lib/backend/recommendation-v3/candidate-provider";

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

test("over-strict policy returns relaxation status instead of forcing a default candidate", () => {
  const run = buildRecommendationV2({
    accounts,
    holdings: [],
    profile: makeProfile({
      recommendationConstraints: {
        ...DEFAULT_RECOMMENDATION_CONSTRAINTS,
        excludedSymbols: ["VFV", "XUU", "VOO", "VTI", "QQC", "XUS"],
      },
    }),
    contributionAmountCad: 5000,
    language: "zh",
  });

  const usEquityItem = run.items.find((item) => item.assetClass === "US Equity");

  assert.equal(usEquityItem, undefined);
  assert.equal(run.poolStatus?.status, "needs_policy_relaxation");
  assert.ok(
    run.notes?.some((note) => note.includes("进货规矩过严")),
  );
});

test("candidate role constraints can exclude satellite candidates before scoring", () => {
  const pool = evaluateCandidatePool({
    candidates: listRecommendationCandidates({
      assetClass: "US Equity",
      watchlistSymbols: ["AAPL:NASDAQ:USD"],
      securities: [
        {
          id: "sec_aapl",
          symbol: "AAPL",
          name: "Apple Inc.",
          currency: "USD",
          canonicalExchange: "NASDAQ",
          micCode: "XNAS",
          securityType: "Common Stock",
          marketSector: "Technology",
          country: "US",
          underlyingId: null,
          economicAssetClass: "US Equity",
          economicSector: "Technology",
          exposureRegion: "US",
          metadataSource: "manual",
          metadataConfidence: 90,
          metadataAsOf: null,
          metadataConfirmedAt: null,
          metadataNotes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }),
    policy: buildCandidatePoolPolicy({
      profile: makeProfile({
        recommendationConstraints: {
          ...DEFAULT_RECOMMENDATION_CONSTRAINTS,
          excludedCandidateRoles: ["satellite"],
        },
      }),
      assetClass: "US Equity",
      portfolioCashPct: 10,
    }),
    constraints: {
      ...DEFAULT_RECOMMENDATION_CONSTRAINTS,
      excludedCandidateRoles: ["satellite"],
    },
    assetClass: "US Equity",
  });

  assert.ok(
    pool.rejectedCandidates.some(
      (item) =>
        item.candidate.symbol === "AAPL" &&
        item.reasons.some((reason) => reason.includes("卫星标的")),
    ),
  );
});

test("relaxed core fallback is explicit and does not run by default", () => {
  const strictProfile = makeProfile({
    recommendationConstraints: {
      ...DEFAULT_RECOMMENDATION_CONSTRAINTS,
      includedCandidateRoles: ["satellite"],
      excludedCandidateRoles: ["core"],
    },
  });
  const strictRun = buildRecommendationV2({
    accounts,
    holdings: [],
    profile: strictProfile,
    contributionAmountCad: 5000,
    language: "zh",
  });
  const relaxedRun = buildRecommendationV2({
    accounts,
    holdings: [],
    profile: strictProfile,
    contributionAmountCad: 5000,
    language: "zh",
    fallbackMode: "core_only_relaxed",
  });

  assert.equal(strictRun.poolStatus?.status, "needs_policy_relaxation");
  assert.equal(relaxedRun.poolStatus?.status, "ok");
  assert.ok(relaxedRun.items.some((item) => item.assetClass === "US Equity"));
});

test("shared registered room overrides duplicate account-level room for placement", () => {
  const duplicateRoomAccounts: InvestmentAccount[] = [
    {
      id: "acct_tfsa_a",
      userId: "user_test",
      institution: "Broker A",
      type: "TFSA",
      nickname: "TFSA A",
      currency: "CAD",
      marketValueCad: 25000,
      contributionRoomCad: 10000,
    },
    {
      id: "acct_tfsa_b",
      userId: "user_test",
      institution: "Broker B",
      type: "TFSA",
      nickname: "TFSA B",
      currency: "CAD",
      marketValueCad: 25000,
      contributionRoomCad: 10000,
    },
    {
      id: "acct_taxable",
      userId: "user_test",
      institution: "Broker C",
      type: "Taxable",
      nickname: "Taxable",
      currency: "CAD",
      marketValueCad: 10000,
      contributionRoomCad: null,
    },
  ];
  const registeredRooms: RegisteredAccountRoom[] = [
    {
      id: "room_tfsa_zero",
      userId: "user_test",
      accountType: "TFSA",
      taxYear: new Date().getFullYear(),
      remainingRoomCad: 0,
      note: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const run = buildRecommendationV2({
    accounts: duplicateRoomAccounts,
    holdings: [],
    profile: makeProfile({
      accountFundingPriority: ["TFSA", "Taxable", "RRSP"],
      riskProfile: "Conservative",
    }),
    contributionAmountCad: 5000,
    language: "zh",
    registeredRooms,
  });

  assert.ok(
    run.items.every((item) => item.targetAccountType !== "TFSA"),
    "TFSA should not be selected when shared TFSA room is zero.",
  );
});

test("candidate pool policy can hide routine cash for high-risk profiles", () => {
  const profile = makeProfile({
    preferenceFactors: {
      ...DEFAULT_PREFERENCE_FACTORS,
      behavior: {
        ...DEFAULT_PREFERENCE_FACTORS.behavior,
        riskCapacity: "high",
      },
      liquidity: {
        ...DEFAULT_PREFERENCE_FACTORS.liquidity,
        liquidityNeed: "low",
      },
    },
  });
  const policy = buildCandidatePoolPolicy({
    profile,
    assetClass: "US Equity",
    portfolioCashPct: 10,
  });

  assert.equal(policy.allowCashParking, false);
  assert.ok(policy.excludeRoles.includes("cash_parking"));
});

test("cash candidates re-enter when cash sleeve itself has a target gap", () => {
  const profile = makeProfile({
    preferenceFactors: {
      ...DEFAULT_PREFERENCE_FACTORS,
      behavior: {
        ...DEFAULT_PREFERENCE_FACTORS.behavior,
        riskCapacity: "high",
      },
      liquidity: {
        ...DEFAULT_PREFERENCE_FACTORS.liquidity,
        liquidityNeed: "low",
      },
    },
  });
  const policy = buildCandidatePoolPolicy({
    profile,
    assetClass: "Cash",
    portfolioCashPct: 10,
  });
  const pool = evaluateCandidatePool({
    candidates: listRecommendationCandidates({
      assetClass: "Cash",
      watchlistSymbols: [],
    }),
    policy,
    constraints: profile.recommendationConstraints,
    assetClass: "Cash",
  });

  assert.equal(policy.allowCashParking, true);
  assert.equal(pool.poolStatus.status, "ok");
  assert.ok(pool.eligibleCandidates.some((candidate) => candidate.role === "cash_parking"));
});

test("recommendation run exposes candidate brief for the purchase workbench", () => {
  const run = buildRecommendationV2({
    accounts,
    holdings: [],
    profile: makeProfile(),
    contributionAmountCad: 2500,
    language: "zh"
  });
  const firstItem = run.items[0];
  assert.ok(firstItem);

  const brief = buildCandidateBrief(firstItem);

  assert.ok(brief.identity.symbol);
  assert.ok(brief.decision.recommendedAmountCad > 0);
  assert.ok(["lump_sum", "dca", "wait_pullback", "avoid"].includes(brief.decision.action));
  assert.ok(brief.badges.length > 0);
  assert.equal(brief.dailyBriefId, null);
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

test("watchlist identity keys match exact listing before ticker fallback", () => {
  const usListing = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile({
      watchlistSymbols: ["AAPL:NASDAQ:USD"]
    }),
    language: "zh",
    candidate: {
      symbol: "AAPL",
      exchange: "NASDAQ",
      name: "Apple Inc.",
      currency: "USD",
      assetClass: "US Equity",
      securityType: "Common Stock"
    }
  });
  const cadListing = scoreCandidateSecurity({
    accounts,
    holdings: [],
    profile: makeProfile({
      watchlistSymbols: ["AAPL:NASDAQ:USD"]
    }),
    language: "zh",
    candidate: {
      symbol: "AAPL",
      exchange: "NEO",
      name: "Apple Inc. CDR",
      currency: "CAD",
      assetClass: "US Equity",
      securityType: "Common Stock"
    }
  });

  assert.equal(usListing.watchlistMatched, true);
  assert.equal(cadListing.watchlistMatched, false);
});

test("watchlist candidates can enter the recommendation pool when identity and sleeve match", () => {
  const candidates = listRecommendationCandidates({
    assetClass: "US Equity",
    watchlistSymbols: ["AMZN:NASDAQ:USD"],
  });

  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.symbol === "AMZN" &&
        candidate.exchange === "NASDAQ" &&
        candidate.currency === "USD" &&
        candidate.source === "watchlist",
    ),
  );
});

test("recent observations can enter the recommendation pool when identity and sleeve match", () => {
  const candidates = listRecommendationCandidates({
    assetClass: "US Equity",
    watchlistSymbols: [],
    observations: [
      {
        id: "obs_gev",
        userId: "user_test",
        securityId: null,
        symbol: "GEV",
        exchange: "NYSE",
        currency: "USD",
        name: "GE Vernova",
        source: "search",
        observationCount: 1,
        lastObservedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.symbol === "GEV" &&
        candidate.exchange === "NYSE" &&
        candidate.currency === "USD" &&
        candidate.source === "recent_observation",
    ),
  );
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

test("recommendation run does not route new money into overweight sleeves", () => {
  const run = buildRecommendationV2({
    accounts,
    holdings: [
      {
        id: "holding_us_equity",
        userId: "user_test",
        accountId: "acct_rrsp",
        symbol: "VTI",
        name: "Vanguard Total Stock Market ETF",
        assetClass: "US Equity",
        sector: "Broad Market",
        marketValueCad: 60000,
        weightPct: 60,
        gainLossPct: 0,
        quantity: 100,
        costBasisCad: 500,
        lastPriceAmount: 600,
        lastPriceCad: 600,
        currency: "USD",
        exchangeOverride: "NYSE",
        securityTypeOverride: "ETF",
        updatedAt: "2026-05-10T00:00:00.000Z",
      },
      {
        id: "holding_canadian_equity",
        userId: "user_test",
        accountId: "acct_tfsa",
        symbol: "VCN",
        name: "Vanguard FTSE Canada All Cap Index ETF",
        assetClass: "Canadian Equity",
        sector: "Broad Market",
        marketValueCad: 15000,
        weightPct: 15,
        gainLossPct: 0,
        quantity: 100,
        costBasisCad: 150,
        lastPriceAmount: 150,
        lastPriceCad: 150,
        currency: "CAD",
        exchangeOverride: "TSX",
        securityTypeOverride: "ETF",
        updatedAt: "2026-05-10T00:00:00.000Z",
      },
      {
        id: "holding_international_equity",
        userId: "user_test",
        accountId: "acct_tfsa",
        symbol: "XEF",
        name: "iShares Core MSCI EAFE IMI Index ETF",
        assetClass: "International Equity",
        sector: "Broad Market",
        marketValueCad: 15000,
        weightPct: 15,
        gainLossPct: 0,
        quantity: 100,
        costBasisCad: 150,
        lastPriceAmount: 150,
        lastPriceCad: 150,
        currency: "CAD",
        exchangeOverride: "TSX",
        securityTypeOverride: "ETF",
        updatedAt: "2026-05-10T00:00:00.000Z",
      },
      {
        id: "holding_fixed_income",
        userId: "user_test",
        accountId: "acct_tfsa",
        symbol: "XBB",
        name: "iShares Core Canadian Universe Bond Index ETF",
        assetClass: "Fixed Income",
        sector: "Fixed Income",
        marketValueCad: 5000,
        weightPct: 5,
        gainLossPct: 0,
        quantity: 100,
        costBasisCad: 50,
        lastPriceAmount: 50,
        lastPriceCad: 50,
        currency: "CAD",
        exchangeOverride: "TSX",
        securityTypeOverride: "ETF",
        updatedAt: "2026-05-10T00:00:00.000Z",
      },
      {
        id: "holding_cash",
        userId: "user_test",
        accountId: "acct_tfsa",
        symbol: "CASH",
        name: "Global X High Interest Savings ETF",
        assetClass: "Cash",
        sector: "Cash",
        marketValueCad: 5000,
        weightPct: 5,
        gainLossPct: 0,
        quantity: 100,
        costBasisCad: 50,
        lastPriceAmount: 50,
        lastPriceCad: 50,
        currency: "CAD",
        exchangeOverride: "TSX",
        securityTypeOverride: "ETF",
        updatedAt: "2026-05-10T00:00:00.000Z",
      },
    ],
    profile: makeProfile({
      targetAllocation: [
        { assetClass: "Canadian Equity", targetPct: 10 },
        { assetClass: "US Equity", targetPct: 40 },
        { assetClass: "International Equity", targetPct: 15 },
        { assetClass: "Fixed Income", targetPct: 5 },
        { assetClass: "Cash", targetPct: 5 },
      ],
    }),
    contributionAmountCad: 5000,
    language: "zh",
  });

  assert.equal(run.items.length, 0);
  assert.ok(
    run.notes?.some((note) => note.includes("不强行把新增资金放进已经达标或超配的袖口")),
  );
});

test("candidate scoring uses high-confidence security metadata for asset class", () => {
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
      securityType: "ETF",
      metadata: {
        economicAssetClass: "Commodity",
        economicSector: "Precious Metals",
        exposureRegion: null,
        source: "provider",
        confidence: 92,
        asOf: "2026-05-03T00:00:00.000Z",
        confirmedAt: null,
        notes: "ETF metadata provider classified gold exposure.",
      },
    },
  });

  assert.equal(result.assetClass, "Commodity");
  assert.equal(result.assetClassSource, "metadata");
});
