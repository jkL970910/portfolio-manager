import type {
  CurrencyCode,
  PreferenceFactors,
  PreferenceProfile,
  RecommendationConstraints,
} from "@/lib/backend/models";
import type { RecommendationCandidate } from "@/lib/backend/recommendation-v3/candidate-provider";
import type { CoreRecommendationCandidateRole } from "@/lib/backend/recommendation-v3/core-universe";

export type RecommendationPoolStatus =
  | { status: "ok" }
  | {
      status: "needs_policy_relaxation";
      reason: string;
      blockers: string[];
      suggestedRelaxations: Array<{
        type: "allow_role" | "allow_asset_class" | "lower_threshold";
        value: string;
        label: string;
      }>;
    };

export type CandidatePoolPolicy = {
  includeRoles: CoreRecommendationCandidateRole[];
  excludeRoles: CoreRecommendationCandidateRole[];
  allowedAssetClasses: string[];
  avoidedAssetClasses: string[];
  preferredSectors: string[];
  avoidedSectors: string[];
  maxExpenseBps: number | null;
  minLiquidityScore: number;
  allowSingleStocks: boolean;
  allowSectorEtfs: boolean;
  allowCommodity: boolean;
  allowCashParking: boolean;
  requireCleanIdentity: boolean;
  minProviderConfidence: "low" | "medium" | "high";
};

export type CandidatePoolEvaluation = {
  policy: CandidatePoolPolicy;
  eligibleCandidates: RecommendationCandidate[];
  rejectedCandidates: Array<{
    candidate: RecommendationCandidate;
    reasons: string[];
  }>;
  poolStatus: RecommendationPoolStatus;
};

type RecommendationPoolRelaxation =
  Extract<
    RecommendationPoolStatus,
    { status: "needs_policy_relaxation" }
  >["suggestedRelaxations"][number];

const ALL_ROLES: CoreRecommendationCandidateRole[] = [
  "core",
  "satellite",
  "cash_parking",
  "defensive",
];

const CONFIDENCE_RANK = {
  low: 1,
  medium: 2,
  high: 3,
} as const;

export function buildCandidatePoolPolicy(input: {
  profile: PreferenceProfile;
  assetClass: string;
  portfolioCashPct: number;
  fallbackMode?: "core_only_relaxed" | null;
}): CandidatePoolPolicy {
  const factors = input.profile.preferenceFactors;
  const constraints = input.profile.recommendationConstraints;
  const baseIncludeRoles = buildIncludedRoles(factors, input.assetClass);
  const allowCashParking = shouldAllowCashParking({
    factors,
    assetClass: input.assetClass,
    portfolioCashPct: input.portfolioCashPct,
  });
  const includeRoles =
    input.fallbackMode === "core_only_relaxed"
      ? (["core"] as CoreRecommendationCandidateRole[])
      : applyRoleInclusions(baseIncludeRoles, constraints.includedCandidateRoles);
  const excludeRoles =
    input.fallbackMode === "core_only_relaxed"
      ? []
      : applyRoleExclusions(
          allowCashParking ? [] : ["cash_parking"],
          constraints.excludedCandidateRoles,
        );
  return {
    includeRoles,
    excludeRoles,
    allowedAssetClasses: [input.assetClass],
    avoidedAssetClasses: [],
    preferredSectors: factors.sectorTilts.preferredSectors,
    avoidedSectors: factors.sectorTilts.avoidedSectors,
    maxExpenseBps:
      input.fallbackMode === "core_only_relaxed"
        ? null
        : getMaxExpenseBps(factors),
    minLiquidityScore:
      input.fallbackMode === "core_only_relaxed"
        ? 0
        : getMinLiquidityScore(factors),
    allowSingleStocks: factors.behavior.riskCapacity === "high",
    allowSectorEtfs: factors.behavior.riskCapacity !== "low",
    allowCommodity:
      input.assetClass === "Commodity" || factors.behavior.riskCapacity !== "low",
    allowCashParking,
    requireCleanIdentity: true,
    minProviderConfidence:
      input.fallbackMode === "core_only_relaxed" ? "low" : "medium",
  };
}

function applyRoleInclusions(
  baseRoles: CoreRecommendationCandidateRole[],
  configuredRoles: string[],
) {
  if (configuredRoles.length === 0) {
    return baseRoles;
  }
  const configured = new Set(configuredRoles);
  return ALL_ROLES.filter((role) => configured.has(role));
}

function applyRoleExclusions(
  baseRoles: CoreRecommendationCandidateRole[],
  configuredRoles: string[],
) {
  const roles = new Set<CoreRecommendationCandidateRole>(baseRoles);
  for (const role of configuredRoles) {
    if (ALL_ROLES.includes(role as CoreRecommendationCandidateRole)) {
      roles.add(role as CoreRecommendationCandidateRole);
    }
  }
  return ALL_ROLES.filter((role) => roles.has(role));
}

export function evaluateCandidatePool(input: {
  candidates: RecommendationCandidate[];
  policy: CandidatePoolPolicy;
  constraints: RecommendationConstraints;
  assetClass: string;
}): CandidatePoolEvaluation {
  const rejectedCandidates: CandidatePoolEvaluation["rejectedCandidates"] = [];
  const eligibleCandidates = input.candidates.filter((candidate) => {
    const reasons = getCandidateRejectionReasons({
      candidate,
      policy: input.policy,
      constraints: input.constraints,
      assetClass: input.assetClass,
    });
    if (reasons.length > 0) {
      rejectedCandidates.push({ candidate, reasons });
      return false;
    }
    return true;
  });

  return {
    policy: input.policy,
    eligibleCandidates,
    rejectedCandidates,
    poolStatus:
      eligibleCandidates.length > 0
        ? { status: "ok" }
        : buildEmptyPoolStatus({
            policy: input.policy,
            assetClass: input.assetClass,
            rejectedCandidates,
          }),
  };
}

function getCandidateRejectionReasons(input: {
  candidate: RecommendationCandidate;
  policy: CandidatePoolPolicy;
  constraints: RecommendationConstraints;
  assetClass: string;
}) {
  const reasons: string[] = [];
  const candidate = input.candidate;
  const constraints = input.constraints;
  if (
    constraints.excludedSymbols.includes(candidate.symbol.trim().toUpperCase())
  ) {
    reasons.push("用户已排除该标的");
  }
  if (!input.policy.includeRoles.includes(candidate.role)) {
    reasons.push(`当前规则不允许 ${roleLabel(candidate.role)}`);
  }
  if (input.policy.excludeRoles.includes(candidate.role)) {
    reasons.push(`当前规则排除了 ${roleLabel(candidate.role)}`);
  }
  if (
    input.policy.allowedAssetClasses.length > 0 &&
    !input.policy.allowedAssetClasses.includes(candidate.assetClass)
  ) {
    reasons.push("资产类别不匹配");
  }
  if (input.policy.avoidedAssetClasses.includes(candidate.assetClass)) {
    reasons.push("资产类别已被排除");
  }
  if (
    input.policy.requireCleanIdentity &&
    (!candidate.symbol || !candidate.exchange || !candidate.currency)
  ) {
    reasons.push("缺少完整交易身份");
  }
  if (!isProviderConfidenceAllowed(candidate, input.policy)) {
    reasons.push("资料置信度不足");
  }
  if (
    input.policy.maxExpenseBps != null &&
    candidate.expenseBps > input.policy.maxExpenseBps
  ) {
    reasons.push("费用率超过当前规则");
  }
  if (candidate.liquidityScore < input.policy.minLiquidityScore) {
    reasons.push("流动性不足");
  }
  if (!isSecurityTypeAllowedByPolicy(candidate, input.policy)) {
    reasons.push("标的类型不符合当前规则");
  }
  if (!input.policy.allowCommodity && candidate.assetClass === "Commodity") {
    reasons.push("当前规则不允许商品类候选");
  }
  if (candidateMatchesAny(candidate, input.policy.avoidedSectors)) {
    reasons.push("命中回避行业或主题");
  }
  return reasons;
}

function buildIncludedRoles(
  factors: PreferenceFactors,
  assetClass: string,
): CoreRecommendationCandidateRole[] {
  const roles = new Set<CoreRecommendationCandidateRole>(["core", "defensive"]);
  if (factors.behavior.riskCapacity !== "low") {
    roles.add("satellite");
  }
  if (
    assetClass === "Cash" ||
    factors.liquidity.liquidityNeed === "high" ||
    factors.lifeGoals.homePurchase.enabled
  ) {
    roles.add("cash_parking");
  }
  return ALL_ROLES.filter((role) => roles.has(role));
}

function shouldAllowCashParking(input: {
  factors: PreferenceFactors;
  assetClass: string;
  portfolioCashPct: number;
}) {
  if (input.assetClass === "Cash") {
    return true;
  }
  if (input.factors.liquidity.liquidityNeed === "high") {
    return true;
  }
  if (
    input.factors.lifeGoals.homePurchase.enabled &&
    input.factors.lifeGoals.homePurchase.priority === "high"
  ) {
    return true;
  }
  if (input.portfolioCashPct < 3) {
    return true;
  }
  return input.factors.behavior.riskCapacity !== "high";
}

function getMaxExpenseBps(factors: PreferenceFactors) {
  return factors.behavior.riskCapacity === "high" ? 85 : 60;
}

function getMinLiquidityScore(factors: PreferenceFactors) {
  return factors.liquidity.liquidityNeed === "high" ? 80 : 65;
}

function isProviderConfidenceAllowed(
  candidate: RecommendationCandidate,
  policy: CandidatePoolPolicy,
) {
  const confidence = candidate.providerConfidence ?? "high";
  return CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK[policy.minProviderConfidence];
}

function isSecurityTypeAllowedByPolicy(
  candidate: RecommendationCandidate,
  policy: CandidatePoolPolicy,
) {
  const securityType = candidate.securityType;
  const normalized = (securityType ?? "").trim().toLowerCase();
  if (!policy.allowSingleStocks && normalized.includes("common stock")) {
    return false;
  }
  if (
    !policy.allowSectorEtfs &&
    (normalized.includes("sector") ||
      normalized.includes("thematic") ||
      candidate.tags.some((tag) => {
        const normalizedTag = tag.trim().toLowerCase();
        return (
          normalizedTag.includes("sector") ||
          normalizedTag.includes("thematic")
        );
      }))
  ) {
    return false;
  }
  return true;
}

function candidateMatchesAny(
  candidate: RecommendationCandidate,
  tokens: string[],
) {
  if (tokens.length === 0) {
    return false;
  }
  const candidateTokens = [candidate.assetClass, candidate.securityType ?? "", ...candidate.tags]
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return tokens
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .some((token) =>
      candidateTokens.some(
        (candidateToken) =>
          candidateToken.includes(token) || token.includes(candidateToken),
      ),
    );
}

function buildEmptyPoolStatus(input: {
  policy: CandidatePoolPolicy;
  assetClass: string;
  rejectedCandidates: CandidatePoolEvaluation["rejectedCandidates"];
}): RecommendationPoolStatus {
  const blockers = Array.from(
    new Set(input.rejectedCandidates.flatMap((item) => item.reasons)),
  ).slice(0, 5);
  return {
    status: "needs_policy_relaxation",
    reason: "当前进货规矩排除了所有可推荐标的。",
    blockers:
      blockers.length > 0
        ? blockers
        : [`${input.assetClass} 暂无符合当前规则的候选`],
    suggestedRelaxations: buildSuggestedRelaxations(input.policy, input.assetClass),
  };
}

function buildSuggestedRelaxations(
  policy: CandidatePoolPolicy,
  assetClass: string,
): RecommendationPoolRelaxation[] {
  const suggestions: RecommendationPoolRelaxation[] = [];
  if (!policy.includeRoles.includes("core")) {
    suggestions.push({
      type: "allow_role",
      value: "core",
      label: "允许核心池标的",
    });
  }
  if (policy.excludeRoles.includes("cash_parking")) {
    suggestions.push({
      type: "allow_role",
      value: "cash_parking",
      label: "允许现金停泊候选",
    });
  }
  suggestions.push({
    type: "allow_asset_class",
    value: assetClass,
    label: `允许 ${assetClass} 候选`,
  });
  suggestions.push({
    type: "lower_threshold",
    value: "liquidity",
    label: "降低流动性门槛",
  });
  return suggestions.slice(0, 3);
}

function roleLabel(role: CoreRecommendationCandidateRole) {
  switch (role) {
    case "core":
      return "核心池";
    case "satellite":
      return "卫星标的";
    case "cash_parking":
      return "现金停泊";
    case "defensive":
      return "防守候选";
  }
}
