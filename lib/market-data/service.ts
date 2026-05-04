import { getProviderHealth } from "@/lib/market-data/config";
import { getOrSetCached } from "@/lib/market-data/cache";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { getHistoricalSeriesFromAlphaVantage } from "@/lib/market-data/alpha-vantage";
import { isProviderLimited } from "@/lib/market-data/provider-limits";
import { resolveSecurityWithOpenFigi } from "@/lib/market-data/openfigi";
import {
  getHistoricalSeriesFromTwelveData,
  getQuoteFromTwelveData,
  searchSecuritiesWithTwelveData,
} from "@/lib/market-data/twelve-data";
import {
  getHistoricalSeriesFromYahooFinance,
  getQuoteFromYahooFinance,
} from "@/lib/market-data/yahoo-finance";
import type {
  SecurityHistoricalPoint,
  SecurityQuote,
  SecurityResolution,
  SecuritySearchResult,
} from "@/lib/market-data/types";

type SecurityQuoteOptions = {
  exchange?: string | null;
  currency?: string | null;
};

function isCanadianQuoteRequest(
  exchange?: string | null,
  currency?: string | null,
) {
  const normalizedCurrency = currency?.trim().toUpperCase() || null;
  const normalizedExchange = exchange?.trim().toUpperCase() || null;
  return (
    normalizedCurrency === "CAD" ||
    normalizedExchange === "TSX" ||
    normalizedExchange === "TSXV" ||
    normalizedExchange === "NEO" ||
    normalizedExchange === "CBOE" ||
    normalizedExchange === "CBOE CANADA" ||
    Boolean(normalizedExchange?.startsWith("NEO-"))
  );
}

async function getRoutedQuote(
  symbol: string,
  exchange?: string | null,
  currency?: string | null,
) {
  if (exchange?.trim().toUpperCase() === "OTHER / MANUAL") {
    return null;
  }

  if (isCanadianQuoteRequest(exchange, currency)) {
    const yahooQuote = (await isProviderLimited("yahoo-finance"))
      ? null
      : await getQuoteFromYahooFinance(symbol, exchange, currency).catch(
          (error) => {
            const message =
              error instanceof Error ? error.message.toLowerCase() : "";
            if (message.includes("rate limit")) {
              throw error;
            }
            return null;
          },
        );
    if (yahooQuote) {
      return yahooQuote;
    }
  }

  const twelveQuote = (await isProviderLimited("twelve-data"))
    ? null
    : await getQuoteFromTwelveData(symbol, exchange, currency);
  if (twelveQuote) {
    return twelveQuote;
  }

  if (
    !isCanadianQuoteRequest(exchange, currency) &&
    !(await isProviderLimited("yahoo-finance"))
  ) {
    return getQuoteFromYahooFinance(symbol, exchange, currency).catch(
      () => null,
    );
  }

  return null;
}

function hasDenseHistory(points: SecurityHistoricalPoint[]) {
  if (points.length < 30) {
    return false;
  }

  const sorted = [...points].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  if (!latest || !previous) {
    return false;
  }

  const dayGap =
    (new Date(latest.date).getTime() - new Date(previous.date).getTime()) /
    (1000 * 60 * 60 * 24);
  return dayGap <= 7;
}

export async function searchSecurities(
  query: string,
): Promise<{
  results: SecuritySearchResult[];
  providerHealth: ReturnType<typeof getProviderHealth>;
}> {
  const trimmed = query.trim();
  if (trimmed.length < 1) {
    return { results: [], providerHealth: getProviderHealth() };
  }

  const { searchCacheTtlSeconds } = getMarketDataConfig();
  const results = await getOrSetCached(
    `market-data:search:${trimmed.toLowerCase()}`,
    {
      ttlMs: searchCacheTtlSeconds * 1000,
      staleOnErrorMs: searchCacheTtlSeconds * 1000,
    },
    async () => searchSecuritiesWithTwelveData(trimmed),
  );

  return { results, providerHealth: getProviderHealth() };
}

export async function resolveSecurity(
  symbol: string,
  options?: SecurityQuoteOptions,
): Promise<{
  result: SecurityResolution;
  providerHealth: ReturnType<typeof getProviderHealth>;
}> {
  const trimmed = symbol.trim().toUpperCase();
  const normalizedExchange = options?.exchange?.trim().toUpperCase() || null;
  const normalizedCurrency = options?.currency?.trim().toUpperCase() || null;
  if (!trimmed) {
    throw new Error("Security symbol is required.");
  }

  const { resolveCacheTtlSeconds } = getMarketDataConfig();
  const openFigiResult = await getOrSetCached(
    [
      "market-data:resolve",
      trimmed,
      normalizedExchange ?? "any-exchange",
      normalizedCurrency ?? "any-currency",
    ].join(":"),
    {
      ttlMs: resolveCacheTtlSeconds * 1000,
      staleOnErrorMs: resolveCacheTtlSeconds * 1000,
    },
    async () =>
      resolveSecurityWithOpenFigi(trimmed, {
        exchange: normalizedExchange,
        currency: normalizedCurrency,
      }),
  );

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
      provider: "fallback",
    },
    providerHealth: getProviderHealth(),
  };
}

export async function getSecurityQuote(
  symbol: string,
  options?: SecurityQuoteOptions,
): Promise<{
  result: SecurityQuote;
  providerHealth: ReturnType<typeof getProviderHealth>;
}> {
  const trimmed = symbol.trim().toUpperCase();
  const normalizedExchange = options?.exchange?.trim() || null;
  const normalizedCurrency = options?.currency?.trim().toUpperCase() || null;
  if (!trimmed) {
    throw new Error("Security symbol is required.");
  }

  const { quoteCacheTtlSeconds } = getMarketDataConfig();
  const cacheKey = [
    "market-data:quote:v4",
    trimmed,
    normalizedExchange?.toLowerCase() ?? "no-exchange",
    normalizedCurrency?.toLowerCase() ?? "no-currency",
  ].join(":");
  const quote = await getOrSetCached(
    cacheKey,
    {
      ttlMs: quoteCacheTtlSeconds * 1000,
      staleOnErrorMs: quoteCacheTtlSeconds * 1000,
    },
    async () => getRoutedQuote(trimmed, normalizedExchange, normalizedCurrency),
  );

  if (quote) {
    return { result: quote, providerHealth: getProviderHealth() };
  }

  return {
    result: {
      symbol: trimmed,
      exchange: normalizedExchange,
      price: 0,
      currency: null,
      timestamp: new Date().toISOString(),
      provider: "fallback",
      delayed: true,
    },
    providerHealth: getProviderHealth(),
  };
}

export async function getBatchSecurityQuotes(
  symbols: Array<
    | string
    | { symbol: string; exchange?: string | null; currency?: string | null }
  >,
): Promise<{
  results: SecurityQuote[];
  providerHealth: ReturnType<typeof getProviderHealth>;
}> {
  const uniqueSymbols = [
    ...new Map(
      symbols
        .map((entry) =>
          typeof entry === "string"
            ? {
                symbol: entry.trim().toUpperCase(),
                exchange: null as string | null,
                currency: null as string | null,
              }
            : {
                symbol: entry.symbol.trim().toUpperCase(),
                exchange: entry.exchange?.trim() || null,
                currency: entry.currency?.trim().toUpperCase() || null,
              },
        )
        .filter((entry) => entry.symbol)
        .map((entry) => [
          `${entry.symbol}::${entry.exchange ?? ""}::${entry.currency ?? ""}`,
          entry,
        ]),
    ).values(),
  ];
  const results: SecurityQuote[] = [];
  let rateLimited = false;
  for (const entry of uniqueSymbols) {
    const fallbackQuote: SecurityQuote = {
      symbol: entry.symbol,
      exchange: entry.exchange,
      price: 0,
      currency: entry.currency,
      timestamp: new Date().toISOString(),
      provider: "fallback" as const,
      delayed: true,
    };

    if (rateLimited) {
      results.push(fallbackQuote);
      continue;
    }

    try {
      if (
        (await isProviderLimited("twelve-data")) &&
        (await isProviderLimited("yahoo-finance"))
      ) {
        rateLimited = true;
        results.push(fallbackQuote);
        continue;
      }

      const quote = await getSecurityQuote(entry.symbol, {
        exchange: entry.exchange,
        currency: entry.currency,
      });
      results.push(quote.result);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (
        message.includes("twelve data") ||
        message.includes("api credits") ||
        message.includes("rate limit")
      ) {
        rateLimited = true;
      }
      results.push(fallbackQuote);
    }
  }

  return {
    results,
    providerHealth: getProviderHealth(),
  };
}

export async function getSecurityHistoricalSeries(
  symbol: string,
  options?: SecurityQuoteOptions,
): Promise<{
  results: SecurityHistoricalPoint[];
  providerHealth: ReturnType<typeof getProviderHealth>;
}> {
  const trimmed = symbol.trim().toUpperCase();
  const normalizedExchange = options?.exchange?.trim() || null;
  const normalizedCurrency = options?.currency?.trim().toUpperCase() || null;
  if (!trimmed) {
    throw new Error("Security symbol is required.");
  }

  const { quoteCacheTtlSeconds } = getMarketDataConfig();
  const cacheKey = [
    "market-data:history:v3",
    trimmed,
    normalizedExchange?.toLowerCase() ?? "no-exchange",
    normalizedCurrency?.toLowerCase() ?? "no-currency",
  ].join(":");
  const results = await getOrSetCached(
    cacheKey,
    {
      ttlMs: quoteCacheTtlSeconds * 1000,
      staleOnErrorMs: 60 * 1000,
    },
    async () => {
      if (
        isCanadianQuoteRequest(normalizedExchange, normalizedCurrency) &&
        !(await isProviderLimited("yahoo-finance"))
      ) {
        const yahooResults = await getHistoricalSeriesFromYahooFinance(
          trimmed,
          normalizedExchange,
          normalizedCurrency,
        ).catch((error) => {
          const message =
            error instanceof Error ? error.message.toLowerCase() : "";
          if (message.includes("rate limit")) {
            throw error;
          }
          return [];
        });
        if (hasDenseHistory(yahooResults)) {
          return yahooResults;
        }
      }

      const twelveResults = await getHistoricalSeriesFromTwelveData(
        trimmed,
        normalizedExchange,
      ).catch(() => []);
      if (hasDenseHistory(twelveResults)) {
        return twelveResults;
      }

      if (
        !isCanadianQuoteRequest(normalizedExchange, normalizedCurrency) &&
        !(await isProviderLimited("yahoo-finance"))
      ) {
        const yahooResults = await getHistoricalSeriesFromYahooFinance(
          trimmed,
          normalizedExchange,
          normalizedCurrency,
        ).catch(() => []);
        if (hasDenseHistory(yahooResults)) {
          return yahooResults;
        }
      }

      const alphaResults = await getHistoricalSeriesFromAlphaVantage(
        trimmed,
        normalizedExchange,
        normalizedCurrency,
      );
      if (alphaResults.length >= 2) {
        return alphaResults;
      }

      return twelveResults;
    },
  );

  return {
    results: results ?? [],
    providerHealth: getProviderHealth(),
  };
}
