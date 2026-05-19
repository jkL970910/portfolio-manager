import type {
  CurrencyCode,
  HoldingPosition,
  MobileSecurityObservation,
  RecommendationDynamicCandidateRecord,
  SecurityRecord,
} from "@/lib/backend/models";
import {
  getCoreRecommendationUniverse,
  type CoreRecommendationCandidate,
} from "@/lib/backend/recommendation-v3/core-universe";

export type RecommendationCandidateSource =
  | "core_pool"
  | "watchlist"
  | "recent_observation"
  | "dynamic_pool";

export type RecommendationCandidate = Omit<CoreRecommendationCandidate, "source"> & {
  source: RecommendationCandidateSource;
  providerConfidence?: "low" | "medium" | "high";
  sourceNote?: string | null;
  lastRefreshedAt?: string | null;
  expiresAt?: string | null;
};

export type RecommendationCandidateProviderContext = {
  assetClass: string;
  watchlistSymbols: string[];
  holdings?: HoldingPosition[];
  securities?: SecurityRecord[];
  observations?: MobileSecurityObservation[];
  dynamicCandidates?: RecommendationDynamicCandidateRecord[];
};

export interface RecommendationCandidateProvider {
  readonly id: string;
  listCandidates(
    context: RecommendationCandidateProviderContext,
  ): RecommendationCandidate[];
}

export class CoreRecommendationCandidateProvider
  implements RecommendationCandidateProvider
{
  readonly id = "core_pool";

  listCandidates(
    context: RecommendationCandidateProviderContext,
  ): RecommendationCandidate[] {
    return (getCoreRecommendationUniverse()[context.assetClass] ?? []).map(
      (candidate) => ({
        ...candidate,
        source: "core_pool",
        providerConfidence: "high",
        sourceNote: "Curated core-pool candidate.",
      }),
    );
  }
}

export function getDefaultRecommendationCandidateProviders(): RecommendationCandidateProvider[] {
  return [
    new CoreRecommendationCandidateProvider(),
    new DynamicRecommendationCandidateProvider(),
    new WatchlistRecommendationCandidateProvider(),
    new RecentObservationRecommendationCandidateProvider(),
  ];
}

export function listRecommendationCandidates(input: {
  assetClass: string;
  watchlistSymbols: string[];
  holdings?: HoldingPosition[];
  securities?: SecurityRecord[];
  observations?: MobileSecurityObservation[];
  dynamicCandidates?: RecommendationDynamicCandidateRecord[];
  providers?: RecommendationCandidateProvider[];
}) {
  const providers =
    input.providers ?? getDefaultRecommendationCandidateProviders();
  const candidates = providers.flatMap((provider) =>
    provider.listCandidates({
      assetClass: input.assetClass,
      watchlistSymbols: input.watchlistSymbols,
      holdings: input.holdings,
      securities: input.securities,
      observations: input.observations,
      dynamicCandidates: input.dynamicCandidates,
    }),
  );
  return dedupeRecommendationCandidates(candidates);
}

export class DynamicRecommendationCandidateProvider
  implements RecommendationCandidateProvider
{
  readonly id = "dynamic_pool";

  listCandidates(
    context: RecommendationCandidateProviderContext,
  ): RecommendationCandidate[] {
    return (context.dynamicCandidates ?? [])
      .map(dynamicRecordToCandidate)
      .filter((candidate) => candidate.assetClass === context.assetClass);
  }
}

function dynamicRecordToCandidate(
  record: RecommendationDynamicCandidateRecord,
): RecommendationCandidate {
  return {
    symbol: record.symbol,
    name: record.name,
    assetClass: record.assetClass,
    currency: record.currency ?? "CAD",
    exchange: record.exchange,
    securityType: record.securityType ?? "ETF",
    expenseBps: record.expenseBps,
    liquidityScore: record.liquidityScore,
    tags: record.tags,
    source: "dynamic_pool",
    role:
      record.role === "core" ||
      record.role === "satellite" ||
      record.role === "cash_parking" ||
      record.role === "defensive"
        ? record.role
        : "core",
    providerConfidence: record.providerConfidence,
    lastRefreshedAt: record.lastRefreshedAt,
    expiresAt: record.expiresAt,
    sourceNote: "DB-backed dynamic candidate; still subject to V4 policy.",
  };
}

function dedupeRecommendationCandidates(candidates: RecommendationCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = [
      candidate.symbol.trim().toUpperCase(),
      candidate.exchange?.trim().toUpperCase() ?? "",
      candidate.currency,
    ].join(":");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function candidateIdentityKey(candidate: {
  symbol: string;
  exchange?: string | null;
  currency?: CurrencyCode | null;
}) {
  return [
    candidate.symbol.trim().toUpperCase(),
    candidate.exchange?.trim().toUpperCase() ?? "",
    candidate.currency ?? "",
  ].join(":");
}

export class WatchlistRecommendationCandidateProvider
  implements RecommendationCandidateProvider
{
  readonly id = "watchlist";

  listCandidates(
    context: RecommendationCandidateProviderContext,
  ): RecommendationCandidate[] {
    return context.watchlistSymbols
      .map((key) => watchlistKeyToCandidate(key, context))
      .filter((candidate): candidate is RecommendationCandidate =>
        Boolean(candidate),
      );
  }
}

export class RecentObservationRecommendationCandidateProvider
  implements RecommendationCandidateProvider
{
  readonly id = "recent_observation";

  listCandidates(
    context: RecommendationCandidateProviderContext,
  ): RecommendationCandidate[] {
    return (context.observations ?? [])
      .slice(0, 20)
      .map((observation) => observationToCandidate(observation, context))
      .filter((candidate): candidate is RecommendationCandidate =>
        Boolean(candidate),
      );
  }
}

function watchlistKeyToCandidate(
  key: string,
  context: RecommendationCandidateProviderContext,
): RecommendationCandidate | null {
  const identity = parseCandidateIdentityKey(key);
  if (!identity.symbol) {
    return null;
  }
  return identityToRecommendationCandidate({
    ...identity,
    source: "watchlist",
    context,
    fallbackName: identity.symbol,
  });
}

function observationToCandidate(
  observation: MobileSecurityObservation,
  context: RecommendationCandidateProviderContext,
): RecommendationCandidate | null {
  if (!observation.symbol.trim()) {
    return null;
  }
  return identityToRecommendationCandidate({
    symbol: observation.symbol,
    exchange: observation.exchange,
    currency: observation.currency,
    securityId: observation.securityId,
    source: "recent_observation",
    context,
    fallbackName: observation.name ?? observation.symbol,
  });
}

function identityToRecommendationCandidate(input: {
  symbol: string;
  exchange?: string | null;
  currency?: CurrencyCode | null;
  securityId?: string | null;
  source: RecommendationCandidateSource;
  context: RecommendationCandidateProviderContext;
  fallbackName: string;
}): RecommendationCandidate | null {
  const symbol = input.symbol.trim().toUpperCase();
  const matchedSecurity = matchSecurityRecord({
    symbol,
    exchange: input.exchange ?? null,
    currency: input.currency ?? null,
    securityId: input.securityId ?? null,
    securities: input.context.securities ?? [],
  });
  const matchedHolding = matchHolding({
    symbol,
    exchange: input.exchange ?? matchedSecurity?.canonicalExchange ?? null,
    currency: input.currency ?? matchedSecurity?.currency ?? null,
    securityId: input.securityId ?? matchedSecurity?.id ?? null,
    holdings: input.context.holdings ?? [],
  });
  const assetClass =
    matchedSecurity?.economicAssetClass ??
    matchedHolding?.assetClassOverride ??
    matchedHolding?.rawAssetClass ??
    matchedHolding?.assetClass ??
    input.context.assetClass;

  if (assetClass !== input.context.assetClass) {
    return null;
  }

  const exchange =
    input.exchange ??
    matchedSecurity?.canonicalExchange ??
    matchedHolding?.exchangeOverride ??
    matchedHolding?.quoteExchange ??
    null;
  const currency =
    input.currency ??
    matchedSecurity?.currency ??
    matchedHolding?.quoteCurrency ??
    matchedHolding?.currency ??
    null;
  const hasCleanIdentity = Boolean(symbol && exchange && currency);
  const providerConfidence = matchedSecurity
    ? metadataConfidenceToProviderConfidence(matchedSecurity.metadataConfidence)
    : matchedHolding
      ? "medium"
      : hasCleanIdentity
        ? "medium"
        : "low";

  return {
    symbol,
    name: matchedSecurity?.name ?? matchedHolding?.name ?? input.fallbackName,
    assetClass,
    currency: currency ?? "CAD",
    exchange,
    securityType: matchedSecurity?.securityType ?? "ETF",
    expenseBps: input.source === "core_pool" ? 20 : 65,
    liquidityScore: hasCleanIdentity ? 72 : 45,
    tags: [
      input.source === "watchlist" ? "watchlist" : "recent-observation",
      matchedSecurity?.economicSector ?? matchedHolding?.sector ?? "",
      matchedSecurity?.exposureRegion ?? "",
    ].filter(Boolean),
    source: input.source,
    role:
      matchedSecurity?.securityType?.toLowerCase().includes("stock")
        ? "satellite"
        : "core",
    providerConfidence,
    sourceNote:
      input.source === "watchlist"
        ? "User watchlist candidate; must pass identity and policy checks."
        : "Recently observed candidate; visible for policy review.",
  };
}

function parseCandidateIdentityKey(key: string) {
  const parts = key
    .split(":")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  const currency: CurrencyCode | null =
    parts[2] === "CAD" || parts[2] === "USD" ? parts[2] : null;
  return {
    symbol: parts[0] ?? "",
    exchange: parts[1] ?? null,
    currency,
  };
}

function matchSecurityRecord(input: {
  symbol: string;
  exchange: string | null;
  currency: CurrencyCode | null;
  securityId: string | null;
  securities: SecurityRecord[];
}) {
  return input.securities.find((security) => {
    if (input.securityId && security.id === input.securityId) {
      return true;
    }
    return (
      security.symbol.toUpperCase() === input.symbol &&
      (!input.exchange ||
        security.canonicalExchange.toUpperCase() === input.exchange) &&
      (!input.currency || security.currency === input.currency)
    );
  });
}

function matchHolding(input: {
  symbol: string;
  exchange: string | null;
  currency: CurrencyCode | null;
  securityId: string | null;
  holdings: HoldingPosition[];
}) {
  return input.holdings.find((holding) => {
    if (input.securityId && holding.securityId === input.securityId) {
      return true;
    }
    return (
      holding.symbol.toUpperCase() === input.symbol &&
      (!input.exchange ||
        holding.exchangeOverride?.toUpperCase() === input.exchange ||
        holding.quoteExchange?.toUpperCase() === input.exchange) &&
      (!input.currency ||
        holding.quoteCurrency === input.currency ||
        holding.currency === input.currency)
    );
  });
}

function metadataConfidenceToProviderConfidence(
  confidence: number,
): "low" | "medium" | "high" {
  if (confidence >= 80) {
    return "high";
  }
  if (confidence >= 50) {
    return "medium";
  }
  return "low";
}
