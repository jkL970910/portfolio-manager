import type { CurrencyCode } from "@/lib/backend/models";
import {
  getCoreRecommendationUniverse,
  type CoreRecommendationCandidate,
} from "@/lib/backend/recommendation-v3/core-universe";

export type RecommendationCandidateSource =
  | "core_pool"
  | "watchlist"
  | "dynamic_pool";

export type RecommendationCandidate = Omit<CoreRecommendationCandidate, "source"> & {
  source: RecommendationCandidateSource;
  providerConfidence?: "low" | "medium" | "high";
  sourceNote?: string | null;
};

export type RecommendationCandidateProviderContext = {
  assetClass: string;
  watchlistSymbols: string[];
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
  return [new CoreRecommendationCandidateProvider()];
}

export function listRecommendationCandidates(input: {
  assetClass: string;
  watchlistSymbols: string[];
  providers?: RecommendationCandidateProvider[];
}) {
  const providers =
    input.providers ?? getDefaultRecommendationCandidateProviders();
  const candidates = providers.flatMap((provider) =>
    provider.listCandidates({
      assetClass: input.assetClass,
      watchlistSymbols: input.watchlistSymbols,
    }),
  );
  return dedupeRecommendationCandidates(candidates);
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
