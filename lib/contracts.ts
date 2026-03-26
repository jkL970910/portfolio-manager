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
    id: string;
    name: string;
    caption: string;
    value: string;
    room: string;
    badge: string;
    badgeVariant: "primary" | "success" | "warning" | "neutral";
    href: string;
  }[];
  drift: {
    assetClass: string;
    current: string;
    target: string;
    delta: string;
  }[];
  assetMix: { name: string; value: number }[];
  topHoldings: {
    id: string;
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
  healthScore: {
    score: number;
    status: string;
    strongestDimension: string;
    weakestDimension: string;
    highlights: string[];
  };
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
  accountTypeAllocation: { id: string; name: string; value: number; detail?: string }[];
  accountInstanceAllocation: { id: string; name: string; value: number; detail?: string }[];
  accountCards: {
    id: string;
    name: string;
    typeId: string;
    typeLabel: string;
    institution: string;
    currency: string;
    value: string;
    share: string;
    room: string;
    topHoldings: string[];
    href: string;
  }[];
  accountContexts: {
    id: string;
    name: string;
    typeId: string;
    typeLabel: string;
    performance: { label: string; value: number }[];
    healthScore: {
      score: number;
      status: string;
      radar: { dimension: string; value: number }[];
      highlights: string[];
      strongestDimension: string;
      weakestDimension: string;
    };
    healthDetail: {
      score: number;
      status: string;
      radar: { dimension: string; value: number }[];
      highlights: string[];
      strongestDimension: string;
      weakestDimension: string;
      dimensions: {
        id: string;
        label: string;
        score: number;
        status: string;
        summary: string;
        drivers: string[];
        consequences: string[];
        actions: string[];
      }[];
      actionQueue: string[];
      accountDrilldown: {
        id: string;
        label: string;
        href?: string;
        score: number;
        status: string;
        summary: string;
        impactHints?: {
          amount: number;
          hint: string;
        }[];
        drivers: string[];
        actions: string[];
      }[];
      holdingDrilldown: {
        id: string;
        label: string;
        href?: string;
        score: number;
        status: string;
        summary: string;
        impactHints?: {
          amount: number;
          hint: string;
        }[];
        drivers: string[];
        actions: string[];
      }[];
    };
    summaryPoints: string[];
  }[];
  sectorExposure: { name: string; value: number }[];
  quoteStatus: {
    lastRefreshed: string;
    freshness: string;
    coverage: string;
  };
  healthScore: {
    score: number;
    status: string;
    radar: { dimension: string; value: number }[];
    highlights: string[];
    strongestDimension: string;
    weakestDimension: string;
    dimensions: {
      id: string;
      label: string;
      score: number;
      status: string;
      summary: string;
      drivers: string[];
      consequences: string[];
      actions: string[];
    }[];
    actionQueue: string[];
    accountDrilldown: {
      id: string;
      label: string;
      href?: string;
      score: number;
      status: string;
      summary: string;
      impactHints?: {
        amount: number;
        hint: string;
      }[];
      drivers: string[];
      actions: string[];
    }[];
    holdingDrilldown: {
      id: string;
      label: string;
      href?: string;
      score: number;
      status: string;
      summary: string;
      impactHints?: {
        amount: number;
        hint: string;
      }[];
      drivers: string[];
      actions: string[];
    }[];
  };
  holdings: {
    id: string;
    symbol: string;
    name: string;
    assetClass: string;
    sector: string;
    accountId: string;
    accountType: string;
    account: string;
    href: string;
    lastPrice: string;
    lastUpdated: string;
    freshnessVariant: "success" | "warning" | "neutral";
    portfolioShare: string;
    accountShare: string;
    gainLoss: string;
    signal: string;
  }[];
  summaryPoints: string[];
}

export interface PortfolioAccountDetailData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
  };
  account: {
    id: string;
    name: string;
    typeId: string;
    typeLabel: string;
    institution: string;
    currency: string;
    value: string;
    portfolioShare: string;
    room: string;
    topHoldings: string[];
    summaryPoints: string[];
  };
  performance: { label: string; value: number }[];
  allocation: { name: string; value: number }[];
  healthScore: PortfolioData["healthScore"];
  holdings: PortfolioData["holdings"];
}

export interface PortfolioHoldingDetailData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
  };
  holding: {
    id: string;
    symbol: string;
    name: string;
    assetClass: string;
    sector: string;
    currency: string;
    accountId: string;
    accountName: string;
    accountType: string;
    accountHref: string;
    value: string;
    lastPrice: string;
    lastUpdated: string;
    freshnessVariant: "success" | "warning" | "neutral";
    portfolioShare: string;
    accountShare: string;
    gainLoss: string;
  };
  performance: { label: string; value: number }[];
  portfolioRole: string[];
  healthSummary: {
    score: number;
    status: string;
    summary: string;
    drivers: string[];
    actions: string[];
  };
}

export interface RecommendationsData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
  };
  contributionAmount: string;
  engine: {
    version: string;
    objective: string;
    confidence: string;
  };
  inputs: { label: string; value: string; tone?: "default" | "muted" | "warning" }[];
  explainer: string[];
  priorities: {
    id: string;
    assetClass: string;
    description: string;
    amount: string;
    account: string;
    security: string;
    tickers: string;
    accountFit: string;
    scoreline: string;
    gapSummary: string;
    alternatives: string[];
    whyThis: string[];
    whyNot: string[];
    constraints: {
      label: string;
      detail: string;
      variant: "success" | "warning" | "neutral";
    }[];
    execution: {
      label: string;
      value: string;
    }[];
  }[];
  scenarios: {
    id: string;
    label: string;
    amount: string;
    summary: string;
    diffs: string[];
    allocations: {
      assetClass: string;
      amount: string;
      account: string;
    }[];
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
