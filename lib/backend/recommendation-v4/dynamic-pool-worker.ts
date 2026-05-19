import type {
  CurrencyCode,
  MobileSecurityObservation,
  RecommendationDynamicCandidateRecord,
  SecurityRecord,
} from "@/lib/backend/models";
import { getRepositories } from "@/lib/backend/repositories/factory";

type DynamicPoolRefreshResult = {
  userId: string;
  scannedWatchlistCount: number;
  scannedObservationCount: number;
  upsertedCount: number;
  skippedCount: number;
  refreshedAt: string;
};

type DynamicPoolWorkerBatchResult = {
  workerId: string;
  scannedUserCount: number;
  refreshedUserCount: number;
  upsertedCount: number;
  skippedCount: number;
  startedAt: string;
  finishedAt: string;
  results: DynamicPoolRefreshResult[];
};

export async function runRecommendationDynamicPoolWorkerOnce(input: {
  workerId?: string;
  userId?: string | null;
  maxUsers?: number;
  now?: Date;
} = {}): Promise<DynamicPoolWorkerBatchResult> {
  const repositories = getRepositories();
  const now = input.now ?? new Date();
  const startedAt = new Date().toISOString();
  const maxUsers = Math.min(Math.max(Math.trunc(input.maxUsers ?? 50), 1), 500);
  const users = input.userId
    ? [await repositories.users.getById(input.userId)]
    : await repositories.users.listAll({ limit: maxUsers });
  const results: DynamicPoolRefreshResult[] = [];
  for (const user of users) {
    results.push(await refreshRecommendationDynamicPoolForUser(user.id, now));
  }
  return {
    workerId: input.workerId ?? "recommendation-dynamic-pool-worker",
    scannedUserCount: users.length,
    refreshedUserCount: results.length,
    upsertedCount: results.reduce((sum, item) => sum + item.upsertedCount, 0),
    skippedCount: results.reduce((sum, item) => sum + item.skippedCount, 0),
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
  };
}

export async function refreshRecommendationDynamicPoolForUser(
  userId: string,
  now = new Date(),
): Promise<DynamicPoolRefreshResult> {
  const repositories = getRepositories();
  const [profile, observations, holdings] = await Promise.all([
    repositories.preferences.getByUserId(userId),
    repositories.mobileSecurityObservations.listRecentByUserId(userId, 50),
    repositories.holdings.listByUserId(userId),
  ]);
  const securityIds = new Set<string>();
  for (const observation of observations) {
    if (observation.securityId) securityIds.add(observation.securityId);
  }
  for (const holding of holdings) {
    if (holding.securityId) securityIds.add(holding.securityId);
  }
  const securities = await repositories.securities.listByIds([...securityIds]);
  const candidates = [
    ...profile.watchlistSymbols.map((key) =>
      candidateFromWatchlistKey(key, userId, securities, now),
    ),
    ...observations.map((observation) =>
      candidateFromObservation(observation, userId, securities, now),
    ),
  ].filter(
    (
      candidate,
    ): candidate is Omit<
      RecommendationDynamicCandidateRecord,
      "id" | "createdAt" | "updatedAt"
    > => Boolean(candidate),
  );

  let upsertedCount = 0;
  for (const candidate of candidates) {
    await repositories.recommendationDynamicCandidates.upsert(candidate);
    upsertedCount += 1;
  }

  return {
    userId,
    scannedWatchlistCount: profile.watchlistSymbols.length,
    scannedObservationCount: observations.length,
    upsertedCount,
    skippedCount:
      profile.watchlistSymbols.length + observations.length - candidates.length,
    refreshedAt: now.toISOString(),
  };
}

function candidateFromWatchlistKey(
  key: string,
  userId: string,
  securities: SecurityRecord[],
  now: Date,
) {
  const parts = key
    .split(":")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  return candidateFromIdentity(
    {
      userId,
      symbol: parts[0] ?? "",
      exchange: parts[1] ?? null,
      currency: parts[2] === "CAD" || parts[2] === "USD" ? parts[2] : null,
      name: parts[0] ?? "",
      source: "watchlist",
    },
    securities,
    now,
  );
}

function candidateFromObservation(
  observation: MobileSecurityObservation,
  userId: string,
  securities: SecurityRecord[],
  now: Date,
) {
  return candidateFromIdentity(
    {
      userId,
      symbol: observation.symbol,
      exchange: observation.exchange,
      currency: observation.currency,
      securityId: observation.securityId,
      name: observation.name ?? observation.symbol,
      source: "recent_observation",
    },
    securities,
    now,
  );
}

function candidateFromIdentity(
  input: {
    userId: string;
    symbol: string;
    exchange?: string | null;
    currency?: CurrencyCode | null;
    securityId?: string | null;
    name: string;
    source: "watchlist" | "recent_observation";
  },
  securities: SecurityRecord[],
  now: Date,
): Omit<
  RecommendationDynamicCandidateRecord,
  "id" | "createdAt" | "updatedAt"
> | null {
  const symbol = input.symbol.trim().toUpperCase();
  const exchange = input.exchange?.trim().toUpperCase() ?? null;
  const currency = input.currency ?? null;
  if (!symbol || !exchange || !currency) {
    return null;
  }
  const security = securities.find((item) => {
    if (input.securityId && item.id === input.securityId) return true;
    return (
      item.symbol.toUpperCase() === symbol &&
      item.canonicalExchange.toUpperCase() === exchange &&
      item.currency === currency
    );
  });
  const assetClass = security?.economicAssetClass;
  if (!assetClass) {
    return null;
  }
  const confidence = metadataConfidenceToProviderConfidence(
    security.metadataConfidence,
  );
  const isStock = security.securityType?.toLowerCase().includes("stock") ?? false;
  const refreshedAt = now.toISOString();
  return {
    userId: input.userId,
    securityId: security.id,
    symbol,
    name: security.name || input.name || symbol,
    exchange,
    currency,
    assetClass,
    role: isStock ? "satellite" : "core",
    source: input.source,
    providerConfidence: confidence,
    liquidityScore: confidence === "high" ? 78 : confidence === "medium" ? 66 : 45,
    expenseBps: isStock ? 0 : 75,
    securityType: security.securityType,
    tags: [
      input.source,
      security.economicSector ?? "",
      security.exposureRegion ?? "",
    ].filter(Boolean),
    sourceMetadata: {
      metadataSource: security.metadataSource,
      metadataConfidence: security.metadataConfidence,
      metadataAsOf: security.metadataAsOf,
    },
    lastRefreshedAt: refreshedAt,
    expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function metadataConfidenceToProviderConfidence(
  confidence: number,
): "low" | "medium" | "high" {
  if (confidence >= 80) return "high";
  if (confidence >= 50) return "medium";
  return "low";
}
