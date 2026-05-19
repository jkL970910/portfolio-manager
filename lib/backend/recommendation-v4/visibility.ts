import type {
  HoldingPosition,
  CurrencyCode,
  MobileSecurityObservation,
  PreferenceProfile,
  RecommendationRun,
  SecurityRecord,
} from "@/lib/backend/models";
import type { RecommendationsData } from "@/lib/contracts";
import {
  listRecommendationCandidates,
  type RecommendationCandidate,
} from "@/lib/backend/recommendation-v3/candidate-provider";
import {
  buildCandidatePoolPolicy,
  evaluateCandidatePool,
  type CandidatePoolEvaluation,
} from "@/lib/backend/recommendation-v3/candidate-pool-policy";
import type {
  RecommendationV4CandidateRejection,
  RecommendationV4CandidateSource,
  RecommendationV4CandidateStatus,
  RecommendationV4Visibility,
} from "@/lib/backend/recommendation-v4/types";

type VisibilityCandidate = {
  symbol: string;
  name: string;
  exchange: string | null;
  currency: CurrencyCode | null;
  securityId?: string | null;
  source: RecommendationV4CandidateSource;
  status: RecommendationV4CandidateStatus;
  reasons: RecommendationV4CandidateRejection["reasons"];
  providerConfidence?: "low" | "medium" | "high" | null;
  lastRefreshedAt?: string | null;
  expiresAt?: string | null;
};

export function buildRecommendationV4Visibility(input: {
  data: RecommendationsData;
  profile: PreferenceProfile;
  observations: MobileSecurityObservation[];
  holdings?: HoldingPosition[];
  securities?: SecurityRecord[];
  poolEvaluation?: RecommendationRun["poolEvaluation"] | null;
}): RecommendationV4Visibility {
  const persistedCandidates = poolEvaluationToCandidates(
    input.poolEvaluation ?? null,
  );
  const policyEvaluations =
    persistedCandidates.length > 0 ? [] : buildPolicyEvaluations(input);
  const evaluatedCandidates =
    persistedCandidates.length > 0
      ? persistedCandidates
      : policyEvaluations.flatMap(evaluationToCandidates);
  const candidates = dedupeVisibilityCandidates([
    ...evaluatedCandidates,
    ...input.data.priorities.map(priorityToCandidate),
    ...(persistedCandidates.length > 0
      ? []
      : [
          ...input.profile.watchlistSymbols.map((key) =>
            watchlistKeyToCandidate(
              key,
              input.data.priorities,
              evaluatedCandidates,
            ),
          ),
          ...input.observations
            .slice(0, 12)
            .map((observation) =>
              observationToCandidate(observation, evaluatedCandidates),
            ),
        ]),
  ]);
  const rejectedCandidates = candidates
    .filter((candidate) => candidate.status !== "eligible")
    .map(candidateToRejection)
    .slice(0, 12);
  const eligibleCount = candidates.filter(
    (candidate) => candidate.status === "eligible",
  ).length;
  const poolSnapshot = {
    rawCount: candidates.length,
    eligibleCount,
    excludedCount: countStatus(candidates, "excluded"),
    watchOnlyCount: countStatus(candidates, "watch_only"),
    needsDataCount: countStatus(candidates, "needs_data"),
    needsIdentityCount: countStatus(candidates, "needs_identity"),
    sourceBreakdown: buildSourceBreakdown(candidates),
    statusBreakdown: buildStatusBreakdown(candidates),
    candidateEvidence: buildCandidateEvidence(candidates),
  };

  return {
    version: "v4-pool-visibility",
    policy: buildPolicySummary(input, policyEvaluations, input.poolEvaluation),
    poolSnapshot,
    rejectedCandidates,
    emptyState:
      eligibleCount > 0
        ? null
        : {
            title: "本轮没有可进货候选",
            detail:
              "当前规则没有通过筛选的标的，系统不会静默强塞默认 ETF。可以先补齐标的身份、刷新资料，或放宽进货规矩。",
            repairActions: [
              { type: "edit_preferences", label: "调整进货规矩" },
              { type: "refresh_data", label: "刷新候选资料" },
            ],
          },
  };
}

function poolEvaluationToCandidates(
  poolEvaluation: RecommendationRun["poolEvaluation"] | null,
): VisibilityCandidate[] {
  if (!poolEvaluation) {
    return [];
  }
  return poolEvaluation.evaluations.flatMap((evaluation) => [
    ...evaluation.eligibleCandidates.map((candidate) => ({
      symbol: candidate.symbol,
      name: candidate.name,
      exchange: candidate.exchange,
      currency: candidate.currency,
      source: mapCandidateSource(candidate.source),
      status: "eligible" as const,
      reasons: [],
      providerConfidence: candidate.providerConfidence ?? null,
      lastRefreshedAt: candidate.lastRefreshedAt ?? null,
      expiresAt: candidate.expiresAt ?? null,
    })),
    ...evaluation.rejectedCandidates.map((candidate) => ({
      symbol: candidate.symbol,
      name: candidate.name,
      exchange: candidate.exchange,
      currency: candidate.currency,
      source: mapCandidateSource(candidate.source),
      status: rejectionStatusForReasons(candidate.reasons),
      reasons: candidate.reasons.map(reasonToV4Reason),
      providerConfidence: candidate.providerConfidence ?? null,
      lastRefreshedAt: candidate.lastRefreshedAt ?? null,
      expiresAt: candidate.expiresAt ?? null,
    })),
  ]);
}

function buildPolicyEvaluations(input: {
  data: RecommendationsData;
  profile: PreferenceProfile;
  observations: MobileSecurityObservation[];
  holdings?: HoldingPosition[];
  securities?: SecurityRecord[];
}) {
  const assetClasses = new Set(
    input.data.priorities
      .map((priority) => priority.assetClass)
      .filter(Boolean),
  );
  for (const target of input.profile.targetAllocation) {
    assetClasses.add(target.assetClass);
  }

  return [...assetClasses].map((assetClass) => {
    const policy = buildCandidatePoolPolicy({
      profile: input.profile,
      assetClass,
      portfolioCashPct: 0,
    });
    return evaluateCandidatePool({
      candidates: listRecommendationCandidates({
        assetClass,
        watchlistSymbols: input.profile.watchlistSymbols,
        observations: input.observations,
        holdings: input.holdings,
        securities: input.securities,
      }),
      policy,
      constraints: input.profile.recommendationConstraints,
      assetClass,
    });
  });
}

function buildPolicySummary(
  input: {
    data: RecommendationsData;
    profile: PreferenceProfile;
  },
  evaluations: CandidatePoolEvaluation[],
  poolEvaluation?: RecommendationRun["poolEvaluation"] | null,
) {
  if (poolEvaluation) {
    const includeRoles = Array.from(
      new Set(
        poolEvaluation.evaluations.flatMap(
          (evaluation) => evaluation.policy.includeRoles,
        ),
      ),
    );
    const excludeRoles = Array.from(
      new Set(
        poolEvaluation.evaluations.flatMap(
          (evaluation) => evaluation.policy.excludeRoles,
        ),
      ),
    );
    return {
      riskMode: input.profile.riskProfile,
      includeRoles,
      excludeRoles,
      hardRules: buildHardRules(input.profile),
      contributionAmountLabel: input.data.contributionAmount,
      noSilentFallback: true,
    };
  }
  const includeRoles = Array.from(
    new Set(evaluations.flatMap((evaluation) => evaluation.policy.includeRoles)),
  );
  const excludeRoles = Array.from(
    new Set(evaluations.flatMap((evaluation) => evaluation.policy.excludeRoles)),
  );
  return {
    riskMode: input.profile.riskProfile,
    includeRoles: includeRoles.length > 0 ? includeRoles : inferIncludedRoles(input.profile),
    excludeRoles,
    hardRules: buildHardRules(input.profile, evaluations),
    contributionAmountLabel: input.data.contributionAmount,
    noSilentFallback: true,
  };
}

function evaluationToCandidates(
  evaluation: CandidatePoolEvaluation,
): VisibilityCandidate[] {
  return [
    ...evaluation.eligibleCandidates.map((candidate) =>
      recommendationCandidateToVisibility(candidate, "eligible", []),
    ),
    ...evaluation.rejectedCandidates.map((item) =>
      recommendationCandidateToVisibility(
        item.candidate,
        rejectionStatusForReasons(item.reasons),
        item.reasons.map(reasonToV4Reason),
      ),
    ),
  ];
}

function recommendationCandidateToVisibility(
  candidate: RecommendationCandidate,
  status: RecommendationV4CandidateStatus,
  reasons: RecommendationV4CandidateRejection["reasons"],
): VisibilityCandidate {
  return {
    symbol: candidate.symbol,
    name: candidate.name,
    exchange: candidate.exchange ?? null,
    currency: candidate.currency,
    source: mapCandidateSource(candidate.source),
    status,
    reasons,
    providerConfidence: candidate.providerConfidence ?? null,
    lastRefreshedAt: candidate.lastRefreshedAt ?? null,
    expiresAt: candidate.expiresAt ?? null,
  };
}

function mapCandidateSource(source: string): RecommendationV4CandidateSource {
  if (
    source === "core_pool" ||
    source === "watchlist" ||
    source === "recent_observation" ||
    source === "dynamic_pool" ||
    source === "current_holding" ||
    source === "manual"
  ) {
    return source;
  }
  return "manual";
}

function rejectionStatusForReasons(
  reasons: string[],
): RecommendationV4CandidateStatus {
  if (reasons.some((reason) => reason.includes("身份"))) {
    return "needs_identity";
  }
  if (reasons.some((reason) => reason.includes("资料") || reason.includes("置信"))) {
    return "needs_data";
  }
  return "excluded";
}

function reasonToV4Reason(reason: string) {
  const code = reason.includes("身份")
    ? "identity_missing"
    : reason.includes("资料") || reason.includes("置信")
      ? "data_insufficient"
      : "policy_excluded";
  return {
    code,
    label: reason,
    detail: reason,
    severity:
      code === "identity_missing" || code === "data_insufficient"
        ? "blocker" as const
        : "warning" as const,
  };
}

function priorityToCandidate(
  priority: RecommendationsData["priorities"][number],
): VisibilityCandidate {
  const brief = priority.candidateBrief;
  return {
    symbol:
      brief?.identity.symbol ||
      priority.securitySymbol ||
      priority.security.split(" ")[0] ||
      priority.assetClass,
    name: brief?.identity.name || priority.security || priority.assetClass,
    exchange: brief?.identity.exchange || priority.securityExchange || null,
    currency:
      brief?.identity.currency ||
      priority.securityCurrency ||
      null,
    securityId: brief?.identity.securityId || priority.securityId || null,
    source: brief?.source === "watchlist" ? "watchlist" : "core_pool",
    status: "eligible",
    reasons: [],
    providerConfidence: null,
  };
}

function watchlistKeyToCandidate(
  key: string,
  priorities: RecommendationsData["priorities"],
  evaluatedCandidates: VisibilityCandidate[] = [],
): VisibilityCandidate {
  const parts = key
    .split(":")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  const symbol = parts[0] ?? key.trim().toUpperCase();
  const exchange = parts[1] ?? null;
  const currency =
    parts[2] === "CAD" || parts[2] === "USD" ? parts[2] : null;
  const matchedPriority = priorities.find((priority) => {
    const prioritySymbol =
      priority.candidateBrief?.identity.symbol || priority.securitySymbol;
    const priorityExchange =
      priority.candidateBrief?.identity.exchange || priority.securityExchange;
    const priorityCurrency =
      priority.candidateBrief?.identity.currency || priority.securityCurrency;
    return (
      prioritySymbol.trim().toUpperCase() === symbol &&
      (!exchange || priorityExchange?.trim().toUpperCase() === exchange) &&
      (!currency || priorityCurrency === currency)
    );
  });
  if (matchedPriority) {
    return priorityToCandidate(matchedPriority);
  }
  const matchedEvaluated = evaluatedCandidates.find(
    (candidate) =>
      candidate.symbol.trim().toUpperCase() === symbol &&
      (!exchange || candidate.exchange?.trim().toUpperCase() === exchange) &&
      (!currency || candidate.currency === currency),
  );
  if (matchedEvaluated) {
    return matchedEvaluated;
  }
  return {
    symbol,
    name: symbol,
    exchange,
    currency,
    source: "watchlist",
    status: exchange && currency ? "watch_only" : "needs_identity",
    reasons:
      exchange && currency
        ? [
            {
              code: "not_selected_by_policy",
              label: "本轮未入选",
              detail:
                "已在囤货清单，但当前缺口、护栏或候选排序没有把它放进 Loo皇推荐。",
              severity: "info",
            },
          ]
        : [
            {
              code: "identity_missing",
              label: "身份待确认",
              detail: "缺少交易所或币种，暂不进入推荐池。",
              severity: "blocker",
            },
          ],
  };
}

function observationToCandidate(
  observation: MobileSecurityObservation,
  evaluatedCandidates: VisibilityCandidate[] = [],
): VisibilityCandidate {
  const hasIdentity = Boolean(observation.exchange && observation.currency);
  const matchedEvaluated = evaluatedCandidates.find(
    (candidate) =>
      candidate.symbol.trim().toUpperCase() ===
        observation.symbol.trim().toUpperCase() &&
      (!observation.exchange ||
        candidate.exchange?.trim().toUpperCase() ===
          observation.exchange.trim().toUpperCase()) &&
      (!observation.currency || candidate.currency === observation.currency),
  );
  if (matchedEvaluated) {
    return matchedEvaluated;
  }
  return {
    symbol: observation.symbol,
    name: observation.name ?? observation.symbol,
    exchange: observation.exchange,
    currency: observation.currency,
    securityId: observation.securityId,
    source: "recent_observation",
    status: hasIdentity ? "watch_only" : "needs_identity",
    reasons: hasIdentity
      ? [
          {
            code: "recent_observation_only",
            label: "近期观察",
            detail:
              "用户近期查看过该标的；它进入 raw pool，但未必通过本轮进货规则。",
            severity: "info",
          },
        ]
      : [
          {
            code: "identity_missing",
            label: "身份待确认",
            detail: "近期观察缺少完整交易身份，需要先进入标的页确认。",
            severity: "blocker",
          },
        ],
  };
}

function candidateToRejection(
  candidate: VisibilityCandidate,
): RecommendationV4CandidateRejection {
  return {
    identity: {
      symbol: candidate.symbol,
      name: candidate.name,
      exchange: candidate.exchange,
      currency: candidate.currency,
      securityId: candidate.securityId,
    },
    source: candidate.source,
    status: candidate.status === "eligible" ? "watch_only" : candidate.status,
    reasons: candidate.reasons,
    repairAction:
      candidate.status === "needs_identity"
        ? { type: "open_security_detail", label: "打开标的确认身份" }
        : candidate.status === "needs_data"
          ? { type: "refresh_data", label: "刷新资料" }
          : candidate.status === "excluded"
            ? { type: "edit_preferences", label: "调整进货规矩" }
            : undefined,
  };
}

function dedupeVisibilityCandidates(candidates: VisibilityCandidate[]) {
  const byKey = new Map<string, VisibilityCandidate>();
  for (const candidate of candidates) {
    const key = [
      candidate.symbol.trim().toUpperCase(),
      candidate.exchange?.trim().toUpperCase() ?? "",
      candidate.currency ?? "",
    ].join(":");
    const existing = byKey.get(key);
    if (!existing || statusRank(candidate.status) > statusRank(existing.status)) {
      byKey.set(key, candidate);
    }
  }
  return [...byKey.values()];
}

function statusRank(status: RecommendationV4CandidateStatus) {
  return {
    eligible: 5,
    watch_only: 4,
    needs_data: 3,
    needs_identity: 2,
    excluded: 1,
  }[status];
}

function countStatus(
  candidates: VisibilityCandidate[],
  status: RecommendationV4CandidateStatus,
) {
  return candidates.filter((candidate) => candidate.status === status).length;
}

function buildSourceBreakdown(candidates: VisibilityCandidate[]) {
  const labels: Record<RecommendationV4CandidateSource, string> = {
    core_pool: "核心池",
    watchlist: "囤货清单",
    recent_observation: "近期观察",
    dynamic_pool: "动态候选",
    current_holding: "已有持仓",
    manual: "手动候选",
  };
  return (Object.keys(labels) as RecommendationV4CandidateSource[])
    .map((source) => ({
      source,
      label: labels[source],
      count: candidates.filter((candidate) => candidate.source === source)
        .length,
    }))
    .filter((item) => item.count > 0);
}

function buildCandidateEvidence(candidates: VisibilityCandidate[]) {
  const labels: Record<RecommendationV4CandidateSource, string> = {
    core_pool: "核心池",
    watchlist: "囤货清单",
    recent_observation: "近期观察",
    dynamic_pool: "动态候选",
    current_holding: "已有持仓",
    manual: "手动候选",
  };
  return candidates
    .filter((candidate) =>
      ["watchlist", "recent_observation", "dynamic_pool"].includes(
        candidate.source,
      ),
    )
    .slice(0, 8)
    .map((candidate) => ({
      symbol: candidate.symbol,
      source: candidate.source,
      sourceLabel: labels[candidate.source],
      status: candidate.status,
      confidenceLabel: formatProviderConfidence(candidate.providerConfidence),
      freshnessLabel: formatFreshness(candidate.lastRefreshedAt, candidate.expiresAt),
    }));
}

function formatProviderConfidence(
  confidence?: "low" | "medium" | "high" | null,
) {
  if (confidence === "high") return "高置信";
  if (confidence === "medium") return "中置信";
  if (confidence === "low") return "低置信";
  return "规则候选";
}

function formatFreshness(
  lastRefreshedAt?: string | null,
  expiresAt?: string | null,
) {
  if (expiresAt) {
    const date = new Date(expiresAt);
    if (!Number.isNaN(date.getTime())) {
      return `缓存至 ${date.toISOString().slice(5, 10)}`;
    }
  }
  if (lastRefreshedAt) {
    const date = new Date(lastRefreshedAt);
    if (!Number.isNaN(date.getTime())) {
      return `更新 ${date.toISOString().slice(5, 10)}`;
    }
  }
  return "按当前规则";
}

function buildStatusBreakdown(candidates: VisibilityCandidate[]) {
  const labels: Record<RecommendationV4CandidateStatus, string> = {
    eligible: "已进推荐池",
    watch_only: "仅观察",
    needs_identity: "身份待确认",
    needs_data: "资料待补",
    excluded: "规则排除",
  };
  return (Object.keys(labels) as RecommendationV4CandidateStatus[])
    .map((status) => ({
      status,
      label: labels[status],
      count: countStatus(candidates, status),
    }))
    .filter((item) => item.count > 0);
}

function inferIncludedRoles(profile: PreferenceProfile) {
  const riskCapacity = profile.preferenceFactors.behavior.riskCapacity;
  return [
    "core",
    riskCapacity === "low" ? null : "satellite",
    "defensive",
    shouldAllowCashRole(profile) ? "cash_parking" : null,
  ].filter((role): role is string => Boolean(role));
}

function inferExcludedRoles(profile: PreferenceProfile) {
  return shouldAllowCashRole(profile) ? [] : ["cash_parking"];
}

function shouldAllowCashRole(profile: PreferenceProfile) {
  return (
    profile.preferenceFactors.behavior.riskCapacity !== "high" ||
    profile.preferenceFactors.liquidity.liquidityNeed === "high" ||
    profile.preferenceFactors.lifeGoals.homePurchase.enabled
  );
}

function buildHardRules(
  profile: PreferenceProfile,
  evaluations: CandidatePoolEvaluation[] = [],
) {
  return [
    "身份不完整不进推荐池",
    "无可用资料不强推",
    "空结果不静默塞入默认标的",
    profile.recommendationConstraints.excludedSymbols.length > 0
      ? `排除 ${profile.recommendationConstraints.excludedSymbols.join(" / ")}`
      : null,
    inferExcludedRoles(profile).length > 0
      ? `排除 ${inferExcludedRoles(profile).join(" / ")}`
      : null,
    ...Array.from(
      new Set(
        evaluations
          .flatMap((evaluation) =>
            evaluation.rejectedCandidates.flatMap((candidate) =>
              candidate.reasons,
            ),
          )
          .slice(0, 4),
      ),
    ),
  ].filter((item): item is string => Boolean(item));
}
