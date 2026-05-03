import { desc, eq } from "drizzle-orm";
import { apiSuccess } from "@/lib/backend/contracts";
import { getMobileDataFreshnessPolicy } from "@/lib/backend/data-freshness-policy";
import { refreshPortfolioQuotes } from "@/lib/backend/services";
import { getDb } from "@/lib/db/client";
import { marketDataRefreshRuns } from "@/lib/db/schema";
import { getProviderLimitSnapshotPersisted } from "@/lib/market-data/provider-limits";

type MarketDataRefreshTrigger = "manual" | "worker";

interface MarketDataRefreshRunForMobileInput {
  id: string;
  scope: string;
  status: string;
  triggeredBy: string;
  workerId: string | null;
  sampledSymbolCount: number;
  refreshedHoldingCount: number;
  missingQuoteCount: number;
  historyPointCount: number;
  snapshotRecorded: boolean;
  fxRateLabel: string | null;
  fxAsOf: string | null;
  fxSource: string | null;
  fxFreshness: string | null;
  providerStatusJson?: unknown;
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Market-data refresh failed unexpectedly.";
}

function classifyFailure(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("rate limit") ||
    normalized.includes("api credits") ||
    normalized.includes("quota")
    ? "provider-limited"
    : "unknown";
}

function mapStatusLabel(status: string) {
  switch (status) {
    case "success":
      return "刷新成功";
    case "partial":
      return "部分完成";
    case "failed":
      return "刷新失败";
    case "skipped":
      return "已跳过";
    case "running":
      return "运行中";
    default:
      return "状态未知";
  }
}

function mapTriggerLabel(triggeredBy: string) {
  switch (triggeredBy) {
    case "manual":
      return "手动刷新";
    case "worker":
      return "后台任务";
    default:
      return "系统刷新";
  }
}

function mapFxFreshnessLabel(freshness: string | null) {
  switch (freshness) {
    case "fresh":
      return "FX 新鲜";
    case "stale":
      return "FX 可能过期";
    case "fallback":
      return "FX 使用保守回退";
    default:
      return "FX 状态未知";
  }
}

function formatProviderStatus(args: {
  status: string;
  missingQuoteCount: number;
  errorMessage: string | null;
  providerLimits?: unknown;
}) {
  const activeLimits = Array.isArray(args.providerLimits)
    ? args.providerLimits.filter(
        (item): item is { provider?: string; retryAfterSeconds?: number } =>
          Boolean(item) &&
          typeof item === "object" &&
          "limited" in item &&
          item.limited === true,
      )
    : [];

  if (activeLimits.length > 0) {
    return activeLimits
      .map((item) => {
        const provider = item.provider ?? "provider";
        const retryAfter = item.retryAfterSeconds
          ? `，约 ${item.retryAfterSeconds} 秒后重试`
          : "";
        return `${provider} 已限流${retryAfter}`;
      })
      .join("；");
  }

  if (args.errorMessage) {
    return args.errorMessage;
  }
  if (args.status === "skipped") {
    return "本次没有执行真实行情刷新。";
  }
  if (args.status === "partial" || args.missingQuoteCount > 0) {
    return `还有 ${args.missingQuoteCount} 个标的暂未拿到可用报价。`;
  }
  if (args.status === "running") {
    return "刷新任务仍在运行。";
  }
  return "本次刷新没有记录 provider 错误。";
}

export function mapMarketDataRefreshRunForMobile(
  run: MarketDataRefreshRunForMobileInput,
) {
  const providerLimits =
    run.providerStatusJson &&
    typeof run.providerStatusJson === "object" &&
    "providerLimits" in run.providerStatusJson &&
    Array.isArray(run.providerStatusJson.providerLimits)
      ? run.providerStatusJson.providerLimits
      : [];
  const durationMs =
    run.finishedAt && run.startedAt
      ? Math.max(run.finishedAt.getTime() - run.startedAt.getTime(), 0)
      : null;

  return {
    id: run.id,
    scope: run.scope,
    scopeLabel: run.scope === "portfolio-quotes" ? "组合行情" : run.scope,
    status: run.status,
    statusLabel: mapStatusLabel(run.status),
    triggeredBy: run.triggeredBy,
    triggerLabel: mapTriggerLabel(run.triggeredBy),
    workerId: run.workerId,
    sampledSymbolCount: run.sampledSymbolCount,
    refreshedHoldingCount: run.refreshedHoldingCount,
    missingQuoteCount: run.missingQuoteCount,
    historyPointCount: run.historyPointCount,
    snapshotRecorded: run.snapshotRecorded,
    fxRateLabel: run.fxRateLabel,
    fxAsOf: run.fxAsOf,
    fxSource: run.fxSource,
    fxFreshness: run.fxFreshness,
    fxFreshnessLabel: mapFxFreshnessLabel(run.fxFreshness),
    providerLimits,
    providerStatusLabel: formatProviderStatus({
      status: run.status,
      missingQuoteCount: run.missingQuoteCount,
      errorMessage: run.errorMessage,
      providerLimits,
    }),
    errorMessage: run.errorMessage,
    durationMs,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
  };
}

export async function refreshPortfolioQuotesWithRunLedger(input: {
  userId: string;
  triggeredBy: MarketDataRefreshTrigger;
  workerId?: string;
}) {
  const db = getDb();
  const runRows = await db
    .insert(marketDataRefreshRuns)
    .values({
      userId: input.userId,
      status: "running",
      triggeredBy: input.triggeredBy,
      workerId: input.workerId,
      startedAt: new Date(),
    })
    .returning();
  const run = runRows[0];

  try {
    const data = await refreshPortfolioQuotes(input.userId, {
      refreshRunId: run.id,
    });
    const providerLimits = await getProviderLimitSnapshotPersisted();
    const status = data.missingQuoteCount > 0 ? "partial" : "success";
    await db
      .update(marketDataRefreshRuns)
      .set({
        status,
        sampledSymbolCount: data.sampledSymbolCount,
        refreshedHoldingCount: data.refreshedHoldingCount,
        missingQuoteCount: data.missingQuoteCount,
        historyPointCount: data.historyPointCount,
        snapshotRecorded: data.snapshotRecorded,
        fxRateLabel: data.fxRateLabel,
        fxAsOf: data.fxAsOf,
        fxSource: data.fxSource,
        fxFreshness: data.fxFreshness,
        finishedAt: new Date(),
        providerStatusJson: {
          providerLimits,
          fx: {
            label: data.fxRateLabel,
            asOf: data.fxAsOf,
            source: data.fxSource,
            freshness: data.fxFreshness,
          },
        },
      })
      .where(eq(marketDataRefreshRuns.id, run.id));
    return { ok: true as const, data, runId: run.id, status };
  } catch (error) {
    const errorMessage = readErrorMessage(error);
    const providerLimits = await getProviderLimitSnapshotPersisted();
    await db
      .update(marketDataRefreshRuns)
      .set({
        status: "failed",
        errorMessage,
        finishedAt: new Date(),
        providerStatusJson: {
          providerLimits,
          failureClass: classifyFailure(errorMessage),
        },
      })
      .where(eq(marketDataRefreshRuns.id, run.id));

    return {
      ok: false as const,
      runId: run.id,
      status: "failed",
      errorMessage,
    };
  }
}

export async function getMobileMarketDataRefreshRuns(
  userId: string,
  limit = 5,
) {
  const db = getDb();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const runs = await db.query.marketDataRefreshRuns.findMany({
    where: eq(marketDataRefreshRuns.userId, userId),
    orderBy: desc(marketDataRefreshRuns.createdAt),
    limit: safeLimit,
  });
  const items = runs.map(mapMarketDataRefreshRunForMobile);
  const latest = items[0] ?? null;
  const latestManual =
    items.find((item) => item.triggeredBy === "manual") ?? latest;

  return apiSuccess(
    {
      summary: {
        latestStatusLabel: latest?.statusLabel ?? "还没有刷新记录",
        latestProviderStatusLabel:
          latest?.providerStatusLabel ?? "尚未执行过行情刷新。",
        latestFxLabel: latest?.fxRateLabel ?? null,
        latestFxFreshnessLabel: latest?.fxFreshnessLabel ?? null,
        latestManualStatusLabel:
          latestManual?.statusLabel ?? "还没有手动刷新记录",
        latestManualProviderStatusLabel:
          latestManual?.providerStatusLabel ?? "尚未执行过手动行情刷新。",
        latestManualFxLabel: latestManual?.fxRateLabel ?? null,
        latestManualFxFreshnessLabel: latestManual?.fxFreshnessLabel ?? null,
      },
      freshnessPolicy: getMobileDataFreshnessPolicy(),
      items,
    },
    "database",
  );
}
