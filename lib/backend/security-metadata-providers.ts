import type { SecurityMetadata, SecurityRecord } from "@/lib/backend/models";
import {
  inferSecurityMetadata,
  normalizeSecurityMetadataForWrite,
} from "@/lib/backend/security-economic-exposure";

export type SecurityMetadataProviderId =
  | "project-registry"
  | "provider-placeholder";

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

export const providerPlaceholderSecurityMetadataProvider: SecurityMetadataProvider = {
  id: "provider-placeholder",
  enabled() {
    return isRealMetadataProviderEnabled();
  },
  async fetch() {
    return null;
  },
};

export function getEnabledSecurityMetadataProviders() {
  return [
    providerPlaceholderSecurityMetadataProvider,
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
