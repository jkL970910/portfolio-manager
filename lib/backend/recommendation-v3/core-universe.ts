import type { AccountType, CurrencyCode } from "@/lib/backend/models";

export type RecommendationCandidateAction =
  | "lump_sum"
  | "dca"
  | "wait_pullback"
  | "avoid";

export type RecommendationAction = RecommendationCandidateAction;

export type CoreRecommendationCandidateRole =
  | "core"
  | "satellite"
  | "cash_parking"
  | "defensive";

export type CoreRecommendationCandidate = {
  symbol: string;
  name: string;
  assetClass: string;
  currency: CurrencyCode;
  exchange?: string | null;
  securityType?: string;
  expenseBps: number;
  liquidityScore: number;
  tags: string[];
  source: "core_pool";
  role: CoreRecommendationCandidateRole;
  preferredAccountTypes?: AccountType[];
  avoidedAccountTypes?: AccountType[];
  taxNotes?: string[];
  defaultAction?: RecommendationCandidateAction;
};

export const CORE_RECOMMENDATION_UNIVERSE: Record<
  string,
  CoreRecommendationCandidate[]
> = {
  "Canadian Equity": [
    {
      symbol: "VCN",
      name: "Vanguard FTSE Canada All Cap Index ETF",
      assetClass: "Canadian Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 6,
      liquidityScore: 94,
      tags: ["broad-market"],
      source: "core_pool",
      role: "core",
      preferredAccountTypes: ["TFSA", "FHSA", "Taxable"],
    },
    {
      symbol: "XIC",
      name: "iShares Core S&P/TSX Capped Composite ETF",
      assetClass: "Canadian Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 6,
      liquidityScore: 95,
      tags: ["broad-market"],
      source: "core_pool",
      role: "core",
      preferredAccountTypes: ["TFSA", "FHSA", "Taxable"],
    },
    {
      symbol: "ZCN",
      name: "BMO S&P/TSX Capped Composite Index ETF",
      assetClass: "Canadian Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 6,
      liquidityScore: 90,
      tags: ["broad-market"],
      source: "core_pool",
      role: "core",
      preferredAccountTypes: ["TFSA", "FHSA", "Taxable"],
    },
    {
      symbol: "XIT",
      name: "iShares S&P/TSX Capped Information Technology Index ETF",
      assetClass: "Canadian Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 61,
      liquidityScore: 72,
      tags: ["sector", "technology", "growth"],
      source: "core_pool",
      role: "satellite",
      defaultAction: "dca",
    },
    {
      symbol: "XEG",
      name: "iShares S&P/TSX Capped Energy Index ETF",
      assetClass: "Canadian Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 61,
      liquidityScore: 82,
      tags: ["sector", "energy", "cyclical"],
      source: "core_pool",
      role: "satellite",
      defaultAction: "dca",
    },
  ],
  "US Equity": [
    {
      symbol: "VFV",
      name: "Vanguard S&P 500 Index ETF",
      assetClass: "US Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 9,
      liquidityScore: 97,
      tags: ["cad-listed", "core", "unhedged"],
      source: "core_pool",
      role: "core",
      preferredAccountTypes: ["TFSA", "FHSA", "Taxable"],
      taxNotes: ["CAD wrapper for broad US equity exposure outside RRSP."],
    },
    {
      symbol: "XUU",
      name: "iShares Core S&P U.S. Total Market Index ETF",
      assetClass: "US Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 7,
      liquidityScore: 92,
      tags: ["cad-listed", "core", "total-market"],
      source: "core_pool",
      role: "core",
      preferredAccountTypes: ["TFSA", "FHSA", "Taxable"],
    },
    {
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      assetClass: "US Equity",
      currency: "USD",
      exchange: "NYSEARCA",
      securityType: "ETF",
      expenseBps: 3,
      liquidityScore: 99,
      tags: ["usd-listed", "core", "s-and-p-500"],
      source: "core_pool",
      role: "core",
      preferredAccountTypes: ["RRSP"],
      taxNotes: ["Often cleaner inside RRSP when the user already has USD funding."],
    },
    {
      symbol: "VTI",
      name: "Vanguard Total Stock Market ETF",
      assetClass: "US Equity",
      currency: "USD",
      exchange: "NYSEARCA",
      securityType: "ETF",
      expenseBps: 3,
      liquidityScore: 99,
      tags: ["usd-listed", "core", "total-market"],
      source: "core_pool",
      role: "core",
      preferredAccountTypes: ["RRSP"],
      taxNotes: ["Broad US total-market expression for RRSP/USD funding paths."],
    },
    {
      symbol: "QQC",
      name: "Invesco NASDAQ 100 Index ETF",
      assetClass: "US Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 20,
      liquidityScore: 78,
      tags: ["cad-listed", "technology", "growth", "nasdaq-100"],
      source: "core_pool",
      role: "satellite",
      defaultAction: "dca",
    },
    {
      symbol: "XUS",
      name: "iShares Core S&P 500 Index ETF",
      assetClass: "US Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 10,
      liquidityScore: 88,
      tags: ["cad-listed", "core", "quality"],
      source: "core_pool",
      role: "core",
      preferredAccountTypes: ["TFSA", "FHSA", "Taxable"],
    },
  ],
  "International Equity": [
    {
      symbol: "XEF",
      name: "iShares Core MSCI EAFE IMI Index ETF",
      assetClass: "International Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 22,
      liquidityScore: 90,
      tags: ["developed", "core"],
      source: "core_pool",
      role: "core",
    },
    {
      symbol: "VIU",
      name: "Vanguard FTSE Developed All Cap ex North America Index ETF",
      assetClass: "International Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 23,
      liquidityScore: 88,
      tags: ["developed", "core"],
      source: "core_pool",
      role: "core",
    },
    {
      symbol: "XAW",
      name: "iShares Core MSCI All Country World ex Canada Index ETF",
      assetClass: "International Equity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 22,
      liquidityScore: 91,
      tags: ["all-world", "core"],
      source: "core_pool",
      role: "core",
    },
  ],
  "Fixed Income": [
    {
      symbol: "XBB",
      name: "iShares Core Canadian Universe Bond Index ETF",
      assetClass: "Fixed Income",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 9,
      liquidityScore: 95,
      tags: ["core-bonds"],
      source: "core_pool",
      role: "defensive",
      preferredAccountTypes: ["RRSP", "FHSA", "TFSA"],
    },
    {
      symbol: "ZAG",
      name: "BMO Aggregate Bond Index ETF",
      assetClass: "Fixed Income",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 9,
      liquidityScore: 92,
      tags: ["core-bonds"],
      source: "core_pool",
      role: "defensive",
      preferredAccountTypes: ["RRSP", "FHSA", "TFSA"],
    },
    {
      symbol: "VAB",
      name: "Vanguard Canadian Aggregate Bond Index ETF",
      assetClass: "Fixed Income",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 8,
      liquidityScore: 89,
      tags: ["core-bonds"],
      source: "core_pool",
      role: "defensive",
      preferredAccountTypes: ["RRSP", "FHSA", "TFSA"],
    },
  ],
  Commodity: [
    {
      symbol: "CGL.C",
      name: "iShares Gold Bullion ETF",
      assetClass: "Commodity",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 55,
      liquidityScore: 78,
      tags: ["gold", "precious-metals", "commodity", "defensive"],
      source: "core_pool",
      role: "defensive",
      defaultAction: "dca",
    },
    {
      symbol: "PHYS",
      name: "Sprott Physical Gold Trust",
      assetClass: "Commodity",
      currency: "USD",
      exchange: "NYSE",
      securityType: "CEF",
      expenseBps: 41,
      liquidityScore: 82,
      tags: ["gold", "precious-metals", "commodity"],
      source: "core_pool",
      role: "defensive",
      defaultAction: "dca",
    },
    {
      symbol: "GLD",
      name: "SPDR Gold Shares",
      assetClass: "Commodity",
      currency: "USD",
      exchange: "NYSEARCA",
      securityType: "ETF",
      expenseBps: 40,
      liquidityScore: 95,
      tags: ["gold", "precious-metals", "commodity"],
      source: "core_pool",
      role: "defensive",
      defaultAction: "dca",
    },
  ],
  Cash: [
    {
      symbol: "CASH",
      name: "Global X High Interest Savings ETF",
      assetClass: "Cash",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 11,
      liquidityScore: 96,
      tags: ["cash-parking"],
      source: "core_pool",
      role: "cash_parking",
      preferredAccountTypes: ["FHSA", "TFSA", "Taxable"],
    },
    {
      symbol: "PSA",
      name: "Purpose High Interest Savings ETF",
      assetClass: "Cash",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 15,
      liquidityScore: 92,
      tags: ["cash-parking"],
      source: "core_pool",
      role: "cash_parking",
      preferredAccountTypes: ["FHSA", "TFSA", "Taxable"],
    },
    {
      symbol: "HSAV",
      name: "Horizons Cash Maximizer ETF",
      assetClass: "Cash",
      currency: "CAD",
      exchange: "TSX",
      securityType: "ETF",
      expenseBps: 18,
      liquidityScore: 88,
      tags: ["cash-parking"],
      source: "core_pool",
      role: "cash_parking",
      preferredAccountTypes: ["Taxable"],
    },
  ],
};

export function getCoreRecommendationUniverse() {
  return CORE_RECOMMENDATION_UNIVERSE;
}

export function getCoreRecommendationCandidates(assetClass: string) {
  return CORE_RECOMMENDATION_UNIVERSE[assetClass] ?? [];
}

export function findCoreRecommendationCandidate(symbol: string) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  return Object.values(CORE_RECOMMENDATION_UNIVERSE)
    .flat()
    .find((candidate) => candidate.symbol.toUpperCase() === normalizedSymbol);
}
