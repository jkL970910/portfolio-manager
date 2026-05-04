import { getMarketDataConfig } from "@/lib/market-data/config";
import {
  markProviderLimited,
  readRetryAfterSeconds,
} from "@/lib/market-data/provider-limits";
import type { SecurityHistoricalPoint } from "@/lib/market-data/types";

interface AlphaVantageMonthlyValue {
  ["4. close"]?: string;
  ["5. adjusted close"]?: string;
}

interface AlphaVantageDailyValue {
  ["4. close"]?: string;
  ["5. adjusted close"]?: string;
}

interface AlphaVantageMonthlyResponse {
  ["Meta Data"]?: {
    ["2. Symbol"]?: string;
  };
  ["Monthly Adjusted Time Series"]?: Record<string, AlphaVantageMonthlyValue>;
  ["Error Message"]?: string;
  Note?: string;
  Information?: string;
}

interface AlphaVantageDailyResponse {
  ["Meta Data"]?: {
    ["2. Symbol"]?: string;
  };
  ["Time Series (Daily)"]?: Record<string, AlphaVantageDailyValue>;
  ["Error Message"]?: string;
  Note?: string;
  Information?: string;
}

export interface AlphaVantageProfilePayload {
  candidateSymbol: string;
  kind: "company-overview" | "etf-profile";
  payload: Record<string, unknown>;
}

export function getAlphaVantageCandidateSymbols(
  symbol: string,
  exchange?: string | null,
  currency?: string | null,
) {
  const trimmed = symbol.trim().toUpperCase();
  const exchangeUpper = exchange?.trim().toUpperCase() ?? "";
  const currencyUpper = currency?.trim().toUpperCase() ?? "";

  if (exchangeUpper.includes("TSX") || exchangeUpper.includes("CBOE CANADA")) {
    return [`${trimmed}.TO`, `${trimmed}.TRT`, trimmed];
  }

  if (currencyUpper === "CAD") {
    return [`${trimmed}.TO`, `${trimmed}.TRT`, trimmed];
  }

  if (currencyUpper === "USD") {
    return [trimmed, `${trimmed}.TO`, `${trimmed}.TRT`];
  }

  return [trimmed, `${trimmed}.TO`, `${trimmed}.TRT`];
}

function isAlphaVantageLimitPayload(payload: Record<string, unknown>) {
  const message = String(
    payload.Note ?? payload.Information ?? payload["Error Message"] ?? "",
  ).toLowerCase();
  return (
    message.includes("api call frequency") ||
    message.includes("rate limit") ||
    message.includes("standard api") ||
    message.includes("premium endpoint")
  );
}

async function fetchAlphaVantagePayload(input: {
  fn: string;
  symbol: string;
  apiKey: string;
}) {
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", input.fn);
  url.searchParams.set("symbol", input.symbol);
  url.searchParams.set("apikey", input.apiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 429 || response.status === 503) {
      markProviderLimited({
        provider: "alpha-vantage",
        reason: `Alpha Vantage returned HTTP ${response.status}.`,
        retryAfterSeconds: readRetryAfterSeconds(response.headers),
      });
    }
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  if (isAlphaVantageLimitPayload(payload)) {
    markProviderLimited({
      provider: "alpha-vantage",
      reason: "Alpha Vantage rate limit or endpoint limit reached.",
      retryAfterSeconds: readRetryAfterSeconds(response.headers),
    });
    return null;
  }
  if (payload["Error Message"]) {
    return null;
  }

  return payload;
}

function hasCompanyOverview(payload: Record<string, unknown>) {
  return Boolean(payload.Symbol || payload.Name || payload.AssetType);
}

function hasEtfProfile(payload: Record<string, unknown>) {
  return Boolean(
    payload.net_assets ||
      payload.net_expense_ratio ||
      payload.portfolio_turnover ||
      payload.asset_allocation ||
      payload.sectors ||
      payload.holdings,
  );
}

export async function getAlphaVantageProfile(
  symbol: string,
  exchange?: string | null,
  currency?: string | null,
  input?: {
    preferredKind?: "company-overview" | "etf-profile";
  },
): Promise<AlphaVantageProfilePayload | null> {
  const { alphaVantageApiKey } = getMarketDataConfig();
  if (!alphaVantageApiKey) {
    return null;
  }

  const order =
    input?.preferredKind === "company-overview"
      ? (["OVERVIEW", "ETF_PROFILE"] as const)
      : (["ETF_PROFILE", "OVERVIEW"] as const);

  for (const candidateSymbol of getAlphaVantageCandidateSymbols(
    symbol,
    exchange,
    currency,
  )) {
    for (const fn of order) {
      const payload = await fetchAlphaVantagePayload({
        fn,
        symbol: candidateSymbol,
        apiKey: alphaVantageApiKey,
      });
      if (fn === "ETF_PROFILE" && payload && hasEtfProfile(payload)) {
        return {
          candidateSymbol,
          kind: "etf-profile",
          payload,
        };
      }
      if (fn === "OVERVIEW" && payload && hasCompanyOverview(payload)) {
        return {
          candidateSymbol,
          kind: "company-overview",
          payload,
        };
      }
    }
  }

  return null;
}

export async function getHistoricalSeriesFromAlphaVantage(symbol: string, exchange?: string | null, currency?: string | null): Promise<SecurityHistoricalPoint[]> {
  const { alphaVantageApiKey } = getMarketDataConfig();
  if (!alphaVantageApiKey) {
    return [];
  }

  for (const candidateSymbol of getAlphaVantageCandidateSymbols(symbol, exchange, currency)) {
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "TIME_SERIES_DAILY_ADJUSTED");
    url.searchParams.set("symbol", candidateSymbol);
    url.searchParams.set("outputsize", "full");
    url.searchParams.set("apikey", alphaVantageApiKey);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as AlphaVantageDailyResponse;
    const series = payload["Time Series (Daily)"];
    if (!series || Object.keys(series).length === 0) {
      continue;
    }

    return Object.entries(series)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, value]) => {
        const close = Number(value["4. close"]);
        const adjustedClose = Number(value["5. adjusted close"]);
        return {
          symbol: symbol.trim().toUpperCase(),
          date,
          close,
          adjustedClose: Number.isFinite(adjustedClose) ? adjustedClose : null,
          currency: "CAD",
          exchange: exchange ?? null,
          provider: "fallback" as const
        };
      })
      .filter((point) => Number.isFinite(point.close));
  }

  return [];
}
