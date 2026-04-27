import type { AccountType, CurrencyCode, RecommendationConstraints, SecurityConstraintIdentity } from "@/lib/backend/models";

const ACCOUNT_TYPES: AccountType[] = ["TFSA", "RRSP", "FHSA", "Taxable"];

export const DEFAULT_RECOMMENDATION_CONSTRAINTS: RecommendationConstraints = {
  excludedSymbols: [],
  preferredSymbols: [],
  excludedSecurities: [],
  preferredSecurities: [],
  assetClassBands: [],
  avoidAccountTypes: [],
  preferredAccountTypes: [],
  allowedSecurityTypes: []
};

function normalizeSymbols(value: unknown, max = 50) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, max);
}

function normalizeSecurityIdentities(value: unknown, max = 50): SecurityConstraintIdentity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries = value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => {
      const symbol = typeof item.symbol === "string" ? item.symbol.trim().toUpperCase() : "";
      const currency = typeof item.currency === "string" ? item.currency.trim().toUpperCase() : null;
      return {
        symbol,
        exchange: typeof item.exchange === "string" && item.exchange.trim() ? item.exchange.trim() : null,
        currency: currency === "CAD" || currency === "USD" ? currency as CurrencyCode : null,
        name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : null,
        provider: typeof item.provider === "string" && item.provider.trim() ? item.provider.trim() : null
      };
    })
    .filter((item) => item.symbol);

  return Array.from(
    new Map(entries.map((item) => [`${item.symbol}|${item.exchange ?? ""}|${item.currency ?? ""}`, item])).values()
  ).slice(0, max);
}

function normalizeAccountTypes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((item): item is AccountType => ACCOUNT_TYPES.includes(item as AccountType)))
  );
}

function normalizeAssetClassBands(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => ({
      assetClass: typeof item.assetClass === "string" ? item.assetClass.trim() : "",
      minPct: typeof item.minPct === "number" ? item.minPct : null,
      maxPct: typeof item.maxPct === "number" ? item.maxPct : null
    }))
    .filter((item) => item.assetClass)
    .slice(0, 20);
}

function normalizeSecurityTypes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 20);
}

export function normalizeRecommendationConstraints(value: unknown): RecommendationConstraints {
  const input = value != null && typeof value === "object" ? value as Record<string, unknown> : {};
  const excludedSecurities = normalizeSecurityIdentities(input.excludedSecurities);
  const preferredSecurities = normalizeSecurityIdentities(input.preferredSecurities);
  const excludedSymbols = Array.from(new Set([
    ...normalizeSymbols(input.excludedSymbols),
    ...excludedSecurities.map((item) => item.symbol)
  ]));

  return {
    excludedSymbols,
    preferredSymbols: Array.from(new Set([
      ...normalizeSymbols(input.preferredSymbols),
      ...preferredSecurities.map((item) => item.symbol)
    ])).filter(
      (symbol) => !excludedSymbols.includes(symbol)
    ),
    excludedSecurities,
    preferredSecurities: preferredSecurities.filter(
      (item) => !excludedSymbols.includes(item.symbol)
    ),
    assetClassBands: normalizeAssetClassBands(input.assetClassBands),
    avoidAccountTypes: normalizeAccountTypes(input.avoidAccountTypes),
    preferredAccountTypes: normalizeAccountTypes(input.preferredAccountTypes),
    allowedSecurityTypes: normalizeSecurityTypes(input.allowedSecurityTypes)
  };
}
