import type { ProviderHealth } from "@/lib/market-data/types";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readIntEnv(name: string, fallback: number): number {
  const value = readEnv(name);
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getMarketDataConfig() {
  return {
    openFigiApiKey: readEnv("OPENFIGI_API_KEY"),
    twelveDataApiKey: readEnv("TWELVE_DATA_API_KEY"),
    alphaVantageApiKey: readEnv("ALPHA_VANTAGE_API_KEY"),
    searchCacheTtlSeconds: readIntEnv("MARKET_DATA_SEARCH_CACHE_TTL_SECONDS", 21600),
    resolveCacheTtlSeconds: readIntEnv("MARKET_DATA_RESOLVE_CACHE_TTL_SECONDS", 604800),
    quoteCacheTtlSeconds: readIntEnv("MARKET_DATA_QUOTE_CACHE_TTL_SECONDS", 1800),
    fxCacheTtlSeconds: readIntEnv("MARKET_DATA_FX_CACHE_TTL_SECONDS", 43200)
  };
}

export function getProviderHealth(): ProviderHealth {
  const config = getMarketDataConfig();

  return {
    openFigiConfigured: Boolean(config.openFigiApiKey),
    twelveDataConfigured: Boolean(config.twelveDataApiKey)
  };
}
