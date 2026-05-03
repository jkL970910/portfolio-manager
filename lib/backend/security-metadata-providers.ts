import type { SecurityMetadata, SecurityRecord } from "@/lib/backend/models";
import type { SecurityResolution } from "@/lib/market-data/types";
import {
  inferSecurityMetadata,
  normalizeSecurityMetadataForWrite,
} from "@/lib/backend/security-economic-exposure";

export type SecurityMetadataProviderId =
  | "project-registry"
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

function normalizeProviderExchange(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() || "";
  if (normalized === "XTSE") return "TSX";
  if (normalized === "XNAS") return "NASDAQ";
  if (normalized === "XNYS") return "NYSE";
  if (normalized === "ARCX") return "NYSE ARCA";
  return normalized;
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
    const inferred = inferSecurityMetadata({
      symbol: security.symbol,
      name: security.name,
      assetClass: security.economicAssetClass,
      securityType: security.securityType,
      currency: security.currency,
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
    const resolved = await resolveSecurity(security.symbol);
    if (!providerResultMatchesListing(security, resolved.result)) {
      return null;
    }

    const inferred = inferSecurityMetadata({
      symbol: security.symbol,
      name: resolved.result.name || security.name,
      assetClass: security.economicAssetClass,
      securityType: resolved.result.securityType ?? security.securityType,
      currency: security.currency,
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

export function getEnabledSecurityMetadataProviders() {
  return [
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
    return true;
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
