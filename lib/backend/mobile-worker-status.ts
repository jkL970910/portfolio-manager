import { desc } from "drizzle-orm";
import { apiSuccess } from "@/lib/backend/contracts";
import { getMobileExternalResearchJobs } from "@/lib/backend/external-research-jobs";
import { mapMarketDataRefreshRunForMobile } from "@/lib/backend/market-data-refresh-runs";
import { listRecentProviderUsage } from "@/lib/backend/provider-usage-ledger";
import { getDb } from "@/lib/db/client";
import {
  marketDataRefreshRuns,
  securityMetadataRefreshRuns,
} from "@/lib/db/schema";

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function statusLabel(status: string) {
  switch (status) {
    case "success":
      return "运行成功";
    case "partial":
      return "部分完成";
    case "failed":
      return "运行失败";
    case "skipped":
      return "已跳过";
    case "running":
      return "运行中";
    case "queued":
      return "排队中";
    default:
      return "状态未知";
  }
}

function providerUsageLabel(row: Awaited<ReturnType<typeof listRecentProviderUsage>>[number]) {
  const quota =
    row.quotaLimit && row.quotaLimit > 0
      ? ` / 上限 ${row.quotaLimit}`
      : "";
  return `${row.provider} · ${row.endpoint} · ${row.usageDate}：请求 ${row.requestCount}${quota}，成功 ${row.successCount}，失败 ${row.failureCount}，跳过 ${row.skippedCount}`;
}

function mapSecurityMetadataRun(
  row: typeof securityMetadataRefreshRuns.$inferSelect | null,
) {
  if (!row) {
    return {
      id: null,
      title: "标的资料修正",
      status: "empty",
      statusLabel: "还没有运行记录",
      note: "后台还没有修正过标的资料。",
      lastFinishedAt: null,
      metricsLabel: "更新 0 / 跳过 0 / 失败 0",
    };
  }

  return {
    id: row.id,
    title: "标的资料修正",
    status: row.status,
    statusLabel: statusLabel(row.status),
    note: row.statusNote ?? "标的资料 worker 已记录运行状态。",
    lastFinishedAt: formatDateTime(row.finishedAt ?? row.createdAt),
    metricsLabel: `检查 ${row.sampledSecurityCount} 个；更新 ${row.updatedCount}；跳过 ${row.skippedCount}；失败 ${row.failedCount}`,
    providerIds: Array.isArray(row.providerIdsJson)
      ? row.providerIdsJson
      : [],
  };
}

export async function getMobileWorkerStatusCenter(userId: string) {
  const db = getDb();
  const [marketRows, metadataRows, providerUsageRows, externalJobs] =
    await Promise.all([
      db
        .select()
        .from(marketDataRefreshRuns)
        .orderBy(desc(marketDataRefreshRuns.createdAt))
        .limit(1),
      db
        .select()
        .from(securityMetadataRefreshRuns)
        .orderBy(desc(securityMetadataRefreshRuns.createdAt))
        .limit(1),
      listRecentProviderUsage(undefined, 6),
      getMobileExternalResearchJobs(userId, 3),
    ]);

  const latestMarket = marketRows[0]
    ? mapMarketDataRefreshRunForMobile(marketRows[0])
    : null;
  const latestMetadata = mapSecurityMetadataRun(metadataRows[0] ?? null);
  const externalData =
    externalJobs.data && typeof externalJobs.data === "object"
      ? externalJobs.data
      : { summary: null, items: [] };
  const externalSummary =
    "summary" in externalData && externalData.summary
      ? (externalData.summary as {
          latestStatusLabel?: string;
          latestStatusNote?: string;
          runningCount?: number;
          queuedCount?: number;
          failedCount?: number;
        })
      : null;

  const tasks = [
    {
      id: "market-data",
      title: "行情刷新",
      status: latestMarket?.status ?? "empty",
      statusLabel: latestMarket?.statusLabel ?? "还没有运行记录",
      note:
        latestMarket?.providerStatusLabel ??
        "后台还没有行情刷新记录；可先手动刷新或等待 Cron。",
      lastFinishedAt: latestMarket?.finishedAt ?? latestMarket?.createdAt ?? null,
      metricsLabel: latestMarket
        ? `检查 ${latestMarket.sampledSymbolCount} 个；刷新 ${latestMarket.refreshedHoldingCount} 笔；缺失 ${latestMarket.missingQuoteCount}`
        : "检查 0 / 刷新 0 / 缺失 0",
    },
    latestMetadata,
    {
      id: "external-research",
      title: "外部研究",
      status:
        (externalSummary?.runningCount ?? 0) > 0
          ? "running"
          : (externalSummary?.failedCount ?? 0) > 0
            ? "partial"
            : "disabled",
      statusLabel: externalSummary?.latestStatusLabel ?? "当前默认关闭",
      note:
        externalSummary?.latestStatusNote ??
        "外部研究默认不自动抓新闻/论坛；必须通过 worker、缓存和来源白名单。",
      lastFinishedAt: null,
      metricsLabel: `运行 ${externalSummary?.runningCount ?? 0} / 排队 ${externalSummary?.queuedCount ?? 0} / 失败 ${externalSummary?.failedCount ?? 0}`,
    },
  ];

  return apiSuccess(
    {
      summary: {
        title: "云端后台任务中心",
        statusLabel:
          "行情、标的资料和外部研究都由后台 worker/cache 管理，手机页面只读状态或手动确认触发。",
        nextRunLabel: "Cloudflare Cron 每天 UTC 11:15 自动运行。",
      },
      tasks,
      providerUsage: providerUsageRows.map((row) => ({
        provider: row.provider,
        endpoint: row.endpoint,
        usageDate: row.usageDate,
        requestCount: row.requestCount,
        successCount: row.successCount,
        failureCount: row.failureCount,
        skippedCount: row.skippedCount,
        quotaLimit: row.quotaLimit,
        label: providerUsageLabel(row),
      })),
    },
    "database",
  );
}
