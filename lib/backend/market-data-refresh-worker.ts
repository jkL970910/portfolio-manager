import { desc, eq } from "drizzle-orm";
import { refreshPortfolioQuotes } from "@/lib/backend/services";
import { getDb } from "@/lib/db/client";
import {
  holdingPositions,
  marketDataRefreshRuns,
  users,
} from "@/lib/db/schema";
import { getProviderLimitSnapshot } from "@/lib/market-data/provider-limits";

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function getHoldingIdentityCount(
  holdings: Array<{
    symbol: string;
    exchangeOverride: string | null;
    currency: string;
  }>,
) {
  return new Set(
    holdings
      .map((holding) => ({
        symbol: holding.symbol.trim().toUpperCase(),
        exchange: holding.exchangeOverride?.trim().toUpperCase() || "",
        currency: holding.currency?.trim().toUpperCase() || "CAD",
      }))
      .filter((holding) => holding.symbol)
      .map(
        (holding) =>
          `${holding.symbol}::${holding.exchange}::${holding.currency}`,
      ),
  ).size;
}

export async function runMarketDataRefreshWorkerOnce(input?: {
  workerId?: string;
  maxUsers?: number;
  maxSymbols?: number;
}) {
  const db = getDb();
  const workerId = input?.workerId ?? `market-data-worker-${process.pid}`;
  const maxUsers = normalizePositiveInteger(input?.maxUsers, 25);
  const maxSymbols = normalizePositiveInteger(input?.maxSymbols, 250);
  const startedAt = new Date();
  const allUsers = await db.query.users.findMany({
    orderBy: desc(users.createdAt),
    limit: maxUsers,
  });

  let consumedSymbolCount = 0;
  let completedUserCount = 0;
  let failedUserCount = 0;
  let skippedUserCount = 0;
  const runs: Array<{
    userId: string;
    status: string;
    sampledSymbolCount: number;
    refreshedHoldingCount: number;
    missingQuoteCount: number;
    historyPointCount: number;
    errorMessage?: string | null;
  }> = [];

  for (const user of allUsers) {
    const userHoldings = await db.query.holdingPositions.findMany({
      where: eq(holdingPositions.userId, user.id),
    });
    const estimatedSymbolCount = getHoldingIdentityCount(userHoldings);
    const runRows = await db
      .insert(marketDataRefreshRuns)
      .values({
        userId: user.id,
        status: "running",
        triggeredBy: "worker",
        workerId,
        sampledSymbolCount: estimatedSymbolCount,
        providerStatusJson: {
          quota: {
            maxSymbols,
            consumedBeforeUser: consumedSymbolCount,
          },
        },
        startedAt,
      })
      .returning();
    const run = runRows[0];

    if (estimatedSymbolCount === 0) {
      const finishedAt = new Date();
      await db
        .update(marketDataRefreshRuns)
        .set({
          status: "skipped",
          finishedAt,
          providerStatusJson: {
            reason: "no-holdings",
            quota: { maxSymbols, consumedBeforeUser: consumedSymbolCount },
          },
        })
        .where(eq(marketDataRefreshRuns.id, run.id));
      skippedUserCount += 1;
      runs.push({
        userId: user.id,
        status: "skipped",
        sampledSymbolCount: 0,
        refreshedHoldingCount: 0,
        missingQuoteCount: 0,
        historyPointCount: 0,
        errorMessage: "No holdings to refresh.",
      });
      continue;
    }

    if (consumedSymbolCount + estimatedSymbolCount > maxSymbols) {
      const finishedAt = new Date();
      const message = `Skipped because estimated symbols (${estimatedSymbolCount}) would exceed worker quota (${maxSymbols}).`;
      await db
        .update(marketDataRefreshRuns)
        .set({
          status: "skipped",
          errorMessage: message,
          finishedAt,
          providerStatusJson: {
            reason: "quota-budget-exceeded",
            quota: { maxSymbols, consumedBeforeUser: consumedSymbolCount },
          },
        })
        .where(eq(marketDataRefreshRuns.id, run.id));
      skippedUserCount += 1;
      runs.push({
        userId: user.id,
        status: "skipped",
        sampledSymbolCount: estimatedSymbolCount,
        refreshedHoldingCount: 0,
        missingQuoteCount: 0,
        historyPointCount: 0,
        errorMessage: message,
      });
      continue;
    }

    consumedSymbolCount += estimatedSymbolCount;

    try {
      const result = await refreshPortfolioQuotes(user.id, {
        refreshRunId: run.id,
      });
      const providerLimits = getProviderLimitSnapshot();
      const status = result.missingQuoteCount > 0 ? "partial" : "success";
      await db
        .update(marketDataRefreshRuns)
        .set({
          status,
          sampledSymbolCount: result.sampledSymbolCount,
          refreshedHoldingCount: result.refreshedHoldingCount,
          missingQuoteCount: result.missingQuoteCount,
          historyPointCount: result.historyPointCount,
          snapshotRecorded: result.snapshotRecorded,
          fxRateLabel: result.fxRateLabel,
          fxAsOf: result.fxAsOf,
          fxSource: result.fxSource,
          fxFreshness: result.fxFreshness,
          finishedAt: new Date(),
          providerStatusJson: {
            providerLimits,
            quota: { maxSymbols, consumedSymbolCount },
            fx: {
              label: result.fxRateLabel,
              asOf: result.fxAsOf,
              source: result.fxSource,
              freshness: result.fxFreshness,
            },
          },
        })
        .where(eq(marketDataRefreshRuns.id, run.id));
      completedUserCount += 1;
      runs.push({
        userId: user.id,
        status,
        sampledSymbolCount: result.sampledSymbolCount,
        refreshedHoldingCount: result.refreshedHoldingCount,
        missingQuoteCount: result.missingQuoteCount,
        historyPointCount: result.historyPointCount,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Market-data refresh failed unexpectedly.";
      const providerLimits = getProviderLimitSnapshot();
      await db
        .update(marketDataRefreshRuns)
        .set({
          status: "failed",
          errorMessage: message,
          finishedAt: new Date(),
          providerStatusJson: {
            providerLimits,
            quota: { maxSymbols, consumedSymbolCount },
            failureClass:
              message.toLowerCase().includes("rate limit") ||
              message.toLowerCase().includes("api credits")
                ? "provider-limited"
                : "unknown",
          },
        })
        .where(eq(marketDataRefreshRuns.id, run.id));
      failedUserCount += 1;
      runs.push({
        userId: user.id,
        status: "failed",
        sampledSymbolCount: estimatedSymbolCount,
        refreshedHoldingCount: 0,
        missingQuoteCount: estimatedSymbolCount,
        historyPointCount: 0,
        errorMessage: message,
      });
    }
  }

  return {
    workerId,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    maxUsers,
    maxSymbols,
    consumedSymbolCount,
    completedUserCount,
    failedUserCount,
    skippedUserCount,
    runs,
  };
}
