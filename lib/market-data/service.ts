import { getProviderHealth } from "@/lib/market-data/config";
import { getOrSetCached } from "@/lib/market-data/cache";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { resolveSecurityWithOpenFigi } from "@/lib/market-data/openfigi";
import { getQuoteFromTwelveData, searchSecuritiesWithTwelveData } from "@/lib/market-data/twelve-data";
import type { SecurityQuote, SecurityResolution, SecuritySearchResult } from "@/lib/market-data/types";

export async function searchSecurities(query: string): Promise<{ results: SecuritySearchResult[]; providerHealth: ReturnType<typeof getProviderHealth> }> {
  const trimmed = query.trim();
  if (trimmed.length < 1) {
    return { results: [], providerHealth: getProviderHealth() };
  }

  const { searchCacheTtlSeconds } = getMarketDataConfig();
  const results = await getOrSetCached(`market-data:search:${trimmed.toLowerCase()}`, {
    ttlMs: searchCacheTtlSeconds * 1000,
    staleOnErrorMs: searchCacheTtlSeconds * 1000
  }, async () => searchSecuritiesWithTwelveData(trimmed));

  return { results, providerHealth: getProviderHealth() };
}

export async function resolveSecurity(symbol: string): Promise<{ result: SecurityResolution; providerHealth: ReturnType<typeof getProviderHealth> }> {
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) {
    throw new Error("Security symbol is required.");
  }

  const { resolveCacheTtlSeconds } = getMarketDataConfig();
  const openFigiResult = await getOrSetCached(`market-data:resolve:${trimmed}`, {
    ttlMs: resolveCacheTtlSeconds * 1000,
    staleOnErrorMs: resolveCacheTtlSeconds * 1000
  }, async () => resolveSecurityWithOpenFigi(trimmed));

  if (openFigiResult) {
    return { result: openFigiResult, providerHealth: getProviderHealth() };
  }

  return {
    result: {
      symbol: trimmed,
      name: trimmed,
      exchange: null,
      micCode: null,
      compositeFigi: null,
      shareClassFigi: null,
      securityType: null,
      marketSector: null,
      provider: "fallback"
    },
    providerHealth: getProviderHealth()
  };
}

export async function getSecurityQuote(symbol: string): Promise<{ result: SecurityQuote; providerHealth: ReturnType<typeof getProviderHealth> }> {
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) {
    throw new Error("Security symbol is required.");
  }

  const { quoteCacheTtlSeconds } = getMarketDataConfig();
  const quote = await getOrSetCached(`market-data:quote:${trimmed}`, {
    ttlMs: quoteCacheTtlSeconds * 1000,
    staleOnErrorMs: quoteCacheTtlSeconds * 1000
  }, async () => getQuoteFromTwelveData(trimmed));

  if (quote) {
    return { result: quote, providerHealth: getProviderHealth() };
  }

  return {
    result: {
      symbol: trimmed,
      price: 0,
      currency: null,
      timestamp: new Date().toISOString(),
      provider: "fallback",
      delayed: true
    },
    providerHealth: getProviderHealth()
  };
}

export async function getBatchSecurityQuotes(symbols: string[]): Promise<{ results: SecurityQuote[]; providerHealth: ReturnType<typeof getProviderHealth> }> {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
  const results = await Promise.all(uniqueSymbols.map(async (symbol) => {
    const quote = await getSecurityQuote(symbol);
    return quote.result;
  }));

  return {
    results,
    providerHealth: getProviderHealth()
  };
}
