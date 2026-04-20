import type { SecurityQuote } from "@/lib/market-data/types";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        exchangeName?: string;
        fullExchangeName?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
};

function normalizeExchange(value?: string | null) {
  return value?.trim().toUpperCase() || null;
}

function toYahooSymbol(symbol: string, exchange?: string | null, currency?: string | null) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedExchange = normalizeExchange(exchange);
  const normalizedCurrency = currency?.trim().toUpperCase() || null;

  if (normalizedCurrency === "CAD") {
    const yahooBase = normalizedSymbol.replace(/\./g, "-");
    if (normalizedExchange === "NEO" || normalizedExchange === "CBOE CANADA" || normalizedExchange === "CBOE" || normalizedExchange?.startsWith("NEO-")) {
      return `${yahooBase}.NE`;
    }
    if (normalizedExchange === "TSXV" || normalizedExchange === "TSX VENTURE") {
      return `${yahooBase}.V`;
    }
    return `${yahooBase}.TO`;
  }

  if (normalizedCurrency === "USD") {
    return normalizedSymbol;
  }

  return normalizedSymbol;
}

export async function getQuoteFromYahooFinance(symbol: string, exchange?: string | null, currency?: string | null): Promise<SecurityQuote | null> {
  const yahooSymbol = toYahooSymbol(symbol, exchange, currency);
  const expectedCurrency = currency?.trim().toUpperCase() || null;
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1d");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; PortfolioManager/1.0; +https://localhost)"
    }
  });

  if (response.status === 404) {
    return null;
  }
  if (response.status === 429) {
    throw new Error("Yahoo Finance quote rate limit reached.");
  }
  if (!response.ok) {
    throw new Error(`Yahoo Finance quote failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const meta = payload.chart?.result?.[0]?.meta;
  if (!meta) {
    return null;
  }

  const price = Number(meta.regularMarketPrice ?? meta.previousClose);
  const quoteCurrency = meta.currency?.trim().toUpperCase() || null;
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }
  if (expectedCurrency && quoteCurrency && quoteCurrency !== expectedCurrency) {
    return null;
  }

  return {
    symbol: symbol.trim().toUpperCase(),
    exchange: exchange?.trim() || meta.exchangeName || meta.fullExchangeName || null,
    price,
    currency: quoteCurrency ?? expectedCurrency,
    timestamp: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
    provider: "yahoo-finance",
    delayed: true
  };
}

