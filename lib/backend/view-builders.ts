import {
  DashboardData,
  ImportData,
  PortfolioAccountDetailData,
  PortfolioHoldingDetailData,
  PortfolioData,
  RecommendationsData,
  SettingsData,
  SpendingData
} from "@/lib/contracts";
import {
  AllocationTarget,
  CashflowTransaction,
  CurrencyCode,
  HoldingPosition,
  ImportJob,
  InvestmentAccount,
  PreferenceProfile,
  RecommendationRun,
  RiskProfile,
  UserProfile
} from "@/lib/backend/models";
import { buildPortfolioHealthSummary } from "@/lib/backend/portfolio-health";
import {
  getAccountTypeLabel,
  getAssetClassLabel,
  getCategoryLabel,
  getMerchantLabel,
  getRecommendationStrategyLabel,
  getRiskProfileLabel,
  getSectorLabel,
  getTransitionPreferenceLabel
} from "@/lib/i18n/finance";
import { formatMoney, roundAmount } from "@/lib/money/display";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

const MONTH_LABELS_EN = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const MONTH_LABELS_ZH = ["10?", "11?", "12?", "1?", "2?", "3?"];
const PRIORITY_BADGE_VARIANTS = {
  first: "primary",
  second: "success",
  later: "warning"
} as const;

const ACCOUNT_CAPTIONS: Record<InvestmentAccount["type"], { zh: string; en: string }> = {
  TFSA: { zh: "??????", en: "Tax-free growth sleeve" },
  RRSP: { zh: "??????", en: "Long-horizon retirement sleeve" },
  FHSA: { zh: "??????", en: "Home down-payment sleeve" },
  Taxable: { zh: "??????", en: "Flexible capital account" }
};

const ACCOUNT_TYPE_FIT: Record<InvestmentAccount["type"], { zh: string; en: string }> = {
  TFSA: {
    zh: "???????????,??????????????",
    en: "Generally suitable for tax-free compounding and secondary funding priorities."
  },
  RRSP: {
    zh: "???????????????????",
    en: "Commonly preferred for sheltered long-horizon allocations."
  },
  FHSA: {
    zh: "?????????????,????????",
    en: "Commonly preferred when home-goal room remains available."
  },
  Taxable: {
    zh: "??????????,????????????????",
    en: "Fallback account once sheltered room is consumed or flexibility is needed."
  }
};

const RISK_DETAILS: Record<RiskProfile, { zh: string; en: string }> = {
  Conservative: {
    zh: "?????,???????????????",
    en: "Defensive profile with more income and cash tolerance."
  },
  Balanced: {
    zh: "???????????????????",
    en: "Within configured tolerance band."
  },
  Growth: {
    zh: "?????????????????",
    en: "Higher equity exposure than target comfort band."
  }
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

type DisplayContext = {
  currency: CurrencyCode;
  cadToDisplayRate: number;
};

function convertCadToDisplay(valueCad: number, context: DisplayContext) {
  return context.currency === "CAD"
    ? valueCad
    : roundAmount(valueCad * context.cadToDisplayRate, 2);
}

function formatDisplayCurrency(valueCad: number, context: DisplayContext) {
  return formatMoney(convertCadToDisplay(valueCad, context), context.currency);
}

function buildDisplayContext(context: DisplayContext, language: DisplayLanguage) {
  const fxRate = context.currency === "CAD" ? 1 : context.cadToDisplayRate;
  return {
    currency: context.currency,
    fxRateLabel: context.currency === "CAD"
      ? pick(language, "????????????? CAD?", "Base analytics and display are in CAD.")
      : `1 CAD = ${fxRate.toFixed(4)} USD`,
    fxNote: context.currency === "CAD"
      ? pick(language, "CAD ????????USD ??????????????,????????? CAD ????", "CAD is the active display currency. USD-native positions retain their own price inputs, while portfolio analytics stay normalized in CAD.")
      : pick(language, "USD ???????????????? CAD ???,??????? USD/CAD ????? USD ???", "USD is the active display currency. Portfolio analytics remain normalized in CAD and are converted into USD for display using the latest cached USD/CAD FX rate.")
  };
}

function formatMoneyForDisplay(valueAmount: number | null | undefined, nativeCurrency: CurrencyCode, valueCad: number, context: DisplayContext) {
  if ((valueAmount ?? 0) > 0 && nativeCurrency === context.currency) {
    return formatMoney(valueAmount ?? 0, context.currency);
  }
  return formatDisplayCurrency(valueCad, context);
}

function formatCompactPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

function formatSignedPercent(value: number, digits = 0) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getMonthLabels(language: DisplayLanguage) {
  return language === "zh" ? MONTH_LABELS_ZH : MONTH_LABELS_EN;
}

function getLatestMonthLabel(language: DisplayLanguage) {
  const now = new Date();
  return now.toLocaleString(language === "zh" ? "zh-CN" : "en-CA", { month: "long", year: "numeric" });
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

function getAccountNickname(account: InvestmentAccount) {
  return account.nickname.trim();
}

function buildAccountLabelMaps(accounts: InvestmentAccount[], language: DisplayLanguage) {
  const typeLabelMap = new Map(accounts.map((account) => [account.id, getAccountTypeLabel(account.type, language)]));
  const nicknameCounts = new Map<string, number>();

  for (const account of accounts) {
    const nickname = getAccountNickname(account);
    nicknameCounts.set(nickname, (nicknameCounts.get(nickname) ?? 0) + 1);
  }

  const initialLabels = accounts.map((account) => {
    const nickname = getAccountNickname(account);
    const typeLabel = typeLabelMap.get(account.id) ?? account.type;
    const isGenericNickname = !nickname || nickname === account.type || nickname === typeLabel;
    const hasDuplicateNickname = (nicknameCounts.get(nickname) ?? 0) > 1;

    return {
      account,
      label: isGenericNickname || hasDuplicateNickname
        ? `${account.institution} ${typeLabel}`
        : nickname
    };
  });

  const labelCounts = new Map<string, number>();
  for (const item of initialLabels) {
    labelCounts.set(item.label, (labelCounts.get(item.label) ?? 0) + 1);
  }

  const secondaryLabels = initialLabels.map((item) => ({
    account: item.account,
    label: (labelCounts.get(item.label) ?? 0) > 1
      ? `${item.label} · ${item.account.currency ?? "CAD"}`
      : item.label
  }));

  const finalCounts = new Map<string, number>();
  const finalRanks = new Map<string, number>();
  for (const item of secondaryLabels) {
    finalCounts.set(item.label, (finalCounts.get(item.label) ?? 0) + 1);
  }

  const instanceLabelMap = new Map<string, string>();
  const instanceDetailMap = new Map<string, string>();
  for (const item of secondaryLabels) {
    const rank = (finalRanks.get(item.label) ?? 0) + 1;
    finalRanks.set(item.label, rank);
    const finalLabel = (finalCounts.get(item.label) ?? 0) > 1 ? `${item.label} · ${rank}` : item.label;
    instanceLabelMap.set(item.account.id, finalLabel);
    instanceDetailMap.set(
      item.account.id,
      pick(
        language,
        `${typeLabelMap.get(item.account.id)} · ${item.account.institution} · ${item.account.currency ?? "CAD"}`,
        `${typeLabelMap.get(item.account.id)} · ${item.account.institution} · ${item.account.currency ?? "CAD"}`
      )
    );
  }

  return { typeLabelMap, instanceLabelMap, instanceDetailMap };
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

function getSixMonthSeries(latestValue: number, profile: PreferenceProfile, labels = MONTH_LABELS_EN) {
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

function getMonthlyTransactionSeries(transactions: CashflowTransaction[], language: DisplayLanguage) {
  const outflows = transactions.filter((transaction) => transaction.direction === "outflow");
  const monthlyTotals = groupBy(
    outflows,
    (transaction) => transaction.bookedAt.slice(0, 7),
    (transaction) => transaction.amountCad
  );
  const sortedKeys = [...monthlyTotals.keys()].sort();

  if (sortedKeys.length >= 6) {
    return sortedKeys.slice(-6).map((key) => ({
      label: new Date(`${key}-01T00:00:00`).toLocaleString(language === "zh" ? "zh-CN" : "en-CA", { month: "short" }),
      value: round(monthlyTotals.get(key) ?? 0, 0)
    }));
  }

  const latestValue = round(sortedKeys.length > 0 ? monthlyTotals.get(sortedKeys[sortedKeys.length - 1]) ?? 0 : 0, 0);
  const fallback = [1.08, 1.05, 1.02, 0.98, 1.01, 1].map((factor) => round(latestValue * factor, 0));
  return getMonthLabels(language).map((label, index) => ({ label, value: fallback[index] ?? latestValue }));
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

function getRecommendationTheme(
  run: RecommendationRun | null,
  context: DisplayContext,
  language: DisplayLanguage,
  profile: PreferenceProfile,
  accounts: InvestmentAccount[]
) {
  const lead = run?.items[0];
  if (!lead) {
    return {
      theme: pick(language, "??????,?????????????????", "The system needs your data and preferences before it can suggest a next step"),
      subtitle: pick(language, "??????????????", "There is no usable next-step recommendation yet."),
      reason: pick(language, "?????????????????,?????????????????", "Once your accounts, holdings, and target mix are in place, the system can start suggesting where new money likely helps first."),
      signals: [
        pick(language, "??????????????,?????????????", "Import at least one account and one holding so the system can understand the current portfolio."),
        pick(language, "???????????,??????????????????", "Then save your preferences so the system knows what kind of mix you want to move toward.")
      ]
    };
  }

  return {
    theme: pick(
      language,
      `${getAccountTypeLabel(lead.targetAccountType, language)} ? ${getAssetClassLabel(lead.assetClass, language)}`,
      `${getAssetClassLabel(lead.assetClass, language)} in ${getAccountTypeLabel(lead.targetAccountType, language)}`
    ),
    subtitle: pick(
      language,
      `????????? ${formatDisplayCurrency(run.contributionAmountCad, context)},?????????`,
      `If you are putting in ${formatDisplayCurrency(run.contributionAmountCad, context)} next, this is the path the system would check first.`
    ),
    reason: getRecommendationItemExplanation(lead, context, language),
    signals: getRecommendationAssumptions(profile, accounts, language).slice(0, 2)
  };
}

function getSignalForHolding(holding: HoldingPosition, driftMap: Map<string, number>, language: DisplayLanguage) {
  const gap = driftMap.get(holding.assetClass) ?? 0;
  if (holding.symbol === "CASH" && holding.weightPct > 8) {
    return pick(language, "???????????????", "Cash drag is still elevated relative to the target mix.");
  }
  if (gap < -4) {
    return pick(
      language,
      `???????????,??????? ${formatCompactPercent(Math.abs(gap), 0)}?`,
      `This sleeve remains underweight by ${formatCompactPercent(Math.abs(gap), 0)} versus target.`
    );
  }
  if (holding.weightPct >= 15) {
    return pick(language, "?????????,????????????", "Core position is carrying a meaningful share of total portfolio risk.");
  }
  return pick(language, "?????????????,??????????????", "Supports the current portfolio mix without driving the main gaps.");
}

function formatHoldingLastUpdated(value: string | null | undefined, language: DisplayLanguage) {
  if (!value) {
    return pick(language, "????", "Not refreshed");
  }

  return new Date(value).toLocaleString(language === "zh" ? "zh-CN" : "en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getHoldingFreshnessVariant(value?: string | null): "success" | "warning" | "neutral" {
  if (!value) {
    return "neutral";
  }

  const ageMs = Date.now() - new Date(value).getTime();
  const ageMinutes = Math.max(0, Math.round(ageMs / 60000));
  if (ageMinutes <= 30) {
    return "success";
  }
  if (ageMinutes <= 180) {
    return "warning";
  }
  return "neutral";
}

function sanitizeRecommendationNotes(notes: string[] | null | undefined) {
  return (notes ?? []).filter((note) => {
    const normalized = note.trim();
    if (!normalized) {
      return false;
    }

    if (/[?]{4,}/.test(normalized)) {
      return false;
    }

    if (/[?Â]/.test(normalized)) {
      return false;
    }

    return true;
  });
}

function getPortfolioQuoteStatus(holdings: HoldingPosition[], language: DisplayLanguage) {
  const quotedHoldings = holdings.filter((holding) => (holding.lastPriceCad ?? 0) > 0 && holding.updatedAt);
  const coverage = holdings.length > 0
    ? pick(
      language,
      `${quotedHoldings.length}/${holdings.length} ?????????????`,
      `${quotedHoldings.length}/${holdings.length} holdings already have usable prices`
    )
    : pick(language, "?????????????", "There are no holdings with refreshable prices yet");

  if (quotedHoldings.length === 0) {
    return {
      lastRefreshed: pick(language, "???????", "No price refresh yet"),
      freshness: pick(language, "??", "Unknown"),
      coverage
    };
  }

  const latestUpdatedAt = quotedHoldings
    .map((holding) => new Date(holding.updatedAt!))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  const ageMs = Date.now() - latestUpdatedAt.getTime();
  const ageMinutes = Math.max(0, Math.round(ageMs / 60000));
  const freshness = ageMinutes <= 30
    ? pick(language, "?????,??", "Fresh within cache window")
    : ageMinutes <= 180
      ? pick(language, "??,?????", "Stale but still usable")
      : pick(language, "????", "Refresh recommended");

  return {
    lastRefreshed: latestUpdatedAt.toLocaleString(language === "zh" ? "zh-CN" : "en-CA", {
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

function getRiskDetail(riskProfile: RiskProfile, language: DisplayLanguage) {
  const detail = RISK_DETAILS[riskProfile];
  return pick(language, detail.zh, detail.en);
}

function getAccountCaption(type: InvestmentAccount["type"], language: DisplayLanguage) {
  const caption = ACCOUNT_CAPTIONS[type];
  return pick(language, caption.zh, caption.en);
}

function getAccountTypeFit(type: InvestmentAccount["type"], language: DisplayLanguage) {
  const fit = ACCOUNT_TYPE_FIT[type];
  return pick(language, fit.zh, fit.en);
}

function formatRoomDetail(account: InvestmentAccount, display: DisplayContext, language: DisplayLanguage) {
  if (account.contributionRoomCad == null) {
    return pick(language, "???????", "No tax shelter");
  }
  return pick(
    language,
    `?? ${formatDisplayCurrency(account.contributionRoomCad, display)} ??`,
    `${formatDisplayCurrency(account.contributionRoomCad, display)} room left`
  );
}

function getAccountBadgeLabel(index: number, includedInPriority: boolean, language: DisplayLanguage) {
  if (index === 0) {
    return pick(language, "??", "Priority");
  }
  if (includedInPriority) {
    return pick(language, "????", "Tax fit");
  }
  return pick(language, "??", "Review");
}

function formatAccountPriorityOrder(priorityOrder: InvestmentAccount["type"][], language: DisplayLanguage) {
  return priorityOrder.map((type) => getAccountTypeLabel(type, language)).join(" -> ");
}

function getEffectiveAccountPriorityOrder(accounts: InvestmentAccount[], priorityOrder: InvestmentAccount["type"][]) {
  const accountTypes = new Set(accounts.map((account) => account.type));
  const availableShelteredTypes = new Set(
    accounts
      .filter((account) => account.type === "Taxable" || account.contributionRoomCad == null || account.contributionRoomCad > 0)
      .map((account) => account.type)
  );

  return priorityOrder.filter((type) => accountTypes.has(type) && availableShelteredTypes.has(type));
}

function getExhaustedPriorityTypes(accounts: InvestmentAccount[], priorityOrder: InvestmentAccount["type"][]) {
  const accountTypes = new Set(accounts.map((account) => account.type));
  const availableShelteredTypes = new Set(
    accounts
      .filter((account) => account.type === "Taxable" || account.contributionRoomCad == null || account.contributionRoomCad > 0)
      .map((account) => account.type)
  );

  return priorityOrder.filter((type) => accountTypes.has(type) && !availableShelteredTypes.has(type));
}

function formatHoldingPrice(amount: number | null | undefined, currency: CurrencyCode | null | undefined, amountCad: number | null | undefined, display: DisplayContext, language: DisplayLanguage) {
  if (amountCad != null && amountCad > 0) {
    return formatMoneyForDisplay(amount ?? amountCad, currency ?? "CAD", amountCad, display);
  }
  return pick(language, "????", "Not priced");
}

function getRecommendationAssumptions(profile: PreferenceProfile, accounts: InvestmentAccount[], language: DisplayLanguage) {
  const effectiveOrder = getEffectiveAccountPriorityOrder(accounts, profile.accountFundingPriority);
  const exhaustedTypes = getExhaustedPriorityTypes(accounts, profile.accountFundingPriority);
  return [
    pick(
      language,
      "???????????????,???????????????????",
      "The system first compares your current mix with the target mix you set."
    ),
    pick(
      language,
      `??????????????????????????? ${formatAccountPriorityOrder(effectiveOrder, language)}?`,
      `It also considers which accounts you prefer to use first. The usable order for this contribution is ${formatAccountPriorityOrder(effectiveOrder, language)}.`
    ),
    ...(exhaustedTypes.length > 0
      ? [
          pick(
            language,
            `${formatAccountPriorityOrder(exhaustedTypes, language)} ???????,????????????`,
            `${formatAccountPriorityOrder(exhaustedTypes, language)} drops back for this contribution because the available room is already used up.`
          )
        ]
      : []),
    profile.taxAwarePlacement
      ? pick(
        language,
        "?????“??????”????,???????????????????????",
        "You have account placement guidance turned on, so the system pays more attention to which account is a better long-term home."
      )
      : pick(
        language,
        "?????“??????”????,??????????????????",
        "Account placement guidance is off, so the run leans more on allocation gaps and room availability."
      )
  ];
}

function getRecommendationItemExplanation(
  item: RecommendationRun["items"][number],
  display: DisplayContext,
  language: DisplayLanguage
) {
  const assetClass = getAssetClassLabel(item.assetClass, language);
  const accountType = getAccountTypeLabel(item.targetAccountType, language);
  return pick(
    language,
    `${assetClass} ???????,???? ${formatDisplayCurrency(item.amountCad, display)} ???? ${accountType} ??`,
    `${assetClass} is currently underweight relative to the configured target, so this run allocates ${formatDisplayCurrency(item.amountCad, display)} to ${accountType}.`
  );
}

function getGuidedQuestions(profile: PreferenceProfile, language: DisplayLanguage) {
  if (profile.riskProfile === "Growth") {
    return [
      pick(language, "???????????,????????", "How important is the home goal compared with long-term portfolio growth?"),
      pick(language, "???????,???????????????", "How much short-term volatility can you tolerate before changing course?"),
      pick(language, "????????,?????????????????", "Should the engine prioritize sheltered room before broader drift correction?"),
      pick(language, "???????,????????????", "How much cash should remain available for shorter-term milestones?")
    ];
  }

  return [
    pick(language, "?????????????????", "What is your primary financial goal and time horizon?"),
    pick(language, "????????????????", "How comfortable are you with portfolio volatility and drawdowns?"),
    pick(language, "??????????,???????????", "Should the engine prioritize tax efficiency or staying close to current holdings?"),
    pick(language, "??????????,???????????????", "Should recommendations preserve a larger cash buffer for upcoming spending?")
  ];
}

function getManualGroups(profile: PreferenceProfile, language: DisplayLanguage): SettingsData["manualGroups"] {
  return [
    {
      title: pick(language, "?????????", "Risk profile and target allocation"),
      description: pick(
        language,
        `?????${getRiskProfileLabel(profile.riskProfile, language)},??? ${sortTargetsForDisplay(profile.targetAllocation).length} ????????`,
        `Current profile is ${profile.riskProfile.toLowerCase()} with ${sortTargetsForDisplay(profile.targetAllocation).length} target sleeves configured.`
      )
    },
    {
      title: pick(language, "???????", "Account funding priorities"),
      description: pick(language, `????:${profile.accountFundingPriority.join(" -> ")}`, `Current order: ${profile.accountFundingPriority.join(" -> ")}`),
      badge: pick(language, "???", "Sortable")
    },
    {
      title: pick(language, "????", "Recommendation behavior"),
      description: pick(
        language,
        `???????${getTransitionPreferenceLabel(profile.transitionPreference, language)},???${getRecommendationStrategyLabel(profile.recommendationStrategy, language)}?`,
        `Transition is ${profile.transitionPreference}, strategy is ${profile.recommendationStrategy}.`
      )
    },
    {
      title: pick(language, "??????", "Tax-aware placement"),
      description: profile.taxAwarePlacement
        ? pick(language, "??????????????????????????????", "Tax-aware placement is enabled. Advanced province and marginal bracket fields can stay collapsed by default.")
        : pick(language, "??????????????????????????????", "Tax-aware placement is disabled. The engine will favor simpler account-fit rules."),
      badge: pick(language, "??", "Advanced")
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
  display: DisplayContext;
}): DashboardData {
  const { viewer, accounts, holdings, transactions, profile, latestRun, display } = args;
  const language = viewer.displayLanguage;
  const { typeLabelMap, instanceLabelMap } = buildAccountLabelMaps(accounts, language);
  const totalPortfolio = sum(accounts.map((account) => account.marketValueCad));
  const availableRoom = sum(accounts.map((account) => account.contributionRoomCad ?? 0));
  const currentAllocation = getCurrentAllocation(holdings);
  const targetAllocation = getTargetAllocation(profile);
  const health = buildPortfolioHealthSummary({ accounts, holdings, profile, language });
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
  const recommendation = getRecommendationTheme(latestRun, display, language, profile, accounts);

  return {
    displayContext: buildDisplayContext(display, language),
    metrics: [
      {
        label: pick(language, "???", "Total Portfolio"),
        value: formatDisplayCurrency(totalPortfolio, display),
        detail: pick(language, `${accounts.length} ??????`, `${accounts.length} accounts connected`)
      },
      {
        label: pick(language, "????", "Available Room"),
        value: formatDisplayCurrency(availableRoom, display),
        detail: pick(language, "TFSA?RRSP ? FHSA ??????", "TFSA, RRSP, and FHSA contribution room remaining")
      },
      {
        label: pick(language, "????", "Portfolio Risk"),
        value: getRiskProfileLabel(profile.riskProfile, language),
        detail: getRiskDetail(profile.riskProfile, language)
      },
      {
        label: pick(language, "?????", "Portfolio Health Score"),
        value: `${health.score}`,
        detail: health.status
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
        id: account.id,
        name: instanceLabelMap.get(account.id) ?? account.nickname,
        caption: pick(
          language,
          `${typeLabelMap.get(account.id) ?? account.type} · ${getAccountCaption(account.type, language)}`,
          `${typeLabelMap.get(account.id) ?? account.type} · ${getAccountCaption(account.type, language)}`
        ),
        value: formatMoneyForDisplay(account.marketValueAmount, account.currency ?? "CAD", account.marketValueCad, display),
        room: formatRoomDetail(account, display, language),
        badge: getAccountBadgeLabel(index, accountPriorityOrder.includes(account.type), language),
        badgeVariant: index === 0
          ? PRIORITY_BADGE_VARIANTS.first
          : accountPriorityOrder.includes(account.type)
            ? PRIORITY_BADGE_VARIANTS.second
            : PRIORITY_BADGE_VARIANTS.later
      })),
    drift: drift.map((item) => ({
      assetClass: getAssetClassLabel(item.assetClass, language),
      current: formatCompactPercent(item.current, 0),
      target: formatCompactPercent(item.target, 0),
      delta: formatSignedPercent(item.delta, 0)
    })),
    assetMix: [...currentAllocation.entries()].map(([name, value]) => ({ name: getAssetClassLabel(name, language), value: round(value, 0) })),
    topHoldings: [...holdings]
      .sort((left, right) => right.marketValueCad - left.marketValueCad)
      .slice(0, 3)
      .map((holding) => ({
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        account: instanceLabelMap.get(holding.accountId) ?? pick(language, "??", "Account"),
        lastPrice: formatHoldingPrice(holding.lastPriceAmount, holding.currency, holding.lastPriceCad, display, language),
        lastUpdated: formatHoldingLastUpdated(holding.updatedAt, language),
        freshnessVariant: getHoldingFreshnessVariant(holding.updatedAt),
        weight: formatCompactPercent(holding.weightPct, 1),
        value: formatMoneyForDisplay(holding.marketValueAmount, holding.currency ?? "CAD", holding.marketValueCad, display)
      })),
    netWorthTrend: getSixMonthSeries(totalPortfolio, profile, getMonthLabels(language)),
    spendingMonthLabel: getLatestMonthLabel(language),
    savingsPattern: formatCompactPercent(spending.savingsRate, 1),
    investableCash: formatDisplayCurrency(spending.investableCash, display),
    spendingCategories: spending.categories.slice(0, 3).map(([name, value]) => ({
      name: getCategoryLabel(name, language),
      value: formatDisplayCurrency(value, display)
    })),
    healthPreview: health.radar,
    healthScore: {
      score: health.score,
      status: health.status,
      strongestDimension: `${health.strongestDimension.label} ${health.strongestDimension.value}`,
      weakestDimension: `${health.weakestDimension.label} ${health.weakestDimension.value}`,
      highlights: health.highlights
    },
    recommendation
  };
}

export function buildPortfolioData(args: {
  language: DisplayLanguage;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  display: DisplayContext;
}): PortfolioData {
  const { language, accounts, holdings, profile, display } = args;
  const { typeLabelMap, instanceLabelMap, instanceDetailMap } = buildAccountLabelMaps(accounts, language);
  const currentAllocation = getCurrentAllocation(holdings);
  const targetAllocation = getTargetAllocation(profile);
  const health = buildPortfolioHealthSummary({ accounts, holdings, profile, language });
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
    name: getSectorLabel(name, language),
    value: totalPortfolio > 0 ? round((value / totalPortfolio) * 100, 0) : 0
  }));
  const sectorRemainder = round(100 - sum(sectorExposure.map((item) => item.value)), 0);
  if (sectorRemainder > 0) {
    sectorExposure.push({ name: pick(language, "??", "Other"), value: sectorRemainder });
  }

  const largestHolding = [...holdings].sort((left, right) => right.weightPct - left.weightPct)[0];
  const mainGap = [...driftMap.entries()].sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))[0];
  const accountTypeAllocation = [...groupBy(accounts, (account) => account.type, (account) => account.marketValueCad).entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([accountType, value]) => {
      const accountCount = accounts.filter((account) => account.type === accountType).length;
      return {
        id: accountType,
        name: getAccountTypeLabel(accountType as InvestmentAccount["type"], language),
        value: totalPortfolio > 0 ? round((value / totalPortfolio) * 100, 0) : 0,
        detail: pick(language, `${accountCount} ???`, `${accountCount} account${accountCount > 1 ? "s" : ""}`)
      };
    });
  const accountInstanceAllocation = [...accounts]
    .sort((left, right) => right.marketValueCad - left.marketValueCad)
    .map((account) => ({
      id: account.id,
      name: instanceLabelMap.get(account.id) ?? account.nickname,
      value: totalPortfolio > 0 ? round((account.marketValueCad / totalPortfolio) * 100, 0) : 0,
      detail: instanceDetailMap.get(account.id)
    }));
  const accountCards = [...accounts]
    .sort((left, right) => right.marketValueCad - left.marketValueCad)
    .map((account) => {
      const accountHoldings = holdings
        .filter((holding) => holding.accountId === account.id)
        .sort((left, right) => right.marketValueCad - left.marketValueCad);
      return {
        id: account.id,
        name: instanceLabelMap.get(account.id) ?? account.nickname,
        typeId: account.type,
        typeLabel: typeLabelMap.get(account.id) ?? account.type,
        institution: account.institution,
        currency: account.currency ?? "CAD",
        value: formatDisplayCurrency(account.marketValueCad, display),
        share: totalPortfolio > 0
          ? pick(language, `????? ${formatCompactPercent((account.marketValueCad / totalPortfolio) * 100, 0)}`, `About ${formatCompactPercent((account.marketValueCad / totalPortfolio) * 100, 0)} of the portfolio`)
          : pick(language, "?????", "No assets yet"),
        room: account.contributionRoomCad !== null
          ? pick(
            language,
            `???? CAD ???? ${formatMoney(account.contributionRoomCad, "CAD")}`,
            `${formatMoney(account.contributionRoomCad, "CAD")} of planning-base CAD room left`
          )
          : pick(language, "???????????", "This account type does not track room here"),
        topHoldings: accountHoldings.slice(0, 3).map((holding) => holding.symbol),
        href: `/portfolio?account=${account.id}`
      };
    });
  const accountContexts = [...accounts]
    .sort((left, right) => right.marketValueCad - left.marketValueCad)
    .map((account) => {
      const accountHoldings = holdings.filter((holding) => holding.accountId === account.id);
      const accountHealth = buildPortfolioHealthSummary({
        accounts: [account],
        holdings: accountHoldings,
        profile,
        language
      });
      const accountTotal = account.marketValueCad || 1;
      return {
        id: account.id,
        name: instanceLabelMap.get(account.id) ?? account.nickname,
        typeId: account.type,
        typeLabel: typeLabelMap.get(account.id) ?? account.type,
        performance: getSixMonthSeries(accountTotal, profile, getMonthLabels(language)).map((point) => ({
          label: point.label,
          value: round((point.value / (getSixMonthSeries(accountTotal, profile)[0]?.value || 1)) * 100, 1)
        })),
        healthScore: {
          score: accountHealth.score,
          status: accountHealth.status,
          radar: accountHealth.radar,
          highlights: accountHealth.highlights,
          strongestDimension: `${accountHealth.strongestDimension.label} ${accountHealth.strongestDimension.value}`,
          weakestDimension: `${accountHealth.weakestDimension.label} ${accountHealth.weakestDimension.value}`
        },
        healthDetail: {
          score: accountHealth.score,
          status: accountHealth.status,
          radar: accountHealth.radar,
          highlights: accountHealth.highlights,
          strongestDimension: `${accountHealth.strongestDimension.label} ${accountHealth.strongestDimension.value}`,
          weakestDimension: `${accountHealth.weakestDimension.label} ${accountHealth.weakestDimension.value}`,
          dimensions: accountHealth.dimensions,
          actionQueue: accountHealth.actionQueue,
          accountDrilldown: accountHealth.accountDrilldown,
          holdingDrilldown: accountHealth.holdingDrilldown
        },
        summaryPoints: [
          pick(
            language,
            `${instanceLabelMap.get(account.id) ?? account.nickname} ??????? ${formatCompactPercent(totalPortfolio > 0 ? (account.marketValueCad / totalPortfolio) * 100 : 0, 0)} ????`,
            `${instanceLabelMap.get(account.id) ?? account.nickname} currently holds about ${formatCompactPercent(totalPortfolio > 0 ? (account.marketValueCad / totalPortfolio) * 100 : 0, 0)} of the portfolio.`
          ),
          accountHoldings[0]
            ? pick(
              language,
              `????????????? ${accountHoldings.sort((left, right) => right.marketValueCad - left.marketValueCad)[0]?.symbol}?`,
              `${accountHoldings.sort((left, right) => right.marketValueCad - left.marketValueCad)[0]?.symbol} is currently the largest holding in this account.`
            )
            : pick(language, "?????????????", "There are no holdings in this account yet."),
          account.contributionRoomCad !== null
            ? pick(language, `??????? ${formatMoney(account.contributionRoomCad, "CAD")} ????????`, `This account still has ${formatMoney(account.contributionRoomCad, "CAD")} of planning-base room left.`)
            : pick(language, "??????????????", "This account type does not track contribution room here.")
        ]
      };
    });

  return {
    displayContext: buildDisplayContext(display, language),
    performance: getSixMonthSeries(totalPortfolio || 1, profile, getMonthLabels(language)).map((point, index) => ({
      label: point.label,
      value: round((performanceBase[index] / baseline) * 100, 1)
    })),
    accountTypeAllocation,
    accountInstanceAllocation,
    accountCards,
    accountContexts,
    sectorExposure,
    quoteStatus: getPortfolioQuoteStatus(holdings, language),
    healthScore: {
      score: health.score,
      status: health.status,
      radar: health.radar,
      highlights: health.highlights,
      strongestDimension: `${health.strongestDimension.label} ${health.strongestDimension.value}`,
      weakestDimension: `${health.weakestDimension.label} ${health.weakestDimension.value}`,
      dimensions: health.dimensions,
      actionQueue: health.actionQueue,
      accountDrilldown: health.accountDrilldown,
      holdingDrilldown: health.holdingDrilldown
    },
    holdings: [...holdings]
      .sort((left, right) => right.marketValueCad - left.marketValueCad)
      .map((holding) => ({
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        assetClass: holding.assetClass,
        sector: holding.sector,
        accountId: holding.accountId,
        accountType: accounts.find((account) => account.id === holding.accountId)?.type ?? "Taxable",
        account: instanceLabelMap.get(holding.accountId) ?? pick(language, "账户", "Account"),
        href: `/portfolio/holding/${holding.id}`,
        lastPrice: formatHoldingPrice(holding.lastPriceAmount, holding.currency, holding.lastPriceCad, display, language),
        lastUpdated: formatHoldingLastUpdated(holding.updatedAt, language),
        freshnessVariant: getHoldingFreshnessVariant(holding.updatedAt),
        weight: formatCompactPercent(holding.weightPct, 1),
        gainLoss: formatSignedPercent(holding.gainLossPct, 1),
        signal: getSignalForHolding(holding, driftMap, language)
      })),
    summaryPoints: [
      mainGap
        ? pick(
          language,
          `${getAssetClassLabel(mainGap[0], language)} ???????????,?????`,
          `${getAssetClassLabel(mainGap[0], language)} is the clearest allocation gap versus the configured target.`
        )
        : pick(language, "????????,??????????????", "Set a target mix first so the system can see which sleeve is missing the most."),
      largestHolding
        ? pick(language, `${largestHolding.symbol} ???????????,?????????????`, `${largestHolding.symbol} is the largest position and drives the current concentration score.`)
        : pick(language, "?????,???????????????????", "Import holdings first so the system can tell whether a few positions are getting too heavy."),
      accounts.some((account) => account.type === "Taxable")
        ? pick(language, "???????????,?????????,???????????", "You are already using taxable accounts, so where new money goes matters more over the long run.")
        : pick(language, "???????????????,?????????????", "Most of the money is still inside sheltered accounts, so account placement is still fairly straightforward.")
    ]
  };
}


export function buildPortfolioAccountDetailData(args: {
  language: DisplayLanguage;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  display: DisplayContext;
  accountId: string;
}): PortfolioAccountDetailData | null {
  const { language, accounts, holdings, profile, display, accountId } = args;
  const portfolio = buildPortfolioData({ language, accounts, holdings, profile, display });
  const accountCard = portfolio.accountCards.find((account) => account.id === accountId);
  const accountContext = portfolio.accountContexts.find((account) => account.id === accountId);

  if (!accountCard || !accountContext) {
    return null;
  }

  const rawHoldings = holdings.filter((holding) => holding.accountId === accountId);
  const accountTotalCad = sum(rawHoldings.map((holding) => holding.marketValueCad));
  const allocation = [...groupBy(rawHoldings, (holding) => holding.assetClass, (holding) => holding.marketValueCad).entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([assetClass, value]) => ({
      name: getAssetClassLabel(assetClass, language),
      value: accountTotalCad > 0 ? round((value / accountTotalCad) * 100, 0) : 0
    }));

  return {
    displayContext: portfolio.displayContext,
    account: {
      id: accountCard.id,
      name: accountCard.name,
      typeId: accountCard.typeId,
      typeLabel: accountCard.typeLabel,
      institution: accountCard.institution,
      currency: accountCard.currency,
      value: accountCard.value,
      share: accountCard.share,
      room: accountCard.room,
      topHoldings: accountCard.topHoldings,
      summaryPoints: accountContext.summaryPoints
    },
    performance: accountContext.performance,
    allocation,
    healthScore: accountContext.healthDetail,
    holdings: portfolio.holdings.filter((holding) => holding.accountId === accountId)
  };
}

export function buildPortfolioHoldingDetailData(args: {
  language: DisplayLanguage;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  display: DisplayContext;
  holdingId: string;
}): PortfolioHoldingDetailData | null {
  const { language, accounts, holdings, profile, display, holdingId } = args;
  const portfolio = buildPortfolioData({ language, accounts, holdings, profile, display });
  const health = buildPortfolioHealthSummary({ accounts, holdings, profile, language });
  const rawHolding = holdings.find((holding) => holding.id === holdingId);
  const viewHolding = portfolio.holdings.find((holding) => holding.id === holdingId);

  if (!rawHolding || !viewHolding) {
    return null;
  }

  const account = accounts.find((entry) => entry.id === rawHolding.accountId);
  const accountCard = portfolio.accountCards.find((entry) => entry.id === rawHolding.accountId);
  const accountTotalCad = sum(holdings.filter((holding) => holding.accountId === rawHolding.accountId).map((holding) => holding.marketValueCad));
  const accountSharePct = accountTotalCad > 0 ? round((rawHolding.marketValueCad / accountTotalCad) * 100, 1) : 0;
  const assetClassTargetPct = getTargetAllocation(profile).get(rawHolding.assetClass) ?? 0;
  const assetClassCurrentPct = getCurrentAllocation(holdings).get(rawHolding.assetClass) ?? 0;
  const holdingHealth = health.holdingDrilldown.find((item) => item.id === holdingId);

  return {
    displayContext: portfolio.displayContext,
    holding: {
      id: viewHolding.id,
      symbol: viewHolding.symbol,
      name: viewHolding.name,
      assetClass: getAssetClassLabel(viewHolding.assetClass, language),
      sector: getSectorLabel(viewHolding.sector, language),
      currency: rawHolding.currency ?? "CAD",
      accountId: rawHolding.accountId,
      accountName: viewHolding.account,
      accountType: account ? getAccountTypeLabel(account.type, language) : pick(language, "账户", "Account"),
      accountHref: `/portfolio/account/${rawHolding.accountId}`,
      value: formatMoneyForDisplay(rawHolding.marketValueAmount, rawHolding.currency ?? "CAD", rawHolding.marketValueCad, display),
      lastPrice: viewHolding.lastPrice,
      lastUpdated: viewHolding.lastUpdated,
      freshnessVariant: viewHolding.freshnessVariant,
      weight: viewHolding.weight,
      gainLoss: viewHolding.gainLoss
    },
    performance: getSixMonthSeries(rawHolding.marketValueCad || 1, profile, getMonthLabels(language)).map((point, index, series) => ({
      label: point.label,
      value: round((point.value / (series[0]?.value || 1)) * 100, 1)
    })),
    portfolioRole: [
      pick(
        language,
        `${rawHolding.symbol} 现在大约占你整个组合 ${rawHolding.weightPct.toFixed(1)}%，在 ${accountCard?.name ?? pick(language, "当前账户", "the current account")} 里大约占 ${accountSharePct.toFixed(1)}%。`,
        `${rawHolding.symbol} currently represents about ${rawHolding.weightPct.toFixed(1)}% of the full portfolio and about ${accountSharePct.toFixed(1)}% of ${accountCard?.name ?? "the current account"}.`
      ),
      pick(
        language,
        `它属于 ${getAssetClassLabel(rawHolding.assetClass, language)}。你给这类资产设的目标大约是 ${assetClassTargetPct.toFixed(1)}%，现在实际大约是 ${assetClassCurrentPct.toFixed(1)}%。`,
        `It belongs to ${getAssetClassLabel(rawHolding.assetClass, language)}. Your target for this sleeve is about ${assetClassTargetPct.toFixed(1)}%, and the current mix is about ${assetClassCurrentPct.toFixed(1)}%.`
      ),
      viewHolding.signal
    ],
    healthSummary: {
      score: holdingHealth?.score ?? 68,
      status: holdingHealth?.status ?? pick(language, "可用", "Usable"),
      summary: holdingHealth?.summary ?? pick(language, "这笔仓位暂时没有被系统判定成最急的问题。", "The system does not currently treat this holding as the most urgent issue."),
      drivers: holdingHealth?.drivers ?? [
        pick(language, "先看这笔仓位占整体和占账户各是多少。", "Start with how large this position is in the full portfolio and inside its account."),
        pick(language, "再看它属于哪类资产，以及这类资产现在是不是已经配多了或配少了。", "Then check which sleeve it belongs to and whether that sleeve is already over- or under-filled.")
      ],
      actions: holdingHealth?.actions ?? [
        pick(language, "如果暂时没有明显问题，就先别急着动，等下一笔资金安排时再一起看。", "If nothing stands out yet, leave it alone for now and review it again with the next contribution.")
      ]
    }
  };
}
export function buildRecommendationsData(args: {
  language: DisplayLanguage;
  profile: PreferenceProfile;
  accounts: InvestmentAccount[];
  latestRun: RecommendationRun | null;
  scenarioRuns?: RecommendationRun[];
  display: DisplayContext;
}): RecommendationsData {
  const { language, profile, accounts, latestRun, scenarioRuns = [], display } = args;
  const equityTarget = sum(profile.targetAllocation
    .filter((target) => target.assetClass !== "Fixed Income" && target.assetClass !== "Cash")
    .map((target) => target.targetPct));
  const fixedIncomeTarget = profile.targetAllocation.find((target) => target.assetClass === "Fixed Income")?.targetPct ?? 0;
  const cashTarget = profile.targetAllocation.find((target) => target.assetClass === "Cash")?.targetPct ?? 0;
  const baselineItems = latestRun?.items ?? [];
  const effectiveAccountPriorityOrder = getEffectiveAccountPriorityOrder(accounts, profile.accountFundingPriority);
  const exhaustedPriorityTypes = getExhaustedPriorityTypes(accounts, profile.accountFundingPriority);

  const buildScenarioDiffs = (scenarioRun: RecommendationRun, scenarioIndex: number) => {
    if (baselineItems.length === 0) {
      return [
        pick(
          language,
          "????????????,???????????????????????",
          "There is no saved baseline recommendation yet, so this card only shows the standalone result for this amount."
        )
      ];
    }

    if (scenarioRun.contributionAmountCad === latestRun?.contributionAmountCad) {
      return [
        pick(
          language,
          "???????????????,??????????????",
          "This is the current recommendation shown on the page, and the other amounts are compared against it."
        )
      ];
    }

    const diffs: string[] = [];
    const baselineTop = baselineItems[0];
    const scenarioTop = scenarioRun.items[0];

    if (baselineTop && scenarioTop && (baselineTop.assetClass !== scenarioTop.assetClass || baselineTop.targetAccountType !== scenarioTop.targetAccountType)) {
      diffs.push(
        pick(
          language,
          `?????? ${getAssetClassLabel(baselineTop.assetClass, language)} -> ${getAccountTypeLabel(baselineTop.targetAccountType, language)},???? ${getAssetClassLabel(scenarioTop.assetClass, language)} -> ${getAccountTypeLabel(scenarioTop.targetAccountType, language)}?`,
          `The top priority shifts from ${getAssetClassLabel(baselineTop.assetClass, language)} -> ${getAccountTypeLabel(baselineTop.targetAccountType, language)} to ${getAssetClassLabel(scenarioTop.assetClass, language)} -> ${getAccountTypeLabel(scenarioTop.targetAccountType, language)}.`
        )
      );
    } else {
      diffs.push(
        pick(
          language,
          "?????????,?????????????????",
          "The top priority stays the same, so the amount change mainly affects sizing rather than ranking."
        )
      );
    }

    const baselineMap = new Map(baselineItems.map((item) => [item.assetClass, item]));
    const accountShift = scenarioRun.items.find((item) => {
      const baseline = baselineMap.get(item.assetClass);
      return baseline && baseline.targetAccountType !== item.targetAccountType;
    });
    if (accountShift) {
      const baseline = baselineMap.get(accountShift.assetClass)!;
      diffs.push(
        pick(
          language,
          `${getAssetClassLabel(accountShift.assetClass, language)} ?????? ${getAccountTypeLabel(baseline.targetAccountType, language)} ??? ${getAccountTypeLabel(accountShift.targetAccountType, language)}?`,
          `${getAssetClassLabel(accountShift.assetClass, language)} shifts from ${getAccountTypeLabel(baseline.targetAccountType, language)} to ${getAccountTypeLabel(accountShift.targetAccountType, language)}.`
        )
      );
    }

    const newAsset = scenarioRun.items.find((item) => !baselineMap.has(item.assetClass));
    if (newAsset) {
      diffs.push(
        pick(
          language,
          `${getAssetClassLabel(newAsset.assetClass, language)} ?????????????????`,
          `${getAssetClassLabel(newAsset.assetClass, language)} becomes worth prioritizing at this contribution size.`
        )
      );
    }

    const removedAsset = baselineItems.find((item) => !scenarioRun.items.some((candidate) => candidate.assetClass === item.assetClass));
    if (removedAsset) {
      diffs.push(
        pick(
          language,
          `${getAssetClassLabel(removedAsset.assetClass, language)} ????????????????`,
          `${getAssetClassLabel(removedAsset.assetClass, language)} falls out of the top priorities at this contribution size.`
        )
      );
    }

    if (diffs.length === 1 && scenarioIndex !== 1) {
      diffs.push(
        pick(
          language,
          "??????????,?????????,??????????????",
          "This suggests the overall path stays similar as the amount changes, and the system is mostly scaling the same idea up or down."
        )
      );
    }

    return diffs.slice(0, 3);
  };

  return {
    displayContext: buildDisplayContext(display, language),
    contributionAmount: formatDisplayCurrency(latestRun?.contributionAmountCad ?? 0, display),
    engine: {
      version: latestRun?.engineVersion?.toUpperCase() ?? "V2",
      objective: latestRun?.objective
        ? pick(
          language,
          latestRun.objective === "target-tracking" ? "??????????" : latestRun.objective,
          latestRun.objective === "target-tracking" ? "Close the biggest target gap first" : latestRun.objective
        )
        : pick(language, "??????????", "Close the biggest target gap first"),
      confidence: latestRun?.confidenceScore != null
        ? `${latestRun.confidenceScore.toFixed(0)}/100`
        : pick(language, "???", "Pending")
    },
    inputs: [
      { label: pick(language, "????", "Target allocation"), value: `${equityTarget} / ${fixedIncomeTarget} / ${cashTarget}` },
      { label: pick(language, "???????", "Saved account order"), value: formatAccountPriorityOrder(profile.accountFundingPriority, language), tone: exhaustedPriorityTypes.length > 0 ? "muted" : "default" },
      { label: pick(language, "????????", "Usable order for this contribution"), value: effectiveAccountPriorityOrder.length > 0 ? formatAccountPriorityOrder(effectiveAccountPriorityOrder, language) : pick(language, "??????????", "Only taxable room is effectively available right now") },
      ...(exhaustedPriorityTypes.length > 0
        ? [{
            label: pick(language, "??????????", "De-prioritized for this contribution"),
            value: pick(
              language,
              `${formatAccountPriorityOrder(exhaustedPriorityTypes, language)}(????)`,
              `${formatAccountPriorityOrder(exhaustedPriorityTypes, language)} (room exhausted)`
            ),
            tone: "warning" as const
          }]
        : []),
      { label: pick(language, "??????", "Tax-aware placement"), value: profile.taxAwarePlacement ? pick(language, "???", "Enabled") : pick(language, "???", "Disabled") },
      { label: pick(language, "????", "Transition preference"), value: getTransitionPreferenceLabel(profile.transitionPreference, language) }
    ],
    explainer: latestRun?.assumptions?.length
      ? getRecommendationAssumptions(profile, accounts, language)
      : [
          pick(language, "??????????????,?????????????", "The system first looks at what you already hold and compares it with your target mix."),
          pick(language, "?????????,??????????", "The asset sleeve furthest from target usually moves to the front of the queue."),
          pick(language, "???????????????,???????????????", "The system first chooses the best account home, then picks a security inside that sleeve.")
        ],
    priorities: (latestRun?.items ?? []).map((item, index) => {
      const leadSecurity = item.securitySymbol && item.securityName
        ? `${item.securitySymbol} - ${item.securityName}`
        : item.tickerOptions[0] ?? pick(language, "????", "Pending security");
      const alternatives = item.tickerOptions.filter((symbol) => symbol !== item.securitySymbol);
      return {
        id: `${item.assetClass}-${item.securitySymbol ?? item.tickerOptions[0] ?? index}`,
        assetClass: getAssetClassLabel(item.assetClass, language),
        description: getRecommendationItemExplanation(item, display, language),
        amount: formatDisplayCurrency(item.amountCad, display),
        account: getAccountTypeLabel(item.targetAccountType, language),
        security: leadSecurity,
        tickers: item.tickerOptions.join(", "),
        accountFit: item.accountFitScore != null
          ? pick(
            language,
            `${getAccountTypeFit(item.targetAccountType, language)} ????? ${item.accountFitScore.toFixed(0)}/100`,
            `${getAccountTypeFit(item.targetAccountType, language)} Rough fit ${item.accountFitScore.toFixed(0)}/100`
          )
          : getAccountTypeFit(item.targetAccountType, language),
        scoreline: pick(
          language,
          `????? ${item.securityScore?.toFixed(0) ?? "--"} / ????? ${item.accountFitScore?.toFixed(0) ?? "--"} / ????? ${item.taxFitScore?.toFixed(0) ?? "--"}`,
          `Security fit ${item.securityScore?.toFixed(0) ?? "--"} / Account fit ${item.accountFitScore?.toFixed(0) ?? "--"} / Tax fit ${item.taxFitScore?.toFixed(0) ?? "--"}`
        ),
        gapSummary: item.allocationGapBeforePct != null && item.allocationGapAfterPct != null
          ? pick(
            language,
            `?????????,?????? ${item.allocationGapBeforePct.toFixed(1)}% ??? ${item.allocationGapAfterPct.toFixed(1)}%`,
            `Gap narrows from ${item.allocationGapBeforePct.toFixed(1)}% to ${item.allocationGapAfterPct.toFixed(1)}%`
          )
          : pick(language, "????????????", "Gap change appears after generation."),
        alternatives: alternatives.length > 0
          ? alternatives
          : [pick(language, "?????????????", "No stronger alternative security is available right now.")],
        whyThis: [
          item.rationale
            ? pick(
              language,
              `${getAssetClassLabel(item.assetClass, language)} ??????????? ${item.rationale.gapBeforePct.toFixed(1)} ?????`,
              `${getAssetClassLabel(item.assetClass, language)} is currently ${item.rationale.gapBeforePct.toFixed(1)}% below target.`
            )
            : pick(language, "????????????????", "The engine prioritizes the largest current allocation gap."),
          pick(
            language,
            `${getAccountTypeLabel(item.targetAccountType, language)} ?????????????`,
            `${getAccountTypeLabel(item.targetAccountType, language)} produced the strongest account fit under the current constraints.`
          ),
          item.rationale?.existingHoldingSymbol && item.rationale.existingHoldingRiskContributionPct != null
            ? pick(
              language,
              `${item.rationale.existingHoldingSymbol} ??????? ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% ?????,??????????????????????????`,
              `${item.rationale.existingHoldingSymbol} already contributes about ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% of total portfolio risk, so this path redirects new money toward an account and security combination that spreads risk out instead of reinforcing it.`
            )
            : pick(
              language,
              "????????????,???????????????????????",
              "This path not only closes the allocation gap, it also avoids stacking fresh money onto the current heaviest risk source."
            ),
          item.rationale?.watchlistMatched
            ? pick(language, "?????????????????", "The lead security also matched your watchlist.")
            : pick(language, "???????????????????????", "The lead security is the highest-scoring expression in the current candidate set.")
        ],
        whyNot: [
          alternatives.length > 0
            ? pick(language, `?? ${alternatives.join(" / ")} ???????????`, `Alternatives ${alternatives.join(" / ")} scored below the current lead security.`)
            : pick(language, "??????????????", "No clearly stronger alternative is available in this sleeve."),
          item.rationale?.existingHoldingSymbol && item.rationale.existingHoldingRiskContributionPct != null
            ? pick(
              language,
              `${item.rationale.existingHoldingSymbol} ??????? ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% ?????,????????????????????`,
              `${item.rationale.existingHoldingSymbol} already contributes about ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% of total portfolio risk, so the engine avoids doubling down on the same risk source.`
            )
            : pick(language, "???????????????????????", "The engine avoids leaning even harder into risk sources that are already concentrated inside the sleeve."),
          (item.fxFrictionPenaltyBps ?? 0) > 0
            ? pick(language, `?????? ${item.fxFrictionPenaltyBps} bps,???? USD ??????`, `Cross-currency friction of about ${item.fxFrictionPenaltyBps} bps pushed some USD ideas lower.`)
            : pick(language, "???????????????????", "This path does not carry a material FX friction cost.")
        ],
        constraints: [
          {
            label: pick(language, "????", "Allocation gap"),
            detail: item.allocationGapBeforePct != null && item.allocationGapAfterPct != null
              ? pick(
                language,
                `????????,?????? ${item.allocationGapBeforePct.toFixed(1)}% ??? ${item.allocationGapAfterPct.toFixed(1)}%?`,
                `Narrows from ${item.allocationGapBeforePct.toFixed(1)}% to ${item.allocationGapAfterPct.toFixed(1)}%.`
              )
              : pick(language, "????? run ???", "Will update on the next run."),
            variant: "success" as const
          },
          {
            label: pick(language, "??/????", "Tax / account placement"),
            detail: pick(
              language,
              `${getAccountTypeLabel(item.targetAccountType, language)} ?????????,????? ${item.accountFitScore?.toFixed(0) ?? "--"},????? ${item.taxFitScore?.toFixed(0) ?? "--"}?`,
              `${getAccountTypeLabel(item.targetAccountType, language)} looks like a smoother home here, with account fit ${item.accountFitScore?.toFixed(0) ?? "--"} and tax fit ${item.taxFitScore?.toFixed(0) ?? "--"}.`
            ),
            variant: profile.taxAwarePlacement ? "success" : "neutral"
          },
          {
            label: pick(language, "FX ??", "FX friction"),
            detail: (item.fxFrictionPenaltyBps ?? 0) > 0
              ? pick(language, `????????? ${item.fxFrictionPenaltyBps} bps ??????`, `This path absorbs about ${item.fxFrictionPenaltyBps} bps of FX cost.`)
              : pick(language, "??????????????????", "This path avoids material FX friction."),
            variant: (item.fxFrictionPenaltyBps ?? 0) > 0 ? "warning" : "success"
          }
        ],
        execution: [
          { label: pick(language, "????", "Suggested amount"), value: formatDisplayCurrency(item.amountCad, display) },
          {
            label: pick(language, "?????", "Lead security"),
            value: item.securitySymbol ?? item.tickerOptions[0] ?? pick(language, "??", "Pending")
          },
          {
            label: pick(language, "????", "Target account"),
            value: getAccountTypeLabel(item.targetAccountType, language)
          },
          {
            label: pick(language, "????", "Execution note"),
            value: item.rationale?.minTradeApplied
              ? pick(language, "??????,?????????????", "This is a small trade; consider batching it with the next contribution.")
              : pick(language, "????????????????", "The current amount is large enough to stand on its own.")
          }
        ]
      };
    }),
    scenarios: scenarioRuns.map((scenarioRun, scenarioIndex) => ({
      id: `scenario-${scenarioRun.contributionAmountCad}-${scenarioIndex}`,
      label: scenarioIndex === 0
        ? pick(language, "???", "Light contribution")
        : scenarioIndex === scenarioRuns.length - 1
          ? pick(language, "????", "Double-sized contribution")
          : pick(language, "????", "Current contribution"),
      amount: formatDisplayCurrency(scenarioRun.contributionAmountCad, display),
      summary: pick(
        language,
        "???????????,???????????????,??????????,????????????",
        "This is a fresh solve at this amount, so you can see whether a different contribution size would change the next step."
      ),
      diffs: buildScenarioDiffs(scenarioRun, scenarioIndex),
      allocations: scenarioRun.items.map((item) => ({
        assetClass: getAssetClassLabel(item.assetClass, language),
        amount: formatDisplayCurrency(item.amountCad, display),
        account: getAccountTypeLabel(item.targetAccountType, language)
      }))
    })),
    notes: [
      profile.taxAwarePlacement
        ? pick(language, "???????????????????,????????????", "The system also considers which account type is a better home for the money, but this is not formal tax advice.")
        : pick(language, "??????“??????”????,???????????????", "Account placement guidance is off, so the system leans more heavily on closing the biggest allocation gap first."),
      pick(
        language,
        `??????“${getRecommendationStrategyLabel(profile.recommendationStrategy, language)}”???????? ${profile.rebalancingTolerancePct}% ?,?????????????`,
        `Your current strategy is "${getRecommendationStrategyLabel(profile.recommendationStrategy, language)}". Once drift moves beyond about ${profile.rebalancingTolerancePct}%, the system becomes more willing to nudge changes.`
      ),
      ...sanitizeRecommendationNotes(latestRun?.notes)
    ]
  };
}

export function buildSpendingData(args: {
  language: DisplayLanguage;
  transactions: CashflowTransaction[];
  profile: PreferenceProfile;
  display: DisplayContext;
}): SpendingData {
  const { language, transactions, profile, display } = args;
  const spending = buildSpendingSummary(transactions, profile.cashBufferTargetCad);
  const latestTransactions = [...transactions]
    .sort((left, right) => right.bookedAt.localeCompare(left.bookedAt))
    .slice(0, 10);
  const discipline = spending.savingsRate >= 30
    ? pick(language, "??", "Stable")
    : spending.savingsRate >= 20
      ? pick(language, "??", "Watch")
      : pick(language, "???", "At risk");

  return {
    displayContext: buildDisplayContext(display, language),
    metrics: [
      {
        label: pick(language, "????", "Monthly spend"),
        value: formatDisplayCurrency(spending.outflowTotal, display),
        detail: pick(language, "????????", "Current month outflow total")
      },
      {
        label: pick(language, "???", "Savings rate"),
        value: formatCompactPercent(spending.savingsRate, 1),
        detail: pick(language, "????????????", "Based on current month inflows and outflows")
      },
      {
        label: pick(language, "?????", "Investable cash"),
        value: formatDisplayCurrency(spending.investableCash, display),
        detail: pick(language, "????????????????", "Monthly inflow minus spending and buffer reserve")
      },
      {
        label: pick(language, "????", "Cash discipline"),
        value: discipline,
        detail: pick(
          language,
          `??????? ${formatDisplayCurrency(profile.cashBufferTargetCad, display)}`,
          `Cash buffer target is ${formatDisplayCurrency(profile.cashBufferTargetCad, display)}`
        )
      }
    ],
    trend: getMonthlyTransactionSeries(transactions, language),
    categories: spending.categories.slice(0, 4).map(([name, value]) => ({
      name: getCategoryLabel(name, language),
      share: spending.outflowTotal > 0 ? formatCompactPercent((value / spending.outflowTotal) * 100, 0) : "0%",
      amount: formatDisplayCurrency(value, display)
    })),
    transactions: latestTransactions.map((transaction) => ({
      date: transaction.bookedAt,
      merchant: getMerchantLabel(transaction.merchant, language),
      category: getCategoryLabel(transaction.category, language),
      amount: `${transaction.direction === "outflow" ? "-" : "+"}${formatDisplayCurrency(transaction.amountCad, display)}`
    }))
  };
}

export function buildImportData(args: {
  latestPortfolioJob: ImportJob | null;
  latestSpendingJob: ImportJob | null;
  accounts: InvestmentAccount[];
  language: DisplayLanguage;
}): ImportData {
  const { latestPortfolioJob, latestSpendingJob, accounts, language } = args;
  return {
    portfolioSteps: [
      {
        title: pick(language, "??????", "Choose account type"),
        description: pick(language, "???????,???????????", "Start with the account structure, not a long form.")
      },
      {
        title: pick(language, "??????", "Choose import method"),
        description: pick(language, "??? CSV,???? broker ???", "CSV import first, account integrations later.")
      },
      {
        title: pick(language, "??????", "Provide account data"),
        description: pick(language, "??????,???????????????????", "Enter account details, room, and starter holding context before any write.")
      },
      {
        title: pick(language, "?????", "Review and confirm"),
        description: latestPortfolioJob
          ? pick(
            language,
            `??????????? ${latestPortfolioJob.status}???????????????`,
            `Latest portfolio import is ${latestPortfolioJob.status}. Confirm what should be written next.`
          )
          : pick(
            language,
            "????????,????????????????",
            "Review the exact account and holding actions before writing them to the database."
          )
      },
      {
        title: pick(language, "????", "Complete setup"),
        description: pick(language, "???????,??????????????", "Confirm the saved result, then continue to preferences or the dashboard.")
      }
    ],
    portfolioSetupCards: [
      {
        label: pick(language, "????", "Account type"),
        title: accounts.length > 0
          ? `${accounts.map((account) => getAccountTypeLabel(account.type, language)).join(" / ")}`
          : `${getAccountTypeLabel("TFSA", language)} / ${getAccountTypeLabel("RRSP", language)} / ${getAccountTypeLabel("Taxable", language)} / ${getAccountTypeLabel("FHSA", language)}`,
        description: pick(language, "???????,?????????", "Pick the right account bucket before asking for institution detail.")
      },
      {
        label: pick(language, "????", "Import method"),
        title: pick(language, "?? CSV ??", "CSV upload first"),
        description: pick(language, "? broker ?????,??? MVP ???????", "Keeps MVP friction low while we define stable broker integrations.")
      },
      {
        label: pick(language, "????", "Field mapping"),
        title: latestPortfolioJob
          ? pick(language, `????:${latestPortfolioJob.fileName}`, `Current file: ${latestPortfolioJob.fileName}`)
          : pick(language, "????????", "Review account and holding columns"),
        description: pick(language, "????????,???????????????", "Mapping stays explicit so the user trusts the imported portfolio data.")
      },
      {
        label: pick(language, "????", "Preference handoff"),
        title: pick(language, "????????", "Move into Investment Preferences"),
        description: pick(language, "?????,??????????????????", "The import flow hands off cleanly into target allocation and account priorities.")
      }
    ],
    portfolioSuccessStates: [
      pick(language, "?????????????????????", "Imported holdings can be grouped by account and asset class."),
      pick(language, "??????????????????????", "Invalid or unknown rows are flagged before the portfolio view updates."),
      pick(language, "????????????????", "On completion the user can move directly to Dashboard or Recommendations.")
    ],
    spendingSetupCards: [
      {
        label: pick(language, "???", "Workflow"),
        title: pick(language, "??????", "Transaction import"),
        description: pick(language, "?????????????,???? workflow ?????", "Import spending records separately from portfolio holdings so each workflow can evolve independently.")
      },
      {
        label: pick(language, "???", "Supported rows"),
        title: latestSpendingJob
          ? pick(language, `????:${latestSpendingJob.fileName}`, `Latest file: ${latestSpendingJob.fileName}`)
          : pick(language, "??? transaction ?", "Transaction rows only"),
        description: pick(language, "????????????????/?????", "Focus on spending transactions, categories, merchants, and inflow/outflow direction.")
      },
      {
        label: pick(language, "??", "Review"),
        title: pick(language, "??????", "Validate before write"),
        description: pick(language, "???????,??????????", "Run preview and validation first, then confirm the transaction write.")
      },
      {
        label: pick(language, "????", "Future integrations"),
        title: pick(language, "? Provider ????", "Provider-ready boundary"),
        description: pick(language, "????????,???? bank ? card API ?? CSV,?????????", "This path is isolated so bank or card APIs can replace CSV later without affecting portfolio import.")
      }
    ],
    spendingSuccessStates: [
      pick(language, "????????? Spending ???????????????", "Imported transactions flow into Spending metrics, category breakdowns, and recent transaction history."),
      pick(language, "???????????? recommendation runs?", "Transaction-only imports do not overwrite holdings or recommendation runs."),
      pick(language, "????????? CSV ???? bank ? card provider,??????????", "This workflow can later swap CSV for bank or card provider integrations without changing the portfolio import path.")
    ],
    existingAccounts: accounts.map((account) => ({
      id: account.id,
      type: account.type,
      institution: account.institution,
      nickname: account.nickname,
      currency: account.currency ?? "CAD",
      contributionRoomCad: account.contributionRoomCad,
      marketValueAmount: account.marketValueAmount ?? account.marketValueCad,
      marketValueCad: account.marketValueCad
    }))
  };
}

export function buildSettingsData(profile: PreferenceProfile, language: DisplayLanguage): SettingsData {
  return {
    guidedQuestions: getGuidedQuestions(profile, language),
    manualGroups: getManualGroups(profile, language)
  };
}




