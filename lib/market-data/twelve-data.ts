import { getMarketDataConfig } from "@/lib/market-data/config";
import type { SecurityQuote, SecuritySearchResult, SupportedAssetType } from "@/lib/market-data/types";

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
  code?: number;
  message?: string;
}

function mapInstrumentType(value?: string): SupportedAssetType {
  switch ((value ?? "").toLowerCase()) {
    case "common stock":
    case "stock":
      return "Common Stock";
    case "etf":
      return "ETF";
    case "mutual fund":
      return "Mutual Fund";
    case "adr":
      return "ADR";
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

export async function searchSecuritiesWithTwelveData(query: string): Promise<SecuritySearchResult[]> {
  const { twelveDataApiKey } = getMarketDataConfig();
  if (!twelveDataApiKey) {
    return [];
  }

  const url = new URL("https://api.twelvedata.com/symbol_search");
  url.searchParams.set("symbol", query);
  url.searchParams.set("apikey", twelveDataApiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Twelve Data search failed with status ${response.status}.`);
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
      provider: "twelve-data"
    }));
}

export async function getQuoteFromTwelveData(symbol: string): Promise<SecurityQuote | null> {
  const { twelveDataApiKey } = getMarketDataConfig();
  if (!twelveDataApiKey) {
    return null;
  }

  const url = new URL("https://api.twelvedata.com/price");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", twelveDataApiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Twelve Data quote failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as TwelveDataPriceResponse;
  const price = Number(payload.price);

  if (!Number.isFinite(price)) {
    return null;
  }

  return {
    symbol,
    price,
    currency: payload.currency ?? null,
    timestamp: new Date().toISOString(),
    provider: "twelve-data",
    delayed: true
  };
}
