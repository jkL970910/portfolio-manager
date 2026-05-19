import type { CurrencyCode } from "@/lib/backend/models";

export type RecommendationV4CandidateSource =
  | "core_pool"
  | "watchlist"
  | "recent_observation"
  | "dynamic_pool"
  | "current_holding"
  | "manual";

export type RecommendationV4CandidateStatus =
  | "eligible"
  | "watch_only"
  | "needs_identity"
  | "needs_data"
  | "excluded";

export type RecommendationV4RepairActionType =
  | "open_security_detail"
  | "refresh_data"
  | "edit_preferences"
  | "allow_role";

export type RecommendationV4PolicySummary = {
  riskMode: string;
  includeRoles: string[];
  excludeRoles: string[];
  hardRules: string[];
  contributionAmountLabel: string;
  noSilentFallback: boolean;
};

export type RecommendationV4PoolSnapshot = {
  rawCount: number;
  eligibleCount: number;
  excludedCount: number;
  watchOnlyCount: number;
  needsDataCount: number;
  needsIdentityCount: number;
  sourceBreakdown: Array<{
    source: RecommendationV4CandidateSource;
    label: string;
    count: number;
  }>;
  statusBreakdown: Array<{
    status: RecommendationV4CandidateStatus;
    label: string;
    count: number;
  }>;
  candidateEvidence: Array<{
    symbol: string;
    source: RecommendationV4CandidateSource;
    sourceLabel: string;
    status: RecommendationV4CandidateStatus;
    confidenceLabel: string;
    freshnessLabel: string;
  }>;
};

export type RecommendationV4CandidateRejection = {
  identity: {
    symbol: string;
    name: string;
    exchange: string | null;
    currency: CurrencyCode | null;
    securityId?: string | null;
  };
  source: RecommendationV4CandidateSource;
  status: Exclude<RecommendationV4CandidateStatus, "eligible">;
  reasons: Array<{
    code: string;
    label: string;
    detail: string;
    severity: "info" | "warning" | "blocker";
  }>;
  repairAction?: {
    type: RecommendationV4RepairActionType;
    label: string;
  };
};

export type RecommendationV4EmptyState = {
  title: string;
  detail: string;
  repairActions: Array<{
    type: RecommendationV4RepairActionType;
    label: string;
  }>;
};

export type RecommendationV4Visibility = {
  version: "v4-pool-visibility";
  policy: RecommendationV4PolicySummary;
  poolSnapshot: RecommendationV4PoolSnapshot;
  rejectedCandidates: RecommendationV4CandidateRejection[];
  emptyState: RecommendationV4EmptyState | null;
};
