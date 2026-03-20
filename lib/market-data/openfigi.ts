import { getMarketDataConfig } from "@/lib/market-data/config";
import type { SecurityResolution } from "@/lib/market-data/types";

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

export async function resolveSecurityWithOpenFigi(symbol: string): Promise<SecurityResolution | null> {
  const { openFigiApiKey } = getMarketDataConfig();
  if (!openFigiApiKey) {
    return null;
  }

  const response = await fetch("https://api.openfigi.com/v3/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OPENFIGI-APIKEY": openFigiApiKey
    },
    body: JSON.stringify({ query: symbol, limit: 5 }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`OpenFIGI lookup failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as { data?: OpenFigiSearchItem[] };
  const match = payload.data?.find((item) => item.ticker?.toUpperCase() === symbol.toUpperCase()) ?? payload.data?.[0];

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
