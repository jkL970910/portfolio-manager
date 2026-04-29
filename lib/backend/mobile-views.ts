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
  return {
    displayContext: data.displayContext,
    security: data.security,
    facts: data.facts,
    marketData: data.marketData,
    analysis: data.analysis,
    performance: data.performance,
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
): MobileRecommendationsData {
  return {
    ...data,
    preferenceContext,
    priorities: data.priorities.map((priority) => {
      const {
        securityHref: _securityHref,
        alternativeLinks: _alternativeLinks,
        relatedLinks: _relatedLinks,
        ...rest
      } = priority;
      return rest;
    }),
  };
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
  identity?: { exchange?: string | null; currency?: "CAD" | "USD" | null },
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
  const [payload, profile] = await Promise.all([
    getRecommendationView(userId),
    getRepositories().preferences.getByUserId(userId),
  ]);
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
    }),
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
