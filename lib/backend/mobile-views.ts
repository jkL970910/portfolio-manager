import type { ApiSuccess } from "@/lib/backend/contracts";
import type {
  DashboardData,
  ImportData,
  PortfolioAccountDetailData,
  PortfolioData,
  PortfolioHoldingDetailData,
  PortfolioSecurityDetailData,
  RecommendationsData,
} from "@/lib/contracts";
import {
  getDashboardView,
  getImportView,
  getPortfolioAccountDetailView,
  getPortfolioHoldingDetailView,
  getPortfolioSecurityDetailView,
  getPortfolioView,
  getRecommendationView,
} from "@/lib/backend/services";
import { getRepositories } from "@/lib/backend/repositories/factory";
import type {
  ExternalResearchDocumentRecord,
  PortfolioAnalysisRun,
} from "@/lib/backend/models";
import type { Viewer } from "@/lib/auth/session";

type MobileHomeData = {
  viewer: Viewer;
  displayContext: DashboardData["displayContext"];
  metrics: DashboardData["metrics"];
  accounts: Array<{
    id: string;
    name: string;
    caption: string;
    value: string;
    room: string;
    badge: string;
    badgeVariant: "primary" | "success" | "warning" | "neutral";
  }>;
  topHoldings: Array<{
    id: string;
    symbol: string;
    name: string;
    account: string;
    lastPrice: string;
    lastUpdated: string;
    freshnessVariant: "success" | "warning" | "neutral";
    quoteProvider?: string | null;
    quoteSourceMode?: string | null;
    quoteStatus?: string | null;
    quoteStatusLabel?: string;
    weight: string;
    value: string;
  }>;
  netWorthTrend: DashboardData["netWorthTrend"];
  chartSeries?: DashboardData["chartSeries"];
  healthScore: DashboardData["healthScore"];
  recommendation: DashboardData["recommendation"];
  context?: {
    userId: string;
    accountCount: number;
    holdingCount: number;
    viewerName: string;
  };
};

type MobilePortfolioOverviewData = {
  viewer: Viewer;
  displayContext: PortfolioData["displayContext"];
  performance: PortfolioData["performance"];
  chartSeries?: PortfolioData["chartSeries"];
  accountTypeAllocation: PortfolioData["accountTypeAllocation"];
  accountInstanceAllocation: PortfolioData["accountInstanceAllocation"];
  assetClassDrilldown: PortfolioData["assetClassDrilldown"];
  accountCards: Array<{
    id: string;
    name: string;
    typeId: string;
    typeLabel: string;
    institution: string;
    currency: string;
    value: string;
    gainLoss: string;
    share: string;
    room: string;
    topHoldings: string[];
  }>;
  holdings: Array<{
    id: string;
    symbol: string;
    name: string;
    assetClass: string;
    sector: string;
    accountId: string;
    accountType: string;
    account: string;
    quantity: string;
    avgCost: string;
    value: string;
    lastPrice: string;
    lastUpdated: string;
    freshnessVariant: "success" | "warning" | "neutral";
    quoteProvider?: string | null;
    quoteSourceMode?: string | null;
    quoteStatus?: string | null;
    quoteStatusLabel?: string;
    portfolioShare: string;
    accountShare: string;
    gainLoss: string;
    signal: string;
  }>;
  quoteStatus: PortfolioData["quoteStatus"];
  healthScore: PortfolioData["healthScore"];
  summaryPoints: PortfolioData["summaryPoints"];
  context?: {
    totalMarketValueCad: number;
    topHoldingSymbol: string | null;
  };
};

type MobilePortfolioHoldingListItem = Omit<
  PortfolioData["holdings"][number],
  "href" | "securityHref"
>;

type MobilePortfolioAccountDetailData = Omit<
  PortfolioAccountDetailData,
  "holdings" | "trendContext" | "editContext"
> & {
  holdings: MobilePortfolioHoldingListItem[];
};

type MobilePortfolioHoldingDetailData = Omit<
  PortfolioHoldingDetailData,
  "holding" | "editContext"
> & {
  holding: Omit<PortfolioHoldingDetailData["holding"], "accountHref"> & {
    identity: {
      symbol: string;
      exchange: string | null;
      currency: "CAD" | "USD";
    };
  };
};

type MobileSecurityAccountHoldingView = Omit<
  MobilePortfolioHoldingDetailData,
  "displayContext"
>;

type MobilePortfolioSecurityDetailData = Omit<
  PortfolioSecurityDetailData,
  "relatedHoldings" | "heldPosition"
> & {
  relatedHoldings: Array<
    Omit<PortfolioSecurityDetailData["relatedHoldings"][number], "href">
  >;
  heldPosition:
    | null
    | (Omit<
        NonNullable<PortfolioSecurityDetailData["heldPosition"]>,
        "accountViews"
      > & {
        accountViews: MobileSecurityAccountHoldingView[];
      });
};

type MobileRecommendationPriority = Omit<
  RecommendationsData["priorities"][number],
  "securityHref" | "alternativeLinks" | "relatedLinks"
>;

type MobileRecommendationsData = Omit<RecommendationsData, "priorities"> & {
  priorities: MobileRecommendationPriority[];
  preferenceContext: {
    riskProfile: string;
    targetAllocation: { assetClass: string; targetPct: number }[];
    accountFundingPriority: string[];
    taxAwarePlacement: boolean;
    recommendationStrategy: string;
    rebalancingTolerancePct: number;
    watchlistSymbols: string[];
    recommendationConstraints: unknown;
    preferenceFactors: unknown;
  };
};

type MobileImportData = {
  manualSteps: { title: string; description: string }[];
  actionCards: { label: string; title: string; description: string }[];
  existingAccounts: Array<
    ImportData["existingAccounts"][number] & {
      displayName: string;
      value: string;
      detail: string;
    }
  >;
  notes: string[];
};

function mapMobileHomeData(
  viewer: Viewer,
  payload: ApiSuccess<DashboardData & { context?: MobileHomeData["context"] }>,
): MobileHomeData {
  return {
    viewer,
    displayContext: payload.data.displayContext,
    metrics: payload.data.metrics,
    accounts: payload.data.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      caption: account.caption,
      value: account.value,
      room: account.room,
      badge: account.badge,
      badgeVariant: account.badgeVariant,
    })),
    topHoldings: payload.data.topHoldings.map((holding) => ({
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      account: holding.account,
      lastPrice: holding.lastPrice,
      lastUpdated: holding.lastUpdated,
      freshnessVariant: holding.freshnessVariant,
      quoteProvider: holding.quoteProvider,
      quoteSourceMode: holding.quoteSourceMode,
      quoteStatus: holding.quoteStatus,
      quoteStatusLabel: holding.quoteStatusLabel,
      weight: holding.weight,
      value: holding.value,
    })),
    netWorthTrend: payload.data.netWorthTrend,
    chartSeries: payload.data.chartSeries,
    healthScore: payload.data.healthScore,
    recommendation: payload.data.recommendation,
    context: payload.data.context,
  };
}

function mapMobilePortfolioOverviewData(
  viewer: Viewer,
  payload: ApiSuccess<
    PortfolioData & { context?: MobilePortfolioOverviewData["context"] }
  >,
): MobilePortfolioOverviewData {
  return {
    viewer,
    displayContext: payload.data.displayContext,
    performance: payload.data.performance,
    chartSeries: payload.data.chartSeries,
    accountTypeAllocation: payload.data.accountTypeAllocation,
    accountInstanceAllocation: payload.data.accountInstanceAllocation,
    assetClassDrilldown: payload.data.assetClassDrilldown,
    accountCards: payload.data.accountCards.map((account) => ({
      id: account.id,
      name: account.name,
      typeId: account.typeId,
      typeLabel: account.typeLabel,
      institution: account.institution,
      currency: account.currency,
      value: account.value,
      gainLoss: account.gainLoss,
      share: account.share,
      room: account.room,
      topHoldings: account.topHoldings,
    })),
    holdings: payload.data.holdings.map((holding) => ({
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      assetClass: holding.assetClass,
      sector: holding.sector,
      accountId: holding.accountId,
      accountType: holding.accountType,
      account: holding.account,
      quantity: holding.quantity,
      avgCost: holding.avgCost,
      value: holding.value,
      lastPrice: holding.lastPrice,
      lastUpdated: holding.lastUpdated,
      freshnessVariant: holding.freshnessVariant,
      quoteProvider: holding.quoteProvider,
      quoteSourceMode: holding.quoteSourceMode,
      quoteStatus: holding.quoteStatus,
      quoteStatusLabel: holding.quoteStatusLabel,
      portfolioShare: holding.portfolioShare,
      accountShare: holding.accountShare,
      gainLoss: holding.gainLoss,
      signal: holding.signal,
    })),
    quoteStatus: payload.data.quoteStatus,
    healthScore: payload.data.healthScore,
    summaryPoints: payload.data.summaryPoints,
    context: payload.data.context,
  };
}

function mapMobilePortfolioHoldingListItem(
  holding: PortfolioData["holdings"][number],
): MobilePortfolioHoldingListItem {
  return {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    assetClass: holding.assetClass,
    sector: holding.sector,
    accountId: holding.accountId,
    accountType: holding.accountType,
    account: holding.account,
    quantity: holding.quantity,
    avgCost: holding.avgCost,
    value: holding.value,
    lastPrice: holding.lastPrice,
    lastUpdated: holding.lastUpdated,
    freshnessVariant: holding.freshnessVariant,
    portfolioShare: holding.portfolioShare,
    accountShare: holding.accountShare,
    gainLoss: holding.gainLoss,
    signal: holding.signal,
  };
}

function mapMobileAccountDetailData(
  data: PortfolioAccountDetailData,
): MobilePortfolioAccountDetailData {
  return {
    displayContext: data.displayContext,
    account: data.account,
    facts: data.facts,
    performance: data.performance,
    chartSeries: data.chartSeries,
    allocation: data.allocation,
    healthScore: data.healthScore,
    holdings: data.holdings.map(mapMobilePortfolioHoldingListItem),
  };
}

function mapMobileHoldingDetailData(
  data: PortfolioHoldingDetailData,
): MobilePortfolioHoldingDetailData {
  const { accountHref: _accountHref, ...holding } = data.holding;

  return {
    displayContext: data.displayContext,
    holding: {
      ...holding,
      identity: {
        symbol: data.holding.symbol,
        exchange: data.editContext.current.exchangeOverride,
        currency: data.editContext.current.currency,
      },
    },
    facts: data.facts,
    marketData: data.marketData,
    performance: data.performance,
    chartSeries: data.chartSeries,
    portfolioRole: data.portfolioRole,
    healthSummary: data.healthSummary,
  };
}

function mapMobileSecurityAccountHoldingView(
  data: PortfolioHoldingDetailData,
): MobileSecurityAccountHoldingView {
  const { displayContext: _displayContext, ...holdingDetail } =
    mapMobileHoldingDetailData(data);
  return holdingDetail;
}

function mapMobileSecurityDetailData(
  data: PortfolioSecurityDetailData,
): MobilePortfolioSecurityDetailData {
  const chartIdentity = data.chartSeries?.priceHistory?.identity;
  const securityExchange =
    data.security.exchange === "正在识别" ||
    data.security.exchange === "Resolving" ||
    data.security.exchange === "未知交易所" ||
    data.security.exchange === "Unknown exchange"
      ? (chartIdentity?.exchange ?? data.security.exchange)
      : data.security.exchange;

  return {
    displayContext: data.displayContext,
    security: {
      ...data.security,
      exchange: securityExchange,
    },
    facts: data.facts,
    marketData: data.marketData,
    analysis: data.analysis,
    performance: data.performance,
    chartSeries: data.chartSeries,
    summaryPoints: data.summaryPoints,
    relatedHoldings: data.relatedHoldings.map((holding) => {
      const { href: _href, ...rest } = holding;
      return rest;
    }),
    heldPosition: data.heldPosition
      ? {
          aggregate: data.heldPosition.aggregate,
          accountOptions: data.heldPosition.accountOptions,
          accountSummaries: data.heldPosition.accountSummaries,
          accountViews: data.heldPosition.accountViews.map(
            mapMobileSecurityAccountHoldingView,
          ),
        }
      : null,
  };
}

function mapMobileRecommendationsData(
  data: RecommendationsData,
  preferenceContext: MobileRecommendationsData["preferenceContext"],
  intelligenceBriefs: RecommendationsData["intelligenceBriefs"] = [],
): MobileRecommendationsData {
  const externalBriefCount = intelligenceBriefs.filter(
    (brief) => brief.sourceMode !== "local",
  ).length;
  return {
    ...data,
    engine: {
      ...data.engine,
      version: externalBriefCount > 0
        ? "V3 Overlay / V2.1 Core"
        : data.engine.version,
      objective: externalBriefCount > 0
        ? `${data.engine.objective} · 已接入 ${externalBriefCount} 条缓存外部情报`
        : data.engine.objective,
    },
    intelligenceBriefs,
    preferenceContext,
    priorities: data.priorities.map((priority) => {
      const {
        securityHref: _securityHref,
        alternativeLinks: _alternativeLinks,
        relatedLinks: _relatedLinks,
        ...rest
      } = priority;
      const intelligenceRefs = mapRecommendationIntelligenceRefs(
        rest,
        intelligenceBriefs,
      );
      const v3Overlay = buildRecommendationV3Overlay(
        rest,
        intelligenceRefs,
        intelligenceBriefs,
      );
      return {
        ...rest,
        v3Overlay,
        constraints: [
          ...rest.constraints,
          ...(intelligenceRefs.length > 0
            ? [
                {
                  label: "外部情报覆盖",
                  detail:
                    `已关联 ${intelligenceRefs.length} 条缓存秘闻；V3 外部情报分 ${v3Overlay?.externalInsightScore?.toFixed(0) ?? "--"}/100，最终分 ${v3Overlay?.finalScore.toFixed(0) ?? "--"}/100。`,
                  variant: "success" as const,
                },
              ]
            : [
                {
                  label: "外部情报覆盖",
                  detail:
                    "当前推荐没有匹配到同一 listing 的缓存秘闻；排序仍基于 V2.1 规则和已保存偏好。",
                  variant: "neutral" as const,
                },
              ]),
        ],
        intelligenceRefs,
      };
    }),
  };
}

export function mapRecommendationIntelligenceRefs(
  priority: Pick<
    RecommendationsData["priorities"][number],
    | "security"
    | "securityId"
    | "securitySymbol"
    | "securityExchange"
    | "securityCurrency"
    | "tickers"
  >,
  intelligenceBriefs: RecommendationsData["intelligenceBriefs"],
): RecommendationsData["priorities"][number]["intelligenceRefs"] {
  const exactSecurityRefs = priority.securityId
    ? intelligenceBriefs.filter((brief) =>
        brief.identity.securityId === priority.securityId
      )
    : [];
  const exactListingRefs = exactSecurityRefs.length > 0
    ? exactSecurityRefs
    : intelligenceBriefs.filter((brief) =>
        briefMatchesPriorityListing(brief, priority)
      );
  if (exactListingRefs.length > 0) {
    return exactListingRefs.slice(0, 2).map((brief) =>
      mapIntelligenceBriefRef(brief, "listing")
    );
  }

  const symbols = getRecommendationPrioritySymbols(priority);
  if (symbols.size === 0) {
    return [];
  }

  return intelligenceBriefs
    .filter((brief) =>
      symbols.has(normalizeSymbolKey(brief.identity.symbol)),
    )
    .slice(0, 2)
    .map((brief) => mapIntelligenceBriefRef(brief, "underlying"));
}

function mapIntelligenceBriefRef(
  brief: RecommendationsData["intelligenceBriefs"][number],
  scope: RecommendationsData["priorities"][number]["intelligenceRefs"][number]["scope"],
) {
  return {
    id: brief.id,
    title: brief.title,
    detail: brief.detail,
    sourceLabel: brief.sourceLabel,
    freshnessLabel: brief.freshnessLabel,
    scope,
    scopeLabel: scope === "underlying"
      ? "底层资产情报"
      : "当前上市版本情报",
    listingLabel: getBriefListingLabel(brief),
  };
}

export function buildRecommendationV3Overlay(
  priority: RecommendationsData["priorities"][number],
  intelligenceRefs: RecommendationsData["priorities"][number]["intelligenceRefs"],
  intelligenceBriefs: RecommendationsData["intelligenceBriefs"],
): RecommendationsData["priorities"][number]["v3Overlay"] {
  const base = priority.v3Overlay;
  if (!base) {
    return undefined;
  }

  if (intelligenceRefs.length === 0) {
    return base;
  }

  const matchedBriefs = intelligenceRefs
    .map((ref) => intelligenceBriefs.find((brief) => brief.id === ref.id))
    .filter((brief): brief is RecommendationsData["intelligenceBriefs"][number] =>
      Boolean(brief)
    );
  const hasListingRef = intelligenceRefs.some((ref) => ref.scope === "listing");
  const hasExternalRef = matchedBriefs.some((brief) =>
    brief.sourceMode !== "local"
  );
  const newestGeneratedAt = matchedBriefs
    .map((brief) => Date.parse(brief.generatedAt))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0];
  const ageDays = newestGeneratedAt
    ? Math.max(0, (Date.now() - newestGeneratedAt) / 86_400_000)
    : null;
  const stalePenalty = ageDays == null
    ? 6
    : ageDays > 14
      ? 14
      : ageDays > 7
        ? 8
        : ageDays > 2
          ? 4
          : 0;
  const scopeBoost = hasListingRef ? 10 : 3;
  const sourceBoost = hasExternalRef ? 8 : 2;
  const externalInsightScore = clampScore(
    50 + scopeBoost + sourceBoost - stalePenalty,
  );
  const preferenceFitScore = base.preferenceFitScore ?? base.baselineScore;
  const finalScore = clampScore(
    base.baselineScore * 0.7 +
      preferenceFitScore * 0.15 +
      externalInsightScore * 0.15,
  );
  const riskFlags = [
    ...base.riskFlags,
    ...(!hasListingRef ? ["仅匹配到底层资产情报，不能当作当前 listing 报价依据。"] : []),
    ...(stalePenalty >= 8 ? ["外部情报较旧，需要刷新后再作为高权重参考。"] : []),
  ];

  return {
    ...base,
    externalInsightScore,
    finalScore,
    confidenceLabel: hasListingRef
      ? "V3 已按当前上市版本缓存情报校准"
      : "V3 仅按底层资产情报轻量校准",
    sourceMode: hasExternalRef ? "cached-external" : "local",
    signals: [
      ...base.signals,
      hasListingRef ? "当前 listing 情报命中" : "底层资产情报命中",
      hasExternalRef ? "缓存外部研究可用" : "本地 AI 快扫可用",
    ],
    riskFlags,
    explanation:
      `V3 最终分 = V2.1 基线 ${base.baselineScore.toFixed(0)} * 70% + 偏好契合 ${preferenceFitScore.toFixed(0)} * 15% + 外部情报 ${externalInsightScore.toFixed(0)} * 15%。`,
  };
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function briefMatchesPriorityListing(
  brief: RecommendationsData["intelligenceBriefs"][number],
  priority: Pick<
    RecommendationsData["priorities"][number],
    "securitySymbol" | "securityExchange" | "securityCurrency"
  >,
) {
  if (!priority.securitySymbol) {
    return false;
  }
  const sameSymbol =
    normalizeSymbolKey(brief.identity.symbol) ===
    normalizeSymbolKey(priority.securitySymbol);
  const sameExchange = priority.securityExchange
    ? normalizeSymbolKey(brief.identity.exchange ?? "") ===
      normalizeSymbolKey(priority.securityExchange)
    : false;
  const sameCurrency = priority.securityCurrency
    ? normalizeSymbolKey(brief.identity.currency ?? "") ===
      normalizeSymbolKey(priority.securityCurrency)
    : false;
  return sameSymbol && sameExchange && sameCurrency;
}

function getBriefListingLabel(
  brief: RecommendationsData["intelligenceBriefs"][number],
) {
  return [
    brief.identity.symbol,
    brief.identity.exchange,
    brief.identity.currency,
  ].filter(Boolean).join(" · ");
}

function getRecommendationPrioritySymbols(
  priority: Pick<
    RecommendationsData["priorities"][number],
    "security" | "tickers"
  >,
) {
  const symbols = new Set<string>();
  const leadSymbol = priority.security.split(/\s|-/)[0];
  const candidates = [
    leadSymbol,
    ...priority.tickers.split(/[,\s/]+/),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSymbolKey(candidate);
    if (normalized) {
      symbols.add(normalized);
    }
  }

  return symbols;
}

function normalizeSymbolKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.:-]/g, "");
}

function readResultMap(run: PortfolioAnalysisRun) {
  return run.result && typeof run.result === "object"
    ? run.result
    : {};
}

function readNestedMap(value: unknown) {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

function mapRecommendationIntelligenceBriefs(
  runs: PortfolioAnalysisRun[],
): RecommendationsData["intelligenceBriefs"] {
  return runs.slice(0, 5).map((run) => {
    const result = readResultMap(run);
    const summary = readNestedMap(result.summary);
    const dataFreshness = readNestedMap(result.dataFreshness);
    const identity = readNestedMap(result.identity);
    const rawSources = Array.isArray(result.sources) ? result.sources : [];
    const symbol =
      typeof identity.symbol === "string" && identity.symbol.trim()
        ? identity.symbol.trim().toUpperCase()
        : "UNKNOWN";
    const securityId =
      typeof identity.securityId === "string" && identity.securityId.trim()
        ? identity.securityId.trim()
        : undefined;
    const exchange =
      typeof identity.exchange === "string" && identity.exchange.trim()
        ? identity.exchange.trim().toUpperCase()
        : undefined;
    const currency =
      typeof identity.currency === "string" && identity.currency.trim()
        ? identity.currency.trim().toUpperCase()
        : undefined;
    const symbols = [
      symbol,
      exchange,
      currency,
    ].filter((value): value is string => Boolean(value));
    const sourceMode =
      run.sourceMode === "cached-external" || run.sourceMode === "live-external"
        ? run.sourceMode
        : "local";
    const sourceLabel = sourceMode === "cached-external"
      ? "缓存外部情报"
      : sourceMode === "live-external"
        ? "实时外部情报"
        : "本地快扫";
    const quotesAsOf =
      typeof dataFreshness.quotesAsOf === "string"
        ? dataFreshness.quotesAsOf
        : null;
    const quoteSource =
      typeof dataFreshness.quoteSourceSummary === "string"
        ? dataFreshness.quoteSourceSummary
        : null;
    const freshnessLabel = [
      quotesAsOf ? `行情 ${quotesAsOf.slice(0, 10)}` : null,
      quoteSource,
    ].filter(Boolean).join(" · ") || "暂无行情新鲜度";

    return {
      id: run.id,
      title:
        typeof summary.title === "string" && summary.title.trim()
          ? summary.title
          : "Loo国秘闻",
      detail:
        typeof summary.thesis === "string" && summary.thesis.trim()
          ? summary.thesis
          : "这条情报来自已缓存的分析记录。",
      sourceLabel,
      sourceMode,
      freshnessLabel,
      generatedAt: run.generatedAt,
      symbols,
      identity: {
        securityId,
        symbol,
        exchange,
        currency,
      },
      sources: rawSources.slice(0, 4).map((source) => {
        const value = readNestedMap(source);
        return {
          title:
            typeof value.title === "string" && value.title.trim()
              ? value.title
              : "来源",
          sourceType:
            typeof value.sourceType === "string"
              ? value.sourceType
              : "portfolio-data",
          date: typeof value.date === "string" ? value.date : undefined,
        };
      }),
    };
  });
}

function mapExternalResearchDocumentBriefs(
  documents: ExternalResearchDocumentRecord[],
): RecommendationsData["intelligenceBriefs"] {
  return documents.slice(0, 8).map((document) => {
    const security = document.security;
    const symbol = security?.symbol?.trim().toUpperCase() || "UNKNOWN";
    const exchange = security?.exchange?.trim().toUpperCase() || undefined;
    const currency =
      security?.currency === "CAD" || security?.currency === "USD"
        ? security.currency
        : undefined;
    const sourceLabelMap: Record<
      ExternalResearchDocumentRecord["sourceType"],
      string
    > = {
      "market-data": "缓存行情情报",
      news: "缓存新闻/公告",
      forum: "社区情绪（低权重）",
      institutional: "缓存机构资料",
      manual: "手动研究记录",
    };
    const freshnessLabel = [
      document.publishedAt
        ? `来源 ${document.publishedAt.slice(0, 10)}`
        : `捕获 ${document.capturedAt.slice(0, 10)}`,
      `过期 ${document.expiresAt.slice(0, 10)}`,
      `可信度 ${document.confidence}`,
    ].join(" · ");

    return {
      id: `doc:${document.id}`,
      title: document.title,
      detail: document.summary,
      sourceLabel: sourceLabelMap[document.sourceType],
      sourceMode: "cached-external",
      freshnessLabel,
      generatedAt: document.capturedAt,
      symbols: [symbol, exchange, currency].filter(
        (value): value is string => Boolean(value),
      ),
      identity: {
        securityId: security?.securityId ?? undefined,
        symbol,
        exchange,
        currency,
      },
      sources: [
        {
          title: document.sourceName,
          sourceType: document.sourceType,
          date:
            document.publishedAt?.slice(0, 10) ??
            document.capturedAt.slice(0, 10),
        },
      ],
    };
  });
}

function mapMobileImportData(data: ImportData): MobileImportData {
  return {
    manualSteps: [
      {
        title: "先创建账户",
        description: "选择账户类型、币种和机构，把 Loo国资产桶先放对位置。",
      },
      {
        title: "再添加持仓",
        description:
          "为账户添加股票、ETF、现金或贵金属持仓，保留原始交易币种。",
      },
      {
        title: "检查成本和市值",
        description:
          "确认数量、成本、当前价格和市场归属，避免 CAD/USD 混在一起。",
      },
      {
        title: "保存后回到组合",
        description: "保存后可直接回组合页、详情页和推荐页继续分析。",
      },
    ],
    actionCards: [
      {
        label: "账户",
        title: "添加账户",
        description: "新增 TFSA、RRSP、Taxable、FHSA 或其它投资账户。",
      },
      {
        label: "持仓",
        title: "添加持仓",
        description: "在已有账户下录入标的、数量、成本、币种和市场。",
      },
      {
        label: "检查",
        title: "复核现有账户",
        description: "先看当前账户清单，再决定补哪个账户或持仓。",
      },
    ],
    existingAccounts: data.existingAccounts.map((account) => ({
      ...account,
      displayName: account.nickname || account.institution || account.type,
      value: new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }).format(account.marketValueCad),
      detail: [account.type, account.institution, account.currency]
        .filter(Boolean)
        .join(" · "),
    })),
    notes: [
      "移动端 MVP 只保留手动/引导式导入，不迁移 CSV 上传和字段映射。",
      "CSV 批量导入后续可作为桌面高级功能保留。",
      ...data.portfolioSuccessStates.slice(0, 2),
    ],
  };
}

export async function getMobileHomeView(userId: string, viewer: Viewer) {
  const payload = await getDashboardView(userId);
  return {
    data: mapMobileHomeData(viewer, payload),
    meta: payload.meta,
  };
}

export async function getMobilePortfolioOverviewView(
  userId: string,
  viewer: Viewer,
) {
  const payload = await getPortfolioView(userId);
  return {
    data: mapMobilePortfolioOverviewData(viewer, payload),
    meta: payload.meta,
  };
}

export async function getMobilePortfolioAccountDetailView(
  userId: string,
  accountId: string,
) {
  const payload = await getPortfolioAccountDetailView(userId, accountId);
  return {
    data: payload.data.data
      ? mapMobileAccountDetailData(payload.data.data)
      : null,
    meta: payload.meta,
  };
}

export async function getMobilePortfolioHoldingDetailView(
  userId: string,
  holdingId: string,
) {
  const payload = await getPortfolioHoldingDetailView(userId, holdingId);
  return {
    data: payload.data.data
      ? mapMobileHoldingDetailData(payload.data.data)
      : null,
    meta: payload.meta,
  };
}

export async function getMobilePortfolioSecurityDetailView(
  userId: string,
  symbol: string,
  identity?: {
    securityId?: string | null;
    exchange?: string | null;
    currency?: "CAD" | "USD" | null;
  },
) {
  const payload = await getPortfolioSecurityDetailView(
    userId,
    symbol,
    identity,
  );
  return {
    data: payload.data.data
      ? mapMobileSecurityDetailData(payload.data.data)
      : null,
    meta: payload.meta,
  };
}

export async function getMobileRecommendationsView(userId: string) {
  const now = new Date();
  const [payload, profile, analysisRuns, externalDocuments] = await Promise.all([
    getRecommendationView(userId),
    getRepositories().preferences.getByUserId(userId),
    getRepositories().analysisRuns.listRecentByUserId(userId, 5),
    getRepositories().externalResearchDocuments.listFreshByUserId(userId, {
      now,
      limit: 8,
    }),
  ]);
  const intelligenceBriefs = [
    ...mapExternalResearchDocumentBriefs(externalDocuments),
    ...mapRecommendationIntelligenceBriefs(analysisRuns),
  ];
  return {
    data: mapMobileRecommendationsData(payload.data, {
      riskProfile: profile.riskProfile,
      targetAllocation: profile.targetAllocation,
      accountFundingPriority: profile.accountFundingPriority,
      taxAwarePlacement: profile.taxAwarePlacement,
      recommendationStrategy: profile.recommendationStrategy,
      rebalancingTolerancePct: profile.rebalancingTolerancePct,
      watchlistSymbols: profile.watchlistSymbols,
      recommendationConstraints: profile.recommendationConstraints,
      preferenceFactors: profile.preferenceFactors,
    }, intelligenceBriefs),
    meta: payload.meta,
  };
}

export async function getMobileImportView(userId: string) {
  const payload = await getImportView(userId);
  return {
    data: mapMobileImportData(payload.data),
    meta: payload.meta,
  };
}
