export interface MetricCard {
  label: string;
  value: string;
  detail: string;
}

export interface MobileChartPoint {
  displayLabel: string;
  rawDate?: string;
  value: number;
  displayValue: string;
}

export interface MobileChartSeries {
  id: string;
  title: string;
  kind: "line" | "distribution" | "radar";
  valueType: "money" | "percent" | "index" | "score" | "quantity";
  currency?: "CAD" | "USD";
  sourceMode: "local" | "cached-external" | "live-external";
  freshness: {
    status: "fresh" | "stale" | "fallback";
    label: string;
    latestDate: string | null;
    detail: string;
  };
  identity?: {
    symbol: string;
    exchange?: string | null;
    currency?: "CAD" | "USD" | null;
  };
  points: MobileChartPoint[];
  notes: string[];
}

export interface DashboardData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
    fxAsOf: string | null;
    fxSource: string;
    fxFreshness: "fresh" | "stale" | "fallback";
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
    href: string;
    securityHref: string;
    lastPrice: string;
    lastUpdated: string;
    freshnessVariant: "success" | "warning" | "neutral";
    quoteProvider?: string | null;
    quoteSourceMode?: string | null;
    quoteStatus?: string | null;
    quoteStatusLabel?: string;
    weight: string;
    value: string;
  }[];
  trendContext: {
    title: string;
    description: string;
    scopeLabel: string;
    scopeDetail: string;
    sourceLabel: string;
    sourceDetail: string;
  };
  netWorthTrend: { label: string; value: number; rawDate?: string }[];
  chartSeries?: {
    netWorth?: MobileChartSeries;
  };
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
    fxAsOf: string | null;
    fxSource: string;
    fxFreshness: "fresh" | "stale" | "fallback";
  };
  trendContext: {
    title: string;
    description: string;
    scopeLabel: string;
    scopeDetail: string;
    sourceLabel: string;
    sourceDetail: string;
  };
  performance: { label: string; value: number; rawDate?: string }[];
  chartSeries?: {
    portfolioValue?: MobileChartSeries;
  };
  accountTypeAllocation: {
    id: string;
    name: string;
    value: number;
    detail?: string;
  }[];
  accountInstanceAllocation: {
    id: string;
    name: string;
    value: number;
    detail?: string;
  }[];
  assetClassDrilldown: {
    id: string;
    name: string;
    value: string;
    currentPct: number;
    targetPct: number;
    driftPct: number;
    current: string;
    target: string;
    driftLabel: string;
    summary: string;
    actions: string[];
    chartSeries?: {
      valueHistory?: MobileChartSeries;
    };
    holdings: {
      id: string;
      symbol: string;
      name: string;
      account: string;
      accountType: string;
      value: string;
      portfolioShare: string;
    }[];
  }[];
  accountCards: {
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
    href: string;
  }[];
  accountContexts: {
    id: string;
    name: string;
    typeId: string;
    typeLabel: string;
    performance: { label: string; value: number; rawDate?: string }[];
    chartSeries?: {
      accountValue?: MobileChartSeries;
    };
    healthScore: {
      score: number;
      status: string;
      scopeLabel?: string;
      scopeDetail?: string;
      radar: { dimension: string; value: number }[];
      highlights: string[];
      strongestDimension: string;
      weakestDimension: string;
    };
    healthDetail: {
      score: number;
      status: string;
      scopeLabel?: string;
      scopeDetail?: string;
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
    scopeLabel?: string;
    scopeDetail?: string;
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
    securityHref: string;
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
  }[];
  summaryPoints: string[];
}

export interface PortfolioAccountDetailData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
    fxAsOf: string | null;
    fxSource: string;
    fxFreshness: "fresh" | "stale" | "fallback";
  };
  trendContext: {
    title: string;
    description: string;
    scopeLabel: string;
    scopeDetail: string;
    sourceLabel: string;
    sourceDetail: string;
  };
  account: {
    id: string;
    name: string;
    typeId: string;
    typeLabel: string;
    institution: string;
    currency: string;
    value: string;
    gainLoss: string;
    portfolioShare: string;
    room: string;
    topHoldings: string[];
    summaryPoints: string[];
  };
  facts: {
    label: string;
    value: string;
    detail?: string;
  }[];
  performance: { label: string; value: number; rawDate?: string }[];
  chartSeries?: {
    accountValue?: MobileChartSeries;
  };
  allocation: { name: string; value: number }[];
  healthScore: PortfolioData["healthScore"];
  holdings: PortfolioData["holdings"];
  editContext: {
    typeOptions: { value: string; label: string }[];
    currencyOptions: { value: "CAD" | "USD"; label: string }[];
    current: {
      nickname: string;
      institution: string;
      type: string;
      currency: "CAD" | "USD";
      contributionRoomCad: number | null;
    };
    mergeTargets: {
      value: string;
      label: string;
      detail: string;
    }[];
    holdingCreateContext: {
      currencyOptions: { value: "CAD" | "USD"; label: string }[];
      assetClassOptions: { value: string; label: string }[];
      securityTypeOptions: { value: string; label: string }[];
      exchangeOptions: { value: string; label: string }[];
      sectorSuggestions: string[];
      marketSectorSuggestions: string[];
      defaults: {
        currency: "CAD" | "USD";
      };
    };
  };
}

export interface PortfolioHoldingDetailData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
    fxAsOf: string | null;
    fxSource: string;
    fxFreshness: "fresh" | "stale" | "fallback";
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
    quantity: string;
    avgCost: string;
    costBasis: string;
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
    securityType: string;
    exchange: string;
    marketSector: string;
  };
  facts: {
    label: string;
    value: string;
    detail?: string;
  }[];
  marketData: {
    summary: string;
    notes: string[];
    facts: {
      label: string;
      value: string;
      detail?: string;
    }[];
  };
  performance: { label: string; value: number; rawDate?: string }[];
  chartSeries?: {
    holdingValue?: MobileChartSeries;
  };
  portfolioRole: string[];
  healthSummary: {
    score: number;
    status: string;
    summary: string;
    drivers: string[];
    actions: string[];
  };
  editContext: {
    accountOptions: {
      value: string;
      label: string;
      detail: string;
    }[];
    currencyOptions: { value: "CAD" | "USD"; label: string }[];
    assetClassOptions: { value: string; label: string }[];
    securityTypeOptions: { value: string; label: string }[];
    exchangeOptions: { value: string; label: string }[];
    sectorSuggestions: string[];
    marketSectorSuggestions: string[];
    current: {
      name: string;
      currency: "CAD" | "USD";
      quantity: number | null;
      avgCostPerShareAmount: number | null;
      costBasisAmount: number | null;
      lastPriceAmount: number | null;
      marketValueAmount: number | null;
      assetClassOverride: string | null;
      sectorOverride: string | null;
      securityTypeOverride: string | null;
      exchangeOverride: string | null;
      marketSectorOverride: string | null;
    };
    raw: {
      assetClass: string;
      sector: string;
      securityType: string;
      exchange: string;
      marketSector: string;
    };
  };
}

export interface PortfolioSecurityDetailData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
    fxAsOf: string | null;
    fxSource: string;
    fxFreshness: "fresh" | "stale" | "fallback";
  };
  security: {
    symbol: string;
    name: string;
    assetClass: string;
    sector: string;
    currency: string;
    securityType: string;
    exchange: string;
    marketSector: string;
    lastPrice: string;
    quoteTimestamp: string;
    freshnessVariant: "success" | "warning" | "neutral";
    quoteStatus?: string | null;
    quoteStatusLabel?: string;
  };
  facts: {
    label: string;
    value: string;
    detail?: string;
  }[];
  marketData: {
    summary: string;
    notes: string[];
    facts: {
      label: string;
      value: string;
      detail?: string;
    }[];
  };
  analysis: {
    assetClassLabel: string;
    targetAllocationPct: number;
    currentAllocationPct: number;
    driftPct: number;
    targetAllocation: string;
    currentAllocation: string;
    driftLabel: string;
    portfolioSharePct: number;
    portfolioShare: string;
    summary: string;
  };
  performance: { label: string; value: number; rawDate?: string }[];
  chartSeries?: {
    priceHistory?: MobileChartSeries;
  };
  summaryPoints: string[];
  relatedHoldings: {
    id: string;
    symbol: string;
    name: string;
    account: string;
    href: string;
    value: string;
    portfolioShare: string;
    accountShare: string;
    gainLoss: string;
  }[];
  heldPosition: null | {
    aggregate: {
      quantity: string;
      avgCost: string;
      costBasis: string;
      value: string;
      lastPrice: string;
      gainLoss: string;
      portfolioShare: string;
      accountCount: string;
      summaryPoints: string[];
    };
    accountOptions: {
      accountId: string;
      label: string;
      detail: string;
      holdingId: string;
      summary: string;
    }[];
    accountSummaries: {
      accountId: string;
      accountLabel: string;
      accountType: string;
      quantity: string;
      avgCost: string;
      costBasis: string;
      value: string;
      lastPrice: string;
      gainLoss: string;
      portfolioShare: string;
      accountShare: string;
      positionShare: string;
      positionSharePct: number;
      holdingCount: string;
      summaryPoints: string[];
    }[];
    accountViews: PortfolioHoldingDetailData[];
  };
}

export interface RecommendationsData {
  displayContext: {
    currency: "CAD" | "USD";
    fxRateLabel: string;
    fxNote: string;
    fxAsOf: string | null;
    fxSource: string;
    fxFreshness: "fresh" | "stale" | "fallback";
  };
  contributionAmount: string;
  engine: {
    version: string;
    objective: string;
    confidence: string;
  };
  inputs: {
    label: string;
    value: string;
    tone?: "default" | "muted" | "warning";
  }[];
  explainer: string[];
  priorities: {
    id: string;
    assetClass: string;
    description: string;
    amount: string;
    account: string;
    security: string;
    securityHref?: string;
    tickers: string;
    accountFit: string;
    scoreline: string;
    gapSummary: string;
    alternatives: string[];
    alternativeLinks?: {
      label: string;
      href: string;
    }[];
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
    relatedLinks?: {
      label: string;
      href: string;
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
    fxAsOf: string | null;
    fxSource: string;
    fxFreshness: "fresh" | "stale" | "fallback";
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
