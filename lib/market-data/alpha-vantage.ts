import { getMarketDataConfig } from "@/lib/market-data/config";
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

function getCandidateSymbols(symbol: string, exchange?: string | null, currency?: string | null) {
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

export async function getHistoricalSeriesFromAlphaVantage(symbol: string, exchange?: string | null, currency?: string | null): Promise<SecurityHistoricalPoint[]> {
  const { alphaVantageApiKey } = getMarketDataConfig();
  if (!alphaVantageApiKey) {
    return [];
  }

  for (const candidateSymbol of getCandidateSymbols(symbol, exchange, currency)) {
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
