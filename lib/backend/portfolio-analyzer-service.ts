import { apiSuccess } from "@/lib/backend/contracts";
import { getRepositories } from "@/lib/backend/repositories/factory";
import { assertExternalResearchAllowed } from "@/lib/backend/portfolio-external-research";
import {
  PortfolioAnalyzerRequest,
  PortfolioAnalyzerResult,
  portfolioAnalyzerResultSchema
} from "@/lib/backend/portfolio-analyzer-contracts";
import {
  AnalyzerMarketDataContext,
  buildAccountAnalyzerQuickScan,
  buildPortfolioAnalyzerQuickScan,
  buildRecommendationRunAnalyzerQuickScan,
  buildSecurityAnalyzerQuickScan
} from "@/lib/backend/portfolio-analyzer";
import type { AnalyzerSecurityIdentity } from "@/lib/backend/portfolio-analyzer-contracts";
import type { HoldingPosition, SecurityPriceHistoryPoint } from "@/lib/backend/models";

function normalizePart(value: string | null | undefined) {
  return value?.trim().toUpperCase() || "_";
}

export function buildPortfolioAnalyzerCacheKey(input: PortfolioAnalyzerRequest) {
  const prefix = `${input.scope}:${input.mode}`;

  if (input.scope === "portfolio") {
    return `${prefix}:all`;
  }

  if (input.scope === "account") {
    return `${prefix}:account:${input.accountId}`;
  }

  if (input.scope === "recommendation-run") {
    return `${prefix}:run:${input.recommendationRunId}`;
  }

  if (input.holdingId) {
    return `${prefix}:holding:${input.holdingId}`;
  }

  const identity = input.security;
  return [
    prefix,
    "security",
    normalizePart(identity?.symbol),
    normalizePart(identity?.exchange ?? null),
    normalizePart(identity?.currency ?? null),
    normalizePart(identity?.provider ?? null)
  ].join(":");
}

function expiresAtFrom(now: Date, maxCacheAgeSeconds: number) {
  return new Date(now.getTime() + maxCacheAgeSeconds * 1000).toISOString();
}

function shouldUseCache(input: PortfolioAnalyzerRequest) {
  return input.cacheStrategy === "prefer-cache" && !input.includeExternalResearch;
}

function normalizeIdentityPart(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

async function loadAnalyzerMarketDataContext(args: {
  userId: string;
  holdings: HoldingPosition[];
  identity?: AnalyzerSecurityIdentity | null;
}): Promise<AnalyzerMarketDataContext> {
  const repositories = getRepositories();
  const portfolioSnapshotsPromise = repositories.snapshots.listByUserId(args.userId);

  const identities = args.identity
    ? [args.identity]
    : args.holdings.map((holding) => ({
        symbol: holding.symbol,
        exchange: holding.exchangeOverride ?? null,
        currency: holding.currency ?? null,
      }));
  const uniqueIdentities = [
    ...new Map(
      identities
        .map((identity) => ({
          symbol: normalizeIdentityPart(identity.symbol),
          exchange: normalizeIdentityPart(identity.exchange),
          currency: normalizeIdentityPart(identity.currency),
        }))
        .filter((identity) => identity.symbol)
        .map((identity) => [
          `${identity.symbol}:${identity.exchange ?? "_"}:${identity.currency ?? "_"}`,
          identity,
        ]),
    ).values(),
  ];
  const historyLists = await Promise.all(
    uniqueIdentities.map((identity) =>
      identity.exchange || identity.currency
        ? repositories.securityPriceHistory.listByIdentity({
            symbol: identity.symbol!,
            exchange: identity.exchange,
            currency: identity.currency,
          })
        : repositories.securityPriceHistory.listBySymbol(identity.symbol!),
    ),
  );

  const byHistoryKey = new Map<string, SecurityPriceHistoryPoint>();
  for (const point of historyLists.flat()) {
    byHistoryKey.set(
      `${point.symbol}:${point.exchange ?? ""}:${point.currency}:${point.priceDate}`,
      point,
    );
  }

  return {
    priceHistory: [...byHistoryKey.values()],
    portfolioSnapshots: await portfolioSnapshotsPromise,
  };
}

async function readCachedAnalyzerResult(
  userId: string,
  input: PortfolioAnalyzerRequest,
  targetKey: string
) {
  if (!shouldUseCache(input)) {
    return null;
  }

  try {
    const cached = await getRepositories().analysisRuns.getFreshByKey(userId, {
      scope: input.scope,
      mode: input.mode,
      targetKey,
      now: new Date()
    });
    return cached ? portfolioAnalyzerResultSchema.parse(cached.result) : null;
  } catch (error) {
    console.warn("Portfolio analyzer cache read skipped.", error);
    return null;
  }
}

async function persistAnalyzerResult(
  userId: string,
  input: PortfolioAnalyzerRequest,
  targetKey: string,
  result: PortfolioAnalyzerResult
) {
  if (input.includeExternalResearch) {
    return;
  }

  try {
    await getRepositories().analysisRuns.create({
      userId,
      scope: result.scope,
      mode: result.mode,
      targetKey,
      request: input as unknown as Record<string, unknown>,
      result: result as unknown as Record<string, unknown>,
      sourceMode: result.dataFreshness.sourceMode,
      generatedAt: result.generatedAt,
      expiresAt: expiresAtFrom(new Date(), input.maxCacheAgeSeconds)
    });
  } catch (error) {
    console.warn("Portfolio analyzer cache write skipped.", error);
  }
}

export async function getPortfolioAnalyzerQuickScan(userId: string, input: PortfolioAnalyzerRequest) {
  const repositories = getRepositories();
  const targetKey = buildPortfolioAnalyzerCacheKey(input);
  assertExternalResearchAllowed(input);
  const cached = await readCachedAnalyzerResult(userId, input, targetKey);
  if (cached) {
    return apiSuccess(cached, "database");
  }

  const [accounts, holdings, profile] = await Promise.all([
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.preferences.getByUserId(userId)
  ]);

  let result: PortfolioAnalyzerResult;

  if (input.scope === "portfolio") {
    result = buildPortfolioAnalyzerQuickScan({
      accounts,
      holdings,
      profile,
      marketData: await loadAnalyzerMarketDataContext({ userId, holdings })
    });
  } else if (input.scope === "account") {
    const account = accounts.find((item) => item.id === input.accountId);
    if (!account) {
      throw new Error("Requested account is not available for quick analysis.");
    }

    result = buildAccountAnalyzerQuickScan({
      account,
      accounts,
      holdings,
      profile,
      marketData: await loadAnalyzerMarketDataContext({
        userId,
        holdings: holdings.filter((item) => item.accountId === input.accountId),
      })
    });
  } else if (input.scope === "security") {
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

    result = buildSecurityAnalyzerQuickScan({
      identity,
      accounts,
      holdings,
      profile,
      marketData: await loadAnalyzerMarketDataContext({
        userId,
        holdings,
        identity,
      })
    });
  } else {
    const latestRun = await repositories.recommendations.getLatestByUserId(userId);
    if (latestRun.id !== input.recommendationRunId) {
      throw new Error("Requested recommendation run is not available for quick analysis.");
    }

    result = buildRecommendationRunAnalyzerQuickScan({
      run: latestRun,
      profile
    });
  }

  await persistAnalyzerResult(userId, input, targetKey, result);
  return apiSuccess(result, "database");
}
