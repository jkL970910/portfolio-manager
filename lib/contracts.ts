export interface MetricCard {
  label: string;
  value: string;
  detail: string;
}

export interface DashboardData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
  };
  metrics: MetricCard[];
  accounts: {
    name: string;
    caption: string;
    value: string;
    room: string;
    badge: string;
    badgeVariant: "primary" | "success" | "warning" | "neutral";
  }[];
  drift: {
    assetClass: string;
    current: string;
    target: string;
    delta: string;
  }[];
  assetMix: { name: string; value: number }[];
  topHoldings: {
    symbol: string;
    name: string;
    account: string;
    lastPrice: string;
    lastUpdated: string;
    freshnessVariant: "success" | "warning" | "neutral";
    weight: string;
    value: string;
  }[];
  netWorthTrend: { label: string; value: number }[];
  spendingMonthLabel: string;
  savingsPattern: string;
  investableCash: string;
  spendingCategories: { name: string; value: string }[];
  healthPreview: { dimension: string; value: number }[];
  recommendation: {
    theme: string;
    subtitle: string;
    reason: string;
    signals: string[];
  };
}

export interface PortfolioData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
  };
  performance: { label: string; value: number }[];
  accountAllocation: { name: string; value: number }[];
  sectorExposure: { name: string; value: number }[];
  quoteStatus: {
    lastRefreshed: string;
    freshness: string;
    coverage: string;
  };
  holdings: {
    symbol: string;
    account: string;
    lastPrice: string;
    lastUpdated: string;
    freshnessVariant: "success" | "warning" | "neutral";
    weight: string;
    gainLoss: string;
    signal: string;
  }[];
  summaryPoints: string[];
}

export interface RecommendationsData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
  };
  contributionAmount: string;
  inputs: { label: string; value: string }[];
  explainer: string[];
  priorities: {
    assetClass: string;
    description: string;
    amount: string;
    account: string;
    tickers: string;
    accountFit: string;
  }[];
  notes: string[];
}

export interface SpendingData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
  };
  metrics: MetricCard[];
  trend: { label: string; value: number }[];
  categories: { name: string; share: string; amount: string }[];
  transactions: {
    date: string;
    merchant: string;
    category: string;
    amount: string;
  }[];
}

export interface ImportData {
  portfolioSteps: { title: string; description: string }[];
  portfolioSetupCards: { label: string; title: string; description: string }[];
  portfolioSuccessStates: string[];
  spendingSetupCards: { label: string; title: string; description: string }[];
  spendingSuccessStates: string[];
  existingAccounts: {
    id: string;
    type: string;
    institution: string;
    nickname: string;
    currency: "CAD" | "USD";
    contributionRoomCad: number | null;
    marketValueAmount: number;
    marketValueCad: number;
  }[];
}

export interface SettingsData {
  guidedQuestions: string[];
  manualGroups: {
    title: string;
    description: string;
    badge?: string;
  }[];
}
