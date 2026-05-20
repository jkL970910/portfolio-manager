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
  getCitizenProfile,
  getImportView,
  getPortfolioAccountDetailView,
  getPortfolioHoldingDetailView,
  getPortfolioSecurityDetailView,
  getPortfolioView,
  getRecommendationView,
} from "@/lib/backend/services";
import { getRepositories } from "@/lib/backend/repositories/factory";
import {
  getDailyIntelligenceItemsForUser,
  mapDailyIntelligenceItemToRecommendationBrief,
} from "@/lib/backend/mobile-daily-intelligence";
import {
  getOrCreateLatestMarketSentiment,
  mapMarketSentimentForMobileWithIndexes,
} from "@/lib/backend/market-sentiment";
import {
  getExternalResearchPolicy,
  mapExternalResearchPolicyForMobile,
} from "@/lib/backend/portfolio-external-research";
import { buildRecommendationV4Visibility } from "@/lib/backend/recommendation-v4/visibility";
import type { RecommendationV4Visibility } from "@/lib/backend/recommendation-v4/types";
import {
  getMobileExternalResearchUsage,
  mapExternalResearchJobForMobile,
} from "@/lib/backend/external-research-jobs";
import type { Viewer } from "@/lib/auth/session";
import type {
  CitizenProfile,
  ExternalResearchDocumentRecord,
  HoldingPosition,
  MobileSecurityObservation,
  PreferenceProfile,
  RecommendationRun,
  SecurityPriceHistoryPoint,
} from "@/lib/backend/models";

type MobileHomeData = {
  viewer: Viewer;
  citizenProfile: CitizenProfile;
  displayContext: DashboardData["displayContext"];
  metrics: DashboardData["metrics"];
  accounts: Array<{
    id: string;
    name: string;
    caption: string;
    value: string;
    gainLoss: string;
    room: string;
    badge: string;
    badgeVariant: "primary" | "success" | "warning" | "neutral";
  }>;
  topHoldings: Array<{
    id: string;
    securityId?: string | null;
    symbol: string;
    name: string;
    account: string;
    accountCount?: string;
    lotCount?: string;
    currency?: "CAD" | "USD";
    exchange?: string | null;
    lastPrice: string;
    lastUpdated: string;
    freshnessVariant: "success" | "warning" | "neutral";
    quoteProvider?: string | null;
    quoteSourceMode?: string | null;
    quoteStatus?: string | null;
    quoteStatusLabel?: string;
    weight: string;
    value: string;
    gainLoss: string;
  }>;
  netWorthTrend: DashboardData["netWorthTrend"];
  chartSeries?: DashboardData["chartSeries"];
  healthScore: DashboardData["healthScore"];
  recommendation: DashboardData["recommendation"];
  marketSentiment?: NonNullable<DashboardData["marketSentiment"]>;
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
  securityHoldings: Array<{
    id: string;
    securityId?: string | null;
    symbol: string;
    name: string;
    assetClass: string;
    sector: string;
    currency: "CAD" | "USD";
    exchange?: string | null;
    account: string;
    accountCount: string;
    lotCount: string;
    quantity: string;
    avgCost: string;
    costBasis: string;
    value: string;
    lastPrice: string;
    lastUpdated: string;
    freshnessVariant: "success" | "warning" | "neutral";
    quoteProvider?: string | null;
    quoteSourceMode?: string | null;
    quoteStatus?: string | null;
    quoteStatusLabel?: string;
    portfolioShare: string;
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
  researchRefreshActions: MobileResearchRefreshAction[];
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

type MobileResearchRefreshAction = {
  id: "quote-history" | "profile" | "institutional";
  label: string;
  detail: string;
  providerLabel: string | null;
  estimatedCalls: number;
  quotaLabel: string | null;
  enabled: boolean;
  disabledReason: string | null;
  sourceId: "market-data" | "profile" | "institutional" | null;
  cache: {
    status:
      | "unknown"
      | "missing"
      | "fresh"
      | "stale"
      | "no-data"
      | "limited"
      | "not-applicable";
    label: string;
    detail: string;
    lastUpdatedAt: string | null;
    ttlLabel: string | null;
    confirmationRequired: boolean;
    confirmationMessage: string | null;
  };
};

function isFundLikeSecurity(data: PortfolioSecurityDetailData) {
  const raw = [
    data.security.securityType,
    data.security.assetClass,
    data.security.name,
    data.security.sector,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  return raw.includes("etf") || raw.includes("fund");
}

function parseMobileDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatMobileTtl(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) {
    return null;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} 分钟`;
  }
  if (seconds < 86400) {
    return `${Math.round(seconds / 3600)} 小时`;
  }
  return `${Math.round(seconds / 86400)} 天`;
}

function getResearchActionCache(input: {
  latestJob: ReturnType<typeof mapExternalResearchJobForMobile> | null;
  freshDocument: ExternalResearchDocumentRecord | null;
  ttlSeconds: number;
  providerLabel: string;
  estimatedCalls: number;
  now: Date;
}) {
  const {
    latestJob,
    freshDocument,
    ttlSeconds,
    providerLabel,
    estimatedCalls,
    now,
  } = input;
  if (freshDocument) {
    const remainingSeconds = Math.max(
      1,
      Math.ceil((Date.parse(freshDocument.expiresAt) - now.getTime()) / 1000),
    );
    const ttlLabel = formatMobileTtl(remainingSeconds);
    return {
      status: "fresh" as const,
      label: "资料仍有效",
      detail: `已有 ${freshDocument.sourceName} 资料，约 ${ttlLabel ?? "一段时间"} 后过期。`,
      lastUpdatedAt: freshDocument.capturedAt,
      ttlLabel,
      confirmationRequired: true,
      confirmationMessage: `${providerLabel} 资料仍在有效期内。继续刷新预计消耗 ${estimatedCalls} 次 provider 调用，是否仍继续？`,
    };
  }

  if (!latestJob) {
    return {
      status: "missing" as const,
      label: "未见最近刷新",
      detail: "点击后会提交后台任务。",
      lastUpdatedAt: null,
      ttlLabel: formatMobileTtl(ttlSeconds),
      confirmationRequired: false,
      confirmationMessage: null,
    };
  }

  const lastUpdatedAt =
    latestJob.finishedAt ?? latestJob.startedAt ?? latestJob.createdAt ?? null;
  const lastDate = parseMobileDate(lastUpdatedAt);
  const freshUntil =
    lastDate && latestJob.status === "succeeded"
      ? new Date(lastDate.getTime() + ttlSeconds * 1000)
      : null;
  const fresh =
    freshUntil !== null &&
    Number.isFinite(freshUntil.getTime()) &&
    freshUntil > now;
  const resultKind = String(latestJob.resultKind ?? "");

  if (fresh) {
    const ttlLabel = formatMobileTtl(
      Math.ceil((freshUntil.getTime() - now.getTime()) / 1000),
    );
    return {
      status: "fresh" as const,
      label: "资料仍有效",
      detail: `已有可用缓存，约 ${ttlLabel ?? "一段时间"} 后过期。`,
      lastUpdatedAt,
      ttlLabel,
      confirmationRequired: true,
      confirmationMessage: `${providerLabel} 资料仍在有效期内。继续刷新预计消耗 ${estimatedCalls} 次 provider 调用，是否仍继续？`,
    };
  }

  if (resultKind === "provider_limited") {
    return {
      status: "limited" as const,
      label: "来源额度暂不可用",
      detail: latestJob.resultDetail ?? "provider 当前限流或额度不可用。",
      lastUpdatedAt,
      ttlLabel: formatMobileTtl(ttlSeconds),
      confirmationRequired: false,
      confirmationMessage: null,
    };
  }

  if (resultKind === "not_applicable") {
    return {
      status: "not-applicable" as const,
      label: "这类资料不适用",
      detail: latestJob.resultDetail ?? "该资料不适用于这类标的。",
      lastUpdatedAt,
      ttlLabel: formatMobileTtl(ttlSeconds),
      confirmationRequired: false,
      confirmationMessage: null,
    };
  }

  if (resultKind === "no_data" || latestJob.status === "skipped") {
    return {
      status: "no-data" as const,
      label: latestJob.resultLabel ?? "来源暂无资料",
      detail:
        latestJob.resultDetail ??
        latestJob.statusNote ??
        "本次没有写入新资料。",
      lastUpdatedAt,
      ttlLabel: formatMobileTtl(ttlSeconds),
      confirmationRequired: false,
      confirmationMessage: null,
    };
  }

  return {
    status: "stale" as const,
    label: latestJob.resultLabel ?? latestJob.statusLabel ?? "缓存需刷新",
    detail:
      latestJob.resultDetail ?? latestJob.statusNote ?? "可以重新刷新资料。",
    lastUpdatedAt,
    ttlLabel: formatMobileTtl(ttlSeconds),
    confirmationRequired: false,
    confirmationMessage: null,
  };
}

export function buildMobileResearchRefreshActions(input: {
  data: PortfolioSecurityDetailData;
  jobs: ReturnType<typeof mapExternalResearchJobForMobile>[];
  freshDocuments?: ExternalResearchDocumentRecord[];
  policy: ReturnType<typeof getExternalResearchPolicy>;
  usage: Awaited<
    ReturnType<typeof getMobileExternalResearchUsage>
  >["data"]["usage"];
  now: Date;
}): MobileResearchRefreshAction[] {
  const { data, jobs, freshDocuments = [], policy, usage, now } = input;
  const mobilePolicy = mapExternalResearchPolicyForMobile(policy);
  const ttlSeconds = policy.defaultTtlSeconds;
  const quotaLabel = `外部资料额度剩余 ${usage.remainingRuns} / ${usage.dailyRunLimit}`;
  const canUseExternalResearch =
    mobilePolicy.canRunLiveResearch &&
    policy.securityManualRefreshEnabled &&
    usage.remainingRuns > 0;
  const chartIdentity = data.chartSeries?.priceHistory?.identity;
  const rawExchange = data.security.exchange.trim();
  const resolvedExchange =
    rawExchange === "正在识别" ||
    rawExchange === "Resolving" ||
    rawExchange === "未知交易所" ||
    rawExchange === "Unknown exchange"
      ? (chartIdentity?.exchange ?? rawExchange)
      : rawExchange;
  const rawCurrency = data.security.currency.trim();
  const resolvedCurrency =
    rawCurrency === "正在识别" ||
    rawCurrency === "Resolving" ||
    rawCurrency === "未知币种" ||
    rawCurrency === "Unknown currency"
      ? (chartIdentity?.currency ?? rawCurrency)
      : rawCurrency;
  const symbol = data.security.symbol.trim().toUpperCase();
  const exchange = resolvedExchange.trim().toUpperCase();
  const currency = resolvedCurrency.trim().toUpperCase();
  const securityId = data.security.securityId?.trim() ?? "";

  function latestFor(sourceId: "profile" | "institutional") {
    function isFreshSucceededJob(
      job: ReturnType<typeof mapExternalResearchJobForMobile>,
    ) {
      const lastUpdatedAt =
        job.finishedAt ?? job.startedAt ?? job.createdAt ?? null;
      const lastDate = parseMobileDate(lastUpdatedAt);
      if (!lastDate || job.status !== "succeeded") {
        return false;
      }
      const freshUntil = new Date(lastDate.getTime() + ttlSeconds * 1000);
      return Number.isFinite(freshUntil.getTime()) && freshUntil > now;
    }

    function matchesSecurityIdentity(
      job: ReturnType<typeof mapExternalResearchJobForMobile>,
    ) {
      const identity = job.identity;
      const jobSecurityId = identity?.securityId?.trim() ?? "";
      const jobSymbol = identity?.symbol?.trim().toUpperCase() ?? "";
      const jobExchange = identity?.exchange?.trim().toUpperCase() ?? "";
      const jobCurrency = identity?.currency?.trim().toUpperCase() ?? "";
      const targetKey = job.targetKey.trim().toUpperCase();
      const targetSecurityId = securityId.trim().toUpperCase();
      const securityIdMatches =
        Boolean(securityId && jobSecurityId && jobSecurityId === securityId) ||
        Boolean(targetSecurityId && targetKey.includes(targetSecurityId));
      const listingMatches =
        jobSymbol === symbol &&
        (!jobExchange || jobExchange === exchange) &&
        (!jobCurrency || jobCurrency === currency);
      const targetListingMatches =
        targetKey.includes(`:${symbol}:`) &&
        (!exchange || targetKey.includes(`:${exchange}:`)) &&
        (!currency || targetKey.includes(`:${currency}`));

      return securityIdMatches || listingMatches || targetListingMatches;
    }

    const matchingJobs = jobs.filter((job) => {
      if (!job.sourceIds.includes(sourceId)) {
        return false;
      }
      return matchesSecurityIdentity(job);
    });
    return (
      matchingJobs.find((job) => isFreshSucceededJob(job)) ??
      matchingJobs[0] ??
      null
    );
  }

  function freshDocumentFor(sourceId: "profile" | "institutional") {
    const providerIds =
      sourceId === "profile"
        ? new Set(["alpha-vantage-profile", "eodhd-profile"])
        : new Set(["alpha-vantage-earnings"]);
    return (
      freshDocuments.find((document) => providerIds.has(document.providerId)) ??
      null
    );
  }

  const fundLike = isFundLikeSecurity(data);
  const profileProviderLabel = fundLike ? "EODHD（待接入）" : "Alpha Vantage";
  const profileEnabled =
    !fundLike &&
    canUseExternalResearch &&
    policy.allowedSources.some(
      (source) => source.id === "profile" && source.enabled,
    );
  const institutionalEnabled =
    !fundLike &&
    canUseExternalResearch &&
    policy.allowedSources.some(
      (source) => source.id === "institutional" && source.enabled,
    );

  return [
    {
      id: "quote-history",
      label: "刷新报价与走势",
      detail: "刷新报价、历史走势和图表缓存；不消耗外部资料额度。",
      providerLabel: "行情 provider",
      estimatedCalls: 0,
      quotaLabel: null,
      enabled: true,
      disabledReason: null,
      sourceId: "market-data",
      cache: {
        status: "unknown",
        label: data.security.quoteStatusLabel ?? "报价状态待确认",
        detail: "报价刷新使用行情链路，和外部研究额度分开计算。",
        lastUpdatedAt: null,
        ttlLabel: null,
        confirmationRequired: false,
        confirmationMessage: null,
      },
    },
    {
      id: "profile",
      label: fundLike ? "刷新 ETF 资料" : "刷新基本资料",
      detail: fundLike
        ? "ETF/基金资料优先使用 EODHD；未配置前不会伪装成可用。"
        : "目标价、PE、Beta、市值、52周区间等估值证据。",
      providerLabel: profileProviderLabel,
      estimatedCalls: 1,
      quotaLabel,
      enabled: profileEnabled,
      disabledReason: profileEnabled
        ? null
        : fundLike
          ? "ETF 资料源 EODHD 尚未配置；不会消耗 Alpha Vantage 额度。"
          : mobilePolicy.canRunLiveResearch
            ? "基本资料来源当前不可用或今日额度已用完。"
            : "外部资料来源尚未完整启用。",
      sourceId: "profile",
      cache: getResearchActionCache({
        latestJob: latestFor("profile"),
        freshDocument: freshDocumentFor("profile"),
        ttlSeconds,
        providerLabel: profileProviderLabel,
        estimatedCalls: 1,
        now,
      }),
    },
    {
      id: "institutional",
      label: "刷新财报资料",
      detail: "公司 EPS / earnings 披露资料；ETF/基金不适用。",
      providerLabel: "Alpha Vantage",
      estimatedCalls: 1,
      quotaLabel,
      enabled: institutionalEnabled,
      disabledReason: fundLike
        ? "ETF/基金通常没有公司财报或 EPS 披露。"
        : institutionalEnabled
          ? null
          : mobilePolicy.canRunLiveResearch
            ? "财报资料来源当前不可用或今日额度已用完。"
            : "外部资料来源尚未完整启用。",
      sourceId: "institutional",
      cache: fundLike
        ? {
            status: "not-applicable",
            label: "这类资料不适用",
            detail: "ETF/基金通常没有公司财报或 EPS 披露。",
            lastUpdatedAt: null,
            ttlLabel: formatMobileTtl(ttlSeconds),
            confirmationRequired: false,
            confirmationMessage: null,
          }
        : getResearchActionCache({
            latestJob: latestFor("institutional"),
            freshDocument: freshDocumentFor("institutional"),
            ttlSeconds,
            providerLabel: "Alpha Vantage",
            estimatedCalls: 1,
            now,
          }),
    },
  ];
}

type MobileRecommendationPriority = Omit<
  RecommendationsData["priorities"][number],
  "securityHref" | "alternativeLinks" | "relatedLinks"
>;

type MobileRecommendationsData = Omit<RecommendationsData, "priorities"> & {
  priorities: MobileRecommendationPriority[];
  watchlistMarketItems: MobileRecommendationMarketItem[];
  recentObservationItems: MobileRecommendationMarketItem[];
  engineSummary: MobileRecommendationEngineSummary;
  recommendationV4: RecommendationV4Visibility;
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

type MobileRecommendationEngineSummary = {
  title: string;
  summary: string;
  chips: string[];
  rankingInputs: { label: string; value: string }[];
  preferenceFactors: {
    label: string;
    value: string;
    tone?: "neutral" | "warning" | "success";
  }[];
  guardrails: {
    label: string;
    value: string;
    tone?: "neutral" | "warning" | "success";
  }[];
};

type MobileRecommendationMarketItem = {
  key: string;
  symbol: string;
  name: string;
  exchange: string | null;
  currency: "CAD" | "USD" | null;
  securityId?: string | null;
  poolStatus:
    | "eligible"
    | "watch_only"
    | "needs_identity"
    | "needs_data"
    | "excluded";
  poolStatusLabel: string;
  poolStatusDetail: string;
  lastPriceLabel: string;
  dayChangeLabel: string;
  dayChangePctLabel: string;
  dayChangeVariant: "positive" | "negative" | "neutral" | "unavailable";
  freshnessLabel: string;
};

type MobileImportData = {
  manualSteps: { title: string; description: string }[];
  actionCards: { label: string; title: string; description: string }[];
  brokerageProviders: {
    id: "ibkr-flex" | "snaptrade";
    name: string;
    status: "ready-to-build" | "feasibility-check";
    statusLabel: string;
    description: string;
    primaryUse: string;
    setupItems: string[];
    limitations: string[];
  }[];
  existingAccounts: Array<
    ImportData["existingAccounts"][number] & {
      displayName: string;
      value: string;
      detail: string;
      holdingCount: number;
    }
  >;
  notes: string[];
};

async function mapMobileHomeData(
  viewer: Viewer,
  payload: ApiSuccess<DashboardData & { context?: MobileHomeData["context"] }>,
): Promise<MobileHomeData> {
  const marketSentiment = await getOrCreateLatestMarketSentiment();
  const citizenProfile = await getCitizenProfile(viewer.id);
  return {
    viewer,
    citizenProfile,
    displayContext: payload.data.displayContext,
    metrics: payload.data.metrics,
    accounts: payload.data.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      caption: account.caption,
      value: account.value,
      gainLoss: account.gainLoss,
      room: account.room,
      badge: account.badge,
      badgeVariant: account.badgeVariant,
    })),
    topHoldings: payload.data.topHoldings.map((holding) => ({
      id: holding.id,
      securityId: holding.securityId,
      symbol: holding.symbol,
      name: holding.name,
      account: holding.account,
      accountCount: holding.accountCount,
      lotCount: holding.lotCount,
      currency: holding.currency,
      exchange: holding.exchange,
      lastPrice: holding.lastPrice,
      lastUpdated: holding.lastUpdated,
      freshnessVariant: holding.freshnessVariant,
      quoteProvider: holding.quoteProvider,
      quoteSourceMode: holding.quoteSourceMode,
      quoteStatus: holding.quoteStatus,
      quoteStatusLabel: holding.quoteStatusLabel,
      weight: holding.weight,
      value: holding.value,
      gainLoss: holding.gainLoss,
    })),
    netWorthTrend: payload.data.netWorthTrend,
    chartSeries: payload.data.chartSeries,
    healthScore: payload.data.healthScore,
    recommendation: payload.data.recommendation,
    marketSentiment:
      await mapMarketSentimentForMobileWithIndexes(marketSentiment),
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
      securityId: holding.securityId,
      symbol: holding.symbol,
      name: holding.name,
      assetClass: holding.assetClass,
      sector: holding.sector,
      currency: holding.currency,
      exchange: holding.exchange,
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
    securityHoldings: payload.data.securityHoldings.map((holding) => ({
      id: holding.id,
      securityId: holding.securityId,
      symbol: holding.symbol,
      name: holding.name,
      assetClass: holding.assetClass,
      sector: holding.sector,
      currency: holding.currency,
      exchange: holding.exchange,
      account: holding.account,
      accountCount: holding.accountCount,
      lotCount: holding.lotCount,
      quantity: holding.quantity,
      avgCost: holding.avgCost,
      costBasis: holding.costBasis,
      value: holding.value,
      lastPrice: holding.lastPrice,
      lastUpdated: holding.lastUpdated,
      freshnessVariant: holding.freshnessVariant,
      quoteProvider: holding.quoteProvider,
      quoteSourceMode: holding.quoteSourceMode,
      quoteStatus: holding.quoteStatus,
      quoteStatusLabel: holding.quoteStatusLabel,
      portfolioShare: holding.portfolioShare,
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
    securityId: holding.securityId,
    symbol: holding.symbol,
    name: holding.name,
    assetClass: holding.assetClass,
    sector: holding.sector,
    currency: holding.currency,
    exchange: holding.exchange,
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
  researchRefreshActions: MobileResearchRefreshAction[] = [],
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
    researchRefreshActions,
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

async function mapMobileRecommendationsData(
  data: RecommendationsData,
  profile: PreferenceProfile,
  intelligenceBriefs: RecommendationsData["intelligenceBriefs"] = [],
  userId: string,
  observations: MobileSecurityObservation[] = [],
): Promise<MobileRecommendationsData> {
  const preferenceContext: MobileRecommendationsData["preferenceContext"] = {
    riskProfile: profile.riskProfile,
    targetAllocation: profile.targetAllocation,
    accountFundingPriority: profile.accountFundingPriority,
    taxAwarePlacement: profile.taxAwarePlacement,
    recommendationStrategy: profile.recommendationStrategy,
    rebalancingTolerancePct: profile.rebalancingTolerancePct,
    watchlistSymbols: profile.watchlistSymbols,
    recommendationConstraints: profile.recommendationConstraints,
    preferenceFactors: profile.preferenceFactors,
  };
  const externalBriefCount = intelligenceBriefs.filter(
    (brief) => brief.sourceMode !== "local",
  ).length;
  const marketItems = await buildMobileRecommendationMarketItems({
    userId,
    watchlistSymbols: preferenceContext.watchlistSymbols,
    priorities: data.priorities,
    observations,
  });
  const recommendationContext = await loadRecommendationV4Context({
    userId,
    observations,
  });
  return {
    ...data,
    engine: {
      ...data.engine,
      version:
        externalBriefCount > 0 ? "V3 Overlay / V2.1 Core" : data.engine.version,
      objective:
        externalBriefCount > 0
          ? `${data.engine.objective} · 已接入 ${externalBriefCount} 条缓存外部情报`
          : data.engine.objective,
    },
    intelligenceBriefs,
    watchlistMarketItems: marketItems.watchlistMarketItems,
    recentObservationItems: marketItems.recentObservationItems,
    recommendationV4: buildRecommendationV4Visibility({
      data,
      profile,
      observations,
      ...recommendationContext,
    }),
    engineSummary: buildMobileRecommendationEngineSummary({
      data,
      preferenceContext,
      externalBriefCount,
    }),
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
                  detail: `已关联 ${intelligenceRefs.length} 条缓存秘闻；V3 外部情报分 ${v3Overlay?.externalInsightScore?.toFixed(0) ?? "--"}/100，最终分 ${v3Overlay?.finalScore.toFixed(0) ?? "--"}/100。`,
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
        candidateBrief: attachDailyBriefToCandidateBrief(
          rest.candidateBrief,
          intelligenceBriefs,
        ),
      };
    }),
  };
}

function attachDailyBriefToCandidateBrief(
  brief: RecommendationsData["priorities"][number]["candidateBrief"],
  intelligenceBriefs: RecommendationsData["intelligenceBriefs"],
) {
  if (!brief || brief.dailyBriefId) {
    return brief;
  }
  const match = intelligenceBriefs.find((document) => {
    if (
      brief.identity.securityId &&
      document.identity.securityId === brief.identity.securityId
    ) {
      return true;
    }
    return (
      document.identity.symbol?.trim().toUpperCase() ===
        brief.identity.symbol.trim().toUpperCase() &&
      document.identity.exchange?.trim().toUpperCase() ===
        brief.identity.exchange?.trim().toUpperCase() &&
      document.identity.currency === brief.identity.currency
    );
  });
  return {
    ...brief,
    dailyBriefId: match?.id ?? null,
  };
}

async function buildMobileRecommendationMarketItems(input: {
  userId: string;
  watchlistSymbols: string[];
  priorities: RecommendationsData["priorities"];
  observations: MobileSecurityObservation[];
}): Promise<{
  watchlistMarketItems: MobileRecommendationMarketItem[];
  recentObservationItems: MobileRecommendationMarketItem[];
}> {
  const repositories = getRepositories();
  const holdings = await repositories.holdings.listByUserId(input.userId);
  const watchlistMarketItems = await Promise.all(
    input.watchlistSymbols.slice(0, 12).map((key) =>
      buildMobileRecommendationMarketItem({
        key,
        identity: parseRecommendationMarketIdentity(key),
        holdings,
      }),
    ),
  );
  const seenRecent = new Set<string>();
  const recentCandidates = input.observations
    .filter((observation) => observation.symbol.trim().length > 0)
    .map((observation) => ({
      key: [
        observation.symbol,
        observation.exchange ?? "",
        observation.currency ?? "",
      ]
        .filter(Boolean)
        .join(":"),
      identity: {
        symbol: observation.symbol,
        exchange: observation.exchange ?? null,
        currency: observation.currency ?? null,
        securityId: observation.securityId ?? null,
        name: observation.name ?? observation.symbol,
      },
    }))
    .filter((candidate) => {
      if (seenRecent.has(candidate.key)) {
        return false;
      }
      seenRecent.add(candidate.key);
      return true;
    })
    .slice(0, 8);
  const recentObservationItems = await Promise.all(
    recentCandidates.map((candidate) =>
      buildMobileRecommendationMarketItem({
        key: candidate.key,
        identity: candidate.identity,
        holdings,
        recommended: true,
      }),
    ),
  );
  return { watchlistMarketItems, recentObservationItems };
}

async function loadRecommendationV4Context(input: {
  userId: string;
  observations: MobileSecurityObservation[];
}) {
  const repositories = getRepositories();
  const holdings = await repositories.holdings.listByUserId(input.userId);
  const securities = await repositories.securities.listByIds([
    ...holdings
      .map((holding) => holding.securityId)
      .filter((id): id is string => Boolean(id)),
    ...input.observations
      .map((observation) => observation.securityId)
      .filter((id): id is string => Boolean(id)),
  ]);
  return { holdings, securities };
}

function buildMobileRecommendationEngineSummary(input: {
  data: RecommendationsData;
  preferenceContext: MobileRecommendationsData["preferenceContext"];
  externalBriefCount: number;
}): MobileRecommendationEngineSummary {
  const factors = input.preferenceContext.preferenceFactors as
    | Record<string, unknown>
    | null
    | undefined;
  const constraints = input.preferenceContext.recommendationConstraints as
    | Record<string, unknown>
    | null
    | undefined;
  const targetLine = input.preferenceContext.targetAllocation
    .map((target) => `${target.assetClass} ${target.targetPct}%`)
    .join(" · ");
  return {
    title: "推荐引擎",
    summary: "按目标缺口、账户顺序、税务放置、偏好因子和护栏排序。",
    chips: [
      riskProfileLabel(input.preferenceContext.riskProfile),
      input.preferenceContext.taxAwarePlacement ? "税务感知" : "税务中性",
      `再平衡 ${input.preferenceContext.rebalancingTolerancePct}%`,
      input.externalBriefCount > 0 ? "外部秘闻参与" : "本地规则",
    ],
    rankingInputs: [
      { label: "本轮银两", value: input.data.contributionAmount },
      {
        label: "推荐策略",
        value: input.preferenceContext.recommendationStrategy,
      },
      {
        label: "账户顺序",
        value:
          input.preferenceContext.accountFundingPriority.join(" -> ") ||
          "未设置",
      },
      { label: "目标配置", value: targetLine || "未设置" },
    ],
    preferenceFactors: [
      {
        label: "风险容量",
        value: factorLevelLabel(
          readNestedString(factors, ["behavior", "riskCapacity"]),
        ),
      },
      {
        label: "波动承受",
        value: factorLevelLabel(
          readNestedString(factors, ["behavior", "volatilityComfort"]),
        ),
      },
      {
        label: "集中度容忍",
        value: factorLevelLabel(
          readNestedString(factors, ["behavior", "concentrationTolerance"]),
        ),
      },
      {
        label: "行业倾向",
        value:
          readNestedStringList(factors, ["sectorTilts", "preferredSectors"])
            .slice(0, 3)
            .join("、") || "未设置",
      },
      {
        label: "避开行业",
        value:
          readNestedStringList(factors, ["sectorTilts", "avoidedSectors"])
            .slice(0, 3)
            .join("、") || "未设置",
        tone: readNestedStringList(factors, ["sectorTilts", "avoidedSectors"])
          .length
          ? "warning"
          : "neutral",
      },
      {
        label: "买房目标",
        value: readNestedBoolean(factors, [
          "lifeGoals",
          "homePurchase",
          "enabled",
        ])
          ? `开启 · ${factorLevelLabel(
              readNestedString(factors, [
                "lifeGoals",
                "homePurchase",
                "priority",
              ]),
            )}`
          : "未开启",
      },
      {
        label: "流动性需求",
        value: factorLevelLabel(
          readNestedString(factors, ["liquidity", "liquidityNeed"]),
        ),
      },
      {
        label: "外部情报",
        value:
          [
            readNestedBoolean(factors, ["externalInfo", "allowNewsSignals"])
              ? "新闻"
              : null,
            readNestedBoolean(factors, [
              "externalInfo",
              "allowInstitutionalSignals",
            ])
              ? "机构"
              : null,
            readNestedBoolean(factors, [
              "externalInfo",
              "allowCommunitySignals",
            ])
              ? "社区"
              : null,
          ]
            .filter(Boolean)
            .join(" / ") || "关闭",
      },
    ],
    guardrails: [
      {
        label: "偏好标的",
        value:
          readStringList(constraints?.preferredSymbols)
            .slice(0, 4)
            .join("、") || "未设置",
        tone: readStringList(constraints?.preferredSymbols).length
          ? "success"
          : "neutral",
      },
      {
        label: "排除标的",
        value:
          readStringList(constraints?.excludedSymbols).slice(0, 4).join("、") ||
          "未设置",
        tone: readStringList(constraints?.excludedSymbols).length
          ? "warning"
          : "neutral",
      },
      {
        label: "偏好账户",
        value:
          readStringList(constraints?.preferredAccountTypes).join(" -> ") ||
          "未设置",
      },
      {
        label: "避开账户",
        value:
          readStringList(constraints?.avoidAccountTypes).join("、") || "未设置",
        tone: readStringList(constraints?.avoidAccountTypes).length
          ? "warning"
          : "neutral",
      },
      {
        label: "允许类型",
        value:
          readStringList(constraints?.allowedSecurityTypes).join("、") ||
          "未限制",
      },
    ],
  };
}

function riskProfileLabel(value: string) {
  return value === "Conservative"
    ? "保守"
    : value === "Growth"
      ? "成长"
      : "平衡";
}

function factorLevelLabel(value: string | null) {
  return value === "low"
    ? "低"
    : value === "high"
      ? "高"
      : value === "medium"
        ? "中"
        : "未设置";
}

function readNestedString(
  object: Record<string, unknown> | null | undefined,
  path: string[],
) {
  const value = readNestedValue(object, path);
  return typeof value === "string" ? value : null;
}

function readNestedBoolean(
  object: Record<string, unknown> | null | undefined,
  path: string[],
) {
  return readNestedValue(object, path) === true;
}

function readNestedStringList(
  object: Record<string, unknown> | null | undefined,
  path: string[],
) {
  return readStringList(readNestedValue(object, path));
}

function readNestedValue(
  object: Record<string, unknown> | null | undefined,
  path: string[],
): unknown {
  let current: unknown = object;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseRecommendationMarketIdentity(key: string): {
  symbol: string;
  exchange: string | null;
  currency: "CAD" | "USD" | null;
  securityId: null;
  name: string;
} {
  const parts = key
    .split(":")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  const currency = parts[2] === "USD" || parts[2] === "CAD" ? parts[2] : null;
  return {
    symbol: parts[0] ?? "",
    exchange: parts[1] ?? null,
    currency,
    securityId: null,
    name: "",
  };
}

async function buildMobileRecommendationMarketItem(input: {
  key: string;
  identity: {
    symbol: string;
    exchange?: string | null;
    currency?: "CAD" | "USD" | null;
    securityId?: string | null;
    name?: string | null;
  };
  holdings: HoldingPosition[];
  recommended?: boolean;
}): Promise<MobileRecommendationMarketItem> {
  const identity = normalizeRecommendationMarketIdentity(
    input.identity,
    input.holdings,
  );
  const history = await getRecommendationMarketHistory(identity);
  const latestHistory = history[0] ?? null;
  const previousHistory = history[1] ?? null;
  const holdingQuote = getRecommendationHoldingQuote(identity, input.holdings);
  const latestPrice = latestHistory?.close ?? holdingQuote?.price ?? null;
  const previousPrice = previousHistory?.close ?? null;
  const dayChange =
    latestPrice != null && previousPrice != null
      ? latestPrice - previousPrice
      : null;
  const dayChangePct =
    dayChange != null && previousPrice && previousPrice > 0
      ? (dayChange / previousPrice) * 100
      : null;
  const currency =
    latestHistory?.currency ??
    identity.currency ??
    holdingQuote?.currency ??
    null;
  const hasCleanIdentity = Boolean(
    identity.symbol && identity.exchange && currency,
  );
  const hasMarketData = latestPrice != null;
  const poolStatus =
    input.recommended
      ? "eligible"
      : !hasCleanIdentity
        ? "needs_identity"
        : !hasMarketData
          ? "needs_data"
          : "watch_only";
  const poolCopy = recommendationPoolStatusCopy(poolStatus);
  return {
    key: input.key,
    symbol: identity.symbol,
    name: identity.name || identity.symbol,
    exchange: identity.exchange,
    currency,
    securityId: identity.securityId,
    poolStatus,
    poolStatusLabel: poolCopy.label,
    poolStatusDetail: poolCopy.detail,
    lastPriceLabel:
      latestPrice == null
        ? "--"
        : formatRecommendationPrice(latestPrice, currency),
    dayChangeLabel:
      dayChange == null
        ? "待刷新"
        : `${dayChange >= 0 ? "+" : ""}${dayChange.toFixed(2)}`,
    dayChangePctLabel:
      dayChangePct == null
        ? "今日涨跌待刷新"
        : `${dayChangePct >= 0 ? "+" : ""}${dayChangePct.toFixed(2)}%`,
    dayChangeVariant:
      dayChange == null
        ? "unavailable"
        : dayChange > 0
          ? "positive"
          : dayChange < 0
            ? "negative"
            : "neutral",
    freshnessLabel:
      latestHistory?.priceDate ?? holdingQuote?.asOf ?? "暂无缓存行情",
  };
}

function recommendationPoolStatusCopy(
  status: MobileRecommendationMarketItem["poolStatus"],
) {
  switch (status) {
    case "eligible":
      return {
        label: "已进推荐池",
        detail: "已通过本轮进货规则筛选，参与优先级排序。",
      };
    case "watch_only":
      return {
        label: "暂不推荐",
        detail: "已在囤货清单，可进入研究台；是否进货仍由护栏和缺口决定。",
      };
    case "needs_identity":
      return {
        label: "资料待确认",
        detail: "缺少交易所或币种，暂不进入推荐池。",
      };
    case "needs_data":
      return {
        label: "待刷新资料",
        detail: "身份已确认，但缺少可用行情或资料，暂不参与排序。",
      };
    case "excluded":
      return {
        label: "规则已排除",
        detail: "被当前进货规矩排除，不参与本轮推荐。",
      };
  }
}

function normalizeRecommendationMarketIdentity(
  identity: {
    symbol: string;
    exchange?: string | null;
    currency?: "CAD" | "USD" | null;
    securityId?: string | null;
    name?: string | null;
  },
  holdings: HoldingPosition[],
) {
  const symbol = identity.symbol.trim().toUpperCase();
  const matchingHolding = holdings.find((holding) =>
    holdingMatchesRecommendationIdentity(holding, {
      symbol,
      exchange: identity.exchange ?? null,
      currency: identity.currency ?? null,
      securityId: identity.securityId ?? null,
    }),
  );
  return {
    symbol,
    exchange:
      identity.exchange?.trim().toUpperCase() ||
      matchingHolding?.exchangeOverride ||
      matchingHolding?.quoteExchange ||
      null,
    currency:
      identity.currency ??
      matchingHolding?.quoteCurrency ??
      matchingHolding?.currency ??
      null,
    securityId: identity.securityId ?? matchingHolding?.securityId ?? null,
    name: identity.name || matchingHolding?.name || symbol,
  };
}

async function getRecommendationMarketHistory(identity: {
  symbol: string;
  exchange: string | null;
  currency: "CAD" | "USD" | null;
  securityId: string | null;
}) {
  const repository = getRepositories().securityPriceHistory;
  if (identity.securityId) {
    const bySecurityId = await repository.listBySecurityId(identity.securityId);
    if (bySecurityId.length > 0) {
      return bySecurityId.slice(0, 2);
    }
  }
  if (identity.exchange) {
    const byIdentity = await repository.listByIdentity({
      symbol: identity.symbol,
      exchange: identity.exchange,
      currency: identity.currency ?? undefined,
    });
    if (byIdentity.length > 0) {
      return byIdentity.slice(0, 2);
    }
  }
  return (await repository.listBySymbol(identity.symbol))
    .filter((point) =>
      identity.currency ? point.currency === identity.currency : true,
    )
    .slice(0, 2);
}

function getRecommendationHoldingQuote(
  identity: {
    symbol: string;
    exchange: string | null;
    currency: "CAD" | "USD" | null;
    securityId: string | null;
  },
  holdings: HoldingPosition[],
) {
  const matchingHolding = holdings.find((holding) =>
    holdingMatchesRecommendationIdentity(holding, identity),
  );
  if (!matchingHolding?.lastPriceAmount && !matchingHolding?.lastPriceCad) {
    return null;
  }
  return {
    price:
      matchingHolding.lastPriceAmount ?? matchingHolding.lastPriceCad ?? null,
    currency:
      matchingHolding.quoteCurrency ??
      matchingHolding.currency ??
      identity.currency ??
      null,
    asOf:
      matchingHolding.quoteProviderTimestamp ??
      matchingHolding.lastQuoteSuccessAt ??
      matchingHolding.updatedAt ??
      null,
  };
}

function holdingMatchesRecommendationIdentity(
  holding: HoldingPosition,
  identity: {
    symbol: string;
    exchange: string | null;
    currency: "CAD" | "USD" | null;
    securityId: string | null;
  },
) {
  if (identity.securityId && holding.securityId === identity.securityId) {
    return true;
  }
  if (holding.symbol.trim().toUpperCase() !== identity.symbol) {
    return false;
  }
  const holdingExchange = (
    holding.exchangeOverride ??
    holding.quoteExchange ??
    ""
  )
    .trim()
    .toUpperCase();
  if (
    identity.exchange &&
    holdingExchange &&
    holdingExchange !== identity.exchange
  ) {
    return false;
  }
  if (
    identity.currency &&
    holding.currency &&
    holding.currency !== identity.currency &&
    holding.quoteCurrency !== identity.currency
  ) {
    return false;
  }
  return true;
}

function formatRecommendationPrice(
  value: number,
  currency: SecurityPriceHistoryPoint["currency"] | null,
) {
  const prefix = currency === "USD" ? "US$" : currency === "CAD" ? "C$" : "";
  return `${prefix}${value.toFixed(value >= 100 ? 2 : 2)}`;
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
    ? intelligenceBriefs.filter(
        (brief) => brief.identity.securityId === priority.securityId,
      )
    : [];
  const exactListingRefs =
    exactSecurityRefs.length > 0
      ? exactSecurityRefs
      : intelligenceBriefs.filter((brief) =>
          briefMatchesPriorityListing(brief, priority),
        );
  if (exactListingRefs.length > 0) {
    return [
      ...exactListingRefs
        .slice(0, 2)
        .map((brief) => mapIntelligenceBriefRef(brief, "listing")),
      ...getMarketSentimentBriefRefs(intelligenceBriefs),
    ].slice(0, 3);
  }

  const symbols = getRecommendationPrioritySymbols(priority);
  if (symbols.size === 0) {
    return getMarketSentimentBriefRefs(intelligenceBriefs);
  }

  return [
    ...intelligenceBriefs
      .filter((brief) => symbols.has(normalizeSymbolKey(brief.identity.symbol)))
      .slice(0, 2)
      .map((brief) => mapIntelligenceBriefRef(brief, "underlying")),
    ...getMarketSentimentBriefRefs(intelligenceBriefs),
  ].slice(0, 3);
}

function getMarketSentimentBriefRefs(
  intelligenceBriefs: RecommendationsData["intelligenceBriefs"],
) {
  return intelligenceBriefs
    .filter((brief) => brief.id.startsWith("sentiment:"))
    .slice(0, 1)
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
    scopeLabel: scope === "underlying" ? "底层资产情报" : "当前上市版本情报",
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
    .filter(
      (brief): brief is RecommendationsData["intelligenceBriefs"][number] =>
        Boolean(brief),
    );
  const hasListingRef = intelligenceRefs.some((ref) => ref.scope === "listing");
  const hasMarketSentimentRef = matchedBriefs.some((brief) =>
    brief.id.startsWith("sentiment:"),
  );
  const hasExternalRef = matchedBriefs.some(
    (brief) => brief.sourceMode !== "local" && brief.sourceMode !== "derived",
  );
  const newestGeneratedAt = matchedBriefs
    .map((brief) => Date.parse(brief.generatedAt))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0];
  const ageDays = newestGeneratedAt
    ? Math.max(0, (Date.now() - newestGeneratedAt) / 86_400_000)
    : null;
  const stalePenalty =
    ageDays == null
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
  const documentEvidenceScores = matchedBriefs
    .map((brief) =>
      getBriefEvidenceScore(brief, {
        scopeBoost,
        sourceBoost,
        stalePenalty,
      }),
    )
    .filter((value): value is number => value != null);
  const externalInsightScore =
    documentEvidenceScores.length > 0
      ? clampScore(
          documentEvidenceScores.reduce((sum, value) => sum + value, 0) /
            documentEvidenceScores.length,
        )
      : clampScore(50 + scopeBoost + sourceBoost - stalePenalty);
  const preferenceFitScore = base.preferenceFitScore ?? base.baselineScore;
  const finalScore = clampScore(
    base.baselineScore * 0.7 +
      preferenceFitScore * 0.15 +
      externalInsightScore * 0.15,
  );
  const marketSentimentSignals = matchedBriefs
    .filter((brief) => brief.id.startsWith("sentiment:"))
    .flatMap((brief) => [
      `市场脉搏：${brief.title.replace(/^今日市场脉搏：/, "")}`,
      brief.detail,
    ])
    .slice(0, 2);
  const riskFlags = [
    ...base.riskFlags,
    ...matchedBriefs.flatMap((brief) => brief.riskFlags ?? []).slice(0, 3),
    ...(!hasListingRef
      ? ["仅匹配到底层资产情报，不能当作当前 listing 报价依据。"]
      : []),
    ...(stalePenalty >= 8
      ? ["外部情报较旧，需要刷新后再作为高权重参考。"]
      : []),
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
      hasExternalRef ? "缓存外部研究可用" : "本地智能快扫可用",
      ...(hasMarketSentimentRef ? marketSentimentSignals : []),
    ],
    riskFlags,
    explanation: `V3 最终分 = V2.1 基线 ${base.baselineScore.toFixed(0)} * 70% + 偏好契合 ${preferenceFitScore.toFixed(0)} * 15% + 外部情报 ${externalInsightScore.toFixed(0)} * 15%。`,
  };
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function getBriefEvidenceScore(
  brief: RecommendationsData["intelligenceBriefs"][number],
  context: {
    scopeBoost: number;
    sourceBoost: number;
    stalePenalty: number;
  },
) {
  if (
    typeof brief.relevanceScore !== "number" ||
    typeof brief.sourceReliability !== "number"
  ) {
    return null;
  }
  const confidenceBoost =
    brief.confidence === "high" ? 12 : brief.confidence === "medium" ? 6 : 0;
  const riskPenalty = Math.min((brief.riskFlags ?? []).length * 4, 12);
  return clampScore(
    brief.relevanceScore * 0.45 +
      brief.sourceReliability * 0.25 +
      confidenceBoost +
      context.scopeBoost +
      context.sourceBoost -
      context.stalePenalty -
      riskPenalty,
  );
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
  ]
    .filter(Boolean)
    .join(" · ");
}

function getRecommendationPrioritySymbols(
  priority: Pick<
    RecommendationsData["priorities"][number],
    "security" | "tickers"
  >,
) {
  const symbols = new Set<string>();
  const leadSymbol = priority.security.split(/\s|-/)[0];
  const candidates = [leadSymbol, ...priority.tickers.split(/[,\s/]+/)];

  for (const candidate of candidates) {
    const normalized = normalizeSymbolKey(candidate);
    if (normalized) {
      symbols.add(normalized);
    }
  }

  return symbols;
}

function normalizeSymbolKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.:-]/g, "");
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
        label: "券商",
        title: "券商同步",
        description:
          "统一入口：先支持 IBKR Flex，Wealthsimple 走 SnapTrade 可行性验证。",
      },
      {
        label: "检查",
        title: "复核现有账户",
        description: "先看当前账户清单，再决定补哪个账户或持仓。",
      },
    ],
    brokerageProviders: [
      {
        id: "ibkr-flex",
        name: "IBKR Flex Query",
        status: "ready-to-build",
        statusLabel: "优先接入",
        description:
          "适合从 IBKR 导入账户、持仓、现金、交易、股息和费用；不作为实时行情源。",
        primaryUse: "IBKR 真实账户导入",
        setupItems: [
          "在 IBKR Client Portal 创建 Activity Flex Query",
          "准备 Flex Token 和 Query ID",
          "导入前先预览账户、持仓、现金和交易差异",
        ],
        limitations: [
          "只覆盖 IBKR，不覆盖 Wealthsimple",
          "Flex Statement 适合手动或每日同步，不适合实时行情",
        ],
      },
      {
        id: "snaptrade",
        name: "Wealthsimple via SnapTrade",
        status: "feasibility-check",
        statusLabel: "验证中",
        description:
          "用于验证 Wealthsimple 是否能稳定返回账户、持仓、现金、交易和币种信息。",
        primaryUse: "Wealthsimple 连接验证",
        setupItems: [
          "申请 SnapTrade 开发者账户",
          "验证 Wealthsimple 连接是否可用",
          "确认返回字段能保留 symbol + exchange + currency",
        ],
        limitations: [
          "Free plan 通常限制 brokerage connections",
          "正式同步前必须确认费用、OAuth 流程和断连重连策略",
        ],
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
      holdingCount: account.holdingCount ?? 0,
    })),
    notes: [
      "移动端 MVP 只保留手动/引导式导入，不迁移 CSV 上传和字段映射。",
      "CSV 批量导入后续可作为桌面高级功能保留。",
      "券商同步会共用同一套导入预览：先识别账户/持仓/现金/交易，再由用户确认写入。",
      ...data.portfolioSuccessStates.slice(0, 2),
    ],
  };
}

export async function getMobileHomeView(userId: string, viewer: Viewer) {
  const payload = await getDashboardView(userId);
  return {
    data: await mapMobileHomeData(viewer, payload),
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
  const data = payload.data.data;
  let researchRefreshActions: MobileResearchRefreshAction[] = [];
  if (data) {
    const repositories = getRepositories();
    const policy = getExternalResearchPolicy();
    const now = new Date();
    const [usageResponse, recentJobs, freshDocuments] = await Promise.all([
      getMobileExternalResearchUsage(userId),
      repositories.externalResearchJobs.listRecentByUserId(userId, 20),
      repositories.externalResearchDocuments.listFreshByUserId(userId, {
        now,
        limit: 20,
        securityId: data.security.securityId ?? null,
        symbol: data.security.symbol,
        exchange: data.security.exchange,
        currency:
          data.security.currency === "CAD" || data.security.currency === "USD"
            ? data.security.currency
            : null,
      }),
    ]);
    researchRefreshActions = buildMobileResearchRefreshActions({
      data,
      jobs: recentJobs.map(mapExternalResearchJobForMobile),
      freshDocuments,
      policy,
      usage: usageResponse.data.usage,
      now,
    });
  }
  return {
    data: data
      ? mapMobileSecurityDetailData(data, researchRefreshActions)
      : null,
    meta: payload.meta,
  };
}

export async function getMobileRecommendationsView(userId: string) {
  const repositories = getRepositories();
  const [payload, profile, dailyIntelligenceItems, observations] =
    await Promise.all([
      getRecommendationView(userId),
      repositories.preferences.getByUserId(userId),
      getDailyIntelligenceItemsForUser(userId, 8),
      repositories.mobileSecurityObservations.listRecentByUserId(userId, 12),
    ]);
  const intelligenceBriefs = dailyIntelligenceItems.map(
    mapDailyIntelligenceItemToRecommendationBrief,
  );
  return {
    data: await mapMobileRecommendationsData(
      payload.data,
      profile,
      intelligenceBriefs,
      userId,
      observations,
    ),
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
