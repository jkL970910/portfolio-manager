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
}

export function isProviderLimited(provider: MarketDataProviderId) {
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
  });
}
