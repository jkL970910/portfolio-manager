import type { HoldingPosition } from "@/lib/backend/models";

export type EconomicExposureInput = {
  symbol: string;
  name?: string | null;
  assetClass?: string | null;
  securityType?: string | null;
  currency?: string | null;
};

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

export function inferEconomicAssetClass(input: EconomicExposureInput) {
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

export function getHoldingEconomicAssetClass(holding: HoldingPosition) {
  return inferEconomicAssetClass({
    symbol: holding.symbol,
    name: holding.name,
    assetClass: holding.assetClass,
    securityType: holding.securityTypeOverride,
    currency: holding.currency,
  });
}

export function isEconomicExposureDifferent(input: EconomicExposureInput) {
  const fallback = input.assetClass?.trim();
  return Boolean(fallback && inferEconomicAssetClass(input) !== fallback);
}
