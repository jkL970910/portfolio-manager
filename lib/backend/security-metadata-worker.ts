import { getRepositories } from "@/lib/backend/repositories/factory";
import {
  getEnabledSecurityMetadataProviders,
  shouldApplySecurityMetadata,
} from "@/lib/backend/security-metadata-providers";
import {
  normalizeSecurityMetadataForWrite,
} from "@/lib/backend/security-economic-exposure";
import { incrementProviderUsage } from "@/lib/backend/provider-usage-ledger";
import { getDb } from "@/lib/db/client";
import { securityMetadataRefreshRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type SecurityMetadataRefreshRunRow =
  typeof securityMetadataRefreshRuns.$inferSelect;

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function readMetadataStaleBefore(now: Date, maxAgeDays: number) {
  return new Date(now.getTime() - maxAgeDays * 86_400_000).toISOString();
}

type SecurityMetadataRefreshFilter = {
  symbol: string;
  exchange: string | null;
  currency: string | null;
};

function normalizeIdentityValue(value: string): SecurityMetadataRefreshFilter | null {
  const parts = value
    .trim()
    .split(":")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return {
    symbol: parts[0],
    exchange: parts[1] ?? null,
    currency: parts[2] ?? null,
  };
}

function normalizeIdentityList(symbols: string[] | string | undefined) {
  const values = Array.isArray(symbols)
    ? symbols
    : symbols
      ? symbols.split(",")
      : [];
  return values
    .map(normalizeIdentityValue)
    .filter((item): item is SecurityMetadataRefreshFilter => Boolean(item));
}

function normalizeIdentityPart(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function matchesRefreshFilter(
  security: {
    symbol: string;
    canonicalExchange: string;
    micCode?: string | null;
    currency: string;
  },
  filter: SecurityMetadataRefreshFilter,
) {
  if (normalizeIdentityPart(security.symbol) !== filter.symbol) {
    return false;
  }
  if (filter.currency && normalizeIdentityPart(security.currency) !== filter.currency) {
    return false;
  }
  if (!filter.exchange) {
    return true;
  }
  return (
    normalizeIdentityPart(security.canonicalExchange) === filter.exchange ||
    normalizeIdentityPart(security.micCode) === filter.exchange
  );
}

function matchesAnyRefreshFilter(
  security: Parameters<typeof matchesRefreshFilter>[0],
  filters: SecurityMetadataRefreshFilter[],
) {
  return (
    filters.length === 0 ||
    filters.some((filter) => matchesRefreshFilter(security, filter))
  );
}

function providerRequestQuotaLimit(providerId: string) {
  if (providerId === "openfigi-profile") {
    return Number(process.env.OPENFIGI_DAILY_QUOTA_LIMIT ?? 25);
  }
  if (providerId === "alpha-vantage-profile") {
    return Number(process.env.ALPHA_VANTAGE_DAILY_QUOTA_LIMIT ?? 25);
  }
  return null;
}

function providerRequestCount(providerId: string) {
  return providerId === "project-registry" ? 0 : 1;
}

export async function runSecurityMetadataRefreshWorkerOnce(input?: {
  workerId?: string;
  maxSecurities?: number;
  maxAgeDays?: number;
  symbols?: string[] | string;
  force?: boolean;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  const workerId = input?.workerId ?? `security-metadata-worker-${process.pid}`;
  const maxSecurities = normalizePositiveInteger(input?.maxSecurities, 100);
  const maxAgeDays = normalizePositiveInteger(input?.maxAgeDays, 30);
  const force = input?.force ?? false;
  const repositories = getRepositories();
  const providers = getEnabledSecurityMetadataProviders();
  const refreshFilters = normalizeIdentityList(
    input?.symbols ?? process.env.SECURITY_METADATA_REFRESH_SYMBOLS,
  );
  let run: SecurityMetadataRefreshRunRow | null = null;
  try {
    if (process.env.DATABASE_URL) {
      const db = getDb();
      const runRows = await db
        .insert(securityMetadataRefreshRuns)
        .values({
          status: "running",
          workerId,
          startedAt: now,
          providerIdsJson: providers.map((provider) => provider.id),
        })
        .returning();
      run = runRows[0] ?? null;
    }
  } catch {
    run = null;
  }
  const securities = (
    await repositories.securities.listNeedingMetadataRefresh({
      limit: refreshFilters.length > 0 ? Math.max(maxSecurities, 500) : maxSecurities,
      staleBefore: force
        ? new Date(now.getTime() + 86_400_000).toISOString()
        : readMetadataStaleBefore(now, maxAgeDays),
    })
  )
    .filter(
      (security) =>
        matchesAnyRefreshFilter(security, refreshFilters),
    )
    .slice(0, maxSecurities);

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const items: Array<{
    securityId: string;
    symbol: string;
    exchange: string;
    currency: string;
    status: "updated" | "skipped" | "failed";
    providerId?: string;
    metadataSource?: string;
    metadataConfidence?: number;
    message: string;
  }> = [];

  for (const security of securities) {
    try {
      let applied = false;
      for (const provider of providers) {
        let result = null;
        try {
          result = await provider.fetch(security);
          if (process.env.DATABASE_URL) {
            await incrementProviderUsage({
              provider: provider.id,
              endpoint: "security-metadata",
              requestCount: providerRequestCount(provider.id),
              successCount: result ? 1 : 0,
              skippedCount: result ? 0 : 1,
              quotaLimit: providerRequestQuotaLimit(provider.id),
              metadata: {
                workerId,
                securityId: security.id,
                source: "security-metadata-worker",
              },
              now,
            });
          }
        } catch (error) {
          if (process.env.DATABASE_URL) {
            await incrementProviderUsage({
              provider: provider.id,
              endpoint: "security-metadata",
              requestCount: providerRequestCount(provider.id),
              failureCount: 1,
              quotaLimit: providerRequestQuotaLimit(provider.id),
              metadata: {
                workerId,
                securityId: security.id,
                error: error instanceof Error ? error.message : "unknown",
              },
              now,
            });
          }
          throw error;
        }
        if (!result) {
          continue;
        }
        const metadata = normalizeSecurityMetadataForWrite(result.metadata);
        if (!shouldApplySecurityMetadata(security, metadata)) {
          continue;
        }
        await repositories.securities.updateMetadata(security.id, {
          economicAssetClass: metadata.economicAssetClass,
          economicSector: metadata.economicSector,
          exposureRegion: metadata.exposureRegion,
          metadataSource: metadata.source,
          metadataConfidence: metadata.confidence,
          metadataAsOf: metadata.asOf ?? now.toISOString(),
          metadataConfirmedAt: metadata.confirmedAt,
          metadataNotes: metadata.notes,
        });
        updatedCount += 1;
        applied = true;
        items.push({
          securityId: security.id,
          symbol: security.symbol,
          exchange: security.canonicalExchange,
          currency: security.currency,
          status: "updated",
          providerId: result.providerId,
          metadataSource: metadata.source,
          metadataConfidence: metadata.confidence,
          message: "Security metadata refreshed.",
        });
        break;
      }
      if (!applied) {
        skippedCount += 1;
        items.push({
          securityId: security.id,
          symbol: security.symbol,
          exchange: security.canonicalExchange,
          currency: security.currency,
          status: "skipped",
          message: "No higher-confidence metadata was available.",
        });
      }
    } catch (error) {
      failedCount += 1;
      items.push({
        securityId: security.id,
        symbol: security.symbol,
        exchange: security.canonicalExchange,
        currency: security.currency,
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Security metadata refresh failed unexpectedly.",
      });
    }
  }

  const status =
    failedCount > 0 ? "partial" : updatedCount > 0 ? "success" : "skipped";
  if (run) {
    const db = getDb();
    await db
      .update(securityMetadataRefreshRuns)
      .set({
        status,
        sampledSecurityCount: securities.length,
        updatedCount,
        skippedCount,
        failedCount,
        providerIdsJson: providers.map((provider) => provider.id),
        statusNote:
          status === "skipped"
            ? "本次没有找到更高可信度的标的资料。"
            : status === "partial"
              ? "部分标的资料刷新失败，已保留原有资料。"
              : "标的资料刷新完成。",
        finishedAt: new Date(),
      })
      .where(eq(securityMetadataRefreshRuns.id, run.id));
  }

  return {
    runId: run?.id ?? null,
    workerId,
    startedAt: now.toISOString(),
    finishedAt: new Date().toISOString(),
    maxSecurities,
    maxAgeDays,
    force,
    symbols: refreshFilters.map((filter) =>
      [filter.symbol, filter.exchange, filter.currency].filter(Boolean).join(":"),
    ),
    sampledSecurityCount: securities.length,
    updatedCount,
    skippedCount,
    failedCount,
    providerIds: providers.map((provider) => provider.id),
    items,
  };
}
