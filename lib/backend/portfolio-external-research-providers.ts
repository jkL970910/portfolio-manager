import {
  AnalyzerSecurityIdentity,
  PortfolioAnalyzerRequest,
} from "@/lib/backend/portfolio-analyzer-contracts";
import {
  ExternalResearchPolicy,
  ExternalResearchSource,
  getExternalResearchPolicy,
} from "@/lib/backend/portfolio-external-research";
import type { ExternalResearchDocument } from "@/lib/backend/external-research-documents";
import { getRepositories } from "@/lib/backend/repositories/factory";

export type ExternalResearchProviderId = ExternalResearchSource["id"];

export interface ExternalResearchProviderInput {
  userId: string;
  request: PortfolioAnalyzerRequest;
  targetKey: string;
  allowedSources: ExternalResearchSource[];
  now: Date;
}

export interface ExternalResearchProviderSource {
  title: string;
  url?: string;
  date?: string;
  sourceType: "market-data" | "news" | "forum" | "institutional";
  providerId: ExternalResearchProviderId;
}

export interface ExternalResearchProviderResult {
  sourceMode: "cached-external";
  externalResearchAsOf: string;
  targetKey: string;
  security?: AnalyzerSecurityIdentity;
  summaryPoints: string[];
  risks: string[];
  sources: ExternalResearchProviderSource[];
  documents?: ExternalResearchDocument[];
}

export interface ExternalResearchProvider {
  id: ExternalResearchProviderId;
  sourceType: ExternalResearchProviderSource["sourceType"];
  enabled(policy: ExternalResearchPolicy): boolean;
  fetch(
    input: ExternalResearchProviderInput,
  ): Promise<ExternalResearchProviderResult>;
}

export class ExternalResearchProviderDisabledError extends Error {
  constructor(message = "External research provider is disabled.") {
    super(message);
    this.name = "ExternalResearchProviderDisabledError";
  }
}

export function getEnabledExternalResearchSources(
  policy = getExternalResearchPolicy(),
) {
  return policy.allowedSources.filter((source) => source.enabled);
}

export function assertProviderInputAllowed(
  input: ExternalResearchProviderInput,
) {
  if (input.allowedSources.length === 0) {
    throw new ExternalResearchProviderDisabledError(
      "External research source allowlist has no enabled sources.",
    );
  }
}

function normalizeNullable(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

function isSourceAllowed(
  input: ExternalResearchProviderInput,
  sourceId: ExternalResearchProviderId,
) {
  return input.allowedSources.some(
    (source) => source.id === sourceId && source.enabled,
  );
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function buildCachedMarketDataDocument(args: {
  input: ExternalResearchProviderInput;
  symbol: string;
  expectedCurrency: string | null;
  expectedExchange: string | null;
  expectedSecurityId: string | null;
  summaryPoints: string[];
  risks: string[];
  matchingHistoryCount: number;
  latestPoint:
    | {
        priceDate: string;
        close: number;
        currency: string;
        source: string;
        provider?: string | null;
        freshness?: string | null;
      }
    | null;
  staleOrFallbackPoints: number;
}): ExternalResearchDocument {
  const requestSecurity = args.input.request.security;
  const ttlSeconds = Math.max(
    args.input.request.maxCacheAgeSeconds ?? getExternalResearchPolicy().defaultTtlSeconds,
    getExternalResearchPolicy().minTtlSeconds,
  );
  const publishedAt = args.latestPoint?.priceDate
    ? `${args.latestPoint.priceDate}T00:00:00.000Z`
    : args.input.now.toISOString();
  const confidence = args.matchingHistoryCount > 0
    ? args.staleOrFallbackPoints > 0
      ? "medium"
      : "high"
    : "low";
  const relevanceScore = args.matchingHistoryCount > 0
    ? args.staleOrFallbackPoints > 0
      ? 65
      : 78
    : 35;

  return {
    id: [
      "market-data",
      args.expectedSecurityId ?? args.symbol,
      args.expectedExchange ?? "unknown-exchange",
      args.expectedCurrency ?? "unknown-currency",
      args.latestPoint?.priceDate ?? args.input.now.toISOString().slice(0, 10),
    ].join(":"),
    userId: args.input.userId,
    sourceType: "market-data",
    providerId: "market-data",
    sourceName: "本地缓存行情",
    title: `${args.symbol} listing 缓存行情快照`,
    summary: args.summaryPoints.slice(0, 4).join(" "),
    url: null,
    publishedAt,
    capturedAt: args.input.now.toISOString(),
    expiresAt: addSeconds(args.input.now, ttlSeconds).toISOString(),
    language: "zh",
    security: {
      securityId: args.expectedSecurityId,
      symbol: args.symbol,
      exchange: args.expectedExchange,
      currency: args.expectedCurrency === "CAD" || args.expectedCurrency === "USD"
        ? args.expectedCurrency
        : null,
      name: requestSecurity?.name ?? null,
      provider: args.latestPoint?.provider ?? args.latestPoint?.source ?? "local-cache",
      securityType: null,
    },
    underlyingId: null,
    confidence,
    sentiment: "neutral",
    relevanceScore,
    sourceReliability: 82,
    keyPoints: args.summaryPoints.slice(0, 6),
    riskFlags: args.risks.slice(0, 6),
    tags: [
      "market-data",
      "quote-cache",
      "listing-identity",
      confidence === "high" ? "fresh-cache" : "limited-cache",
    ],
  };
}

function stringField(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getSecurityName(input: ExternalResearchProviderInput) {
  return input.request.security?.name?.trim() || input.request.security?.symbol || "标的";
}

function normalizeIsoDate(value: string | null, fallback: string) {
  if (!value) {
    return fallback;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return new Date(parsed).toISOString();
}

function buildAlphaVantageProfileDocument(args: {
  input: ExternalResearchProviderInput;
  candidateSymbol: string;
  kind: "company-overview" | "etf-profile";
  payload: Record<string, unknown>;
}): ExternalResearchDocument {
  const requestSecurity = args.input.request.security;
  const ttlSeconds = Math.max(
    args.input.request.maxCacheAgeSeconds ??
      getExternalResearchPolicy().defaultTtlSeconds,
    getExternalResearchPolicy().minTtlSeconds,
  );
  const symbol = normalizeNullable(requestSecurity?.symbol) ?? args.candidateSymbol;
  const name =
    stringField(args.payload, "Name") ??
    stringField(args.payload, "name") ??
    getSecurityName(args.input);
  const sector = stringField(args.payload, "Sector");
  const industry = stringField(args.payload, "Industry");
  const country = stringField(args.payload, "Country");
  const assetType = stringField(args.payload, "AssetType");
  const description = stringField(args.payload, "Description");
  const expenseRatio = stringField(args.payload, "net_expense_ratio");
  const dividendYield =
    stringField(args.payload, "DividendYield") ??
    stringField(args.payload, "dividend_yield");
  const keyPoints = [
    assetType ? `资产类型：${assetType}` : null,
    sector ? `行业板块：${sector}` : null,
    industry ? `细分行业：${industry}` : null,
    country ? `地区：${country}` : null,
    expenseRatio ? `费用率：${expenseRatio}` : null,
    dividendYield ? `分红/收益率：${dividendYield}` : null,
    description ? `资料摘要：${description.slice(0, 160)}` : null,
  ].filter((item): item is string => Boolean(item));
  const riskFlags = [
    args.kind === "etf-profile"
      ? "ETF_PROFILE 只提供基金资料快照，不代表实时买卖建议。"
      : "OVERVIEW 只提供公司基本资料快照，不代表实时买卖建议。",
    "该资料需要结合持仓、目标配置、估值和风险偏好一起判断。",
  ];
  const publishedAt = normalizeIsoDate(
    stringField(args.payload, "LatestQuarter"),
    args.input.now.toISOString(),
  );

  return {
    id: [
      "alpha-vantage-profile",
      requestSecurity?.securityId ?? symbol,
      requestSecurity?.exchange ?? "unknown-exchange",
      requestSecurity?.currency ?? "unknown-currency",
      args.kind,
      args.input.now.toISOString().slice(0, 10),
    ].join(":"),
    userId: args.input.userId,
    sourceType: "institutional",
    providerId: "alpha-vantage-profile",
    sourceName: "Alpha Vantage 标的资料",
    title: `${name} 基本资料快照`,
    summary:
      keyPoints.slice(0, 4).join("；") ||
      `${symbol} 的结构化标的资料已缓存。`,
    url: null,
    publishedAt,
    capturedAt: args.input.now.toISOString(),
    expiresAt: addSeconds(args.input.now, ttlSeconds).toISOString(),
    language: "zh",
    security: {
      securityId: requestSecurity?.securityId ?? null,
      symbol,
      exchange: normalizeNullable(requestSecurity?.exchange),
      currency:
        requestSecurity?.currency === "CAD" || requestSecurity?.currency === "USD"
          ? requestSecurity.currency
          : null,
      name,
      provider: "alpha-vantage-profile",
      securityType: assetType,
    },
    underlyingId: null,
    confidence: keyPoints.length >= 3 ? "high" : "medium",
    sentiment: "neutral",
    relevanceScore: keyPoints.length >= 3 ? 78 : 62,
    sourceReliability: 76,
    keyPoints: keyPoints.slice(0, 8),
    riskFlags,
    tags: [
      "profile",
      "alpha-vantage",
      args.kind,
      requestSecurity?.exchange ? "listing-identity" : "partial-identity",
    ],
  };
}

function firstObjectField(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return Array.isArray(value) && value[0] && typeof value[0] === "object"
    ? (value[0] as Record<string, unknown>)
    : null;
}

function buildAlphaVantageEarningsDocument(args: {
  input: ExternalResearchProviderInput;
  candidateSymbol: string;
  payload: Record<string, unknown>;
}): ExternalResearchDocument {
  const requestSecurity = args.input.request.security;
  const ttlSeconds = Math.max(
    args.input.request.maxCacheAgeSeconds ??
      getExternalResearchPolicy().defaultTtlSeconds,
    getExternalResearchPolicy().minTtlSeconds,
  );
  const symbol = normalizeNullable(requestSecurity?.symbol) ?? args.candidateSymbol;
  const quarterly = firstObjectField(args.payload, "quarterlyEarnings");
  const annual = firstObjectField(args.payload, "annualEarnings");
  const fiscalQuarter = stringField(quarterly ?? {}, "fiscalDateEnding");
  const reportedEps = stringField(quarterly ?? {}, "reportedEPS");
  const estimatedEps = stringField(quarterly ?? {}, "estimatedEPS");
  const surprisePercent = stringField(quarterly ?? {}, "surprisePercentage");
  const annualFiscalDate = stringField(annual ?? {}, "fiscalDateEnding");
  const annualEps = stringField(annual ?? {}, "reportedEPS");
  const keyPoints = [
    fiscalQuarter ? `最近季度截止日：${fiscalQuarter}` : null,
    reportedEps ? `最近季度 EPS：${reportedEps}` : null,
    estimatedEps ? `市场预估 EPS：${estimatedEps}` : null,
    surprisePercent ? `EPS surprise：${surprisePercent}%` : null,
    annualFiscalDate && annualEps
      ? `最近年度 EPS：${annualEps}（${annualFiscalDate}）`
      : null,
  ].filter((item): item is string => Boolean(item));
  const publishedAt = normalizeIsoDate(
    fiscalQuarter ? `${fiscalQuarter}T00:00:00.000Z` : annualFiscalDate,
    args.input.now.toISOString(),
  );

  return {
    id: [
      "alpha-vantage-earnings",
      requestSecurity?.securityId ?? symbol,
      requestSecurity?.exchange ?? "unknown-exchange",
      requestSecurity?.currency ?? "unknown-currency",
      args.input.now.toISOString().slice(0, 10),
    ].join(":"),
    userId: args.input.userId,
    sourceType: "institutional",
    providerId: "alpha-vantage-earnings",
    sourceName: "Alpha Vantage 财报资料",
    title: `${symbol} 财报节奏快照`,
    summary:
      keyPoints.slice(0, 4).join("；") ||
      `${symbol} 的结构化财报资料已缓存。`,
    url: null,
    publishedAt,
    capturedAt: args.input.now.toISOString(),
    expiresAt: addSeconds(args.input.now, ttlSeconds).toISOString(),
    language: "zh",
    security: {
      securityId: requestSecurity?.securityId ?? null,
      symbol,
      exchange: normalizeNullable(requestSecurity?.exchange),
      currency:
        requestSecurity?.currency === "CAD" || requestSecurity?.currency === "USD"
          ? requestSecurity.currency
          : null,
      name: requestSecurity?.name ?? null,
      provider: "alpha-vantage-earnings",
      securityType: requestSecurity?.securityType ?? null,
    },
    underlyingId: null,
    confidence: keyPoints.length >= 3 ? "medium" : "low",
    sentiment: "neutral",
    relevanceScore: keyPoints.length >= 3 ? 68 : 42,
    sourceReliability: 70,
    keyPoints: keyPoints.slice(0, 6),
    riskFlags: [
      "财报资料只说明历史盈利披露，不代表实时买卖建议。",
      "ETF、基金或没有财报披露的标的可能没有可用 earnings 资料。",
      "该资料需要结合持仓、目标配置、估值、现金计划和风险偏好一起判断。",
    ],
    tags: [
      "institutional",
      "alpha-vantage",
      "earnings",
      requestSecurity?.exchange ? "listing-identity" : "partial-identity",
    ],
  };
}

export const cachedMarketDataResearchProvider: ExternalResearchProvider = {
  id: "market-data",
  sourceType: "market-data",
  enabled(policy) {
    return (
      policy.liveProvidersEnabled &&
      policy.adaptersImplemented &&
      policy.allowedSources.some(
        (source) => source.id === "market-data" && source.enabled,
      )
    );
  },
  async fetch(input) {
    if (!isSourceAllowed(input, "market-data")) {
      throw new ExternalResearchProviderDisabledError(
        "Market-data external research source is not allowed for this job.",
      );
    }

    const security = input.request.security;
    const symbol = normalizeNullable(security?.symbol);
    if (!symbol) {
      throw new ExternalResearchProviderDisabledError(
        "Cached market-data research requires a security symbol.",
      );
    }

    const expectedCurrency = normalizeNullable(security?.currency);
    const expectedExchange = normalizeNullable(security?.exchange);
    const expectedSecurityId = security?.securityId?.trim() || null;
    const repositories = getRepositories();
    const [holdings, priceHistory] = await Promise.all([
      repositories.holdings.listByUserId(input.userId),
      expectedSecurityId
        ? repositories.securityPriceHistory.listBySecurityId(expectedSecurityId)
        : expectedExchange && expectedCurrency
        ? repositories.securityPriceHistory.listByIdentity({
            symbol,
            exchange: expectedExchange,
            currency: expectedCurrency,
          })
        : Promise.resolve([]),
    ]);

    const matchingHoldings = holdings.filter((holding) => {
      if (expectedSecurityId) {
        return holding.securityId === expectedSecurityId;
      }
      const holdingSymbol = normalizeNullable(holding.symbol);
      const holdingCurrency = normalizeNullable(holding.currency ?? "CAD");
      const holdingExchange = normalizeNullable(holding.exchangeOverride);
      return (
        holdingSymbol === symbol &&
        (!expectedCurrency || holdingCurrency === expectedCurrency) &&
        (!expectedExchange || holdingExchange === expectedExchange)
      );
    });
    const matchingHistory = priceHistory.filter(
      (point) =>
        (!expectedCurrency ||
          normalizeNullable(point.currency) === expectedCurrency) &&
        (!expectedExchange ||
          normalizeNullable(point.exchange) === expectedExchange),
    );
    const latestPoint = matchingHistory[0] ?? null;
    const staleOrFallbackPoints = matchingHistory.filter((point) =>
      ["stale", "fallback"].includes(point.freshness ?? ""),
    ).length;
    const totalMarketValueCad = matchingHoldings.reduce(
      (sum, holding) => sum + holding.marketValueCad,
      0,
    );

    const summaryPoints = [
      `缓存行情覆盖 ${matchingHistory.length} 条 ${symbol} 价格历史。`,
      latestPoint
        ? `最近缓存收盘价：${latestPoint.currency} ${latestPoint.close.toFixed(2)}，日期 ${latestPoint.priceDate}。`
        : "没有找到匹配币种的缓存价格历史。",
      latestPoint
        ? `缓存来源：${latestPoint.source}；provider=${latestPoint.provider ?? "未知"}；freshness=${latestPoint.freshness ?? "未知"}。`
        : "缓存来源：无可用价格历史。",
      `组合内匹配持仓 ${matchingHoldings.length} 笔，CAD 市值约 ${Math.round(totalMarketValueCad).toLocaleString("en-CA")}。`,
      `身份匹配使用 securityId=${expectedSecurityId ?? "未指定"}, symbol=${symbol}, exchange=${expectedExchange ?? "未指定"}, currency=${expectedCurrency ?? "未指定"}。`,
    ];
    const risks = [
      ...(!expectedSecurityId && (!expectedExchange || !expectedCurrency)
        ? ["缺少 securityId 或完整 listing 身份；已跳过 ticker-only 行情关联，避免 CAD/USD 混淆。"]
        : []),
      ...(matchingHistory.length === 0
        ? ["缓存行情为空；不能把该结果当成实时市场研究。"]
        : []),
      ...(staleOrFallbackPoints > 0
        ? [
            `缓存价格历史中有 ${staleOrFallbackPoints} 条 stale/fallback 点；AI 只能把它当成参考数据。`,
          ]
        : []),
      ...(matchingHoldings.length === 0
        ? ["组合内没有找到完全匹配的持仓；请确认交易所和币种是否正确。"]
        : []),
    ];

    return {
      sourceMode: "cached-external",
      externalResearchAsOf: input.now.toISOString(),
      targetKey: input.targetKey,
      security,
      summaryPoints,
      risks,
      sources: [
        {
          title: "Local cached security price history",
          date: latestPoint?.priceDate,
          sourceType: "market-data",
          providerId: "market-data",
        },
      ],
      documents: [
        buildCachedMarketDataDocument({
          input,
          symbol,
          expectedCurrency,
          expectedExchange,
          expectedSecurityId,
          summaryPoints,
          risks,
          matchingHistoryCount: matchingHistory.length,
          latestPoint,
          staleOrFallbackPoints,
        }),
      ],
    };
  },
};

export const alphaVantageProfileResearchProvider: ExternalResearchProvider = {
  id: "profile",
  sourceType: "institutional",
  enabled(policy) {
    return (
      policy.liveProvidersEnabled &&
      policy.adaptersImplemented &&
      Boolean(process.env.ALPHA_VANTAGE_API_KEY?.trim()) &&
      process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE === "enabled" &&
      policy.allowedSources.some(
        (source) => source.id === "profile" && source.enabled,
      )
    );
  },
  async fetch(input) {
    if (!isSourceAllowed(input, "profile")) {
      throw new ExternalResearchProviderDisabledError(
        "Profile external research source is not allowed for this job.",
      );
    }

    const security = input.request.security;
    const symbol = normalizeNullable(security?.symbol);
    if (!symbol) {
      throw new ExternalResearchProviderDisabledError(
        "Profile external research requires a security symbol.",
      );
    }

    const { getAlphaVantageProfile } = await import(
      "@/lib/market-data/alpha-vantage"
    );
    const profile = await getAlphaVantageProfile(
      symbol,
      security?.exchange,
      security?.currency,
      {
        preferredKind:
          security?.securityType?.toLowerCase().includes("etf") ||
          security?.securityType?.toLowerCase().includes("fund")
            ? "etf-profile"
            : "company-overview",
      },
    );
    if (!profile) {
      throw new ExternalResearchProviderDisabledError(
        "No Alpha Vantage profile payload was available for this security.",
      );
    }

    const document = buildAlphaVantageProfileDocument({
      input,
      candidateSymbol: profile.candidateSymbol,
      kind: profile.kind,
      payload: profile.payload,
    });

    return {
      sourceMode: "cached-external",
      externalResearchAsOf: input.now.toISOString(),
      targetKey: input.targetKey,
      security,
      summaryPoints: document.keyPoints.slice(0, 6),
      risks: document.riskFlags.slice(0, 6),
      sources: [
        {
          title: document.title,
          date: document.publishedAt?.slice(0, 10),
          sourceType: "institutional",
          providerId: "profile",
        },
      ],
      documents: [document],
    };
  },
};

export const alphaVantageInstitutionalResearchProvider: ExternalResearchProvider = {
  id: "institutional",
  sourceType: "institutional",
  enabled(policy) {
    return (
      policy.liveProvidersEnabled &&
      policy.adaptersImplemented &&
      Boolean(process.env.ALPHA_VANTAGE_API_KEY?.trim()) &&
      process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_INSTITUTIONAL ===
        "enabled" &&
      policy.allowedSources.some(
        (source) => source.id === "institutional" && source.enabled,
      )
    );
  },
  async fetch(input) {
    if (!isSourceAllowed(input, "institutional")) {
      throw new ExternalResearchProviderDisabledError(
        "Institutional external research source is not allowed for this job.",
      );
    }

    const security = input.request.security;
    const symbol = normalizeNullable(security?.symbol);
    if (!symbol) {
      throw new ExternalResearchProviderDisabledError(
        "Institutional external research requires a security symbol.",
      );
    }

    const { getAlphaVantageEarnings } = await import(
      "@/lib/market-data/alpha-vantage"
    );
    const earnings = await getAlphaVantageEarnings(
      symbol,
      security?.exchange,
      security?.currency,
    );
    if (!earnings) {
      throw new ExternalResearchProviderDisabledError(
        "No Alpha Vantage earnings payload was available for this security.",
      );
    }

    const document = buildAlphaVantageEarningsDocument({
      input,
      candidateSymbol: earnings.candidateSymbol,
      payload: earnings.payload,
    });

    return {
      sourceMode: "cached-external",
      externalResearchAsOf: input.now.toISOString(),
      targetKey: input.targetKey,
      security,
      summaryPoints: document.keyPoints.slice(0, 6),
      risks: document.riskFlags.slice(0, 6),
      sources: [
        {
          title: document.title,
          date: document.publishedAt?.slice(0, 10),
          sourceType: "institutional",
          providerId: "institutional",
        },
      ],
      documents: [document],
    };
  },
};

export const disabledMarketDataResearchProvider: ExternalResearchProvider = {
  id: "market-data",
  sourceType: "market-data",
  enabled() {
    return false;
  },
  async fetch() {
    throw new ExternalResearchProviderDisabledError(
      "Market-data external research adapter is disabled.",
    );
  },
};

export function getExternalResearchProviders() {
  return [
    alphaVantageProfileResearchProvider,
    alphaVantageInstitutionalResearchProvider,
    cachedMarketDataResearchProvider,
  ];
}

export function getEnabledExternalResearchProviders(
  policy = getExternalResearchPolicy(),
) {
  return getExternalResearchProviders().filter((provider) =>
    provider.enabled(policy),
  );
}

export async function fetchCachedExternalResearch(
  input: ExternalResearchProviderInput,
  policy = getExternalResearchPolicy(),
) {
  assertProviderInputAllowed(input);

  const provider = getEnabledExternalResearchProviders(policy).find((item) =>
    input.allowedSources.some((source) => source.id === item.id),
  );

  if (!provider) {
    throw new ExternalResearchProviderDisabledError(
      "No enabled external research provider is available for this job.",
    );
  }

  return provider.fetch(input);
}
