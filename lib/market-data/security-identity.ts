import type {
  CurrencyCode,
  SecurityAliasRecord,
  SecurityRecord,
} from "@/lib/backend/models";
import { getRepositories } from "@/lib/backend/repositories/factory";
import { inferSecurityMetadata } from "@/lib/backend/security-economic-exposure";

export type CanonicalSecurityIdentityInput = {
  symbol: string;
  exchange?: string | null;
  micCode?: string | null;
  currency?: string | null;
  name?: string | null;
  securityType?: string | null;
  marketSector?: string | null;
  country?: string | null;
  provider?: string | null;
  providerSymbol?: string | null;
};

export type CanonicalSecurityIdentity = SecurityRecord;

const EXCHANGE_ALIASES: Record<
  string,
  { canonicalExchange: string; micCode?: string; country?: string }
> = {
  TSX: { canonicalExchange: "TSX", micCode: "XTSE", country: "Canada" },
  TOR: { canonicalExchange: "TSX", micCode: "XTSE", country: "Canada" },
  XTSE: { canonicalExchange: "TSX", micCode: "XTSE", country: "Canada" },
  "TORONTO STOCK EXCHANGE": {
    canonicalExchange: "TSX",
    micCode: "XTSE",
    country: "Canada",
  },
  TSXV: { canonicalExchange: "TSXV", micCode: "XTSX", country: "Canada" },
  XTSX: { canonicalExchange: "TSXV", micCode: "XTSX", country: "Canada" },
  "TSX VENTURE": {
    canonicalExchange: "TSXV",
    micCode: "XTSX",
    country: "Canada",
  },
  NEO: { canonicalExchange: "NEO", micCode: "NEOE", country: "Canada" },
  NEOE: { canonicalExchange: "NEO", micCode: "NEOE", country: "Canada" },
  "NEO EXCHANGE": {
    canonicalExchange: "NEO",
    micCode: "NEOE",
    country: "Canada",
  },
  CBOE: { canonicalExchange: "NEO", micCode: "NEOE", country: "Canada" },
  "CBOE CANADA": {
    canonicalExchange: "NEO",
    micCode: "NEOE",
    country: "Canada",
  },
  NASDAQ: { canonicalExchange: "NASDAQ", micCode: "XNAS", country: "United States" },
  XNAS: { canonicalExchange: "NASDAQ", micCode: "XNAS", country: "United States" },
  "NASDAQ GLOBAL SELECT": {
    canonicalExchange: "NASDAQ",
    micCode: "XNAS",
    country: "United States",
  },
  NYSE: { canonicalExchange: "NYSE", micCode: "XNYS", country: "United States" },
  XNYS: { canonicalExchange: "NYSE", micCode: "XNYS", country: "United States" },
  "NEW YORK STOCK EXCHANGE": {
    canonicalExchange: "NYSE",
    micCode: "XNYS",
    country: "United States",
  },
  ARCA: { canonicalExchange: "NYSEARCA", micCode: "ARCX", country: "United States" },
  NYSEARCA: {
    canonicalExchange: "NYSEARCA",
    micCode: "ARCX",
    country: "United States",
  },
  ARCX: { canonicalExchange: "NYSEARCA", micCode: "ARCX", country: "United States" },
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() || "";
}

export function normalizeSecuritySymbol(value: string) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/\.TO$/u, "")
    .replace(/\.V$/u, "")
    .replace(/\.NE$/u, "")
    .replace(/-/gu, ".");
}

export function normalizeSecurityCurrency(value: string | null | undefined): CurrencyCode {
  return value?.trim().toUpperCase() === "USD" ? "USD" : "CAD";
}

export function canonicalizeExchange(input: {
  exchange?: string | null;
  micCode?: string | null;
  currency?: string | null;
}) {
  const exchange = normalizeText(input.exchange).toUpperCase();
  const micCode = normalizeText(input.micCode).toUpperCase();
  const currency = normalizeSecurityCurrency(input.currency);
  const alias = EXCHANGE_ALIASES[micCode] ?? EXCHANGE_ALIASES[exchange];
  if (alias) {
    return alias;
  }

  if (!exchange && currency === "CAD") {
    return { canonicalExchange: "TSX", micCode: "XTSE", country: "Canada" };
  }
  if (!exchange && currency === "USD") {
    return { canonicalExchange: "NASDAQ", micCode: "XNAS", country: "United States" };
  }

  return {
    canonicalExchange: exchange || micCode || "UNKNOWN",
    micCode: micCode || undefined,
    country: undefined,
  };
}

export function buildUnderlyingId(input: {
  symbol: string;
  name?: string | null;
}) {
  const normalizedName = normalizeText(input.name)
    .toUpperCase()
    .replace(/\b(CDR|ETF|INC|CORP|CORPORATION|CLASS|HEDGED|CAD|USD)\b/gu, "")
    .replace(/[^A-Z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  return normalizedName || normalizeSecuritySymbol(input.symbol);
}

function aliasValuesForInput(
  input: CanonicalSecurityIdentityInput,
): Array<{
  aliasType: SecurityAliasRecord["aliasType"];
  aliasValue: string;
  provider: string | null;
}> {
  const aliases: Array<{
    aliasType: SecurityAliasRecord["aliasType"];
    aliasValue: string;
    provider: string | null;
  }> = [];
  const provider = normalizeText(input.provider) || null;
  const exchange = normalizeText(input.exchange);
  const micCode = normalizeText(input.micCode).toUpperCase();
  const providerSymbol = normalizeText(input.providerSymbol);

  if (exchange) {
    aliases.push({
      aliasType: "exchange-label",
      aliasValue: exchange.toUpperCase(),
      provider,
    });
  }
  if (micCode) {
    aliases.push({ aliasType: "mic-code", aliasValue: micCode, provider });
  }
  if (providerSymbol) {
    aliases.push({
      aliasType: "provider-symbol",
      aliasValue: providerSymbol.toUpperCase(),
      provider,
    });
  }

  return aliases;
}

export async function resolveCanonicalSecurityIdentity(
  input: CanonicalSecurityIdentityInput,
): Promise<CanonicalSecurityIdentity> {
  const symbol = normalizeSecuritySymbol(input.symbol);
  if (!symbol) {
    throw new Error("Security symbol is required.");
  }

  const currency = normalizeSecurityCurrency(input.currency);
  const exchange = canonicalizeExchange({
    exchange: input.exchange,
    micCode: input.micCode,
    currency,
  });
  const repositories = getRepositories();
  const inferredMetadata = inferSecurityMetadata({
    symbol,
    name: input.name,
    assetClass: null,
    securityType: input.securityType,
    currency,
  });

  for (const alias of aliasValuesForInput(input).filter(
    (item) => item.aliasType === "provider-symbol",
  )) {
    const existing = await repositories.securities.findByAlias(alias);
    if (existing && existing.symbol === symbol && existing.currency === currency) {
      return existing;
    }
  }

  const existing = await repositories.securities.findByCanonicalIdentity({
    symbol,
    canonicalExchange: exchange.canonicalExchange,
    currency,
  });
  if (existing) {
    return existing;
  }

  const security = await repositories.securities.upsertCanonical({
    symbol,
    canonicalExchange: exchange.canonicalExchange,
    micCode: input.micCode?.trim().toUpperCase() || (exchange.micCode ?? null),
    currency,
    name: normalizeText(input.name) || symbol,
    securityType: normalizeText(input.securityType) || null,
    marketSector: normalizeText(input.marketSector) || null,
    country: normalizeText(input.country) || (exchange.country ?? null),
    underlyingId: buildUnderlyingId({ symbol, name: input.name }),
    economicAssetClass: inferredMetadata.economicAssetClass,
    economicSector: inferredMetadata.economicSector,
    exposureRegion: inferredMetadata.exposureRegion,
    metadataSource: inferredMetadata.source,
    metadataConfidence: inferredMetadata.confidence,
    metadataAsOf: null,
    metadataConfirmedAt: null,
    metadataNotes: null,
  });

  const aliases = [
    ...aliasValuesForInput(input),
    {
      aliasType: "exchange-label" as const,
      aliasValue: exchange.canonicalExchange,
      provider: null,
    },
    ...(exchange.micCode
      ? [
          {
            aliasType: "mic-code" as const,
            aliasValue: exchange.micCode,
            provider: null,
          },
        ]
      : []),
  ];

  for (const alias of aliases) {
    await repositories.securities.addAlias({
      securityId: security.id,
      ...alias,
    });
  }

  return security;
}
