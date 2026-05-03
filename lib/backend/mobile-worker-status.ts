import { desc, eq, inArray } from "drizzle-orm";
import { apiSuccess } from "@/lib/backend/contracts";
import { getMobileExternalResearchJobs } from "@/lib/backend/external-research-jobs";
import { mapMarketDataRefreshRunForMobile } from "@/lib/backend/market-data-refresh-runs";
import type { SecurityRecord } from "@/lib/backend/models";
import { listRecentProviderUsage } from "@/lib/backend/provider-usage-ledger";
import { getRepositories } from "@/lib/backend/repositories/factory";
import { normalizeSecurityMetadataForWrite } from "@/lib/backend/security-economic-exposure";
import { runSecurityMetadataRefreshWorkerOnce } from "@/lib/backend/security-metadata-worker";
import { getDb } from "@/lib/db/client";
import {
  holdingPositions,
  marketDataRefreshRuns,
  securities,
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

function metadataSourceLabel(source: string) {
  switch (source) {
    case "manual":
      return "人工确认";
    case "provider":
      return "外部资料";
    case "project-registry":
      return "项目规则";
    case "heuristic":
      return "系统推断";
    default:
      return "来源未知";
  }
}

function metadataConfidenceLabel(confidence: number) {
  if (confidence >= 90) return "高可信";
  if (confidence >= 70) return "可用";
  if (confidence >= 50) return "待复核";
  return "低可信";
}

function formatMetadataDate(value: Date | string | null | undefined) {
  const iso = formatDateTime(value);
  if (!iso) return "时间未知";
  return iso.slice(0, 10);
}

function mapSecurityMetadataForMobile(
  security: Pick<
    SecurityRecord,
    | "id"
    | "symbol"
    | "name"
    | "canonicalExchange"
    | "currency"
    | "securityType"
    | "economicAssetClass"
    | "economicSector"
    | "exposureRegion"
    | "metadataSource"
    | "metadataConfidence"
    | "metadataAsOf"
    | "metadataConfirmedAt"
    | "metadataNotes"
  >,
  holdingCount: number,
) {
  const source = security.metadataSource ?? "heuristic";
  const confidence = security.metadataConfidence ?? 45;
  const confirmed = source === "manual" || Boolean(security.metadataConfirmedAt);
  return {
    securityId: security.id,
    symbol: security.symbol,
    name: security.name,
    exchange: security.canonicalExchange,
    currency: security.currency,
    securityType: security.securityType,
    economicAssetClass: security.economicAssetClass ?? "待确认",
    economicSector: security.economicSector ?? "",
    exposureRegion: security.exposureRegion ?? "",
    metadataSource: source,
    metadataSourceLabel: metadataSourceLabel(source),
    metadataConfidence: confidence,
    metadataConfidenceLabel: metadataConfidenceLabel(confidence),
    metadataAsOfLabel: formatMetadataDate(security.metadataAsOf),
    metadataConfirmedAtLabel: security.metadataConfirmedAt
      ? formatMetadataDate(security.metadataConfirmedAt)
      : null,
    metadataNotes: security.metadataNotes ?? "",
    holdingCount,
    locked: confirmed,
    statusLabel: confirmed
      ? "已人工确认，后台不会覆盖"
      : `${metadataSourceLabel(source)} · ${metadataConfidenceLabel(confidence)}`,
  };
}

export class SecurityMetadataAccessError extends Error {
  constructor(message = "只能修正当前组合内的标的资料。") {
    super(message);
    this.name = "SecurityMetadataAccessError";
  }
}

export async function getMobileSecurityMetadataReview(userId: string) {
  const db = getDb();
  const holdingRows = await db
    .select({
      securityId: holdingPositions.securityId,
    })
    .from(holdingPositions)
    .where(eq(holdingPositions.userId, userId));
  const securityIds = [
    ...new Set(
      holdingRows
        .map((row) => row.securityId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  if (securityIds.length === 0) {
    return apiSuccess(
      {
        summary: {
          title: "标的资料修正",
          statusLabel: "当前没有可复核的持仓标的资料。",
          actionLabel: "导入持仓后再复核",
        },
        items: [],
      },
      "database",
    );
  }

  const rows = await db
    .select()
    .from(securities)
    .where(inArray(securities.id, securityIds));
  const holdingCounts = new Map<string, number>();
  for (const row of holdingRows) {
    if (!row.securityId) continue;
    holdingCounts.set(row.securityId, (holdingCounts.get(row.securityId) ?? 0) + 1);
  }
  const items = rows
    .map((row) =>
      mapSecurityMetadataForMobile(
        {
          id: row.id,
          symbol: row.symbol,
          name: row.name,
          canonicalExchange: row.canonicalExchange,
          currency: row.currency as SecurityRecord["currency"],
          securityType: row.securityType,
          economicAssetClass: row.economicAssetClass,
          economicSector: row.economicSector,
          exposureRegion: row.exposureRegion,
          metadataSource:
            (row.metadataSource as SecurityRecord["metadataSource"]) ??
            "heuristic",
          metadataConfidence: row.metadataConfidence,
          metadataAsOf: row.metadataAsOf?.toISOString() ?? null,
          metadataConfirmedAt: row.metadataConfirmedAt?.toISOString() ?? null,
          metadataNotes: row.metadataNotes,
        },
        holdingCounts.get(row.id) ?? 0,
      ),
    )
    .sort((left, right) => {
      if (left.locked !== right.locked) return left.locked ? 1 : -1;
      return left.metadataConfidence - right.metadataConfidence;
    });
  const lowConfidenceCount = items.filter(
    (item) => !item.locked && item.metadataConfidence < 70,
  ).length;
  const manualCount = items.filter((item) => item.locked).length;

  return apiSuccess(
    {
      summary: {
        title: "标的资料修正",
        statusLabel:
          lowConfidenceCount > 0
            ? `${lowConfidenceCount} 个标的资料仍建议复核。`
            : "当前持仓标的资料没有明显低可信项。",
        actionLabel:
          "可小批量刷新外部资料；人工确认后会锁定，不再被后台覆盖。",
        totalCount: items.length,
        manualCount,
        lowConfidenceCount,
      },
      items,
    },
    "database",
  );
}

export async function updateMobileSecurityMetadata(
  userId: string,
  securityId: string,
  input: {
    economicAssetClass: string;
    economicSector?: string | null;
    exposureRegion?: string | null;
    notes?: string | null;
  },
) {
  const repositories = getRepositories();
  const holdings = await repositories.holdings.listByUserId(userId);
  if (!holdings.some((holding) => holding.securityId === securityId)) {
    throw new SecurityMetadataAccessError();
  }

  const now = new Date().toISOString();
  const metadata = normalizeSecurityMetadataForWrite({
    economicAssetClass: input.economicAssetClass,
    economicSector: input.economicSector ?? null,
    exposureRegion: input.exposureRegion ?? null,
    source: "manual",
    confidence: 100,
    asOf: now,
    confirmedAt: now,
    notes: input.notes ?? "用户在移动端人工确认。",
  });
  const security = await repositories.securities.updateMetadata(securityId, {
    economicAssetClass: metadata.economicAssetClass,
    economicSector: metadata.economicSector,
    exposureRegion: metadata.exposureRegion,
    metadataSource: metadata.source,
    metadataConfidence: metadata.confidence,
    metadataAsOf: metadata.asOf,
    metadataConfirmedAt: metadata.confirmedAt,
    metadataNotes: metadata.notes,
  });

  return apiSuccess(
    {
      item: mapSecurityMetadataForMobile(
        security,
        holdings.filter((holding) => holding.securityId === securityId).length,
      ),
    },
    "database",
  );
}

export async function refreshMobileSecurityMetadata(input?: {
  maxSecurities?: number;
}) {
  const result = await runSecurityMetadataRefreshWorkerOnce({
    workerId: "mobile-security-metadata-refresh",
    maxSecurities: input?.maxSecurities ?? 12,
    maxAgeDays: 0,
  });
  return apiSuccess(result, "database");
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
