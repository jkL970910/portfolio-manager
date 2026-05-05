import { getMarketDataConfig } from "@/lib/market-data/config";
import type {
  SecurityResolution,
  SecuritySearchResult,
  SupportedAssetType,
} from "@/lib/market-data/types";

interface OpenFigiSearchItem {
  ticker?: string;
  name?: string;
  exchCode?: string;
  micCode?: string;
  compositeFIGI?: string;
  shareClassFIGI?: string;
  securityType?: string;
  marketSector?: string;
}

export async function resolveSecurityWithOpenFigi(
  symbol: string,
  options?: {
    exchange?: string | null;
    currency?: string | null;
  },
): Promise<SecurityResolution | null> {
  const { openFigiApiKey } = getMarketDataConfig();
  if (!openFigiApiKey) {
    return null;
  }
  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedExchange = options?.exchange?.trim().toUpperCase() || null;
  const normalizedCurrency = options?.currency?.trim().toUpperCase() || null;

  const response = await fetch("https://api.openfigi.com/v3/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OPENFIGI-APIKEY": openFigiApiKey
    },
    body: JSON.stringify({
      query: [
        normalizedSymbol,
        normalizedExchange,
        normalizedCurrency,
      ].filter(Boolean).join(" "),
      limit: 10
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`OpenFIGI lookup failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as { data?: OpenFigiSearchItem[] };
  const exactTickerMatches = payload.data?.filter(
    (item) => item.ticker?.toUpperCase() === normalizedSymbol,
  ) ?? [];
  const match =
    exactTickerMatches.find((item) => {
      const exchange = item.exchCode?.trim().toUpperCase() || "";
      const micCode = item.micCode?.trim().toUpperCase() || "";
      return (
        !normalizedExchange ||
        exchange === normalizedExchange ||
        micCode === normalizedExchange
      );
    }) ??
    exactTickerMatches[0] ??
    payload.data?.[0];

  if (!match?.ticker) {
    return null;
  }

  return {
    symbol: match.ticker,
    name: match.name ?? match.ticker,
    exchange: match.exchCode ?? null,
    micCode: match.micCode ?? null,
    compositeFigi: match.compositeFIGI ?? null,
    shareClassFigi: match.shareClassFIGI ?? null,
    securityType: match.securityType ?? null,
    marketSector: match.marketSector ?? null,
    provider: "openfigi"
  };
}

function mapOpenFigiAssetType(value?: string): SupportedAssetType {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("common") || normalized === "equity") {
    return "Common Stock";
  }
  if (normalized.includes("etf") || normalized.includes("fund")) {
    return "ETF";
  }
  if (normalized.includes("adr")) {
    return "ADR";
  }
  if (normalized.includes("reit")) {
    return "REIT";
  }
  if (normalized.includes("preferred")) {
    return "Preferred Share";
  }
  return "Unknown";
}

export async function searchSecuritiesWithOpenFigi(
  query: string,
): Promise<SecuritySearchResult[]> {
  const { openFigiApiKey } = getMarketDataConfig();
  if (!openFigiApiKey) {
    return [];
  }

  const response = await fetch("https://api.openfigi.com/v3/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OPENFIGI-APIKEY": openFigiApiKey,
    },
    body: JSON.stringify({
      query: query.trim(),
      limit: 10,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenFIGI search failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as { data?: OpenFigiSearchItem[] };
  return (payload.data ?? [])
    .filter((item) => item.ticker && item.name)
    .slice(0, 10)
    .map((item) => ({
      symbol: item.ticker!,
      name: item.name!,
      exchange: item.exchCode ?? null,
      micCode: item.micCode ?? null,
      country: null,
      currency: null,
      type: mapOpenFigiAssetType(item.securityType),
      provider: "openfigi",
    }));
}
