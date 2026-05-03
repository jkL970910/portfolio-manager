import type {
  HoldingPosition,
  SecurityMetadata,
  SecurityMetadataSource,
} from "@/lib/backend/models";

export type EconomicExposureInput = {
  symbol: string;
  name?: string | null;
  assetClass?: string | null;
  securityType?: string | null;
  currency?: string | null;
  metadata?: SecurityMetadata | null;
};

export type InferredSecurityMetadata = SecurityMetadata & {
  assetClassSource: SecurityMetadataSource;
};

export function normalizeSecurityMetadataForWrite(
  metadata: SecurityMetadata,
): SecurityMetadata {
  const confidence = Number.isFinite(metadata.confidence)
    ? Math.min(100, Math.max(0, Math.round(metadata.confidence)))
    : 45;

  return {
    economicAssetClass: metadata.economicAssetClass?.trim() || null,
    economicSector: metadata.economicSector?.trim() || null,
    exposureRegion: metadata.exposureRegion?.trim() || null,
    source: metadata.source,
    confidence,
    asOf: metadata.asOf,
    confirmedAt: metadata.confirmedAt,
    notes: metadata.notes?.trim() || null,
  };
}

const US_EQUITY_EXPOSURE_SYMBOLS = new Set([
  "VFV",
  "XUS",
  "XUU",
  "ZSP",
  "HXS",
  "HULC",
  "QQC",
  "ZQQ",
  "HXQ",
  "XQQ",
]);

const INTERNATIONAL_EQUITY_EXPOSURE_SYMBOLS = new Set([
  "XEF",
  "VIU",
  "XAW",
  "XEQT",
  "VEQT",
]);

const FIXED_INCOME_EXPOSURE_SYMBOLS = new Set([
  "XBB",
  "ZAG",
  "VAB",
  "XSB",
  "ZFL",
]);

const CASH_EXPOSURE_SYMBOLS = new Set(["CASH", "PSA", "HSAV", "CSAV"]);

const PRECIOUS_METALS_EXPOSURE_SYMBOLS = new Set([
  "CGL",
  "CGL.C",
  "CGL-C",
  "GLD",
  "IAU",
  "PHYS",
  "MNT",
  "MNT.U",
  "KILO",
  "XGD",
  "GDX",
  "GDXJ",
  "HUG",
  "HGY",
]);

function getSymbolVariants(symbol: string) {
  const upper = symbol.trim().toUpperCase();
  const withoutProviderSuffix = upper.replace(/\.(TO|TSX|NEO|NYSE|NASDAQ|NDAQ|AMEX|ARCA)$/u, "");
  return new Set([
    upper,
    withoutProviderSuffix,
    withoutProviderSuffix.replace(/-/gu, "."),
    withoutProviderSuffix.replace(/\./gu, "-"),
    withoutProviderSuffix.split(/[.-]/u)[0] ?? withoutProviderSuffix,
  ]);
}

function symbolMatches(symbols: Set<string>, symbol: string) {
  return [...getSymbolVariants(symbol)].some((variant) => symbols.has(variant));
}

function isPreciousMetalsExposure(input: {
  symbol: string;
  name: string;
  type: string;
  fallbackAssetClass: string | null;
}) {
  const fallback = (input.fallbackAssetClass ?? "").trim().toLowerCase();
  return (
    symbolMatches(PRECIOUS_METALS_EXPOSURE_SYMBOLS, input.symbol) ||
    input.type.includes("commodity") ||
    fallback.includes("commodity") ||
    fallback.includes("precious") ||
    input.name.includes("gold bullion") ||
    input.name.includes("silver bullion") ||
    input.name.includes("precious metal") ||
    input.name.includes("precious metals") ||
    input.name.includes("gold miner") ||
    input.name.includes("gold miners") ||
    input.name.includes("gold mining") ||
    input.name.includes("gold producers")
  );
}

export function inferEconomicAssetClass(input: EconomicExposureInput) {
  if (
    input.metadata?.economicAssetClass &&
    input.metadata.confidence >= 70
  ) {
    return input.metadata.economicAssetClass;
  }

  const symbol = input.symbol.trim().toUpperCase();
  const name = (input.name ?? "").trim().toLowerCase();
  const type = (input.securityType ?? "").trim().toLowerCase();
  const fallbackAssetClass = input.assetClass?.trim() || null;
  const isFundLike =
    type.includes("etf") ||
    type.includes("fund") ||
    name.includes(" etf") ||
    name.includes(" index ") ||
    name.includes("nasdaq") ||
    name.includes("s&p") ||
    name.includes("msci");

  if (
    FIXED_INCOME_EXPOSURE_SYMBOLS.has(symbol) ||
    name.includes("bond") ||
    name.includes("aggregate")
  ) {
    return "Fixed Income";
  }

  if (
    CASH_EXPOSURE_SYMBOLS.has(symbol) ||
    name.includes("high interest savings") ||
    name.includes("cash")
  ) {
    return "Cash";
  }

  if (isPreciousMetalsExposure({ symbol, name, type, fallbackAssetClass })) {
    return "Commodity";
  }

  if (
    INTERNATIONAL_EQUITY_EXPOSURE_SYMBOLS.has(symbol) ||
    name.includes("eafe") ||
    name.includes("ex canada") ||
    name.includes("developed all cap ex north america") ||
    name.includes("international")
  ) {
    return "International Equity";
  }

  if (
    US_EQUITY_EXPOSURE_SYMBOLS.has(symbol) ||
    name.includes("nasdaq") ||
    name.includes("s&p 500") ||
    name.includes("s&p500") ||
    name.includes("u.s.") ||
    name.includes("us total market") ||
    name.includes("united states")
  ) {
    return "US Equity";
  }

  if (isFundLike && name.includes("canadian")) {
    return "Canadian Equity";
  }

  return (
    fallbackAssetClass ??
    (input.currency?.trim().toUpperCase() === "USD"
      ? "US Equity"
      : "Canadian Equity")
  );
}

export function inferSecurityMetadata(
  input: Omit<EconomicExposureInput, "metadata">,
): InferredSecurityMetadata {
  const economicAssetClass = inferEconomicAssetClass(input);
  const symbol = input.symbol.trim().toUpperCase();
  const name = (input.name ?? "").trim().toLowerCase();
  const type = (input.securityType ?? "").trim().toLowerCase();
  const fallbackAssetClass = input.assetClass?.trim() || null;
  const isRegistryKnown =
    symbolMatches(US_EQUITY_EXPOSURE_SYMBOLS, symbol) ||
    symbolMatches(INTERNATIONAL_EQUITY_EXPOSURE_SYMBOLS, symbol) ||
    symbolMatches(FIXED_INCOME_EXPOSURE_SYMBOLS, symbol) ||
    symbolMatches(CASH_EXPOSURE_SYMBOLS, symbol) ||
    isPreciousMetalsExposure({ symbol, name, type, fallbackAssetClass });
  const isAssetClassOverride = Boolean(
    fallbackAssetClass && fallbackAssetClass !== economicAssetClass,
  );
  const source: SecurityMetadataSource =
    isRegistryKnown || isAssetClassOverride ? "project-registry" : "heuristic";

  return {
    economicAssetClass,
    economicSector:
      economicAssetClass === "Commodity"
        ? "Precious Metals"
        : null,
    exposureRegion:
      economicAssetClass === "US Equity"
        ? "United States"
        : economicAssetClass === "Canadian Equity"
          ? "Canada"
          : economicAssetClass === "International Equity"
            ? "International"
            : null,
    source,
    assetClassSource: source,
    confidence: source === "project-registry" ? 82 : 45,
    asOf: null,
    confirmedAt: null,
    notes:
      source === "project-registry"
        ? "Matched by project economic exposure registry."
        : "Inferred from available listing, type, currency, and name fields.",
  };
}

export function getHoldingEconomicAssetClass(holding: HoldingPosition) {
  return inferEconomicAssetClass({
    symbol: holding.symbol,
    name: holding.name,
    assetClass: holding.assetClass,
    securityType: holding.securityTypeOverride,
    currency: holding.currency,
    metadata: holding.securityMetadata,
  });
}

export function isEconomicExposureDifferent(input: EconomicExposureInput) {
  const fallback = input.assetClass?.trim();
  return Boolean(fallback && inferEconomicAssetClass(input) !== fallback);
}
