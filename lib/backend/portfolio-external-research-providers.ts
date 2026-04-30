import {
  AnalyzerSecurityIdentity,
  PortfolioAnalyzerRequest,
} from "@/lib/backend/portfolio-analyzer-contracts";
import {
  ExternalResearchPolicy,
  ExternalResearchSource,
  getExternalResearchPolicy,
} from "@/lib/backend/portfolio-external-research";
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

    return {
      sourceMode: "cached-external",
      externalResearchAsOf: input.now.toISOString(),
      targetKey: input.targetKey,
      security,
      summaryPoints: [
        `缓存行情覆盖 ${matchingHistory.length} 条 ${symbol} 价格历史。`,
        latestPoint
          ? `最近缓存收盘价：${latestPoint.currency} ${latestPoint.close.toFixed(2)}，日期 ${latestPoint.priceDate}。`
          : "没有找到匹配币种的缓存价格历史。",
        latestPoint
          ? `缓存来源：${latestPoint.source}；provider=${latestPoint.provider ?? "未知"}；freshness=${latestPoint.freshness ?? "未知"}。`
          : "缓存来源：无可用价格历史。",
        `组合内匹配持仓 ${matchingHoldings.length} 笔，CAD 市值约 ${Math.round(totalMarketValueCad).toLocaleString("en-CA")}。`,
        `身份匹配使用 securityId=${expectedSecurityId ?? "未指定"}, symbol=${symbol}, exchange=${expectedExchange ?? "未指定"}, currency=${expectedCurrency ?? "未指定"}。`,
      ],
      risks: [
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
      ],
      sources: [
        {
          title: "Local cached security price history",
          date: latestPoint?.priceDate,
          sourceType: "market-data",
          providerId: "market-data",
        },
      ],
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
  return [cachedMarketDataResearchProvider];
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
