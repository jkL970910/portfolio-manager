import type {
  AllocationTarget,
  PreferenceFactors,
  PreferenceProfile,
  RiskProfile,
} from "@/lib/backend/models";

export type RecommendationStrategyMode =
  | "conservative"
  | "balanced"
  | "growth_global"
  | "aggressive_us_tech";

export type StrategyQuestionnaireAnswers = {
  horizon: "short" | "medium" | "long";
  drawdownTolerance: "low" | "medium" | "high" | "very_high";
  cashNeed: "low" | "medium" | "high";
  usTechConviction: "low" | "medium" | "high";
  concentrationTolerance: "low" | "medium" | "high";
  accountComplexity: "simple" | "tax_aware";
};

export type RecommendationStrategyProfile = {
  mode: RecommendationStrategyMode;
  label: string;
  summary: string;
  riskProfile: RiskProfile;
  targetAllocation: AllocationTarget[];
  guardrails: {
    maxSingleStockPct: number;
    maxSingleEtfPct: number;
    maxSectorPct: number;
    maxNasdaqGrowthPct: number;
  };
};

export const RECOMMENDATION_STRATEGY_PRESETS: Record<
  RecommendationStrategyMode,
  RecommendationStrategyProfile
> = {
  conservative: {
    mode: "conservative",
    label: "稳守国库",
    summary: "优先守住现金流和波动底线，适合短周期或低回撤承受。",
    riskProfile: "Conservative",
    targetAllocation: [
      { assetClass: "Canadian Equity", targetPct: 18 },
      { assetClass: "US Equity", targetPct: 22 },
      { assetClass: "International Equity", targetPct: 10 },
      { assetClass: "Fixed Income", targetPct: 35 },
      { assetClass: "Cash", targetPct: 15 },
    ],
    guardrails: {
      maxSingleStockPct: 6,
      maxSingleEtfPct: 20,
      maxSectorPct: 30,
      maxNasdaqGrowthPct: 25,
    },
  },
  balanced: {
    mode: "balanced",
    label: "均衡国库",
    summary: "股票和防守资产都保留位置，适合多数长期配置。",
    riskProfile: "Balanced",
    targetAllocation: [
      { assetClass: "Canadian Equity", targetPct: 22 },
      { assetClass: "US Equity", targetPct: 32 },
      { assetClass: "International Equity", targetPct: 16 },
      { assetClass: "Fixed Income", targetPct: 20 },
      { assetClass: "Cash", targetPct: 10 },
    ],
    guardrails: {
      maxSingleStockPct: 10,
      maxSingleEtfPct: 25,
      maxSectorPct: 40,
      maxNasdaqGrowthPct: 35,
    },
  },
  growth_global: {
    mode: "growth_global",
    label: "成长国库",
    summary: "以全球股票为主，但仍保留分散和再平衡空间。",
    riskProfile: "Growth",
    targetAllocation: [
      { assetClass: "Canadian Equity", targetPct: 10 },
      { assetClass: "US Equity", targetPct: 50 },
      { assetClass: "International Equity", targetPct: 25 },
      { assetClass: "Fixed Income", targetPct: 10 },
      { assetClass: "Cash", targetPct: 5 },
    ],
    guardrails: {
      maxSingleStockPct: 12,
      maxSingleEtfPct: 30,
      maxSectorPct: 50,
      maxNasdaqGrowthPct: 45,
    },
  },
  aggressive_us_tech: {
    mode: "aggressive_us_tech",
    label: "纳指科技进攻",
    summary: "显著倾向美股、纳指和科技成长，适合长周期且能承受大回撤的用户。",
    riskProfile: "Aggressive",
    targetAllocation: [
      { assetClass: "Canadian Equity", targetPct: 5 },
      { assetClass: "US Equity", targetPct: 65 },
      { assetClass: "International Equity", targetPct: 15 },
      { assetClass: "Fixed Income", targetPct: 5 },
      { assetClass: "Cash", targetPct: 10 },
    ],
    guardrails: {
      maxSingleStockPct: 15,
      maxSingleEtfPct: 35,
      maxSectorPct: 60,
      maxNasdaqGrowthPct: 65,
    },
  },
};

export function getDefaultTargetAllocationForRisk(
  riskProfile: RiskProfile,
): AllocationTarget[] {
  const mode =
    riskProfile === "Conservative"
      ? "conservative"
      : riskProfile === "Balanced"
        ? "balanced"
        : riskProfile === "Aggressive"
          ? "aggressive_us_tech"
          : "growth_global";
  return RECOMMENDATION_STRATEGY_PRESETS[mode].targetAllocation.map((item) => ({
    ...item,
  }));
}

export function getActiveTargetAllocation(
  profile: Pick<PreferenceProfile, "riskProfile" | "targetAllocation">,
): AllocationTarget[] {
  return profile.targetAllocation.length > 0
    ? profile.targetAllocation
    : getDefaultTargetAllocationForRisk(profile.riskProfile);
}

export function inferStrategyModeFromProfile(
  profile: Pick<PreferenceProfile, "riskProfile" | "targetAllocation" | "preferenceFactors">,
): RecommendationStrategyMode {
  const usTarget = getActiveTargetAllocation(profile).find(
    (item) => item.assetClass === "US Equity",
  )?.targetPct ?? 0;
  const factors = profile.preferenceFactors;
  const preferredSectors = new Set(
    factors.sectorTilts.preferredSectors.map((item) => item.toLowerCase()),
  );
  const styleTilts = new Set(
    factors.sectorTilts.styleTilts.map((item) => item.toLowerCase()),
  );
  const techTilt =
    preferredSectors.has("technology") ||
    preferredSectors.has("semiconductors") ||
    styleTilts.has("growth") ||
    styleTilts.has("ai");

  if (profile.riskProfile === "Aggressive" || (usTarget >= 60 && techTilt)) {
    return "aggressive_us_tech";
  }
  if (profile.riskProfile === "Growth" || usTarget >= 45) {
    return "growth_global";
  }
  if (profile.riskProfile === "Conservative") {
    return "conservative";
  }
  return "balanced";
}

export function deriveStrategyProfileFromAnswers(
  answers: StrategyQuestionnaireAnswers,
): RecommendationStrategyProfile {
  if (
    answers.horizon === "long" &&
    (answers.drawdownTolerance === "very_high" ||
      answers.drawdownTolerance === "high") &&
    answers.usTechConviction === "high" &&
    answers.concentrationTolerance !== "low"
  ) {
    return RECOMMENDATION_STRATEGY_PRESETS.aggressive_us_tech;
  }
  if (
    answers.horizon !== "short" &&
    answers.drawdownTolerance !== "low" &&
    answers.cashNeed !== "high"
  ) {
    return RECOMMENDATION_STRATEGY_PRESETS.growth_global;
  }
  if (answers.drawdownTolerance === "low" || answers.cashNeed === "high") {
    return RECOMMENDATION_STRATEGY_PRESETS.conservative;
  }
  return RECOMMENDATION_STRATEGY_PRESETS.balanced;
}

export function buildPreferenceFactorsForStrategy(
  answers: StrategyQuestionnaireAnswers,
  current: PreferenceFactors,
): PreferenceFactors {
  const preferredSectors =
    answers.usTechConviction === "high"
      ? ["Technology", "Semiconductors"]
      : current.sectorTilts.preferredSectors;
  const styleTilts =
    answers.usTechConviction === "high"
      ? ["Growth", "Quality", "AI"]
      : current.sectorTilts.styleTilts;

  return {
    ...current,
    behavior: {
      ...current.behavior,
      riskCapacity:
        answers.drawdownTolerance === "high" ||
        answers.drawdownTolerance === "very_high"
          ? "high"
          : answers.drawdownTolerance === "low"
            ? "low"
            : "medium",
    },
    liquidity: {
      ...current.liquidity,
      liquidityNeed: answers.cashNeed,
      cashDuringUncertainty: answers.cashNeed,
    },
    taxStrategy: {
      ...current.taxStrategy,
      usdFundingPath:
        answers.usTechConviction === "high"
          ? "available"
          : current.taxStrategy.usdFundingPath,
    },
    sectorTilts: {
      ...current.sectorTilts,
      preferredSectors,
      styleTilts,
    },
  };
}
