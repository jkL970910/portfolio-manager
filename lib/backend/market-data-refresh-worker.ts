import { desc, eq } from "drizzle-orm";
import { refreshPortfolioQuotes } from "@/lib/backend/services";
import { getDb } from "@/lib/db/client";
import {
  holdingPositions,
  marketDataRefreshRuns,
  users,
} from "@/lib/db/schema";
import { getProviderLimitSnapshotPersisted } from "@/lib/market-data/provider-limits";

const DEFAULT_MAX_USERS = 25;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_BATCHES_PER_RUN = 3;
const DEFAULT_MAX_RUNTIME_SECONDS = 45;

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function getHoldingIdentities(
  holdings: Array<{
    symbol: string;
    exchangeOverride: string | null;
    currency: string;
    securityId?: string | null;
  }>,
) {
  return [
    ...new Map(
    holdings
      .map((holding) => ({
        securityId: holding.securityId ?? null,
        symbol: holding.symbol.trim().toUpperCase(),
        exchange: holding.exchangeOverride?.trim().toUpperCase() || "",
        currency: holding.currency?.trim().toUpperCase() || "CAD",
      }))
      .filter((holding) => holding.symbol)
      .map(
        (holding) => [
          holding.securityId ??
            `${holding.symbol}::${holding.exchange}::${holding.currency}`,
          holding,
        ] as const,
      ),
    ).values(),
  ];
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function hasRuntimeBudget(startedAt: Date, maxRuntimeSeconds: number) {
  return Date.now() - startedAt.getTime() < maxRuntimeSeconds * 1000;
}

export async function runMarketDataRefreshWorkerOnce(input?: {
  workerId?: string;
  maxUsers?: number;
  maxSymbols?: number;
  batchSize?: number;
  maxBatchesPerRun?: number;
  maxRuntimeSeconds?: number;
}) {
  const db = getDb();
  const workerId = input?.workerId ?? `market-data-worker-${process.pid}`;
  const maxUsers = normalizePositiveInteger(input?.maxUsers, DEFAULT_MAX_USERS);
  const batchSize = normalizePositiveInteger(
    input?.batchSize ?? input?.maxSymbols,
    DEFAULT_BATCH_SIZE,
  );
  const maxBatchesPerRun = normalizePositiveInteger(
    input?.maxBatchesPerRun,
    DEFAULT_MAX_BATCHES_PER_RUN,
  );
  const maxRuntimeSeconds = normalizePositiveInteger(
    input?.maxRuntimeSeconds,
    DEFAULT_MAX_RUNTIME_SECONDS,
  );
  const maxProviderCalls = batchSize * maxBatchesPerRun;
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
    batchCount?: number;
    deferredSymbolCount?: number;
    errorMessage?: string | null;
  }> = [];

  for (const user of allUsers) {
    const userHoldings = await db.query.holdingPositions.findMany({
      where: eq(holdingPositions.userId, user.id),
    });
    const holdingIdentities = getHoldingIdentities(userHoldings);
    const refreshableIdentities = holdingIdentities.filter(
      (identity) => identity.securityId,
    );
    const estimatedSymbolCount = holdingIdentities.length;
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
            batchSize,
            maxBatchesPerRun,
            maxProviderCalls,
            maxRuntimeSeconds,
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
            quota: {
              batchSize,
              maxBatchesPerRun,
              maxProviderCalls,
              maxRuntimeSeconds,
              consumedBeforeUser: consumedSymbolCount,
            },
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

    const availableProviderCalls = Math.max(
      maxProviderCalls - consumedSymbolCount,
      0,
    );
    const eligibleIdentities = refreshableIdentities.slice(
      0,
      availableProviderCalls,
    );
    const batches = chunk(eligibleIdentities, batchSize).slice(
      0,
      maxBatchesPerRun,
    );
    const selectedIdentities = batches.flat();
    const deferredSymbolCount = Math.max(
      refreshableIdentities.length - selectedIdentities.length,
      0,
    );

    if (selectedIdentities.length === 0) {
      const finishedAt = new Date();
      const message =
        "Skipped because the worker provider-call budget was already consumed.";
      await db
        .update(marketDataRefreshRuns)
        .set({
          status: "skipped",
          errorMessage: message,
          finishedAt,
          providerStatusJson: {
            reason: "quota-budget-exceeded",
            quota: {
              batchSize,
              maxBatchesPerRun,
              maxProviderCalls,
              maxRuntimeSeconds,
              consumedBeforeUser: consumedSymbolCount,
              deferredSymbolCount: refreshableIdentities.length,
            },
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
        batchCount: 0,
        deferredSymbolCount: refreshableIdentities.length,
        errorMessage: message,
      });
      continue;
    }

    try {
      let refreshedHoldingCount = 0;
      let missingQuoteCount = 0;
      let historyPointCount = 0;
      let snapshotRecorded = false;
      let fxRateLabel: string | null = null;
      let fxAsOf: string | null = null;
      let fxSource: string | null = null;
      let fxFreshness: string | null = null;
      let completedBatchCount = 0;
      let processedSymbolCount = 0;
      let stoppedByRuntime = false;

      for (const batch of batches) {
        if (!hasRuntimeBudget(startedAt, maxRuntimeSeconds)) {
          stoppedByRuntime = true;
          break;
        }

        const result = await refreshPortfolioQuotes(user.id, {
          refreshRunId: run.id,
          securityIds: batch
            .map((identity) => identity.securityId)
            .filter((securityId): securityId is string => Boolean(securityId)),
        });
        completedBatchCount += 1;
        processedSymbolCount += batch.length;
        consumedSymbolCount += batch.length;
        refreshedHoldingCount += result.refreshedHoldingCount;
        missingQuoteCount += result.missingQuoteCount;
        historyPointCount += result.historyPointCount;
        snapshotRecorded = snapshotRecorded || result.snapshotRecorded;
        fxRateLabel = result.fxRateLabel;
        fxAsOf = result.fxAsOf;
        fxSource = result.fxSource;
        fxFreshness = result.fxFreshness;
      }

      const providerLimits = await getProviderLimitSnapshotPersisted();
      const effectiveDeferredSymbolCount =
        deferredSymbolCount +
        (stoppedByRuntime ? selectedIdentities.length - processedSymbolCount : 0);
      const status =
        effectiveDeferredSymbolCount > 0 || missingQuoteCount > 0
          ? "partial"
          : "success";
      await db
        .update(marketDataRefreshRuns)
        .set({
          status,
          sampledSymbolCount: estimatedSymbolCount,
          refreshedHoldingCount,
          missingQuoteCount,
          historyPointCount,
          snapshotRecorded,
          fxRateLabel,
          fxAsOf,
          fxSource,
          fxFreshness,
          finishedAt: new Date(),
          providerStatusJson: {
            providerLimits,
            batching: {
              batchSize,
              completedBatchCount,
              plannedBatchCount: batches.length,
              maxBatchesPerRun,
              maxProviderCalls,
              consumedSymbolCount,
              processedSymbolCount,
              deferredSymbolCount: effectiveDeferredSymbolCount,
              stoppedByRuntime,
            },
            fx: {
              label: fxRateLabel,
              asOf: fxAsOf,
              source: fxSource,
              freshness: fxFreshness,
            },
          },
        })
        .where(eq(marketDataRefreshRuns.id, run.id));
      completedUserCount += 1;
      runs.push({
        userId: user.id,
        status,
        sampledSymbolCount: estimatedSymbolCount,
        refreshedHoldingCount,
        missingQuoteCount,
        historyPointCount,
        batchCount: completedBatchCount,
        deferredSymbolCount: effectiveDeferredSymbolCount,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Market-data refresh failed unexpectedly.";
      const providerLimits = await getProviderLimitSnapshotPersisted();
      await db
        .update(marketDataRefreshRuns)
        .set({
          status: "failed",
          errorMessage: message,
          finishedAt: new Date(),
          providerStatusJson: {
            providerLimits,
            batching: {
              batchSize,
              maxBatchesPerRun,
              maxProviderCalls,
              consumedSymbolCount,
              deferredSymbolCount,
            },
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
        batchCount: 0,
        deferredSymbolCount,
        errorMessage: message,
      });
    }
  }

  return {
    workerId,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    maxUsers,
    batchSize,
    maxBatchesPerRun,
    maxProviderCalls,
    maxRuntimeSeconds,
    consumedSymbolCount,
    completedUserCount,
    failedUserCount,
    skippedUserCount,
    runs,
  };
}
