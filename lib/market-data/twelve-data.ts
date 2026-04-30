import { getMarketDataConfig } from "@/lib/market-data/config";
import {
  markProviderLimited,
  readRetryAfterSeconds,
} from "@/lib/market-data/provider-limits";
import type {
  SecurityHistoricalPoint,
  SecurityQuote,
  SecuritySearchResult,
  SupportedAssetType,
} from "@/lib/market-data/types";

interface TwelveDataSymbolResult {
  symbol?: string;
  instrument_name?: string;
  exchange?: string;
  mic_code?: string;
  country?: string;
  currency?: string;
  instrument_type?: string;
}

interface TwelveDataSearchResponse {
  data?: TwelveDataSymbolResult[];
  status?: string;
  message?: string;
}

interface TwelveDataPriceResponse {
  price?: string;
  currency?: string;
  exchange?: string;
  code?: number;
  message?: string;
}

interface TwelveDataTimeSeriesValue {
  datetime?: string;
  close?: string;
}

interface TwelveDataTimeSeriesResponse {
  values?: TwelveDataTimeSeriesValue[];
  meta?: {
    symbol?: string;
    currency?: string;
    exchange?: string;
  };
  status?: string;
  message?: string;
}

function mapInstrumentType(value?: string): SupportedAssetType {
  switch ((value ?? "").toLowerCase()) {
    case "common stock":
    case "stock":
      return "Common Stock";
    case "etf":
      return "ETF";
    case "commodity etf":
    case "commodity":
      return "Commodity ETF";
    case "mutual fund":
      return "Mutual Fund";
    case "adr":
      return "ADR";
    case "reit":
      return "REIT";
    case "trust":
    case "unit trust":
      return "Trust";
    case "preferred stock":
    case "preferred share":
      return "Preferred Share";
    case "index":
      return "Index";
    case "cryptocurrency":
    case "crypto":
      return "Crypto";
    case "forex":
      return "Forex";
    default:
      return "Unknown";
  }
}

export async function searchSecuritiesWithTwelveData(
  query: string,
): Promise<SecuritySearchResult[]> {
  const { twelveDataApiKey } = getMarketDataConfig();
  if (!twelveDataApiKey) {
    return [];
  }

  const url = new URL("https://api.twelvedata.com/symbol_search");
  url.searchParams.set("symbol", query);
  url.searchParams.set("apikey", twelveDataApiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 429) {
    const message = "Twelve Data search rate limit reached.";
    markProviderLimited({
      provider: "twelve-data",
      reason: message,
      retryAfterSeconds: readRetryAfterSeconds(response.headers),
    });
    throw new Error(message);
  }
  if (!response.ok) {
    throw new Error(
      `Twelve Data search failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as TwelveDataSearchResponse;
  const items = payload.data ?? [];

  return items
    .filter((item) => item.symbol && item.instrument_name)
    .slice(0, 10)
    .map((item) => ({
      symbol: item.symbol!,
      name: item.instrument_name!,
      exchange: item.exchange ?? null,
      micCode: item.mic_code ?? null,
      country: item.country ?? null,
      currency: item.currency ?? null,
      type: mapInstrumentType(item.instrument_type),
      provider: "twelve-data",
    }));
}

function getCandidateExchanges(
  exchange?: string | null,
  currency?: string | null,
) {
  const normalizedExchange = exchange?.trim();
  if (normalizedExchange) {
    return [normalizedExchange];
  }

  switch (currency?.trim().toUpperCase()) {
    case "CAD":
      return ["TSX", null];
    case "USD":
      return [null];
    default:
      return [null];
  }
}

async function fetchTwelveDataQuote(
  symbol: string,
  exchange?: string | null,
): Promise<SecurityQuote | null> {
  const { twelveDataApiKey } = getMarketDataConfig();
  if (!twelveDataApiKey) {
    return null;
  }

  const url = new URL("https://api.twelvedata.com/price");
  url.searchParams.set("symbol", symbol);
  if (exchange?.trim()) {
    url.searchParams.set("exchange", exchange.trim());
  }
  url.searchParams.set("apikey", twelveDataApiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 429) {
    const message = "Twelve Data quote rate limit reached.";
    markProviderLimited({
      provider: "twelve-data",
      reason: message,
      retryAfterSeconds: readRetryAfterSeconds(response.headers),
    });
    throw new Error(message);
  }
  if (!response.ok) {
    throw new Error(`Twelve Data quote failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as TwelveDataPriceResponse;
  if (payload.code === 429) {
    const message = payload.message || "Twelve Data quote rate limit reached.";
    markProviderLimited({
      provider: "twelve-data",
      reason: message,
      retryAfterSeconds: readRetryAfterSeconds(response.headers),
    });
    throw new Error(message);
  }

  const price = Number(payload.price);

  if (!Number.isFinite(price)) {
    return null;
  }

  return {
    symbol,
    exchange: payload.exchange ?? exchange ?? null,
    price,
    currency: payload.currency ?? null,
    timestamp: new Date().toISOString(),
    provider: "twelve-data",
    delayed: true,
  };
}

export async function getQuoteFromTwelveData(
  symbol: string,
  exchange?: string | null,
  currency?: string | null,
): Promise<SecurityQuote | null> {
  const expectedCurrency = currency?.trim().toUpperCase() || null;

  for (const candidateExchange of getCandidateExchanges(
    exchange,
    expectedCurrency,
  )) {
    const quote = await fetchTwelveDataQuote(symbol, candidateExchange);
    if (!quote) {
      continue;
    }

    const quoteCurrency = quote.currency?.trim().toUpperCase() || null;
    if (
      expectedCurrency &&
      quoteCurrency &&
      quoteCurrency !== expectedCurrency
    ) {
      continue;
    }

    return {
      ...quote,
      currency: quoteCurrency ?? expectedCurrency,
      exchange: exchange?.trim() || quote.exchange || candidateExchange,
    };
  }

  return null;
}

export async function getHistoricalSeriesFromTwelveData(
  symbol: string,
  exchange?: string | null,
): Promise<SecurityHistoricalPoint[]> {
  const { twelveDataApiKey } = getMarketDataConfig();
  if (!twelveDataApiKey) {
    return [];
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "1day");
  url.searchParams.set("outputsize", "365");
  url.searchParams.set("orderby", "ASC");
  if (exchange?.trim()) {
    url.searchParams.set("exchange", exchange.trim());
  }
  url.searchParams.set("apikey", twelveDataApiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 429) {
    const message = "Twelve Data time series rate limit reached.";
    markProviderLimited({
      provider: "twelve-data",
      reason: message,
      retryAfterSeconds: readRetryAfterSeconds(response.headers),
    });
    throw new Error(message);
  }
  if (!response.ok) {
    throw new Error(
      `Twelve Data time series failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as TwelveDataTimeSeriesResponse;
  const values = payload.values ?? [];

  return values
    .map<SecurityHistoricalPoint | null>((value) => {
      const close = Number(value.close);
      const date = value.datetime?.slice(0, 10) ?? "";
      if (!date || !Number.isFinite(close)) {
        return null;
      }

      return {
        symbol: symbol.trim().toUpperCase(),
        date,
        close,
        adjustedClose: null,
        currency: payload.meta?.currency ?? null,
        exchange: payload.meta?.exchange ?? exchange ?? null,
        provider: "twelve-data" as const,
      };
    })
    .filter((value): value is SecurityHistoricalPoint => value !== null);
}
