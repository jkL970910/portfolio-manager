export type SupportedAssetType =
  | "Common Stock"
  | "ETF"
  | "Commodity ETF"
  | "Mutual Fund"
  | "ADR"
  | "REIT"
  | "Trust"
  | "Preferred Share"
  | "Index"
  | "Crypto"
  | "Forex"
  | "Unknown";

export interface SecuritySearchResult {
  symbol: string;
  name: string;
  exchange?: string | null;
  micCode?: string | null;
  country?: string | null;
  currency?: string | null;
  type: SupportedAssetType;
  provider: "twelve-data" | "openfigi" | "fallback";
}

export interface SecurityResolution {
  symbol: string;
  name: string;
  exchange?: string | null;
  micCode?: string | null;
  compositeFigi?: string | null;
  shareClassFigi?: string | null;
  securityType?: string | null;
  marketSector?: string | null;
  provider: "openfigi" | "fallback";
}

export interface SecurityQuote {
  symbol: string;
  exchange?: string | null;
  price: number;
  currency?: string | null;
  timestamp: string;
  provider: "twelve-data" | "fallback";
  delayed: boolean;
}

export interface SecurityHistoricalPoint {
  symbol: string;
  date: string;
  close: number;
  adjustedClose?: number | null;
  currency?: string | null;
  exchange?: string | null;
  provider: "twelve-data" | "fallback";
}

export interface ProviderHealth {
  openFigiConfigured: boolean;
  twelveDataConfigured: boolean;
}
