import type { PreferenceFactors } from "@/lib/backend/models";

export const DEFAULT_PREFERENCE_FACTORS: PreferenceFactors = {
  behavior: {
    riskCapacity: "medium",
    maxDrawdownComfortPct: null,
    volatilityComfort: "medium",
    concentrationTolerance: "medium",
    leverageAllowed: false,
    optionsAllowed: false,
    cryptoAllowed: false,
  },
  sectorTilts: {
    preferredSectors: [],
    avoidedSectors: [],
    styleTilts: [],
    thematicInterests: [],
  },
  lifeGoals: {
    homePurchase: {
      enabled: false,
      horizonYears: null,
      downPaymentTargetCad: null,
      priority: "medium",
    },
    emergencyFundTargetCad: null,
    expectedLargeExpenses: [],
    retirementHorizonYears: null,
  },
  taxStrategy: {
    province: null,
    marginalTaxBracket: null,
    rrspDeductionPriority: "medium",
    tfsaGrowthPriority: "high",
    fhsaHomeGoalPriority: "medium",
    taxableTaxSensitivity: "medium",
    dividendWithholdingSensitivity: "medium",
    usdFundingPath: "unknown",
  },
  liquidity: {
    monthlyContributionCad: null,
    minimumTradeSizeCad: null,
    liquidityNeed: "medium",
    cashDuringUncertainty: "medium",
  },
  externalInfo: {
    allowNewsSignals: false,
    allowInstitutionalSignals: false,
    allowCommunitySignals: false,
    preferredFreshnessHours: 24,
    maxDailyExternalCalls: 5,
  },
};

function asObject(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T;
function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null,
): T | null;
function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null,
): T | null {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function readNumberOrNull(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(Math.max(value, min), max);
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readStringList(value: unknown, max: number) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, max);
}

export function normalizePreferenceFactors(value: unknown): PreferenceFactors {
  const input = asObject(value);
  const behavior = asObject(input.behavior);
  const sectorTilts = asObject(input.sectorTilts);
  const lifeGoals = asObject(input.lifeGoals);
  const homePurchase = asObject(lifeGoals.homePurchase);
  const taxStrategy = asObject(input.taxStrategy);
  const liquidity = asObject(input.liquidity);
  const externalInfo = asObject(input.externalInfo);

  return {
    behavior: {
      riskCapacity: readEnum(
        behavior.riskCapacity,
        ["low", "medium", "high"],
        DEFAULT_PREFERENCE_FACTORS.behavior.riskCapacity,
      ),
      maxDrawdownComfortPct: readNumberOrNull(
        behavior.maxDrawdownComfortPct,
        0,
        80,
      ),
      volatilityComfort: readEnum(
        behavior.volatilityComfort,
        ["low", "medium", "high"],
        DEFAULT_PREFERENCE_FACTORS.behavior.volatilityComfort,
      ),
      concentrationTolerance: readEnum(
        behavior.concentrationTolerance,
        ["low", "medium", "high"],
        DEFAULT_PREFERENCE_FACTORS.behavior.concentrationTolerance,
      ),
      leverageAllowed: readBoolean(behavior.leverageAllowed),
      optionsAllowed: readBoolean(behavior.optionsAllowed),
      cryptoAllowed: readBoolean(behavior.cryptoAllowed),
    },
    sectorTilts: {
      preferredSectors: readStringList(sectorTilts.preferredSectors, 20),
      avoidedSectors: readStringList(sectorTilts.avoidedSectors, 20),
      styleTilts: readStringList(sectorTilts.styleTilts, 20),
      thematicInterests: readStringList(sectorTilts.thematicInterests, 20),
    },
    lifeGoals: {
      homePurchase: {
        enabled: readBoolean(homePurchase.enabled),
        horizonYears: readNumberOrNull(homePurchase.horizonYears, 0, 50),
        downPaymentTargetCad: readNumberOrNull(
          homePurchase.downPaymentTargetCad,
          0,
          5_000_000,
        ),
        priority: readEnum(
          homePurchase.priority,
          ["low", "medium", "high"],
          DEFAULT_PREFERENCE_FACTORS.lifeGoals.homePurchase.priority,
        ),
      },
      emergencyFundTargetCad: readNumberOrNull(
        lifeGoals.emergencyFundTargetCad,
        0,
        1_000_000,
      ),
      expectedLargeExpenses: readStringList(lifeGoals.expectedLargeExpenses, 20),
      retirementHorizonYears: readNumberOrNull(
        lifeGoals.retirementHorizonYears,
        0,
        80,
      ),
    },
    taxStrategy: {
      province:
        typeof taxStrategy.province === "string" && taxStrategy.province.trim()
          ? taxStrategy.province.trim().toUpperCase()
          : null,
      marginalTaxBracket: readEnum(
        taxStrategy.marginalTaxBracket,
        ["low", "medium", "high"],
        null,
      ),
      rrspDeductionPriority: readEnum(
        taxStrategy.rrspDeductionPriority,
        ["low", "medium", "high"],
        DEFAULT_PREFERENCE_FACTORS.taxStrategy.rrspDeductionPriority,
      ),
      tfsaGrowthPriority: readEnum(
        taxStrategy.tfsaGrowthPriority,
        ["low", "medium", "high"],
        DEFAULT_PREFERENCE_FACTORS.taxStrategy.tfsaGrowthPriority,
      ),
      fhsaHomeGoalPriority: readEnum(
        taxStrategy.fhsaHomeGoalPriority,
        ["low", "medium", "high"],
        DEFAULT_PREFERENCE_FACTORS.taxStrategy.fhsaHomeGoalPriority,
      ),
      taxableTaxSensitivity: readEnum(
        taxStrategy.taxableTaxSensitivity,
        ["low", "medium", "high"],
        DEFAULT_PREFERENCE_FACTORS.taxStrategy.taxableTaxSensitivity,
      ),
      dividendWithholdingSensitivity: readEnum(
        taxStrategy.dividendWithholdingSensitivity,
        ["low", "medium", "high"],
        DEFAULT_PREFERENCE_FACTORS.taxStrategy.dividendWithholdingSensitivity,
      ),
      usdFundingPath: readEnum(
        taxStrategy.usdFundingPath,
        ["unknown", "available", "avoid"],
        DEFAULT_PREFERENCE_FACTORS.taxStrategy.usdFundingPath,
      ),
    },
    liquidity: {
      monthlyContributionCad: readNumberOrNull(
        liquidity.monthlyContributionCad,
        0,
        1_000_000,
      ),
      minimumTradeSizeCad: readNumberOrNull(
        liquidity.minimumTradeSizeCad,
        0,
        1_000_000,
      ),
      liquidityNeed: readEnum(
        liquidity.liquidityNeed,
        ["low", "medium", "high"],
        DEFAULT_PREFERENCE_FACTORS.liquidity.liquidityNeed,
      ),
      cashDuringUncertainty: readEnum(
        liquidity.cashDuringUncertainty,
        ["low", "medium", "high"],
        DEFAULT_PREFERENCE_FACTORS.liquidity.cashDuringUncertainty,
      ),
    },
    externalInfo: {
      allowNewsSignals: readBoolean(externalInfo.allowNewsSignals),
      allowInstitutionalSignals: readBoolean(
        externalInfo.allowInstitutionalSignals,
      ),
      allowCommunitySignals: readBoolean(externalInfo.allowCommunitySignals),
      preferredFreshnessHours:
        readNumberOrNull(externalInfo.preferredFreshnessHours, 1, 168) ??
        DEFAULT_PREFERENCE_FACTORS.externalInfo.preferredFreshnessHours,
      maxDailyExternalCalls:
        readNumberOrNull(externalInfo.maxDailyExternalCalls, 0, 100) ??
        DEFAULT_PREFERENCE_FACTORS.externalInfo.maxDailyExternalCalls,
    },
  };
}
