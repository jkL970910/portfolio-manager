import {
  DashboardData,
  ImportData,
  PortfolioData,
  RecommendationsData,
  SettingsData,
  SpendingData
} from "@/lib/contracts";
import {
  AllocationTarget,
  CashflowTransaction,
  HoldingPosition,
  ImportJob,
  InvestmentAccount,
  PreferenceProfile,
  RecommendationRun,
  RiskProfile,
  UserProfile
} from "@/lib/backend/models";

const MONTH_LABELS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const PRIORITY_BADGE_VARIANTS = {
  first: "primary",
  second: "success",
  later: "warning"
} as const;

const ACCOUNT_CAPTIONS: Record<InvestmentAccount["type"], string> = {
  TFSA: "Tax-free growth sleeve",
  RRSP: "Long-horizon retirement sleeve",
  FHSA: "Home down-payment sleeve",
  Taxable: "Flexible capital account"
};

const ACCOUNT_TYPE_FIT: Record<InvestmentAccount["type"], string> = {
  TFSA: "Generally suitable for tax-free compounding and secondary funding priorities.",
  RRSP: "Commonly preferred for sheltered long-horizon allocations.",
  FHSA: "Commonly preferred when home-goal room remains available.",
  Taxable: "Fallback account once sheltered room is consumed or flexibility is needed."
};

const RISK_DETAILS: Record<RiskProfile, string> = {
  Conservative: "Defensive profile with more income and cash tolerance.",
  Balanced: "Within configured tolerance band.",
  Growth: "Higher equity exposure than target comfort band."
};

const TARGET_PRESETS: Record<RiskProfile, AllocationTarget[]> = {
  Conservative: [
    { assetClass: "Canadian Equity", targetPct: 18 },
    { assetClass: "US Equity", targetPct: 22 },
    { assetClass: "International Equity", targetPct: 10 },
    { assetClass: "Fixed Income", targetPct: 35 },
    { assetClass: "Cash", targetPct: 15 }
  ],
  Balanced: [
    { assetClass: "Canadian Equity", targetPct: 22 },
    { assetClass: "US Equity", targetPct: 32 },
    { assetClass: "International Equity", targetPct: 16 },
    { assetClass: "Fixed Income", targetPct: 20 },
    { assetClass: "Cash", targetPct: 10 }
  ],
  Growth: [
    { assetClass: "Canadian Equity", targetPct: 16 },
    { assetClass: "US Equity", targetPct: 42 },
    { assetClass: "International Equity", targetPct: 22 },
    { assetClass: "Fixed Income", targetPct: 10 },
    { assetClass: "Cash", targetPct: 10 }
  ]
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function formatCompactPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

function formatSignedPercent(value: number, digits = 0) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getLatestMonthLabel() {
  const now = new Date();
  return now.toLocaleString("en-CA", { month: "long", year: "numeric" });
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function groupBy<T>(items: T[], getKey: (item: T) => string, getValue: (item: T) => number) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    map.set(key, (map.get(key) ?? 0) + getValue(item));
  }
  return map;
}

function getCurrentAllocation(holdings: HoldingPosition[]) {
  const total = sum(holdings.map((holding) => holding.marketValueCad));
  if (!total) {
    return new Map<string, number>();
  }
  const byAssetClass = groupBy(holdings, (holding) => holding.assetClass, (holding) => holding.marketValueCad);
  const allocation = new Map<string, number>();
  for (const [assetClass, value] of byAssetClass.entries()) {
    allocation.set(assetClass, round((value / total) * 100, 1));
  }
  return allocation;
}

function getAccountPriorityRank(type: InvestmentAccount["type"], priorityOrder: InvestmentAccount["type"][]) {
  const rank = priorityOrder.indexOf(type);
  return rank === -1 ? 99 : rank;
}

function getTargetAllocation(profile: PreferenceProfile) {
  if (profile.targetAllocation.length > 0) {
    return new Map(profile.targetAllocation.map((target) => [target.assetClass, target.targetPct]));
  }
  return new Map(TARGET_PRESETS[profile.riskProfile].map((target) => [target.assetClass, target.targetPct]));
}

function getSixMonthSeries(latestValue: number, profile: PreferenceProfile, labels = MONTH_LABELS) {
  const growthCurve = profile.riskProfile === "Growth"
    ? [0.88, 0.91, 0.93, 0.95, 0.97, 1]
    : profile.riskProfile === "Conservative"
      ? [0.94, 0.95, 0.97, 0.98, 0.99, 1]
      : [0.9, 0.925, 0.945, 0.965, 0.982, 1];

  return labels.map((label, index) => ({
    label,
    value: Math.max(0, Math.round(latestValue * growthCurve[index]))
  }));
}

function getMonthlyTransactionSeries(transactions: CashflowTransaction[]) {
  const outflows = transactions.filter((transaction) => transaction.direction === "outflow");
  const monthlyTotals = groupBy(
    outflows,
    (transaction) => transaction.bookedAt.slice(0, 7),
    (transaction) => transaction.amountCad
  );
  const sortedKeys = [...monthlyTotals.keys()].sort();

  if (sortedKeys.length >= 6) {
    return sortedKeys.slice(-6).map((key) => ({
      label: new Date(`${key}-01T00:00:00`).toLocaleString("en-CA", { month: "short" }),
      value: round(monthlyTotals.get(key) ?? 0, 0)
    }));
  }

  const latestValue = round(sortedKeys.length > 0 ? monthlyTotals.get(sortedKeys[sortedKeys.length - 1]) ?? 0 : 0, 0);
  const fallback = [1.08, 1.05, 1.02, 0.98, 1.01, 1].map((factor) => round(latestValue * factor, 0));
  return MONTH_LABELS.map((label, index) => ({ label, value: fallback[index] ?? latestValue }));
}

function getCurrentMonthTransactions(transactions: CashflowTransaction[]) {
  const latestMonth = transactions
    .map((transaction) => transaction.bookedAt.slice(0, 7))
    .sort()
    .at(-1);

  if (!latestMonth) {
    return [];
  }

  return transactions.filter((transaction) => transaction.bookedAt.startsWith(latestMonth));
}

function buildSpendingSummary(transactions: CashflowTransaction[], cashBufferTargetCad: number) {
  const currentMonthTransactions = getCurrentMonthTransactions(transactions);
  const outflows = currentMonthTransactions.filter((transaction) => transaction.direction === "outflow");
  const inflows = currentMonthTransactions.filter((transaction) => transaction.direction === "inflow");
  const outflowTotal = sum(outflows.map((transaction) => transaction.amountCad));
  const inflowTotal = sum(inflows.map((transaction) => transaction.amountCad));
  const investableCashRaw = Math.max(0, inflowTotal - outflowTotal - cashBufferTargetCad / 12);
  const savingsRate = inflowTotal > 0 ? ((inflowTotal - outflowTotal) / inflowTotal) * 100 : 0;
  const categoryTotals = [...groupBy(outflows, (transaction) => transaction.category, (transaction) => transaction.amountCad).entries()]
    .sort((left, right) => right[1] - left[1]);

  return {
    outflowTotal,
    inflowTotal,
    investableCash: round(investableCashRaw, 0),
    savingsRate: round(savingsRate, 1),
    categories: categoryTotals
  };
}

function getHealthPreview(currentAllocation: Map<string, number>, targetAllocation: Map<string, number>, holdings: HoldingPosition[], profile: PreferenceProfile) {
  const allocationGap = [...targetAllocation.entries()].map(([assetClass, targetPct]) => Math.abs((currentAllocation.get(assetClass) ?? 0) - targetPct));
  const allocationScore = clamp(100 - sum(allocationGap) * 1.8, 32, 92);
  const largestHolding = holdings.sort((left, right) => right.weightPct - left.weightPct)[0]?.weightPct ?? 0;
  const concentrationScore = clamp(100 - largestHolding * 2.2, 28, 88);
  const representedClasses = [...currentAllocation.values()].filter((value) => value >= 5).length;
  const diversificationScore = clamp(45 + representedClasses * 10, 40, 86);
  const efficiencyScore = clamp(profile.taxAwarePlacement ? 76 : 60, 48, 90);
  const fixedIncomeGap = Math.abs((currentAllocation.get("Fixed Income") ?? 0) - (targetAllocation.get("Fixed Income") ?? 0));
  const riskPenalty = profile.riskProfile === "Growth" ? 8 : profile.riskProfile === "Conservative" ? 4 : 0;
  const riskAlignmentScore = clamp(82 - fixedIncomeGap * 2 - riskPenalty, 40, 90);

  return [
    { dimension: "Allocation", value: round(allocationScore, 0) },
    { dimension: "Diversification", value: round(diversificationScore, 0) },
    { dimension: "Efficiency", value: round(efficiencyScore, 0) },
    { dimension: "Concentration", value: round(concentrationScore, 0) },
    { dimension: "Risk Fit", value: round(riskAlignmentScore, 0) }
  ];
}

function getRecommendationTheme(run: RecommendationRun | null) {
  const lead = run?.items[0];
  if (!lead) {
    return {
      theme: "Complete import and preference setup to generate recommendations",
      subtitle: "No recommendation run has been generated yet.",
      reason: "Once holdings, accounts, and allocation preferences are available, the engine can rank contribution priorities.",
      signals: [
        "Import at least one account and one holding to unlock portfolio diagnostics.",
        "Save investment preferences so the recommendation engine has a target allocation baseline."
      ]
    };
  }

  return {
    theme: `${lead.assetClass} in ${lead.targetAccountType}`,
    subtitle: `Leading recommendation for the next ${formatCurrency(run.contributionAmountCad)} contribution`,
    reason: lead.explanation,
    signals: run.assumptions.slice(0, 2)
  };
}

function getSignalForHolding(holding: HoldingPosition, driftMap: Map<string, number>) {
  const gap = driftMap.get(holding.assetClass) ?? 0;
  if (holding.symbol === "CASH" && holding.weightPct > 8) {
    return "Cash drag is still elevated relative to the target mix.";
  }
  if (gap < -4) {
    return `This sleeve remains underweight by ${formatCompactPercent(Math.abs(gap), 0)} versus target.`;
  }
  if (holding.weightPct >= 15) {
    return "Core position is carrying a meaningful share of total portfolio risk.";
  }
  return "Supports the current portfolio mix without driving the main gaps.";
}

function formatHoldingLastUpdated(value?: string | null) {
  if (!value) {
    return "Not refreshed";
  }

  return new Date(value).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getPortfolioQuoteStatus(holdings: HoldingPosition[]) {
  const quotedHoldings = holdings.filter((holding) => (holding.lastPriceCad ?? 0) > 0 && holding.updatedAt);
  const coverage = holdings.length > 0
    ? `${quotedHoldings.length}/${holdings.length} holdings have provider-backed prices`
    : "No holdings available for quote refresh";

  if (quotedHoldings.length === 0) {
    return {
      lastRefreshed: "No quote refresh yet",
      freshness: "Unknown",
      coverage
    };
  }

  const latestUpdatedAt = quotedHoldings
    .map((holding) => new Date(holding.updatedAt!))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  const ageMs = Date.now() - latestUpdatedAt.getTime();
  const ageMinutes = Math.max(0, Math.round(ageMs / 60000));
  const freshness = ageMinutes <= 30
    ? "Fresh within cache window"
    : ageMinutes <= 180
      ? "Stale but still usable"
      : "Refresh recommended";

  return {
    lastRefreshed: latestUpdatedAt.toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }),
    freshness,
    coverage
  };
}

function sortTargetsForDisplay(targets: AllocationTarget[]) {
  return [...targets].sort((left, right) => {
    const order = ["Canadian Equity", "US Equity", "International Equity", "Fixed Income", "Cash"];
    return order.indexOf(left.assetClass) - order.indexOf(right.assetClass);
  });
}

function getGuidedQuestions(profile: PreferenceProfile) {
  if (profile.riskProfile === "Growth") {
    return [
      "How important is the home goal compared with long-term portfolio growth?",
      "How much short-term volatility can you tolerate before changing course?",
      "Should the engine prioritize sheltered room before broader drift correction?",
      "How much cash should remain available for shorter-term milestones?"
    ];
  }

  return [
    "What is your primary financial goal and time horizon?",
    "How comfortable are you with portfolio volatility and drawdowns?",
    "Should the engine prioritize tax efficiency or staying close to current holdings?",
    "Should recommendations preserve a larger cash buffer for upcoming spending?"
  ];
}

function getManualGroups(profile: PreferenceProfile): SettingsData["manualGroups"] {
  return [
    {
      title: "Risk profile and target allocation",
      description: `Current profile is ${profile.riskProfile.toLowerCase()} with ${sortTargetsForDisplay(profile.targetAllocation).length} target sleeves configured.`
    },
    {
      title: "Account funding priorities",
      description: `Current order: ${profile.accountFundingPriority.join(" -> ")}`,
      badge: "Sortable"
    },
    {
      title: "Recommendation behavior",
      description: `Transition is ${profile.transitionPreference}, strategy is ${profile.recommendationStrategy}.`
    },
    {
      title: "Tax-aware placement",
      description: profile.taxAwarePlacement
        ? "Tax-aware placement is enabled. Advanced province and marginal bracket fields can stay collapsed by default."
        : "Tax-aware placement is disabled. The engine will favor simpler account-fit rules.",
      badge: "Advanced"
    }
  ];
}

export function buildDashboardData(args: {
  viewer: UserProfile;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  transactions: CashflowTransaction[];
  profile: PreferenceProfile;
  latestRun: RecommendationRun | null;
}): DashboardData {
  const { accounts, holdings, transactions, profile, latestRun } = args;
  const totalPortfolio = sum(accounts.map((account) => account.marketValueCad));
  const availableRoom = sum(accounts.map((account) => account.contributionRoomCad ?? 0));
  const currentAllocation = getCurrentAllocation(holdings);
  const targetAllocation = getTargetAllocation(profile);
  const drift = [...targetAllocation.entries()]
    .map(([assetClass, targetPct]) => ({
      assetClass,
      current: round(currentAllocation.get(assetClass) ?? 0, 0),
      target: targetPct,
      delta: round((currentAllocation.get(assetClass) ?? 0) - targetPct, 0)
    }))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 3);
  const spending = buildSpendingSummary(transactions, profile.cashBufferTargetCad);
  const accountPriorityOrder = profile.accountFundingPriority;
  const recommendation = getRecommendationTheme(latestRun);

  return {
    metrics: [
      {
        label: "Total Portfolio",
        value: formatCurrency(totalPortfolio),
        detail: `${accounts.length} accounts connected`
      },
      {
        label: "Available Room",
        value: formatCurrency(availableRoom),
        detail: "TFSA, RRSP, and FHSA contribution room remaining"
      },
      {
        label: "Portfolio Risk",
        value: profile.riskProfile,
        detail: RISK_DETAILS[profile.riskProfile]
      },
      {
        label: "Portfolio Health Score",
        value: "P1",
        detail: "Preview radar ships after scoring logic"
      }
    ],
    accounts: [...accounts]
      .sort((left, right) => {
        const priorityDelta = getAccountPriorityRank(left.type, accountPriorityOrder) - getAccountPriorityRank(right.type, accountPriorityOrder);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return right.marketValueCad - left.marketValueCad;
      })
      .map((account, index) => ({
        name: account.type,
        caption: ACCOUNT_CAPTIONS[account.type],
        value: formatCurrency(account.marketValueCad),
        room: account.contributionRoomCad == null ? "No tax shelter" : `${formatCurrency(account.contributionRoomCad)} room left`,
        badge: index === 0 ? "Priority" : accountPriorityOrder.includes(account.type) ? "Tax fit" : "Review",
        badgeVariant: index === 0
          ? PRIORITY_BADGE_VARIANTS.first
          : accountPriorityOrder.includes(account.type)
            ? PRIORITY_BADGE_VARIANTS.second
            : PRIORITY_BADGE_VARIANTS.later
      })),
    drift: drift.map((item) => ({
      assetClass: item.assetClass,
      current: formatCompactPercent(item.current, 0),
      target: formatCompactPercent(item.target, 0),
      delta: formatSignedPercent(item.delta, 0)
    })),
    assetMix: [...currentAllocation.entries()].map(([name, value]) => ({ name, value: round(value, 0) })),
    topHoldings: [...holdings]
      .sort((left, right) => right.marketValueCad - left.marketValueCad)
      .slice(0, 3)
      .map((holding) => ({
        symbol: holding.symbol,
        name: holding.name,
        account: accounts.find((account) => account.id === holding.accountId)?.type ?? "Account",
        weight: formatCompactPercent(holding.weightPct, 1),
        value: formatCurrency(holding.marketValueCad)
      })),
    netWorthTrend: getSixMonthSeries(totalPortfolio, profile),
    spendingMonthLabel: getLatestMonthLabel(),
    savingsPattern: formatCompactPercent(spending.savingsRate, 1),
    investableCash: formatCurrency(spending.investableCash),
    spendingCategories: spending.categories.slice(0, 3).map(([name, value]) => ({ name, value: formatCurrency(value) })),
    healthPreview: getHealthPreview(currentAllocation, targetAllocation, holdings, profile),
    recommendation
  };
}

export function buildPortfolioData(args: {
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
}): PortfolioData {
  const { accounts, holdings, profile } = args;
  const currentAllocation = getCurrentAllocation(holdings);
  const targetAllocation = getTargetAllocation(profile);
  const totalPortfolio = sum(accounts.map((account) => account.marketValueCad));
  const performanceBase = getSixMonthSeries(totalPortfolio || 1, profile).map((point) => point.value);
  const baseline = performanceBase[0] || 1;
  const driftMap = new Map<string, number>();
  for (const [assetClass, targetPct] of targetAllocation.entries()) {
    driftMap.set(assetClass, round((currentAllocation.get(assetClass) ?? 0) - targetPct, 1));
  }

  const sectors = [...groupBy(
    holdings,
    (holding) => holding.sector === "Multi-sector" ? holding.assetClass : holding.sector,
    (holding) => holding.marketValueCad
  ).entries()]
    .sort((left, right) => right[1] - left[1]);

  const sectorExposure = sectors.slice(0, 4).map(([name, value]) => ({
    name,
    value: totalPortfolio > 0 ? round((value / totalPortfolio) * 100, 0) : 0
  }));
  const sectorRemainder = round(100 - sum(sectorExposure.map((item) => item.value)), 0);
  if (sectorRemainder > 0) {
    sectorExposure.push({ name: "Other", value: sectorRemainder });
  }

  const largestHolding = [...holdings].sort((left, right) => right.weightPct - left.weightPct)[0];
  const mainGap = [...driftMap.entries()].sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))[0];

  return {
    performance: getSixMonthSeries(totalPortfolio || 1, profile).map((point, index) => ({
      label: point.label,
      value: round((performanceBase[index] / baseline) * 100, 1)
    })),
    accountAllocation: accounts.map((account) => ({
      name: account.type,
      value: totalPortfolio > 0 ? round((account.marketValueCad / totalPortfolio) * 100, 0) : 0
    })),
    sectorExposure,
    quoteStatus: getPortfolioQuoteStatus(holdings),
    holdings: [...holdings]
      .sort((left, right) => right.marketValueCad - left.marketValueCad)
      .map((holding) => ({
        symbol: holding.symbol,
        account: accounts.find((account) => account.id === holding.accountId)?.type ?? "Account",
        lastPrice: holding.lastPriceCad != null && holding.lastPriceCad > 0 ? formatCurrency(holding.lastPriceCad) : "Not priced",
        lastUpdated: formatHoldingLastUpdated(holding.updatedAt),
        weight: formatCompactPercent(holding.weightPct, 1),
        gainLoss: formatSignedPercent(holding.gainLossPct, 1),
        signal: getSignalForHolding(holding, driftMap)
      })),
    summaryPoints: [
      mainGap ? `${mainGap[0]} is the clearest allocation gap versus the configured target.` : "Set a target allocation to unlock drift analysis.",
      largestHolding ? `${largestHolding.symbol} is the largest position and drives the current concentration score.` : "Import holdings to unlock concentration analysis.",
      accounts.some((account) => account.type === "Taxable")
        ? "Taxable capital remains available as a secondary funding sleeve after sheltered room is consumed."
        : "Sheltered accounts dominate the current portfolio, which keeps account placement simpler."
    ]
  };
}

export function buildRecommendationsData(args: {
  profile: PreferenceProfile;
  latestRun: RecommendationRun | null;
}): RecommendationsData {
  const { profile, latestRun } = args;
  const equityTarget = sum(profile.targetAllocation
    .filter((target) => target.assetClass !== "Fixed Income" && target.assetClass !== "Cash")
    .map((target) => target.targetPct));
  const fixedIncomeTarget = profile.targetAllocation.find((target) => target.assetClass === "Fixed Income")?.targetPct ?? 0;
  const cashTarget = profile.targetAllocation.find((target) => target.assetClass === "Cash")?.targetPct ?? 0;

  return {
    inputs: [
      { label: "Target allocation", value: `${equityTarget} / ${fixedIncomeTarget} / ${cashTarget}` },
      { label: "Account priority", value: profile.accountFundingPriority.join(" -> ") },
      { label: "Tax-aware placement", value: profile.taxAwarePlacement ? "Enabled" : "Disabled" },
      { label: "Transition preference", value: profile.transitionPreference }
    ],
    explainer: latestRun?.assumptions?.length
      ? latestRun.assumptions
      : [
          "Recommendations are generated once holdings and target allocation are available.",
          "Account room and target drift are used to rank asset classes.",
          "Ticker options appear only after the engine identifies the preferred account and asset sleeve."
        ],
    priorities: (latestRun?.items ?? []).map((item) => ({
      assetClass: item.assetClass,
      description: item.explanation,
      amount: formatCurrency(item.amountCad),
      account: item.targetAccountType,
      tickers: item.tickerOptions.join(", "),
      accountFit: ACCOUNT_TYPE_FIT[item.targetAccountType]
    })),
    notes: [
      profile.taxAwarePlacement
        ? "Tax-aware placement is expressed as account fit based on your configured preferences, not guaranteed tax optimization."
        : "Tax-aware placement is disabled, so recommendations prioritize allocation fit over tax sheltering.",
      `Current strategy: ${profile.recommendationStrategy}. Rebalancing tolerance is ${profile.rebalancingTolerancePct}%.`
    ]
  };
}

export function buildSpendingData(args: {
  transactions: CashflowTransaction[];
  profile: PreferenceProfile;
}): SpendingData {
  const { transactions, profile } = args;
  const spending = buildSpendingSummary(transactions, profile.cashBufferTargetCad);
  const latestTransactions = [...transactions]
    .sort((left, right) => right.bookedAt.localeCompare(left.bookedAt))
    .slice(0, 10);
  const discipline = spending.savingsRate >= 30 ? "Stable" : spending.savingsRate >= 20 ? "Watch" : "At risk";

  return {
    metrics: [
      {
        label: "Monthly spend",
        value: formatCurrency(spending.outflowTotal),
        detail: "Current month outflow total"
      },
      {
        label: "Savings rate",
        value: formatCompactPercent(spending.savingsRate, 1),
        detail: "Based on current month inflows and outflows"
      },
      {
        label: "Investable cash",
        value: formatCurrency(spending.investableCash),
        detail: "Monthly inflow minus spending and buffer reserve"
      },
      {
        label: "Cash discipline",
        value: discipline,
        detail: `Cash buffer target is ${formatCurrency(profile.cashBufferTargetCad)}`
      }
    ],
    trend: getMonthlyTransactionSeries(transactions),
    categories: spending.categories.slice(0, 4).map(([name, value]) => ({
      name,
      share: spending.outflowTotal > 0 ? formatCompactPercent((value / spending.outflowTotal) * 100, 0) : "0%",
      amount: formatCurrency(value)
    })),
    transactions: latestTransactions.map((transaction) => ({
      date: transaction.bookedAt,
      merchant: transaction.merchant,
      category: transaction.category,
      amount: `${transaction.direction === "outflow" ? "-" : "+"}${formatCurrency(transaction.amountCad)}`
    }))
  };
}

export function buildImportData(args: {
  latestJob: ImportJob | null;
  accounts: InvestmentAccount[];
}): ImportData {
  const { latestJob, accounts } = args;
  return {
    steps: [
      { title: "Choose account type", description: "Start with the account structure, not a long form." },
      { title: "Choose import method", description: "CSV import first, account integrations later." },
      { title: "Provide account data", description: "Enter account details, room, and starter holding context before any write." },
      { title: "Review and confirm", description: latestJob ? `Latest import job is ${latestJob.status}. Confirm what should be written next.` : "Review the exact account and import actions before writing them to the database." },
      { title: "Complete setup", description: "Confirm the saved result, then continue to preferences or the dashboard." }
    ],
    setupCards: [
      { label: "Account type", title: accounts.length > 0 ? `${accounts.map((account) => account.type).join(" / ")}` : "TFSA / RRSP / Taxable / FHSA", description: "Pick the right account bucket before asking for institution detail." },
      { label: "Import method", title: "CSV upload first", description: "Keeps MVP friction low while we define stable broker integrations." },
      { label: "Field mapping", title: latestJob ? `Current file: ${latestJob.fileName}` : "Review transaction and holding columns", description: "Mapping stays explicit so the user trusts the imported data." },
      { label: "Preference handoff", title: "Move into Investment Preferences", description: "The import flow hands off cleanly into target allocation and account priorities." }
    ],
    successStates: [
      "Imported holdings can be grouped by account and asset class.",
      "Invalid or unknown rows are flagged before the portfolio view updates.",
      "On completion the user can move directly to Dashboard or Recommendations."
    ],
    existingAccounts: accounts.map((account) => ({
      id: account.id,
      type: account.type,
      institution: account.institution,
      nickname: account.nickname,
      contributionRoomCad: account.contributionRoomCad,
      marketValueCad: account.marketValueCad
    }))
  };
}

export function buildSettingsData(profile: PreferenceProfile): SettingsData {
  return {
    guidedQuestions: getGuidedQuestions(profile),
    manualGroups: getManualGroups(profile)
  };
}
