import {
  AccountType,
  CurrencyCode,
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
  RecommendationRun
} from "@/lib/backend/models";
import { getAssetClassLabel, getAccountTypeLabel, getRiskProfileLabel } from "@/lib/i18n/finance";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";
import {
  getHoldingEconomicAssetClass,
  inferEconomicAssetClass,
  isEconomicExposureDifferent
} from "@/lib/backend/security-economic-exposure";

const DEFAULT_TARGETS_BY_RISK = {
  Conservative: [
    { assetClass: "Canadian Equity", targetPct: 18 },
    { assetClass: "US Equity", targetPct: 22 },
    { assetClass: "International Equity", targetPct: 10 },
    { assetClass: "Fixed Income", targetPct: 35 },
    { assetClass: "Cash", targetPct: 15 }
  ],
  Balanced: [
    { assetClass: "Canadian Equity", targetPct: 22 },
    { assetClass: "US Equity", targetPct: 32 },
    { assetClass: "International Equity", targetPct: 16 },
    { assetClass: "Fixed Income", targetPct: 20 },
    { assetClass: "Cash", targetPct: 10 }
  ],
  Growth: [
    { assetClass: "Canadian Equity", targetPct: 16 },
    { assetClass: "US Equity", targetPct: 42 },
    { assetClass: "International Equity", targetPct: 22 },
    { assetClass: "Fixed Income", targetPct: 10 },
    { assetClass: "Cash", targetPct: 10 }
  ]
} as const;

type SecurityCandidate = {
  symbol: string;
  name: string;
  assetClass: string;
  currency: CurrencyCode;
  securityType?: string;
  expenseBps: number;
  liquidityScore: number;
  tags: string[];
};

type FxPolicy = {
  hasUsdFundingPath: boolean;
  brokerFxFrictionBps: number;
  allowCrossCurrencyTrades: boolean;
  preferredTradingCurrency: "CAD" | "USD" | "mixed";
};

export type CandidateSecurityScoreInput = {
  symbol: string;
  name?: string;
  currency?: CurrencyCode;
  assetClass?: string;
  securityType?: string | null;
};

export type CandidateSecurityScoreResult = {
  symbol: string;
  name: string;
  assetClass: string;
  assetClassSource: "explicit" | "existing-holding" | "known-universe" | "heuristic";
  currency: CurrencyCode;
  score: number;
  verdict: "strong" | "watch" | "weak";
  watchlistMatched: boolean;
  preferredSymbolMatched: boolean;
  selectedAccountType: AccountType;
  selectedAccountName: string;
  accountFitScore: number;
  taxFitScore: number;
  securityScore: number;
  preferenceFitScore: number;
  fxPenaltyBps: number;
  summary: string;
  drivers: string[];
  warnings: string[];
};

type AccountScore = {
  account: InvestmentAccount;
  accountFitScore: number;
  taxFitScore: number;
  fxPenaltyBps: number;
};

function isAccountEligibleForContribution(account: InvestmentAccount) {
  if (account.type === "Taxable") {
    return true;
  }

  if (account.contributionRoomCad == null) {
    return true;
  }

  return account.contributionRoomCad > 0;
}

const SECURITY_UNIVERSE: Record<string, SecurityCandidate[]> = {
  "Canadian Equity": [
    { symbol: "VCN", name: "Vanguard FTSE Canada All Cap Index ETF", assetClass: "Canadian Equity", currency: "CAD", expenseBps: 6, liquidityScore: 94, tags: ["broad-market"] },
    { symbol: "XIC", name: "iShares Core S&P/TSX Capped Composite ETF", assetClass: "Canadian Equity", currency: "CAD", expenseBps: 6, liquidityScore: 95, tags: ["broad-market"] },
    { symbol: "ZCN", name: "BMO S&P/TSX Capped Composite Index ETF", assetClass: "Canadian Equity", currency: "CAD", expenseBps: 6, liquidityScore: 90, tags: ["broad-market"] },
    { symbol: "XIT", name: "iShares S&P/TSX Capped Information Technology Index ETF", assetClass: "Canadian Equity", currency: "CAD", expenseBps: 61, liquidityScore: 72, tags: ["sector", "technology", "growth"] },
    { symbol: "XEG", name: "iShares S&P/TSX Capped Energy Index ETF", assetClass: "Canadian Equity", currency: "CAD", expenseBps: 61, liquidityScore: 82, tags: ["sector", "energy", "cyclical"] }
  ],
  "US Equity": [
    { symbol: "VFV", name: "Vanguard S&P 500 Index ETF", assetClass: "US Equity", currency: "CAD", expenseBps: 9, liquidityScore: 97, tags: ["cad-listed", "core"] },
    { symbol: "XUU", name: "iShares Core S&P U.S. Total Market Index ETF", assetClass: "US Equity", currency: "CAD", expenseBps: 7, liquidityScore: 92, tags: ["cad-listed", "core"] },
    { symbol: "VTI", name: "Vanguard Total Stock Market ETF", assetClass: "US Equity", currency: "USD", expenseBps: 3, liquidityScore: 99, tags: ["usd-listed", "core"] },
    { symbol: "QQC", name: "Invesco NASDAQ 100 Index ETF", assetClass: "US Equity", currency: "CAD", expenseBps: 20, liquidityScore: 78, tags: ["cad-listed", "technology", "growth", "nasdaq-100"] },
    { symbol: "XUS", name: "iShares Core S&P 500 Index ETF", assetClass: "US Equity", currency: "CAD", expenseBps: 10, liquidityScore: 88, tags: ["cad-listed", "core", "quality"] }
  ],
  "International Equity": [
    { symbol: "XEF", name: "iShares Core MSCI EAFE IMI Index ETF", assetClass: "International Equity", currency: "CAD", expenseBps: 22, liquidityScore: 90, tags: ["developed"] },
    { symbol: "VIU", name: "Vanguard FTSE Developed All Cap ex North America Index ETF", assetClass: "International Equity", currency: "CAD", expenseBps: 23, liquidityScore: 88, tags: ["developed"] },
    { symbol: "XAW", name: "iShares Core MSCI All Country World ex Canada Index ETF", assetClass: "International Equity", currency: "CAD", expenseBps: 22, liquidityScore: 91, tags: ["all-world"] }
  ],
  "Fixed Income": [
    { symbol: "XBB", name: "iShares Core Canadian Universe Bond Index ETF", assetClass: "Fixed Income", currency: "CAD", expenseBps: 9, liquidityScore: 95, tags: ["core-bonds"] },
    { symbol: "ZAG", name: "BMO Aggregate Bond Index ETF", assetClass: "Fixed Income", currency: "CAD", expenseBps: 9, liquidityScore: 92, tags: ["core-bonds"] },
    { symbol: "VAB", name: "Vanguard Canadian Aggregate Bond Index ETF", assetClass: "Fixed Income", currency: "CAD", expenseBps: 8, liquidityScore: 89, tags: ["core-bonds"] }
  ],
  Commodity: [
    { symbol: "CGL.C", name: "iShares Gold Bullion ETF", assetClass: "Commodity", currency: "CAD", expenseBps: 55, liquidityScore: 78, tags: ["gold", "precious-metals", "commodity", "defensive"] },
    { symbol: "PHYS", name: "Sprott Physical Gold Trust", assetClass: "Commodity", currency: "USD", expenseBps: 41, liquidityScore: 82, tags: ["gold", "precious-metals", "commodity"] },
    { symbol: "GLD", name: "SPDR Gold Shares", assetClass: "Commodity", currency: "USD", expenseBps: 40, liquidityScore: 95, tags: ["gold", "precious-metals", "commodity"] }
  ],
  Cash: [
    { symbol: "CASH", name: "Global X High Interest Savings ETF", assetClass: "Cash", currency: "CAD", expenseBps: 11, liquidityScore: 96, tags: ["cash-parking"] },
    { symbol: "PSA", name: "Purpose High Interest Savings ETF", assetClass: "Cash", currency: "CAD", expenseBps: 15, liquidityScore: 92, tags: ["cash-parking"] },
    { symbol: "HSAV", name: "Horizons Cash Maximizer ETF", assetClass: "Cash", currency: "CAD", expenseBps: 18, liquidityScore: 88, tags: ["cash-parking"] }
  ]
};

const ACCOUNT_FIT_MATRIX: Record<string, Record<AccountType, number>> = {
  "Canadian Equity": { TFSA: 0.9, RRSP: 0.82, FHSA: 0.9, Taxable: 0.78 },
  "US Equity": { TFSA: 0.74, RRSP: 0.95, FHSA: 0.78, Taxable: 0.68 },
  "International Equity": { TFSA: 0.72, RRSP: 0.86, FHSA: 0.74, Taxable: 0.5 },
  "Fixed Income": { TFSA: 0.66, RRSP: 0.95, FHSA: 0.78, Taxable: 0.24 },
  Commodity: { TFSA: 0.76, RRSP: 0.7, FHSA: 0.56, Taxable: 0.62 },
  Cash: { TFSA: 0.78, RRSP: 0.56, FHSA: 0.9, Taxable: 0.72 }
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function candidateMatchesAny(candidate: SecurityCandidate, tokens: string[]) {
  if (tokens.length === 0) {
    return false;
  }
  const candidateTokens = new Set(
    [candidate.assetClass, candidate.securityType ?? "", ...candidate.tags]
      .map(normalizeToken)
      .filter(Boolean)
  );
  return tokens
    .map(normalizeToken)
    .some((token) =>
      candidateTokens.has(token) ||
      [...candidateTokens].some((candidateToken) =>
        candidateToken.includes(token) || token.includes(candidateToken)
      )
    );
}

function getPreferenceFitAdjustment(
  profile: PreferenceProfile,
  candidate: SecurityCandidate,
  existingHolding: HoldingPosition | undefined
) {
  const factors = profile.preferenceFactors;
  const preferredTiltMatched =
    candidateMatchesAny(candidate, factors.sectorTilts.preferredSectors) ||
    candidateMatchesAny(candidate, factors.sectorTilts.styleTilts) ||
    candidateMatchesAny(candidate, factors.sectorTilts.thematicInterests);
  const avoidedTiltMatched = candidateMatchesAny(
    candidate,
    factors.sectorTilts.avoidedSectors
  );
  const isEquity =
    candidate.assetClass === "Canadian Equity" ||
    candidate.assetClass === "US Equity" ||
    candidate.assetClass === "International Equity";
  const riskCapacityBoost =
    factors.behavior.riskCapacity === "high" && isEquity ? 0.03 : 0;
  const lowRiskPenalty =
    factors.behavior.riskCapacity === "low" && isEquity ? 0.06 : 0;
  const preferredBoost = preferredTiltMatched ? 0.08 : 0;
  const avoidedPenalty = avoidedTiltMatched ? 0.18 : 0;
  const homeGoalPenalty =
    factors.lifeGoals.homePurchase.enabled &&
    factors.lifeGoals.homePurchase.priority === "high" &&
    factors.lifeGoals.homePurchase.horizonYears != null &&
    factors.lifeGoals.homePurchase.horizonYears <= 5 &&
    isEquity
      ? 0.04
      : 0;
  const concentrationThreshold =
    factors.behavior.concentrationTolerance === "high"
      ? 20
      : factors.behavior.concentrationTolerance === "low"
        ? 8
        : 12;
  const concentrationPenalty =
    existingHolding && existingHolding.weightPct >= concentrationThreshold
      ? factors.behavior.concentrationTolerance === "high"
        ? 0.06
        : factors.behavior.concentrationTolerance === "low"
          ? 0.14
          : 0.1
      : 0;

  return {
    adjustment: clamp(
      preferredBoost + riskCapacityBoost -
        avoidedPenalty -
        lowRiskPenalty -
        homeGoalPenalty -
        concentrationPenalty,
      -0.32,
      0.18
    ),
    score: round(
      clamp(
        70 +
          preferredBoost * 100 +
          riskCapacityBoost * 100 -
          avoidedPenalty * 100 -
          lowRiskPenalty * 100 -
          homeGoalPenalty * 100 -
          concentrationPenalty * 100,
        0,
        100
      ),
      1
    ),
    signals: [
      ...(preferredTiltMatched ? ["preference-tilt-match"] : []),
      ...(avoidedTiltMatched ? ["avoided-tilt-match"] : []),
      ...(homeGoalPenalty > 0 ? ["home-goal-risk-buffer"] : []),
      ...(concentrationPenalty > 0 ? ["concentration-tolerance"] : [])
    ]
  };
}

function getTargetAllocation(profile: PreferenceProfile) {
  return profile.targetAllocation.length > 0
    ? profile.targetAllocation
    : DEFAULT_TARGETS_BY_RISK[profile.riskProfile];
}

function getCurrentAllocationFromHoldings(holdings: HoldingPosition[]) {
  const total = holdings.reduce((sum, holding) => sum + holding.marketValueCad, 0);
  const allocation = new Map<string, number>();
  if (total <= 0) {
    return { total, allocation };
  }

  for (const holding of holdings) {
    const assetClass = getHoldingEconomicAssetClass(holding);
    allocation.set(assetClass, (allocation.get(assetClass) ?? 0) + holding.marketValueCad);
  }

  return {
    total,
    allocation: new Map(
      [...allocation.entries()].map(([assetClass, value]) => [assetClass, round((value / total) * 100, 2)])
    )
  };
}

const ASSET_CLASS_RISK_WEIGHTS: Record<string, number> = {
  "Canadian Equity": 1,
  "US Equity": 1.12,
  "International Equity": 1.08,
  "Fixed Income": 0.42,
  Commodity: 1.05,
  Cash: 0.08
};

function inferFxPolicy(accounts: InvestmentAccount[], holdings: HoldingPosition[]): FxPolicy {
  const hasUsdAccount = accounts.some((account) => (account.currency ?? "CAD") === "USD");
  const hasUsdHoldings = holdings.some((holding) => (holding.currency ?? "CAD") === "USD");

  return {
    hasUsdFundingPath: hasUsdAccount,
    brokerFxFrictionBps: hasUsdAccount ? 25 : 150,
    allowCrossCurrencyTrades: true,
    preferredTradingCurrency: hasUsdAccount || hasUsdHoldings ? "mixed" : "CAD"
  };
}

function scoreAccountPlacement(
  accounts: InvestmentAccount[],
  profile: PreferenceProfile,
  assetClass: string,
  securityCurrency: CurrencyCode,
  fxPolicy: FxPolicy
): AccountScore {
  const eligibleAccounts = accounts.filter(isAccountEligibleForContribution);
  const scoringPool = eligibleAccounts.length > 0 ? eligibleAccounts : accounts;
  const orderedAccounts = [...scoringPool].sort((left, right) => {
    const leftRank = profile.accountFundingPriority.indexOf(left.type);
    const rightRank = profile.accountFundingPriority.indexOf(right.type);
    return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
  });

  const scores = orderedAccounts.map((account) => {
    const baseScore = ACCOUNT_FIT_MATRIX[assetClass]?.[account.type] ?? 0.45;
    const roomPenalty = account.type !== "Taxable" && account.contributionRoomCad != null && account.contributionRoomCad <= 0 ? 0.28 : 0;
    const priorityBoost = Math.max(0, 0.08 - Math.max(profile.accountFundingPriority.indexOf(account.type), 0) * 0.02);
    const taxBoost = profile.taxAwarePlacement ? 0.04 : 0;
    const preferredAccountBoost = profile.recommendationConstraints.preferredAccountTypes.includes(account.type) ? 0.08 : 0;
    const avoidAccountPenalty = profile.recommendationConstraints.avoidAccountTypes.includes(account.type) ? 0.22 : 0;
    const accountCurrency = account.currency ?? "CAD";
    const rawFxPenalty = accountCurrency === securityCurrency
      ? 0
      : fxPolicy.allowCrossCurrencyTrades
        ? fxPolicy.brokerFxFrictionBps
        : fxPolicy.brokerFxFrictionBps + 150;
    const fxPenalty = round(rawFxPenalty / 10000, 4);
    const accountFitScore = clamp(baseScore + priorityBoost + taxBoost + preferredAccountBoost - roomPenalty - fxPenalty - avoidAccountPenalty, 0.05, 0.99);
    return {
      account,
      accountFitScore,
      taxFitScore: clamp(baseScore + (profile.taxAwarePlacement ? 0.06 : 0), 0.05, 0.99),
      fxPenaltyBps: rawFxPenalty
    };
  });

  return scores.sort((left, right) => right.accountFitScore - left.accountFitScore)[0] ?? {
    account: accounts[0] ?? { id: "", userId: "", institution: "", type: "Taxable", nickname: "", marketValueCad: 0, contributionRoomCad: null },
    accountFitScore: 0.4,
    taxFitScore: 0.4,
    fxPenaltyBps: fxPolicy.brokerFxFrictionBps
  };
}

function scoreSecurityCandidate(
  candidate: SecurityCandidate,
  assetClass: string,
  selectedAccount: InvestmentAccount,
  holdings: HoldingPosition[],
  profile: PreferenceProfile,
  fxPolicy: FxPolicy
) {
  const watchlistBoost = profile.watchlistSymbols.includes(candidate.symbol) ? 0.14 : 0;
  const preferredBoost = getPreferredSymbolBoost(profile, candidate.symbol);
  const securityTypePenalty = isSecurityTypeAllowed(profile, candidate.securityType ?? "ETF") ? 0 : 0.24;
  const expensePenalty = clamp(candidate.expenseBps / 200, 0, 0.18);
  const liquidityBoost = candidate.liquidityScore / 1000;
  const currencyPenalty = (selectedAccount.currency ?? "CAD") === candidate.currency
    ? 0
    : fxPolicy.brokerFxFrictionBps / 1000;
  const existingHolding = holdings.find((holding) => holding.symbol === candidate.symbol);
  const exposureMatch = candidate.assetClass === assetClass ? 0.62 : 0.4;
  const preferenceFit = getPreferenceFitAdjustment(profile, candidate, existingHolding);

  const score = clamp(exposureMatch + watchlistBoost + preferredBoost + liquidityBoost + preferenceFit.adjustment - expensePenalty - (currencyPenalty / 10) - securityTypePenalty, 0.05, 0.99);
  return {
    candidate,
    score: round(score * 100, 1),
    preferenceFitScore: preferenceFit.score,
    preferenceSignals: preferenceFit.signals,
    fxPenaltyBps: (selectedAccount.currency ?? "CAD") === candidate.currency ? 0 : fxPolicy.brokerFxFrictionBps
  };
}

function buildSecurityUniverse(assetClass: string) {
  return SECURITY_UNIVERSE[assetClass] ?? [
    { symbol: "VCN", name: "Fallback Core ETF", assetClass, currency: "CAD", expenseBps: 12, liquidityScore: 75, tags: ["fallback"] }
  ];
}

function getAllowedSecurityUniverse(assetClass: string, profile: PreferenceProfile) {
  const excludedSymbols = new Set(profile.recommendationConstraints.excludedSymbols);
  const candidates = buildSecurityUniverse(assetClass).filter(
    (candidate) => !excludedSymbols.has(candidate.symbol.toUpperCase())
  );
  const typeFiltered = candidates.filter((candidate) =>
    isSecurityTypeAllowed(profile, candidate.securityType ?? "ETF")
  );

  return typeFiltered.length > 0
    ? typeFiltered
    : candidates.length > 0
      ? candidates
      : buildSecurityUniverse(assetClass);
}

function getPreferredSymbolBoost(profile: PreferenceProfile, symbol: string) {
  return profile.recommendationConstraints.preferredSymbols.includes(symbol.toUpperCase()) ? 0.12 : 0;
}

function isSecurityTypeAllowed(profile: PreferenceProfile, securityType: string) {
  const allowedTypes = profile.recommendationConstraints.allowedSecurityTypes;
  if (allowedTypes.length === 0) {
    return true;
  }
  const normalized = securityType.trim().toLowerCase();
  return allowedTypes.some((item) => item.trim().toLowerCase() === normalized);
}

function getConstrainedTargetPct(profile: PreferenceProfile, assetClass: string, targetPct: number) {
  const band = profile.recommendationConstraints.assetClassBands.find(
    (item) => item.assetClass === assetClass
  );
  if (!band) {
    return targetPct;
  }

  const minPct = band.minPct ?? 0;
  const maxPct = band.maxPct ?? 100;
  return clamp(targetPct, minPct, maxPct);
}

function buildKnownUniverseLookup() {
  return Object.values(SECURITY_UNIVERSE)
    .flat()
    .reduce<Map<string, SecurityCandidate>>((map, candidate) => {
      map.set(candidate.symbol.toUpperCase(), candidate);
      return map;
    }, new Map());
}

function inferAssetClassFromSecurityType(securityType: string | null | undefined, currency: CurrencyCode | undefined) {
  const normalizedType = (securityType ?? "").toLowerCase();
  if (normalizedType.includes("bond")) {
    return "Fixed Income";
  }
  if (normalizedType.includes("commodity")) {
    return "Commodity";
  }
  if (normalizedType.includes("crypto")) {
    return currency === "USD" ? "US Equity" : "Canadian Equity";
  }
  return currency === "USD" ? "US Equity" : "Canadian Equity";
}

function buildRunNotes(profile: PreferenceProfile, fxPolicy: FxPolicy, language: DisplayLanguage) {
  const preferredTilts = [
    ...profile.preferenceFactors.sectorTilts.preferredSectors,
    ...profile.preferenceFactors.sectorTilts.styleTilts,
    ...profile.preferenceFactors.sectorTilts.thematicInterests
  ];
  return [
    pick(
      language,
      `当前 run 以 ${getRiskProfileLabel(profile.riskProfile, language)} 风险档位为起点，优先补足最明显的配置缺口。`,
      `This run uses the ${profile.riskProfile.toLowerCase()} target allocation and prioritizes the widest portfolio gaps.`
    ),
    pick(
      language,
      `账户放置遵循 ${profile.accountFundingPriority.map((type) => getAccountTypeLabel(type, language)).join(" -> ")}，并结合账户匹配与税务感知评分。`,
      `Account placement follows ${profile.accountFundingPriority.map((type) => getAccountTypeLabel(type, language)).join(" -> ")} with tax-aware scoring.`
    ),
    fxPolicy.hasUsdFundingPath
      ? pick(language, "已检测到 USD 入金路径，因此跨币种方案只会受到较轻的 FX 惩罚。", "A USD funding path is available, so cross-currency ideas carry only a light FX penalty.")
      : pick(language, "未检测到 USD 入金路径，因此跨币种方案会承担更高的 FX 摩擦惩罚。", "No USD funding path was detected, so cross-currency ideas carry a higher FX friction penalty."),
    ...(preferredTilts.length > 0
      ? [
          pick(
            language,
            `V2.1 会轻量考虑你的进阶偏好：${preferredTilts.slice(0, 4).join(" / ")}。这些偏好只调整候选排序，不会覆盖目标配置。`,
            `V2.1 lightly considers your advanced preferences: ${preferredTilts.slice(0, 4).join(" / ")}. These preferences adjust candidate order only; they do not override target allocation.`
          )
        ]
      : []),
    ...(profile.preferenceFactors.lifeGoals.homePurchase.enabled
      ? [
          pick(
            language,
            "已记录买房目标：V2.1 只做风险缓冲提示；真正的资金桶/时间线规划会放进 V3。",
            "Home-purchase goal detected: V2.1 only adds risk-buffer hints; full bucket and timeline planning belongs in V3."
          )
        ]
      : [])
  ];
}

export function buildRecommendationV2(args: {
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  contributionAmountCad: number;
  language: DisplayLanguage;
}): Pick<RecommendationRun, "assumptions" | "items" | "notes" | "engineVersion" | "objective" | "confidenceScore"> {
  const { accounts, holdings, profile, contributionAmountCad, language } = args;
  const { total, allocation } = getCurrentAllocationFromHoldings(holdings);
  const targetAllocation = getTargetAllocation(profile);
  const fxPolicy = inferFxPolicy(accounts, holdings);
  const holdingRiskContributionRaw = holdings.map((holding) => ({
    holding,
    weightedRisk: holding.weightPct * (ASSET_CLASS_RISK_WEIGHTS[getHoldingEconomicAssetClass(holding)] ?? 1)
  }));
  const totalHoldingWeightedRisk = holdingRiskContributionRaw.reduce((sum, item) => sum + item.weightedRisk, 0) || 1;
  const holdingRiskContribution = new Map(
    holdingRiskContributionRaw.map((item) => [
      item.holding.symbol.toUpperCase(),
      round((item.weightedRisk / totalHoldingWeightedRisk) * 100, 1)
    ])
  );

  const targetGaps = targetAllocation
    .map((target) => {
      const currentPct = allocation.get(target.assetClass) ?? 0;
      const constrainedTargetPct = getConstrainedTargetPct(profile, target.assetClass, target.targetPct);
      const gapPct = Math.max(0, round(constrainedTargetPct - currentPct, 2));
      return {
        assetClass: target.assetClass,
        currentPct,
        targetPct: constrainedTargetPct,
        gapPct
      };
    })
    .filter((target) => target.gapPct > 0)
    .sort((left, right) => right.gapPct - left.gapPct);

  const priorities = (targetGaps.length > 0 ? targetGaps : targetAllocation
    .slice()
    .sort((left, right) => right.targetPct - left.targetPct)
    .map((target) => ({
      assetClass: target.assetClass,
      currentPct: allocation.get(target.assetClass) ?? 0,
      targetPct: getConstrainedTargetPct(profile, target.assetClass, target.targetPct),
      gapPct: getConstrainedTargetPct(profile, target.assetClass, target.targetPct)
    })))
    .slice(0, 3);

  const totalGap = priorities.reduce((sum, item) => sum + item.gapPct, 0) || 1;
  let allocatedSoFar = 0;
  const items: RecommendationRun["items"] = priorities.map((priority, index) => {
    const share = priority.gapPct / totalGap;
    const rawAmount = index === priorities.length - 1
      ? Math.max(0, contributionAmountCad - allocatedSoFar)
      : Math.max(0, Math.round((contributionAmountCad * share) / 100) * 100);
    allocatedSoFar += rawAmount;

    const candidates = getAllowedSecurityUniverse(priority.assetClass, profile);
    const accountPlacements = candidates.map((candidate) => {
      const placement = scoreAccountPlacement(accounts, profile, priority.assetClass, candidate.currency, fxPolicy);
      const security = scoreSecurityCandidate(candidate, priority.assetClass, placement.account, holdings, profile, fxPolicy);
      return {
        placement,
        security,
        combined: round(placement.accountFitScore * 55 + (security.score / 100) * 45, 2)
      };
    }).sort((left, right) => right.combined - left.combined);

    const best = accountPlacements[0];
    const topTickers = accountPlacements.slice(0, 3).map((entry) => entry.security.candidate.symbol);
    const projectedValue = total + contributionAmountCad;
    const currentAssetValue = (allocation.get(priority.assetClass) ?? 0) / 100 * total;
    const postTradeGapPct = projectedValue > 0
      ? round(priority.targetPct - (((currentAssetValue + rawAmount) / projectedValue) * 100), 2)
      : 0;
    const existingHolding = holdings
      .filter((holding) => getHoldingEconomicAssetClass(holding) === priority.assetClass)
      .sort((left, right) => right.weightPct - left.weightPct)[0];
    return {
      assetClass: priority.assetClass,
      amountCad: rawAmount,
      targetAccountType: best.placement.account.type,
      tickerOptions: topTickers,
      explanation: pick(
        language,
        `${getAssetClassLabel(priority.assetClass, language)} 仍然落后于目标配置，因此把 ${rawAmount.toLocaleString("en-CA")} CAD 优先放进 ${getAccountTypeLabel(best.placement.account.type, language)}，并由 ${best.security.candidate.symbol} 作为主表达标的。`,
        `${getAssetClassLabel(priority.assetClass, language)} remains under target, so ${rawAmount.toLocaleString("en-CA")} CAD is routed into ${getAccountTypeLabel(best.placement.account.type, language)}, led by ${best.security.candidate.symbol}.`
      ),
      securitySymbol: best.security.candidate.symbol,
      securityName: best.security.candidate.name,
      securityCurrency: best.security.candidate.currency,
      securityScore: best.security.score,
      preferenceFitScore: best.security.preferenceFitScore,
      allocationGapBeforePct: priority.gapPct,
      allocationGapAfterPct: Math.max(0, postTradeGapPct),
      accountFitScore: round(best.placement.accountFitScore * 100, 1),
      taxFitScore: round(best.placement.taxFitScore * 100, 1),
      fxFrictionPenaltyBps: best.security.fxPenaltyBps,
      rationale: {
        assetClass: priority.assetClass,
        targetPct: priority.targetPct,
        currentPct: priority.currentPct,
        gapBeforePct: priority.gapPct,
        gapAfterPct: Math.max(0, postTradeGapPct),
        selectedAccountType: best.placement.account.type,
        selectedSecurity: best.security.candidate.symbol,
        selectedSecurityName: best.security.candidate.name,
        accountFitScore: round(best.placement.accountFitScore * 100, 1),
        taxFitScore: round(best.placement.taxFitScore * 100, 1),
        securityScore: best.security.score,
        preferenceFitScore: best.security.preferenceFitScore,
        preferenceSignals: best.security.preferenceSignals,
        fxPolicy: fxPolicy.hasUsdFundingPath ? "usd-funded" : "retail-fx",
        fxPenaltyBps: best.security.fxPenaltyBps,
        minTradeApplied: rawAmount < 500,
        watchlistMatched: profile.watchlistSymbols.includes(best.security.candidate.symbol),
        preferredSymbolMatched: profile.recommendationConstraints.preferredSymbols.includes(best.security.candidate.symbol),
        existingHoldingId: existingHolding?.id,
        existingHoldingAccountId: existingHolding?.accountId,
        existingHoldingSymbol: existingHolding?.symbol,
        existingHoldingWeightPct: existingHolding?.weightPct,
        existingHoldingRiskContributionPct: existingHolding ? holdingRiskContribution.get(existingHolding.symbol.toUpperCase()) ?? undefined : undefined
      }
    };
  });

  const confidenceScore = round(
    items.reduce((sum, item) => sum + (((item.accountFitScore ?? 0) + (item.securityScore ?? 0)) / 2), 0) / Math.max(items.length, 1),
    1
  );

  return {
    engineVersion: "v2.1",
    objective: "target-tracking",
    confidenceScore,
    assumptions: buildRunNotes(profile, fxPolicy, language),
    notes: [
      pick(language, "这一版只帮你安排新增的钱，不会主动建议你先卖出旧持仓。", "This version only plans new money and does not ask you to sell old holdings first."),
      pick(language, "V2.1 已开始读取进阶偏好，但账户匹配、税务放置和标的 universe 仍然是规则型判断。", "V2.1 now reads advanced preferences, but account fit, tax placement, and the security universe remain rule-based."),
      fxPolicy.hasUsdFundingPath
        ? pick(language, "因为你有 USD 入金路径，系统不会自动回避美股，只会轻度考虑换汇成本。", "Because a USD funding path is available, the engine does not automatically avoid USD securities.")
        : pick(language, "因为系统没看到稳定的 USD 入金路径，美股方案会更容易被换汇成本压低。", "Because no stable USD funding path was detected, USD ideas are pushed down more by FX drag.")
    ],
    items
  };
}

export function getAccountPlacementMatrix() {
  return ACCOUNT_FIT_MATRIX;
}

export function scoreCandidateSecurity(args: {
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  language: DisplayLanguage;
  candidate: CandidateSecurityScoreInput;
}): CandidateSecurityScoreResult {
  const { accounts, holdings, profile, language, candidate } = args;
  const normalizedSymbol = candidate.symbol.trim().toUpperCase();
  const knownUniverse = buildKnownUniverseLookup();
  const existingHolding = holdings.find((holding) => holding.symbol.trim().toUpperCase() === normalizedSymbol);
  const knownCandidate = knownUniverse.get(normalizedSymbol);
  const fallbackAssetClass =
    candidate.assetClass ??
    (existingHolding ? getHoldingEconomicAssetClass(existingHolding) : null) ??
    knownCandidate?.assetClass ??
    inferAssetClassFromSecurityType(candidate.securityType, candidate.currency ?? knownCandidate?.currency ?? existingHolding?.currency ?? "CAD");
  const assetClass = inferEconomicAssetClass({
    symbol: normalizedSymbol,
    name: candidate.name ?? knownCandidate?.name ?? existingHolding?.name,
    assetClass: fallbackAssetClass,
    securityType: candidate.securityType ?? knownCandidate?.securityType ?? existingHolding?.securityTypeOverride,
    currency: candidate.currency ?? knownCandidate?.currency ?? existingHolding?.currency ?? "CAD"
  });
  const assetClassSource: CandidateSecurityScoreResult["assetClassSource"] = candidate.assetClass
    ? isEconomicExposureDifferent({
        symbol: normalizedSymbol,
        name: candidate.name ?? knownCandidate?.name ?? existingHolding?.name,
        assetClass: candidate.assetClass,
        securityType: candidate.securityType ?? knownCandidate?.securityType ?? existingHolding?.securityTypeOverride,
        currency: candidate.currency ?? knownCandidate?.currency ?? existingHolding?.currency ?? "CAD"
      })
      ? "known-universe"
      : "explicit"
    : existingHolding
      ? "existing-holding"
      : knownCandidate
        ? "known-universe"
        : "heuristic";
  const securityCandidate: SecurityCandidate = {
    symbol: normalizedSymbol,
    name: candidate.name?.trim() || knownCandidate?.name || existingHolding?.name || normalizedSymbol,
    assetClass,
    currency: candidate.currency ?? knownCandidate?.currency ?? existingHolding?.currency ?? "CAD",
    securityType: candidate.securityType ?? knownCandidate?.securityType ?? existingHolding?.securityTypeOverride ?? "ETF",
    expenseBps: knownCandidate?.expenseBps ?? 18,
    liquidityScore: knownCandidate?.liquidityScore ?? 72,
    tags: knownCandidate?.tags ?? ["manual-candidate"]
  };
  const fxPolicy = inferFxPolicy(accounts, holdings);
  const placement = scoreAccountPlacement(accounts, profile, assetClass, securityCandidate.currency, fxPolicy);
  const security = scoreSecurityCandidate(securityCandidate, assetClass, placement.account, holdings, profile, fxPolicy);
  const score = round(((placement.accountFitScore * 100) + (placement.taxFitScore * 100) + security.score + security.preferenceFitScore) / 4, 1);
  const verdict: CandidateSecurityScoreResult["verdict"] = score >= 80 ? "strong" : score >= 62 ? "watch" : "weak";

  return {
    symbol: normalizedSymbol,
    name: securityCandidate.name,
    assetClass,
    assetClassSource,
    currency: securityCandidate.currency,
    score,
    verdict,
    watchlistMatched: profile.watchlistSymbols.includes(normalizedSymbol),
    preferredSymbolMatched: profile.recommendationConstraints.preferredSymbols.includes(normalizedSymbol),
    selectedAccountType: placement.account.type,
    selectedAccountName: placement.account.nickname || placement.account.institution || placement.account.type,
    accountFitScore: round(placement.accountFitScore * 100, 1),
    taxFitScore: round(placement.taxFitScore * 100, 1),
    securityScore: security.score,
    preferenceFitScore: security.preferenceFitScore,
    fxPenaltyBps: security.fxPenaltyBps,
    summary: pick(
      language,
      score >= 80
        ? `${normalizedSymbol} 目前看起来是比较顺手的候选，账户放置、税务位置和标的匹配都比较稳。`
        : score >= 62
          ? `${normalizedSymbol} 可以继续观察，但还需要结合账户位置、换汇成本或资产类别判断。`
          : `${normalizedSymbol} 现在还不是特别顺手，更像需要额外确认的候选。`,
      score >= 80
        ? `${normalizedSymbol} currently looks like a strong candidate, with supportive account placement, tax fit, and security fit.`
        : score >= 62
          ? `${normalizedSymbol} is worth keeping on the list, but it still needs account, FX, or sleeve-fit review.`
          : `${normalizedSymbol} does not look especially natural yet and needs extra review before it earns conviction.`
    ),
    drivers: [
      pick(
        language,
        `当前最顺手的账户落点是 ${getAccountTypeLabel(placement.account.type, language)}，账户匹配大约 ${round(placement.accountFitScore * 100, 0)}/100。`,
        `The smoothest account home right now is ${getAccountTypeLabel(placement.account.type, language)}, with account fit around ${round(placement.accountFitScore * 100, 0)}/100.`
      ),
      pick(
        language,
        `这支标的本身的候选分大约 ${security.score.toFixed(0)}/100。`,
        `The security itself scores about ${security.score.toFixed(0)}/100 as a candidate.`
      ),
      pick(
        language,
        `它与当前进阶偏好的贴合度约 ${security.preferenceFitScore.toFixed(0)}/100。`,
        `Its fit with the current advanced preferences is about ${security.preferenceFitScore.toFixed(0)}/100.`
      ),
      profile.watchlistSymbols.includes(normalizedSymbol)
        ? pick(language, "它已经在你的观察列表里，所以引擎会给它一点额外加分。", "It is already on your watchlist, so the engine gives it a small watchlist bonus.")
        : pick(language, "它现在还不在你的观察列表里，所以没有拿到观察列表加分。", "It is not currently on your watchlist, so it gets no watchlist bonus.")
    ],
    warnings: [
      ...(assetClassSource === "heuristic"
        ? [pick(language, "这支标的的资产类别是系统按币种和类型推出来的，最好再人工确认一次。", "The asset sleeve for this symbol was inferred heuristically, so it should be confirmed manually.")]
        : []),
      ...(security.fxPenaltyBps > 0
        ? [pick(language, `如果按当前最优账户去放，大约会承受 ${security.fxPenaltyBps} bps 的换汇摩擦。`, `The current best account path still carries about ${security.fxPenaltyBps} bps of FX friction.`)]
        : []),
      ...(existingHolding && existingHolding.weightPct >= 12
        ? [pick(language, `${normalizedSymbol} 已经在组合里占比较重，继续加之前要额外看集中度。`, `${normalizedSymbol} is already a relatively heavy position, so concentration needs another check before adding more.`)]
        : []),
      ...(security.preferenceSignals.includes("avoided-tilt-match")
        ? [pick(language, `${normalizedSymbol} 命中了你想回避的行业或风格偏好，因此需要额外确认。`, `${normalizedSymbol} matches an avoided sector or style preference, so it needs extra confirmation.`)]
        : []),
      ...(security.preferenceSignals.includes("home-goal-risk-buffer")
        ? [pick(language, "你的买房目标会压低部分权益候选的分数，避免短期资金承担过多波动。", "Your home-purchase goal reduces the score for some equity candidates to avoid too much short-horizon volatility.")]
        : [])
    ]
  };
}

