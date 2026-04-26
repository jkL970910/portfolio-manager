import type { ApiSuccess } from "@/lib/backend/contracts";
import type { DashboardData, PortfolioData } from "@/lib/contracts";
import { getDashboardView, getPortfolioView } from "@/lib/backend/services";
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
  accountTypeAllocation: PortfolioData["accountTypeAllocation"];
  accountInstanceAllocation: PortfolioData["accountInstanceAllocation"];
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

function mapMobileHomeData(viewer: Viewer, payload: ApiSuccess<DashboardData & { context?: MobileHomeData["context"] }>): MobileHomeData {
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
    healthScore: payload.data.healthScore,
    recommendation: payload.data.recommendation,
    context: payload.data.context,
  };
}

function mapMobilePortfolioOverviewData(
  viewer: Viewer,
  payload: ApiSuccess<PortfolioData & { context?: MobilePortfolioOverviewData["context"] }>
): MobilePortfolioOverviewData {
  return {
    viewer,
    displayContext: payload.data.displayContext,
    performance: payload.data.performance,
    accountTypeAllocation: payload.data.accountTypeAllocation,
    accountInstanceAllocation: payload.data.accountInstanceAllocation,
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

export async function getMobileHomeView(userId: string, viewer: Viewer) {
  const payload = await getDashboardView(userId);
  return {
    data: mapMobileHomeData(viewer, payload),
    meta: payload.meta,
  };
}

export async function getMobilePortfolioOverviewView(userId: string, viewer: Viewer) {
  const payload = await getPortfolioView(userId);
  return {
    data: mapMobilePortfolioOverviewData(viewer, payload),
    meta: payload.meta,
  };
}
