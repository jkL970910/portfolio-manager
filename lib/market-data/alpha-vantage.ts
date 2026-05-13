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

export interface AlphaVantageEarningsPayload {
  candidateSymbol: string;
  payload: Record<string, unknown>;
}

export interface AlphaVantageNewsArticle {
  title: string;
  url: string;
  source: string;
  sourceDomain: string | null;
  summary: string;
  timePublished: string | null;
  overallSentimentScore: number | null;
  overallSentimentLabel: string | null;
  tickerSentiment: Array<{
    ticker: string;
    relevanceScore: number | null;
    sentimentScore: number | null;
    sentimentLabel: string | null;
  }>;
  topics: Array<{
    topic: string;
    relevanceScore: number | null;
  }>;
  raw: Record<string, unknown>;
}

export interface AlphaVantageNewsPayload {
  candidateTickers: string[];
  topics: string[];
  payload: Record<string, unknown>;
  feed: AlphaVantageNewsArticle[];
}

export class AlphaVantageProviderLimitedError extends Error {
  constructor(message = "Alpha Vantage provider limit reached.") {
    super(message);
    this.name = "AlphaVantageProviderLimitedError";
  }
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
  throwOnLimit?: boolean;
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
    const reason = String(
      payload.Note ??
        payload.Information ??
        "Alpha Vantage rate limit or endpoint limit reached.",
    );
    markProviderLimited({
      provider: "alpha-vantage",
      reason,
      retryAfterSeconds: readRetryAfterSeconds(response.headers),
    });
    if (input.throwOnLimit) {
      throw new AlphaVantageProviderLimitedError(reason);
    }
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

function hasEarningsPayload(payload: Record<string, unknown>) {
  return (
    Array.isArray(payload.annualEarnings) ||
    Array.isArray(payload.quarterlyEarnings)
  );
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readObjectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object",
      )
    : [];
}

function parseAlphaVantageNewsArticle(
  article: Record<string, unknown>,
): AlphaVantageNewsArticle | null {
  const title = readString(article.title);
  const url = readString(article.url);
  const source = readString(article.source) ?? "Alpha Vantage News";
  const summary = readString(article.summary) ?? title;
  if (!title || !url || !summary) {
    return null;
  }

  return {
    title,
    url,
    source,
    sourceDomain: readString(article.source_domain),
    summary,
    timePublished: readString(article.time_published),
    overallSentimentScore: readNumber(article.overall_sentiment_score),
    overallSentimentLabel: readString(article.overall_sentiment_label),
    tickerSentiment: readObjectArray(article.ticker_sentiment).map((item) => ({
      ticker: readString(item.ticker)?.toUpperCase() ?? "UNKNOWN",
      relevanceScore: readNumber(item.relevance_score),
      sentimentScore: readNumber(item.ticker_sentiment_score),
      sentimentLabel: readString(item.ticker_sentiment_label),
    })),
    topics: readObjectArray(article.topics).map((item) => ({
      topic: readString(item.topic) ?? "unknown",
      relevanceScore: readNumber(item.relevance_score),
    })),
    raw: article,
  };
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
        throwOnLimit: true,
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

export async function getAlphaVantageNewsSentiment(input: {
  tickers?: string[];
  topics?: string[];
  limit?: number;
} = {}): Promise<AlphaVantageNewsPayload | null> {
  const { alphaVantageApiKey } = getMarketDataConfig();
  if (!alphaVantageApiKey) {
    return null;
  }

  const tickers = Array.from(
    new Set(
      (input.tickers ?? [])
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).slice(0, 5);
  const topics = Array.from(
    new Set(
      (input.topics ?? [])
        .map((topic) => topic.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 5);
  const limit = Math.min(
    Math.max(Math.trunc(input.limit ?? 12), 1),
    50,
  );

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "NEWS_SENTIMENT");
  if (tickers.length > 0) {
    url.searchParams.set("tickers", tickers.join(","));
  }
  if (topics.length > 0) {
    url.searchParams.set("topics", topics.join(","));
  }
  url.searchParams.set("sort", "LATEST");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apikey", alphaVantageApiKey);

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
    const reason = String(
      payload.Note ??
        payload.Information ??
        "Alpha Vantage rate limit or endpoint limit reached.",
    );
    markProviderLimited({
      provider: "alpha-vantage",
      reason,
      retryAfterSeconds: readRetryAfterSeconds(response.headers),
    });
    throw new AlphaVantageProviderLimitedError(reason);
  }
  if (payload["Error Message"]) {
    return null;
  }

  const feed = readObjectArray(payload.feed)
    .map(parseAlphaVantageNewsArticle)
    .filter((item): item is AlphaVantageNewsArticle => Boolean(item));

  return feed.length > 0
    ? {
        candidateTickers: tickers,
        topics,
        payload,
        feed,
      }
    : null;
}

export async function getAlphaVantageEarnings(
  symbol: string,
  exchange?: string | null,
  currency?: string | null,
): Promise<AlphaVantageEarningsPayload | null> {
  const { alphaVantageApiKey } = getMarketDataConfig();
  if (!alphaVantageApiKey) {
    return null;
  }

  for (const candidateSymbol of getAlphaVantageCandidateSymbols(
    symbol,
    exchange,
    currency,
  )) {
    const payload = await fetchAlphaVantagePayload({
      fn: "EARNINGS",
      symbol: candidateSymbol,
      apiKey: alphaVantageApiKey,
      throwOnLimit: true,
    });
    if (payload && hasEarningsPayload(payload)) {
      return { candidateSymbol, payload };
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
