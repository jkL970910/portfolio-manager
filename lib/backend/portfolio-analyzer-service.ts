import { apiSuccess } from "@/lib/backend/contracts";
import { getRepositories } from "@/lib/backend/repositories/factory";
import { PortfolioAnalyzerRequest } from "@/lib/backend/portfolio-analyzer-contracts";
import {
  buildPortfolioAnalyzerQuickScan,
  buildRecommendationRunAnalyzerQuickScan,
  buildSecurityAnalyzerQuickScan
} from "@/lib/backend/portfolio-analyzer";

export async function getPortfolioAnalyzerQuickScan(userId: string, input: PortfolioAnalyzerRequest) {
  const repositories = getRepositories();
  const [accounts, holdings, profile] = await Promise.all([
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.preferences.getByUserId(userId)
  ]);

  if (input.scope === "portfolio") {
    return apiSuccess(buildPortfolioAnalyzerQuickScan({
      accounts,
      holdings,
      profile
    }), "database");
  }

  if (input.scope === "security") {
    const holding = input.holdingId
      ? holdings.find((item) => item.id === input.holdingId)
      : undefined;
    const identity = input.security ?? (holding
      ? {
          symbol: holding.symbol,
          exchange: holding.exchangeOverride ?? null,
          currency: holding.currency ?? null,
          name: holding.name,
          securityType: holding.securityTypeOverride ?? null
        }
      : null);

    if (!identity) {
      throw new Error("Security analysis requires a resolved security identity or holding id.");
    }

    return apiSuccess(buildSecurityAnalyzerQuickScan({
      identity,
      accounts,
      holdings,
      profile
    }), "database");
  }

  const latestRun = await repositories.recommendations.getLatestByUserId(userId);
  if (latestRun.id !== input.recommendationRunId) {
    throw new Error("Requested recommendation run is not available for quick analysis.");
  }

  return apiSuccess(buildRecommendationRunAnalyzerQuickScan({
    run: latestRun,
    profile
  }), "database");
}
