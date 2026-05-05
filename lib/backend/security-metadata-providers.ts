import type { SecurityMetadata, SecurityRecord } from "@/lib/backend/models";
import type { SecurityResolution } from "@/lib/market-data/types";
import {
  inferSecurityMetadata,
  isSupportedNorthAmericanListing,
  normalizeSecurityMetadataForWrite,
} from "@/lib/backend/security-economic-exposure";

export type SecurityMetadataProviderId =
  | "project-registry"
  | "alpha-vantage-profile"
  | "openfigi-profile";

export interface SecurityMetadataProviderResult {
  providerId: SecurityMetadataProviderId;
  metadata: SecurityMetadata;
  rawPayload?: Record<string, unknown>;
}

export interface SecurityMetadataProvider {
  id: SecurityMetadataProviderId;
  enabled(): boolean;
  fetch(security: SecurityRecord): Promise<SecurityMetadataProviderResult | null>;
}

function isRealMetadataProviderEnabled() {
  return process.env.SECURITY_METADATA_PROVIDER_ENABLED?.trim() === "true";
}

function isOpenFigiMetadataProviderEnabled() {
  return (
    isRealMetadataProviderEnabled() &&
    Boolean(process.env.OPENFIGI_API_KEY?.trim())
  );
}

function isAlphaVantageMetadataProviderEnabled() {
  return (
    isRealMetadataProviderEnabled() &&
    process.env.ALPHA_VANTAGE_PROFILE_PROVIDER_ENABLED?.trim() === "true" &&
    Boolean(process.env.ALPHA_VANTAGE_API_KEY?.trim())
  );
}

function normalizeProviderExchange(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() || "";
  if (normalized === "XTSE") return "TSX";
  if (normalized === "XNAS") return "NASDAQ";
  if (normalized === "XNYS") return "NYSE";
  if (normalized === "ARCX") return "NYSE ARCA";
  return normalized;
}

function stringField(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function listField(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

function normalizeCountry(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  if (["usa", "us", "united states", "united states of america"].includes(normalized)) {
    return "United States";
  }
  if (["canada", "ca"].includes(normalized)) return "Canada";
  return value;
}

function inferCompanyProfileAssetClass(input: {
  assetType: string | null;
  country: string | null;
  currency: string | null;
}) {
  const assetType = input.assetType?.trim().toLowerCase() ?? "";
  const country = normalizeCountry(input.country);
  const currency = input.currency?.trim().toUpperCase() ?? "";
  if (assetType.includes("etf") || assetType.includes("fund")) {
    return null;
  }
  if (country === "United States" || currency === "USD") {
    return "US Equity";
  }
  if (country === "Canada" || currency === "CAD") {
    return "Canadian Equity";
  }
  return "International Equity";
}

function topNamedWeight(items: Array<Record<string, unknown>>) {
  let best: { name: string; weight: number } | null = null;
  for (const item of items) {
    const name =
      stringField(item, "sector") ??
      stringField(item, "asset") ??
      stringField(item, "name");
    const rawWeight =
      stringField(item, "weight") ??
      stringField(item, "value") ??
      stringField(item, "allocation");
    const weight = Number(String(rawWeight ?? "").replace(/[%,$]/gu, ""));
    if (name && Number.isFinite(weight) && (!best || weight > best.weight)) {
      best = { name, weight };
    }
  }
  return best;
}

function inferEtfProfileAssetClass(input: {
  symbol: string;
  name: string | null;
  payload: Record<string, unknown>;
  fallbackCurrency: string | null;
}) {
  const name = `${input.symbol} ${input.name ?? ""}`.toLowerCase();
  const assetAllocation = listField(input.payload, "asset_allocation");
  const topAsset = topNamedWeight(assetAllocation);
  const topAssetName = topAsset?.name.toLowerCase() ?? "";

  if (
    topAssetName.includes("bond") ||
    topAssetName.includes("fixed") ||
    name.includes("bond") ||
    name.includes("aggregate")
  ) {
    return "Fixed Income";
  }
  if (
    topAssetName.includes("cash") ||
    name.includes("cash") ||
    name.includes("savings")
  ) {
    return "Cash";
  }
  if (
    name.includes("gold") ||
    name.includes("silver") ||
    name.includes("precious metal") ||
    name.includes("commodity")
  ) {
    return "Commodity";
  }
  if (
    name.includes("s&p") ||
    name.includes("nasdaq") ||
    name.includes("u.s.") ||
    name.includes("us ") ||
    name.includes("united states")
  ) {
    return "US Equity";
  }
  if (name.includes("international") || name.includes("eafe")) {
    return "International Equity";
  }
  return input.fallbackCurrency?.trim().toUpperCase() === "USD"
    ? "US Equity"
    : "Canadian Equity";
}

function isFundLikeSecurity(security: Pick<SecurityRecord, "securityType" | "name">) {
  const value = `${security.securityType ?? ""} ${security.name ?? ""}`.toLowerCase();
  return (
    value.includes("etf") ||
    value.includes("fund") ||
    value.includes("trust") ||
    value.includes("index")
  );
}

export function buildAlphaVantageProfileMetadata(input: {
  security: Pick<
    SecurityRecord,
    "symbol" | "name" | "currency" | "securityType" | "economicAssetClass"
  >;
  kind: "company-overview" | "etf-profile";
  candidateSymbol: string;
  payload: Record<string, unknown>;
}): SecurityMetadata {
  if (input.kind === "company-overview") {
    const country = normalizeCountry(stringField(input.payload, "Country"));
    const assetClass =
      inferCompanyProfileAssetClass({
        assetType: stringField(input.payload, "AssetType"),
        country,
        currency: stringField(input.payload, "Currency") ?? input.security.currency,
      }) ??
      inferSecurityMetadata({
        symbol: input.security.symbol,
        name: input.security.name,
        assetClass: input.security.economicAssetClass,
        securityType: input.security.securityType,
        currency: input.security.currency,
      }).economicAssetClass;

    return normalizeSecurityMetadataForWrite({
      economicAssetClass: assetClass,
      economicSector: stringField(input.payload, "Sector"),
      exposureRegion: country,
      source: "provider",
      confidence: country && stringField(input.payload, "Sector") ? 80 : 74,
      asOf: new Date().toISOString(),
      confirmedAt: null,
      notes: [
        `Alpha Vantage OVERVIEW profile matched ${input.candidateSymbol}.`,
        stringField(input.payload, "Industry")
          ? `industry=${stringField(input.payload, "Industry")}`
          : null,
      ]
        .filter(Boolean)
        .join("; "),
    });
  }

  const providerName =
    stringField(input.payload, "name") ??
    stringField(input.payload, "Name") ??
    input.security.name;
  const sectors = listField(input.payload, "sectors");
  const topSector = topNamedWeight(sectors);
  const economicAssetClass = inferEtfProfileAssetClass({
    symbol: input.security.symbol,
    name: providerName,
    payload: input.payload,
    fallbackCurrency: input.security.currency,
  });
  const registry = inferSecurityMetadata({
    symbol: input.security.symbol,
    name: providerName,
    assetClass: input.security.economicAssetClass,
    securityType: input.security.securityType,
    currency: input.security.currency,
  });

  return normalizeSecurityMetadataForWrite({
    economicAssetClass,
    economicSector:
      economicAssetClass === "Commodity"
        ? "Precious Metals"
        : topSector?.name ?? registry.economicSector,
    exposureRegion: registry.exposureRegion,
    source: "provider",
    confidence: topSector || economicAssetClass !== "Canadian Equity" ? 78 : 72,
    asOf: new Date().toISOString(),
    confirmedAt: null,
    notes: [
      `Alpha Vantage ETF_PROFILE matched ${input.candidateSymbol}.`,
      topSector ? `topSector=${topSector.name}` : null,
    ]
      .filter(Boolean)
      .join("; "),
  });
}

function providerResultMatchesListing(
  security: SecurityRecord,
  result: SecurityResolution,
) {
  if (result.provider !== "openfigi") {
    return false;
  }
  const requestedSymbol = security.symbol.trim().toUpperCase();
  const resultSymbol = result.symbol.trim().toUpperCase();
  if (requestedSymbol !== resultSymbol) {
    return false;
  }

  const currentExchange =
    normalizeProviderExchange(security.micCode) ||
    normalizeProviderExchange(security.canonicalExchange);
  const resultExchange =
    normalizeProviderExchange(result.micCode) ||
    normalizeProviderExchange(result.exchange);
  if (currentExchange && resultExchange && currentExchange !== resultExchange) {
    return false;
  }

  return true;
}

export const projectRegistrySecurityMetadataProvider: SecurityMetadataProvider = {
  id: "project-registry",
  enabled() {
    return true;
  },
  async fetch(security) {
    if (!isSupportedNorthAmericanListing({
      exchange: security.canonicalExchange,
      micCode: security.micCode,
      currency: security.currency,
      country: security.country,
    })) {
      return null;
    }

    const inferred = inferSecurityMetadata({
      symbol: security.symbol,
      name: security.name,
      assetClass: security.economicAssetClass,
      securityType: security.securityType,
      currency: security.currency,
      exchange: security.canonicalExchange,
      micCode: security.micCode,
      country: security.country,
    });

    return {
      providerId: "project-registry",
      metadata: normalizeSecurityMetadataForWrite({
        ...inferred,
        asOf: new Date().toISOString(),
        notes:
          inferred.source === "heuristic"
            ? "Project metadata fallback from listing, type, currency, and name."
            : inferred.notes,
      }),
    };
  },
};

export const openFigiProfileSecurityMetadataProvider: SecurityMetadataProvider = {
  id: "openfigi-profile",
  enabled() {
    return isOpenFigiMetadataProviderEnabled();
  },
  async fetch(security) {
    const { resolveSecurity } = await import("@/lib/market-data/service");
    const resolved = await resolveSecurity(security.symbol, {
      exchange: security.canonicalExchange,
      currency: security.currency,
    });
    if (!providerResultMatchesListing(security, resolved.result)) {
      return null;
    }

    const inferred = inferSecurityMetadata({
      symbol: security.symbol,
      name: resolved.result.name || security.name,
      assetClass: security.economicAssetClass,
      securityType: resolved.result.securityType ?? security.securityType,
      currency: security.currency,
      exchange: security.canonicalExchange,
      micCode: security.micCode,
      country: security.country,
    });

    return {
      providerId: "openfigi-profile",
      metadata: normalizeSecurityMetadataForWrite({
        ...inferred,
        source: "provider",
        confidence: Math.max(inferred.confidence, 76),
        asOf: new Date().toISOString(),
        notes: [
          "OpenFIGI profile resolved by exact ticker and compatible listing identity.",
          resolved.result.securityType
            ? `securityType=${resolved.result.securityType}`
            : null,
          resolved.result.marketSector
            ? `marketSector=${resolved.result.marketSector}`
            : null,
        ]
          .filter(Boolean)
          .join("; "),
      }),
      rawPayload: {
        provider: resolved.result.provider,
        symbol: resolved.result.symbol,
        exchange: resolved.result.exchange,
        micCode: resolved.result.micCode,
        securityType: resolved.result.securityType,
        marketSector: resolved.result.marketSector,
      },
    };
  },
};

export const alphaVantageProfileSecurityMetadataProvider: SecurityMetadataProvider = {
  id: "alpha-vantage-profile",
  enabled() {
    return isAlphaVantageMetadataProviderEnabled();
  },
  async fetch(security) {
    const { getAlphaVantageProfile } = await import(
      "@/lib/market-data/alpha-vantage"
    );
    const profile = await getAlphaVantageProfile(
      security.symbol,
      security.canonicalExchange,
      security.currency,
      {
        preferredKind: isFundLikeSecurity(security)
          ? "etf-profile"
          : "company-overview",
      },
    );
    if (!profile) {
      return null;
    }
    return {
      providerId: "alpha-vantage-profile",
      metadata: buildAlphaVantageProfileMetadata({
        security,
        kind: profile.kind,
        candidateSymbol: profile.candidateSymbol,
        payload: profile.payload,
      }),
      rawPayload: {
        candidateSymbol: profile.candidateSymbol,
        kind: profile.kind,
      },
    };
  },
};

export function getEnabledSecurityMetadataProviders() {
  return [
    alphaVantageProfileSecurityMetadataProvider,
    openFigiProfileSecurityMetadataProvider,
    projectRegistrySecurityMetadataProvider,
  ].filter((provider) => provider.enabled());
}

export function shouldApplySecurityMetadata(
  current: Pick<
    SecurityRecord,
    "metadataSource" | "metadataConfidence" | "metadataConfirmedAt"
  >,
  next: SecurityMetadata,
) {
  if (current.metadataSource === "manual" || current.metadataConfirmedAt) {
    return false;
  }
  if (next.source === "provider" && next.confidence >= 70) {
    return (
      current.metadataSource === "heuristic" ||
      current.metadataSource === "provider" ||
      next.confidence >= current.metadataConfidence + 10
    );
  }
  if (
    next.source === "project-registry" &&
    current.metadataSource !== "provider" &&
    next.confidence >= current.metadataConfidence
  ) {
    return true;
  }
  return (
    current.metadataSource === "heuristic" &&
    next.confidence > current.metadataConfidence
  );
}
