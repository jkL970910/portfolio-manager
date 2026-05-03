import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { providerUsageLedger } from "@/lib/db/schema";

export interface ProviderUsageIncrement {
  provider: string;
  endpoint: string;
  requestCount?: number;
  successCount?: number;
  failureCount?: number;
  skippedCount?: number;
  estimatedCostMicros?: number;
  quotaLimit?: number | null;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export function getProviderUsageDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export async function incrementProviderUsage(input: ProviderUsageIncrement) {
  const db = getDb();
  const usageDate = getProviderUsageDate(input.now);
  const requestCount = input.requestCount ?? 0;
  const successCount = input.successCount ?? 0;
  const failureCount = input.failureCount ?? 0;
  const skippedCount = input.skippedCount ?? 0;
  const estimatedCostMicros = input.estimatedCostMicros ?? 0;
  const metadata = input.metadata ?? {};
  const updatedAt = input.now ?? new Date();

  await db
    .insert(providerUsageLedger)
    .values({
      provider: input.provider,
      endpoint: input.endpoint,
      usageDate,
      requestCount,
      successCount,
      failureCount,
      skippedCount,
      estimatedCostMicros,
      quotaLimit: input.quotaLimit ?? null,
      metadataJson: metadata,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [
        providerUsageLedger.provider,
        providerUsageLedger.endpoint,
        providerUsageLedger.usageDate,
      ],
      set: {
        requestCount: sql`${providerUsageLedger.requestCount} + ${requestCount}`,
        successCount: sql`${providerUsageLedger.successCount} + ${successCount}`,
        failureCount: sql`${providerUsageLedger.failureCount} + ${failureCount}`,
        skippedCount: sql`${providerUsageLedger.skippedCount} + ${skippedCount}`,
        estimatedCostMicros: sql`${providerUsageLedger.estimatedCostMicros} + ${estimatedCostMicros}`,
        quotaLimit: input.quotaLimit ?? null,
        metadataJson: metadata,
        updatedAt,
      },
    });
}

export async function listRecentProviderUsage(provider?: string, limit = 10) {
  const db = getDb();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const baseQuery = db
    .select()
    .from(providerUsageLedger)
    .orderBy(
      desc(providerUsageLedger.usageDate),
      desc(providerUsageLedger.updatedAt),
    )
    .limit(safeLimit);

  if (!provider) {
    return baseQuery;
  }

  return db
    .select()
    .from(providerUsageLedger)
    .where(eq(providerUsageLedger.provider, provider))
    .orderBy(
      desc(providerUsageLedger.usageDate),
      desc(providerUsageLedger.updatedAt),
    )
    .limit(safeLimit);
}

export async function getProviderUsageForDate(
  provider: string,
  endpoint: string,
  date = getProviderUsageDate(),
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(providerUsageLedger)
    .where(
      and(
        eq(providerUsageLedger.provider, provider),
        eq(providerUsageLedger.endpoint, endpoint),
        eq(providerUsageLedger.usageDate, date),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
