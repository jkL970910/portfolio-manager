import { getRepositories } from "@/lib/backend/repositories/factory";
import {
  getEnabledSecurityMetadataProviders,
  shouldApplySecurityMetadata,
} from "@/lib/backend/security-metadata-providers";
import {
  normalizeSecurityMetadataForWrite,
} from "@/lib/backend/security-economic-exposure";

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

export async function runSecurityMetadataRefreshWorkerOnce(input?: {
  workerId?: string;
  maxSecurities?: number;
  maxAgeDays?: number;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  const workerId = input?.workerId ?? `security-metadata-worker-${process.pid}`;
  const maxSecurities = normalizePositiveInteger(input?.maxSecurities, 100);
  const maxAgeDays = normalizePositiveInteger(input?.maxAgeDays, 30);
  const repositories = getRepositories();
  const providers = getEnabledSecurityMetadataProviders();
  const securities = await repositories.securities.listNeedingMetadataRefresh({
    limit: maxSecurities,
    staleBefore: readMetadataStaleBefore(now, maxAgeDays),
  });

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
        const result = await provider.fetch(security);
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

  return {
    workerId,
    startedAt: now.toISOString(),
    finishedAt: new Date().toISOString(),
    maxSecurities,
    maxAgeDays,
    sampledSecurityCount: securities.length,
    updatedCount,
    skippedCount,
    failedCount,
    providerIds: providers.map((provider) => provider.id),
    items,
  };
}
