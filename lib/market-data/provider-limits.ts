import { eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { marketDataProviderLimits } from "@/lib/db/schema";

export type MarketDataProviderId =
  | "twelve-data"
  | "yahoo-finance"
  | "openfigi"
  | "alpha-vantage";

export interface ProviderLimitStatus {
  provider: MarketDataProviderId;
  limited: boolean;
  reason: string | null;
  retryAfterSeconds: number | null;
  limitedUntil: string | null;
  recordedAt: string | null;
}

type ProviderLimitEntry = {
  reason: string;
  limitedUntil: number;
  recordedAt: number;
};

type ProviderLimitStore = Map<MarketDataProviderId, ProviderLimitEntry>;

const PROVIDERS: MarketDataProviderId[] = [
  "twelve-data",
  "yahoo-finance",
  "openfigi",
  "alpha-vantage",
];
const HYDRATE_INTERVAL_MS = 15_000;
let lastHydratedAt = 0;

declare global {
  // eslint-disable-next-line no-var
  var __portfolioMarketDataProviderLimits__: ProviderLimitStore | undefined;
}

function getStore(): ProviderLimitStore {
  if (!globalThis.__portfolioMarketDataProviderLimits__) {
    globalThis.__portfolioMarketDataProviderLimits__ = new Map();
  }
  return globalThis.__portfolioMarketDataProviderLimits__;
}

function readDefaultRetryAfterSeconds() {
  const value = Number(process.env.MARKET_DATA_PROVIDER_RETRY_AFTER_SECONDS);
  return Number.isFinite(value) && value > 0 ? value : 900;
}

function toStatus(provider: MarketDataProviderId, entry: ProviderLimitEntry) {
  const now = Date.now();
  return {
    provider,
    limited: true,
    reason: entry.reason,
    retryAfterSeconds: Math.max(
      Math.ceil((entry.limitedUntil - now) / 1000),
      1,
    ),
    limitedUntil: new Date(entry.limitedUntil).toISOString(),
    recordedAt: new Date(entry.recordedAt).toISOString(),
  };
}

async function persistProviderLimit(input: {
  provider: MarketDataProviderId;
  reason: string;
  limitedUntil: Date;
  recordedAt: Date;
}) {
  try {
    await getDb()
      .insert(marketDataProviderLimits)
      .values({
        provider: input.provider,
        reason: input.reason,
        limitedUntil: input.limitedUntil,
        recordedAt: input.recordedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: marketDataProviderLimits.provider,
        set: {
          reason: input.reason,
          limitedUntil: input.limitedUntil,
          recordedAt: input.recordedAt,
          updatedAt: new Date(),
        },
      });
  } catch {
    // Provider-limit persistence is observability/coordination. It must not
    // make quote refresh fail if the database is temporarily unavailable.
  }
}

async function hydrateProviderLimitsFromDatabase(input?: {
  force?: boolean;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  const nowMs = now.getTime();
  if (!input?.force && nowMs - lastHydratedAt < HYDRATE_INTERVAL_MS) {
    return;
  }

  try {
    const rows = await getDb().query.marketDataProviderLimits.findMany({
      where: gt(marketDataProviderLimits.limitedUntil, now),
    });
    const store = getStore();
    for (const row of rows) {
      const provider = row.provider as MarketDataProviderId;
      if (!PROVIDERS.includes(provider)) {
        continue;
      }
      const limitedUntil = row.limitedUntil.getTime();
      const recordedAt = row.recordedAt.getTime();
      const existing = store.get(provider);
      if (!existing || existing.recordedAt <= recordedAt) {
        store.set(provider, {
          reason: row.reason,
          limitedUntil,
          recordedAt,
        });
      }
    }
    lastHydratedAt = nowMs;
  } catch {
    // Fall back to the process-local cache; provider calls can still proceed.
  }
}

export function readRetryAfterSeconds(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (!raw) {
    return null;
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.ceil(numeric);
  }

  const date = Date.parse(raw);
  if (Number.isFinite(date)) {
    return Math.max(Math.ceil((date - Date.now()) / 1000), 1);
  }

  return null;
}

export function markProviderLimited(input: {
  provider: MarketDataProviderId;
  reason: string;
  retryAfterSeconds?: number | null;
  now?: Date;
}) {
  const nowMs = input.now?.getTime() ?? Date.now();
  const retryAfterSeconds =
    input.retryAfterSeconds && input.retryAfterSeconds > 0
      ? input.retryAfterSeconds
      : readDefaultRetryAfterSeconds();
  getStore().set(input.provider, {
    reason: input.reason,
    recordedAt: nowMs,
    limitedUntil: nowMs + retryAfterSeconds * 1000,
  });
  void persistProviderLimit({
    provider: input.provider,
    reason: input.reason,
    recordedAt: new Date(nowMs),
    limitedUntil: new Date(nowMs + retryAfterSeconds * 1000),
  });
}

export async function isProviderLimited(provider: MarketDataProviderId) {
  await hydrateProviderLimitsFromDatabase();
  const entry = getStore().get(provider);
  if (!entry) {
    return false;
  }

  if (Date.now() > entry.limitedUntil) {
    getStore().delete(provider);
    return false;
  }

  return true;
}

export function getProviderLimitSnapshot(): ProviderLimitStatus[] {
  const now = Date.now();
  return PROVIDERS.map((provider) => {
    const entry = getStore().get(provider);
    if (!entry || now > entry.limitedUntil) {
      if (entry) {
        getStore().delete(provider);
      }
      return {
        provider,
        limited: false,
        reason: null,
        retryAfterSeconds: null,
        limitedUntil: null,
        recordedAt: null,
      };
    }

    return toStatus(provider, entry);
  });
}

export async function getProviderLimitSnapshotPersisted(): Promise<
  ProviderLimitStatus[]
> {
  await hydrateProviderLimitsFromDatabase({ force: true });
  return getProviderLimitSnapshot();
}

export async function clearProviderLimit(provider: MarketDataProviderId) {
  getStore().delete(provider);
  try {
    await getDb()
      .delete(marketDataProviderLimits)
      .where(eq(marketDataProviderLimits.provider, provider));
  } catch {
    // Best-effort cleanup only.
  }
}
