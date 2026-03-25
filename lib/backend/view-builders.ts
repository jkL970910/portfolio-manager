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
const MONTH_LABELS_ZH = ["10月", "11月", "12月", "1月", "2月", "3月"];
const PRIORITY_BADGE_VARIANTS = {
  first: "primary",
  second: "success",
  later: "warning"
} as const;

const ACCOUNT_CAPTIONS: Record<InvestmentAccount["type"], { zh: string; en: string }> = {
  TFSA: { zh: "免税增长账户", en: "Tax-free growth sleeve" },
  RRSP: { zh: "长期退休账户", en: "Long-horizon retirement sleeve" },
  FHSA: { zh: "购房目标账户", en: "Home down-payment sleeve" },
  Taxable: { zh: "灵活应税账户", en: "Flexible capital account" }
};

const ACCOUNT_TYPE_FIT: Record<InvestmentAccount["type"], { zh: string; en: string }> = {
  TFSA: {
    zh: "通常更适合免税复利增长，以及作为第二优先的注资账户。",
    en: "Generally suitable for tax-free compounding and secondary funding priorities."
  },
  RRSP: {
    zh: "通常更适合长期、受税务保护的核心配置。",
    en: "Commonly preferred for sheltered long-horizon allocations."
  },
  FHSA: {
    zh: "当购房目标相关额度仍可用时，通常会优先考虑。",
    en: "Commonly preferred when home-goal room remains available."
  },
  Taxable: {
    zh: "在受保护账户额度用尽，或需要更高灵活性时作为回退账户。",
    en: "Fallback account once sheltered room is consumed or flexibility is needed."
  }
};

const RISK_DETAILS: Record<RiskProfile, { zh: string; en: string }> = {
  Conservative: {
    zh: "更偏防守型，允许更高的固定收益和现金比例。",
    en: "Defensive profile with more income and cash tolerance."
  },
  Balanced: {
    zh: "当前风险暴露大致在你设定的容忍区间内。",
    en: "Within configured tolerance band."
  },
  Growth: {
    zh: "股票暴露高于较保守配置的舒适区间。",
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
      ? pick(language, "分析基准与显示币种当前都为 CAD。", "Base analytics and display are in CAD.")
      : `1 CAD = ${fxRate.toFixed(4)} USD`,
    fxNote: context.currency === "CAD"
      ? pick(language, "CAD 是当前显示币种。USD 原生持仓会保留自己的价格输入，但组合分析仍统一按 CAD 归一化。", "CAD is the active display currency. USD-native positions retain their own price inputs, while portfolio analytics stay normalized in CAD.")
      : pick(language, "USD 是当前显示币种。底层组合分析仍按 CAD 归一化，再按最新缓存的 USD/CAD 汇率换算成 USD 显示。", "USD is the active display currency. Portfolio analytics remain normalized in CAD and are converted into USD for display using the latest cached USD/CAD FX rate.")
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
  profile: PreferenceProfile
) {
  const lead = run?.items[0];
  if (!lead) {
    return {
      theme: pick(language, "先把数据补齐，系统才能告诉你下一步钱更适合放哪里", "The system needs your data and preferences before it can suggest a next step"),
      subtitle: pick(language, "现在还没有可用的下一步建议。", "There is no usable next-step recommendation yet."),
      reason: pick(language, "等你把账户、持仓和目标配置补齐以后，系统才知道下一笔钱更适合先放哪里。", "Once your accounts, holdings, and target mix are in place, the system can start suggesting where new money likely helps first."),
      signals: [
        pick(language, "至少先导入一个账户和一笔持仓，系统才看得懂你现在的组合。", "Import at least one account and one holding so the system can understand the current portfolio."),
        pick(language, "再把你的投资偏好存下来，系统才知道你想把组合慢慢调成什么样。", "Then save your preferences so the system knows what kind of mix you want to move toward.")
      ]
    };
  }

  return {
    theme: pick(
      language,
      `${getAccountTypeLabel(lead.targetAccountType, language)} 的 ${getAssetClassLabel(lead.assetClass, language)}`,
      `${getAssetClassLabel(lead.assetClass, language)} in ${getAccountTypeLabel(lead.targetAccountType, language)}`
    ),
    subtitle: pick(
      language,
      `如果你现在准备投入 ${formatDisplayCurrency(run.contributionAmountCad, context)}，系统会先看这条路。`,
      `If you are putting in ${formatDisplayCurrency(run.contributionAmountCad, context)} next, this is the path the system would check first.`
    ),
    reason: getRecommendationItemExplanation(lead, context, language),
    signals: getRecommendationAssumptions(profile, language).slice(0, 2)
  };
}

function getSignalForHolding(holding: HoldingPosition, driftMap: Map<string, number>, language: DisplayLanguage) {
  const gap = driftMap.get(holding.assetClass) ?? 0;
  if (holding.symbol === "CASH" && holding.weightPct > 8) {
    return pick(language, "现金占比相对目标配置仍然偏高。", "Cash drag is still elevated relative to the target mix.");
  }
  if (gap < -4) {
    return pick(
      language,
      `这类资产现在配得还不够，离你的目标还差 ${formatCompactPercent(Math.abs(gap), 0)}。`,
      `This sleeve remains underweight by ${formatCompactPercent(Math.abs(gap), 0)} versus target.`
    );
  }
  if (holding.weightPct >= 15) {
    return pick(language, "这笔仓位已经很大了，对整个组合风险影响很重。", "Core position is carrying a meaningful share of total portfolio risk.");
  }
  return pick(language, "这笔仓位目前没有明显拖后腿，但也不是最该优先处理的地方。", "Supports the current portfolio mix without driving the main gaps.");
}

function formatHoldingLastUpdated(value: string | null | undefined, language: DisplayLanguage) {
  if (!value) {
    return pick(language, "尚未刷新", "Not refreshed");
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

    if (/[�Â]/.test(normalized)) {
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
      `${quotedHoldings.length}/${holdings.length} 笔持仓已经拿到可参考的价格`,
      `${quotedHoldings.length}/${holdings.length} holdings already have usable prices`
    )
    : pick(language, "现在还没有可更新价格的持仓", "There are no holdings with refreshable prices yet");

  if (quotedHoldings.length === 0) {
    return {
      lastRefreshed: pick(language, "还没更新过价格", "No price refresh yet"),
      freshness: pick(language, "未知", "Unknown"),
      coverage
    };
  }

  const latestUpdatedAt = quotedHoldings
    .map((holding) => new Date(holding.updatedAt!))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  const ageMs = Date.now() - latestUpdatedAt.getTime();
  const ageMinutes = Math.max(0, Math.round(ageMs / 60000));
  const freshness = ageMinutes <= 30
    ? pick(language, "缓存窗口内，较新", "Fresh within cache window")
    : ageMinutes <= 180
      ? pick(language, "略旧，但仍可参考", "Stale but still usable")
      : pick(language, "建议刷新", "Refresh recommended");

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
    return pick(language, "无税务保护额度", "No tax shelter");
  }
  return pick(
    language,
    `剩余 ${formatDisplayCurrency(account.contributionRoomCad, display)} 额度`,
    `${formatDisplayCurrency(account.contributionRoomCad, display)} room left`
  );
}

function getAccountBadgeLabel(index: number, includedInPriority: boolean, language: DisplayLanguage) {
  if (index === 0) {
    return pick(language, "优先", "Priority");
  }
  if (includedInPriority) {
    return pick(language, "账户匹配", "Tax fit");
  }
  return pick(language, "复核", "Review");
}

function formatAccountPriorityOrder(priorityOrder: InvestmentAccount["type"][], language: DisplayLanguage) {
  return priorityOrder.map((type) => getAccountTypeLabel(type, language)).join(" -> ");
}

function formatHoldingPrice(amount: number | null | undefined, currency: CurrencyCode | null | undefined, amountCad: number | null | undefined, display: DisplayContext, language: DisplayLanguage) {
  if (amountCad != null && amountCad > 0) {
    return formatMoneyForDisplay(amount ?? amountCad, currency ?? "CAD", amountCad, display);
  }
  return pick(language, "暂无价格", "Not priced");
}

function getRecommendationAssumptions(profile: PreferenceProfile, language: DisplayLanguage) {
  return [
    pick(
      language,
      "系统会先对照你自己设的目标配置，再看你现在哪些资产配少了、哪些配多了。",
      "The system first compares your current mix with the target mix you set."
    ),
    pick(
      language,
      `系统也会一起看你想先用哪些账户。你现在的顺序是 ${formatAccountPriorityOrder(profile.accountFundingPriority, language)}。`,
      `It also considers which accounts you prefer to use first. Your current order is ${formatAccountPriorityOrder(profile.accountFundingPriority, language)}.`
    ),
    profile.taxAwarePlacement
      ? pick(
        language,
        "你已经打开“尽量放对账户”这个选项，所以系统会更在意这笔钱长期放在哪类账户更顺手。",
        "You have account placement guidance turned on, so the system pays more attention to which account is a better long-term home."
      )
      : pick(
        language,
        "你还没打开“尽量放对账户”这个选项，所以这次会更先看配置缺口和账户额度。",
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
    `${assetClass} 现在配得还不够，所以这笔 ${formatDisplayCurrency(item.amountCad, display)} 会先放到 ${accountType} 里。`,
    `${assetClass} is currently underweight relative to the configured target, so this run allocates ${formatDisplayCurrency(item.amountCad, display)} to ${accountType}.`
  );
}

function getGuidedQuestions(profile: PreferenceProfile, language: DisplayLanguage) {
  if (profile.riskProfile === "Growth") {
    return [
      pick(language, "购房目标和长期增值相比，你更看重哪一个？", "How important is the home goal compared with long-term portfolio growth?"),
      pick(language, "面对短期波动时，你能接受多大幅度而不改变计划？", "How much short-term volatility can you tolerate before changing course?"),
      pick(language, "在修正大类偏差前，系统是否应优先使用受保护账户额度？", "Should the engine prioritize sheltered room before broader drift correction?"),
      pick(language, "为了短期里程碑，你希望保留多少现金缓冲？", "How much cash should remain available for shorter-term milestones?")
    ];
  }

  return [
    pick(language, "你的主要财务目标和时间跨度是什么？", "What is your primary financial goal and time horizon?"),
    pick(language, "你对组合波动和回撤的接受度如何？", "How comfortable are you with portfolio volatility and drawdowns?"),
    pick(language, "系统应该优先税务效率，还是尽量贴近当前持仓？", "Should the engine prioritize tax efficiency or staying close to current holdings?"),
    pick(language, "在接下来有支出计划时，建议是否应保留更大的现金缓冲？", "Should recommendations preserve a larger cash buffer for upcoming spending?")
  ];
}

function getManualGroups(profile: PreferenceProfile, language: DisplayLanguage): SettingsData["manualGroups"] {
  return [
    {
      title: pick(language, "风险画像与目标配置", "Risk profile and target allocation"),
      description: pick(
        language,
        `当前画像为${getRiskProfileLabel(profile.riskProfile, language)}，已配置 ${sortTargetsForDisplay(profile.targetAllocation).length} 个目标资产袖口。`,
        `Current profile is ${profile.riskProfile.toLowerCase()} with ${sortTargetsForDisplay(profile.targetAllocation).length} target sleeves configured.`
      )
    },
    {
      title: pick(language, "账户注资优先级", "Account funding priorities"),
      description: pick(language, `当前顺序：${profile.accountFundingPriority.join(" -> ")}`, `Current order: ${profile.accountFundingPriority.join(" -> ")}`),
      badge: pick(language, "可排序", "Sortable")
    },
    {
      title: pick(language, "推荐行为", "Recommendation behavior"),
      description: pick(
        language,
        `当前过渡方式为${getTransitionPreferenceLabel(profile.transitionPreference, language)}，策略为${getRecommendationStrategyLabel(profile.recommendationStrategy, language)}。`,
        `Transition is ${profile.transitionPreference}, strategy is ${profile.recommendationStrategy}.`
      )
    },
    {
      title: pick(language, "税务感知放置", "Tax-aware placement"),
      description: profile.taxAwarePlacement
        ? pick(language, "已启用税务感知放置。省份与边际税率等高级字段默认可保持折叠。", "Tax-aware placement is enabled. Advanced province and marginal bracket fields can stay collapsed by default.")
        : pick(language, "当前未启用税务感知放置。引擎会优先使用更简单的账户匹配规则。", "Tax-aware placement is disabled. The engine will favor simpler account-fit rules."),
      badge: pick(language, "高级", "Advanced")
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
  const recommendation = getRecommendationTheme(latestRun, display, language, profile);

  return {
    displayContext: buildDisplayContext(display, language),
    metrics: [
      {
        label: pick(language, "总资产", "Total Portfolio"),
        value: formatDisplayCurrency(totalPortfolio, display),
        detail: pick(language, `${accounts.length} 个账户已连接`, `${accounts.length} accounts connected`)
      },
      {
        label: pick(language, "可用额度", "Available Room"),
        value: formatDisplayCurrency(availableRoom, display),
        detail: pick(language, "TFSA、RRSP 和 FHSA 剩余注资额度", "TFSA, RRSP, and FHSA contribution room remaining")
      },
      {
        label: pick(language, "组合风险", "Portfolio Risk"),
        value: getRiskProfileLabel(profile.riskProfile, language),
        detail: getRiskDetail(profile.riskProfile, language)
      },
      {
        label: pick(language, "组合健康分", "Portfolio Health Score"),
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
        account: instanceLabelMap.get(holding.accountId) ?? pick(language, "账户", "Account"),
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
    sectorExposure.push({ name: pick(language, "其他", "Other"), value: sectorRemainder });
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
        detail: pick(language, `${accountCount} 个账户`, `${accountCount} account${accountCount > 1 ? "s" : ""}`)
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
          ? pick(language, `大约占组合 ${formatCompactPercent((account.marketValueCad / totalPortfolio) * 100, 0)}`, `About ${formatCompactPercent((account.marketValueCad / totalPortfolio) * 100, 0)} of the portfolio`)
          : pick(language, "还没有资产", "No assets yet"),
        room: account.contributionRoomCad !== null
          ? pick(
            language,
            `规划基准 CAD 剩余额度 ${formatMoney(account.contributionRoomCad, "CAD")}`,
            `${formatMoney(account.contributionRoomCad, "CAD")} of planning-base CAD room left`
          )
          : pick(language, "这类账户不单独追踪额度", "This account type does not track room here"),
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
            `${instanceLabelMap.get(account.id) ?? account.nickname} 里现在大约装了 ${formatCompactPercent(totalPortfolio > 0 ? (account.marketValueCad / totalPortfolio) * 100 : 0, 0)} 的组合。`,
            `${instanceLabelMap.get(account.id) ?? account.nickname} currently holds about ${formatCompactPercent(totalPortfolio > 0 ? (account.marketValueCad / totalPortfolio) * 100 : 0, 0)} of the portfolio.`
          ),
          accountHoldings[0]
            ? pick(
              language,
              `这类账户里当前最重的持仓是 ${accountHoldings.sort((left, right) => right.marketValueCad - left.marketValueCad)[0]?.symbol}。`,
              `${accountHoldings.sort((left, right) => right.marketValueCad - left.marketValueCad)[0]?.symbol} is currently the largest holding in this account.`
            )
            : pick(language, "这个账户里暂时还没有持仓。", "There are no holdings in this account yet."),
          account.contributionRoomCad !== null
            ? pick(language, `这一类账户还剩 ${formatMoney(account.contributionRoomCad, "CAD")} 的规划基准额度。`, `This account still has ${formatMoney(account.contributionRoomCad, "CAD")} of planning-base room left.`)
            : pick(language, "这类账户这里不单独追踪额度。", "This account type does not track contribution room here.")
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
        accountId: holding.accountId,
        accountType: accounts.find((account) => account.id === holding.accountId)?.type ?? "Taxable",
        account: instanceLabelMap.get(holding.accountId) ?? pick(language, "账户", "Account"),
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
          `${getAssetClassLabel(mainGap[0], language)} 现在和你的目标差得最远，最该先补。`,
          `${getAssetClassLabel(mainGap[0], language)} is the clearest allocation gap versus the configured target.`
        )
        : pick(language, "先把目标配置设好，系统才能看出哪一块配得不够。", "Set a target mix first so the system can see which sleeve is missing the most."),
      largestHolding
        ? pick(language, `${largestHolding.symbol} 是你现在最大的一笔仓位，所以它对集中度影响也最大。`, `${largestHolding.symbol} is the largest position and drives the current concentration score.`)
        : pick(language, "先导入持仓，系统才能看出是不是有几笔仓位已经太重。", "Import holdings first so the system can tell whether a few positions are getting too heavy."),
      accounts.some((account) => account.type === "Taxable")
        ? pick(language, "你已经开始用到应税账户，所以钱先放哪个账户，对长期结果会更有影响。", "You are already using taxable accounts, so where new money goes matters more over the long run.")
        : pick(language, "你现在大部分钱还在受保护账户里，所以账户放置还算比较简单。", "Most of the money is still inside sheltered accounts, so account placement is still fairly straightforward.")
    ]
  };
}

export function buildRecommendationsData(args: {
  language: DisplayLanguage;
  profile: PreferenceProfile;
  latestRun: RecommendationRun | null;
  scenarioRuns?: RecommendationRun[];
  display: DisplayContext;
}): RecommendationsData {
  const { language, profile, latestRun, scenarioRuns = [], display } = args;
  const equityTarget = sum(profile.targetAllocation
    .filter((target) => target.assetClass !== "Fixed Income" && target.assetClass !== "Cash")
    .map((target) => target.targetPct));
  const fixedIncomeTarget = profile.targetAllocation.find((target) => target.assetClass === "Fixed Income")?.targetPct ?? 0;
  const cashTarget = profile.targetAllocation.find((target) => target.assetClass === "Cash")?.targetPct ?? 0;
  const baselineItems = latestRun?.items ?? [];

  const buildScenarioDiffs = (scenarioRun: RecommendationRun, scenarioIndex: number) => {
    if (baselineItems.length === 0) {
      return [
        pick(
          language,
          "现在还没有可对照的主建议，所以这里只展示这个金额下系统单独算出来的结果。",
          "There is no saved baseline recommendation yet, so this card only shows the standalone result for this amount."
        )
      ];
    }

    if (scenarioRun.contributionAmountCad === latestRun?.contributionAmountCad) {
      return [
        pick(
          language,
          "这一组就是你现在正在看的主建议，其他金额都会拿它来对照着看。",
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
          `第一优先级从 ${getAssetClassLabel(baselineTop.assetClass, language)} -> ${getAccountTypeLabel(baselineTop.targetAccountType, language)}，切换成了 ${getAssetClassLabel(scenarioTop.assetClass, language)} -> ${getAccountTypeLabel(scenarioTop.targetAccountType, language)}。`,
          `The top priority shifts from ${getAssetClassLabel(baselineTop.assetClass, language)} -> ${getAccountTypeLabel(baselineTop.targetAccountType, language)} to ${getAssetClassLabel(scenarioTop.assetClass, language)} -> ${getAccountTypeLabel(scenarioTop.targetAccountType, language)}.`
        )
      );
    } else {
      diffs.push(
        pick(
          language,
          "第一优先级保持不变，当前金额变化主要体现在分配额度上。",
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
          `${getAssetClassLabel(accountShift.assetClass, language)} 的账户去向从 ${getAccountTypeLabel(baseline.targetAccountType, language)} 调整为 ${getAccountTypeLabel(accountShift.targetAccountType, language)}。`,
          `${getAssetClassLabel(accountShift.assetClass, language)} shifts from ${getAccountTypeLabel(baseline.targetAccountType, language)} to ${getAccountTypeLabel(accountShift.targetAccountType, language)}.`
        )
      );
    }

    const newAsset = scenarioRun.items.find((item) => !baselineMap.has(item.assetClass));
    if (newAsset) {
      diffs.push(
        pick(
          language,
          `${getAssetClassLabel(newAsset.assetClass, language)} 在这档金额下开始变得值得优先处理。`,
          `${getAssetClassLabel(newAsset.assetClass, language)} becomes worth prioritizing at this contribution size.`
        )
      );
    }

    const removedAsset = baselineItems.find((item) => !scenarioRun.items.some((candidate) => candidate.assetClass === item.assetClass));
    if (removedAsset) {
      diffs.push(
        pick(
          language,
          `${getAssetClassLabel(removedAsset.assetClass, language)} 在这档金额下暂时退出前三优先级。`,
          `${getAssetClassLabel(removedAsset.assetClass, language)} falls out of the top priorities at this contribution size.`
        )
      );
    }

    if (diffs.length === 1 && scenarioIndex !== 1) {
      diffs.push(
        pick(
          language,
          "说明金额变大或变小时，系统的大方向没有变，只是在同一路线上放大或缩小。",
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
          latestRun.objective === "target-tracking" ? "先补离目标最远的缺口" : latestRun.objective,
          latestRun.objective === "target-tracking" ? "Close the biggest target gap first" : latestRun.objective
        )
        : pick(language, "先补离目标最远的缺口", "Close the biggest target gap first"),
      confidence: latestRun?.confidenceScore != null
        ? `${latestRun.confidenceScore.toFixed(0)}/100`
        : pick(language, "待生成", "Pending")
    },
    inputs: [
      { label: pick(language, "目标配置", "Target allocation"), value: `${equityTarget} / ${fixedIncomeTarget} / ${cashTarget}` },
      { label: pick(language, "账户优先级", "Account priority"), value: formatAccountPriorityOrder(profile.accountFundingPriority, language) },
      { label: pick(language, "税务感知放置", "Tax-aware placement"), value: profile.taxAwarePlacement ? pick(language, "已启用", "Enabled") : pick(language, "未启用", "Disabled") },
      { label: pick(language, "过渡偏好", "Transition preference"), value: getTransitionPreferenceLabel(profile.transitionPreference, language) }
    ],
    explainer: latestRun?.assumptions?.length
      ? getRecommendationAssumptions(profile, language)
      : [
          pick(language, "系统会先看你现在已经持有什么，再对照你自己设的目标配置。", "The system first looks at what you already hold and compares it with your target mix."),
          pick(language, "哪一类资产差得最远，通常就会先排到前面。", "The asset sleeve furthest from target usually moves to the front of the queue."),
          pick(language, "系统会先决定钱放哪个账户更顺手，再从候选标的里挑一个更合适的。", "The system first chooses the best account home, then picks a security inside that sleeve.")
        ],
    priorities: (latestRun?.items ?? []).map((item, index) => {
      const leadSecurity = item.securitySymbol && item.securityName
        ? `${item.securitySymbol} - ${item.securityName}`
        : item.tickerOptions[0] ?? pick(language, "待选标的", "Pending security");
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
            `${getAccountTypeFit(item.targetAccountType, language)} 大致顺手度 ${item.accountFitScore.toFixed(0)}/100`,
            `${getAccountTypeFit(item.targetAccountType, language)} Rough fit ${item.accountFitScore.toFixed(0)}/100`
          )
          : getAccountTypeFit(item.targetAccountType, language),
        scoreline: pick(
          language,
          `标的合适度 ${item.securityScore?.toFixed(0) ?? "--"} / 账户顺手度 ${item.accountFitScore?.toFixed(0) ?? "--"} / 税务友好度 ${item.taxFitScore?.toFixed(0) ?? "--"}`,
          `Security fit ${item.securityScore?.toFixed(0) ?? "--"} / Account fit ${item.accountFitScore?.toFixed(0) ?? "--"} / Tax fit ${item.taxFitScore?.toFixed(0) ?? "--"}`
        ),
        gapSummary: item.allocationGapBeforePct != null && item.allocationGapAfterPct != null
          ? pick(
            language,
            `如果按这条建议去投，这个缺口会从 ${item.allocationGapBeforePct.toFixed(1)}% 缩小到 ${item.allocationGapAfterPct.toFixed(1)}%`,
            `Gap narrows from ${item.allocationGapBeforePct.toFixed(1)}% to ${item.allocationGapAfterPct.toFixed(1)}%`
          )
          : pick(language, "等待生成后展示偏离变化。", "Gap change appears after generation."),
        alternatives: alternatives.length > 0
          ? alternatives
          : [pick(language, "当前没有更高分的备选标的。", "No stronger alternative security is available right now.")],
        whyThis: [
          item.rationale
            ? pick(
              language,
              `${getAssetClassLabel(item.assetClass, language)} 现在比你的目标少了大约 ${item.rationale.gapBeforePct.toFixed(1)} 个百分点。`,
              `${getAssetClassLabel(item.assetClass, language)} is currently ${item.rationale.gapBeforePct.toFixed(1)}% below target.`
            )
            : pick(language, "系统优先补足当前最大的配置缺口。", "The engine prioritizes the largest current allocation gap."),
          pick(
            language,
            `${getAccountTypeLabel(item.targetAccountType, language)} 是这笔钱当前最合适的落点。`,
            `${getAccountTypeLabel(item.targetAccountType, language)} produced the strongest account fit under the current constraints.`
          ),
          item.rationale?.existingHoldingSymbol && item.rationale.existingHoldingRiskContributionPct != null
            ? pick(
              language,
              `${item.rationale.existingHoldingSymbol} 已经大约贡献了 ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% 的组合风险，因此这条路径优先把新钱引向更能分散风险的账户与标的。`,
              `${item.rationale.existingHoldingSymbol} already contributes about ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% of total portfolio risk, so this path redirects new money toward an account and security combination that spreads risk out instead of reinforcing it.`
            )
            : pick(
              language,
              "这条路径除了补足配置缺口，也在主动避免把新钱继续堆进当前最重的风险来源。",
              "This path not only closes the allocation gap, it also avoids stacking fresh money onto the current heaviest risk source."
            ),
          item.rationale?.watchlistMatched
            ? pick(language, "主表达标的同时命中了你的观察列表。", "The lead security also matched your watchlist.")
            : pick(language, "主表达标的是在当前候选池里得分最高的实现方式。", "The lead security is the highest-scoring expression in the current candidate set.")
        ],
        whyNot: [
          alternatives.length > 0
            ? pick(language, `备选 ${alternatives.join(" / ")} 的综合分低于当前首选。`, `Alternatives ${alternatives.join(" / ")} scored below the current lead security.`)
            : pick(language, "当前没有明显更好的同类备选。", "No clearly stronger alternative is available in this sleeve."),
          item.rationale?.existingHoldingSymbol && item.rationale.existingHoldingRiskContributionPct != null
            ? pick(
              language,
              `${item.rationale.existingHoldingSymbol} 已经大约贡献了 ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% 的组合风险，因此系统不会继续优先往同一风险来源加码。`,
              `${item.rationale.existingHoldingSymbol} already contributes about ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% of total portfolio risk, so the engine avoids doubling down on the same risk source.`
            )
            : pick(language, "系统会回避已经在当前袖口内过度集中的风险来源。", "The engine avoids leaning even harder into risk sources that are already concentrated inside the sleeve."),
          (item.fxFrictionPenaltyBps ?? 0) > 0
            ? pick(language, `跨币种摩擦约 ${item.fxFrictionPenaltyBps} bps，因此部分 USD 方案被下调。`, `Cross-currency friction of about ${item.fxFrictionPenaltyBps} bps pushed some USD ideas lower.`)
            : pick(language, "这条路基本不会额外增加明显的换汇成本。", "This path does not carry a material FX friction cost.")
        ],
        constraints: [
          {
            label: pick(language, "配置缺口", "Allocation gap"),
            detail: item.allocationGapBeforePct != null && item.allocationGapAfterPct != null
              ? pick(
                language,
                `按这条建议执行后，这个缺口会从 ${item.allocationGapBeforePct.toFixed(1)}% 缩小到 ${item.allocationGapAfterPct.toFixed(1)}%。`,
                `Narrows from ${item.allocationGapBeforePct.toFixed(1)}% to ${item.allocationGapAfterPct.toFixed(1)}%.`
              )
              : pick(language, "等待下一次 run 更新。", "Will update on the next run."),
            variant: "success" as const
          },
          {
            label: pick(language, "税务/账户放置", "Tax / account placement"),
            detail: pick(
              language,
              `${getAccountTypeLabel(item.targetAccountType, language)} 这一条放起来更顺手，账户顺手度 ${item.accountFitScore?.toFixed(0) ?? "--"}，税务友好度 ${item.taxFitScore?.toFixed(0) ?? "--"}。`,
              `${getAccountTypeLabel(item.targetAccountType, language)} looks like a smoother home here, with account fit ${item.accountFitScore?.toFixed(0) ?? "--"} and tax fit ${item.taxFitScore?.toFixed(0) ?? "--"}.`
            ),
            variant: profile.taxAwarePlacement ? "success" : "neutral"
          },
          {
            label: pick(language, "FX 摩擦", "FX friction"),
            detail: (item.fxFrictionPenaltyBps ?? 0) > 0
              ? pick(language, `这条方案大约会承担 ${item.fxFrictionPenaltyBps} bps 的换汇成本。`, `This path absorbs about ${item.fxFrictionPenaltyBps} bps of FX cost.`)
              : pick(language, "这条方案基本没有明显的换汇额外成本。", "This path avoids material FX friction."),
            variant: (item.fxFrictionPenaltyBps ?? 0) > 0 ? "warning" : "success"
          }
        ],
        execution: [
          { label: pick(language, "建议金额", "Suggested amount"), value: formatDisplayCurrency(item.amountCad, display) },
          {
            label: pick(language, "主表达标的", "Lead security"),
            value: item.securitySymbol ?? item.tickerOptions[0] ?? pick(language, "待选", "Pending")
          },
          {
            label: pick(language, "账户去向", "Target account"),
            value: getAccountTypeLabel(item.targetAccountType, language)
          },
          {
            label: pick(language, "执行提示", "Execution note"),
            value: item.rationale?.minTradeApplied
              ? pick(language, "当前金额较小，建议与下一笔资金合并执行。", "This is a small trade; consider batching it with the next contribution.")
              : pick(language, "当前金额已足够形成独立执行动作。", "The current amount is large enough to stand on its own.")
          }
        ]
      };
    }),
    scenarios: scenarioRuns.map((scenarioRun, scenarioIndex) => ({
      id: `scenario-${scenarioRun.contributionAmountCad}-${scenarioIndex}`,
      label: scenarioIndex === 0
        ? pick(language, "轻投入", "Light contribution")
        : scenarioIndex === scenarioRuns.length - 1
          ? pick(language, "加倍投入", "Double-sized contribution")
          : pick(language, "当前投入", "Current contribution"),
      amount: formatDisplayCurrency(scenarioRun.contributionAmountCad, display),
      summary: pick(
        language,
        "这组不是按比例放大缩小，而是系统按这个金额重新算了一遍，用来看看金额变了以后，下一步该怎么投会不会变。",
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
        ? pick(language, "系统会顺手考虑这笔钱放在哪类账户更合适，但这还不是正式税务建议。", "The system also considers which account type is a better home for the money, but this is not formal tax advice.")
        : pick(language, "你现在没打开“尽量放对账户”这个选项，所以系统会更看重先补配置缺口。", "Account placement guidance is off, so the system leans more heavily on closing the biggest allocation gap first."),
      pick(
        language,
        `你现在选的是“${getRecommendationStrategyLabel(profile.recommendationStrategy, language)}”。当偏离大到大约 ${profile.rebalancingTolerancePct}% 时，系统会更积极地提醒你调整。`,
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
    ? pick(language, "稳定", "Stable")
    : spending.savingsRate >= 20
      ? pick(language, "关注", "Watch")
      : pick(language, "有风险", "At risk");

  return {
    displayContext: buildDisplayContext(display, language),
    metrics: [
      {
        label: pick(language, "月度支出", "Monthly spend"),
        value: formatDisplayCurrency(spending.outflowTotal, display),
        detail: pick(language, "当前月份流出总额", "Current month outflow total")
      },
      {
        label: pick(language, "储蓄率", "Savings rate"),
        value: formatCompactPercent(spending.savingsRate, 1),
        detail: pick(language, "基于当前月份的流入和流出", "Based on current month inflows and outflows")
      },
      {
        label: pick(language, "可投资现金", "Investable cash"),
        value: formatDisplayCurrency(spending.investableCash, display),
        detail: pick(language, "月度流入减去支出和缓冲储备后得到", "Monthly inflow minus spending and buffer reserve")
      },
      {
        label: pick(language, "现金纪律", "Cash discipline"),
        value: discipline,
        detail: pick(
          language,
          `现金缓冲目标为 ${formatDisplayCurrency(profile.cashBufferTargetCad, display)}`,
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
        title: pick(language, "选择账户类型", "Choose account type"),
        description: pick(language, "先确定账户结构，再进入更细的导入方式。", "Start with the account structure, not a long form.")
      },
      {
        title: pick(language, "选择导入方式", "Choose import method"),
        description: pick(language, "先支持 CSV，后续再接 broker 集成。", "CSV import first, account integrations later.")
      },
      {
        title: pick(language, "提供账户数据", "Provide account data"),
        description: pick(language, "在真正写库前，先确认账户信息、额度和初始持仓上下文。", "Enter account details, room, and starter holding context before any write.")
      },
      {
        title: pick(language, "复核并确认", "Review and confirm"),
        description: latestPortfolioJob
          ? pick(
            language,
            `最近一次投资导入状态为 ${latestPortfolioJob.status}。确认接下来真正要写入的内容。`,
            `Latest portfolio import is ${latestPortfolioJob.status}. Confirm what should be written next.`
          )
          : pick(
            language,
            "在写入数据库之前，先复核本次账户和持仓的具体动作。",
            "Review the exact account and holding actions before writing them to the database."
          )
      },
      {
        title: pick(language, "完成设置", "Complete setup"),
        description: pick(language, "确认保存结果后，可继续前往偏好设置或总览页。", "Confirm the saved result, then continue to preferences or the dashboard.")
      }
    ],
    portfolioSetupCards: [
      {
        label: pick(language, "账户类型", "Account type"),
        title: accounts.length > 0
          ? `${accounts.map((account) => getAccountTypeLabel(account.type, language)).join(" / ")}`
          : `${getAccountTypeLabel("TFSA", language)} / ${getAccountTypeLabel("RRSP", language)} / ${getAccountTypeLabel("Taxable", language)} / ${getAccountTypeLabel("FHSA", language)}`,
        description: pick(language, "先选对账户桶位，再进入机构和细节。", "Pick the right account bucket before asking for institution detail.")
      },
      {
        label: pick(language, "导入方式", "Import method"),
        title: pick(language, "优先 CSV 上传", "CSV upload first"),
        description: pick(language, "在 broker 集成稳定前，先保持 MVP 的低摩擦导入。", "Keeps MVP friction low while we define stable broker integrations.")
      },
      {
        label: pick(language, "字段映射", "Field mapping"),
        title: latestPortfolioJob
          ? pick(language, `当前文件：${latestPortfolioJob.fileName}`, `Current file: ${latestPortfolioJob.fileName}`)
          : pick(language, "复核账户与持仓列", "Review account and holding columns"),
        description: pick(language, "映射保持显式可见，用户才会信任导入后的组合数据。", "Mapping stays explicit so the user trusts the imported portfolio data.")
      },
      {
        label: pick(language, "偏好承接", "Preference handoff"),
        title: pick(language, "继续进入投资偏好", "Move into Investment Preferences"),
        description: pick(language, "导入完成后，顺畅衔接到目标配置与账户优先级设置。", "The import flow hands off cleanly into target allocation and account priorities.")
      }
    ],
    portfolioSuccessStates: [
      pick(language, "导入后的持仓可以按账户和资产类别分组展示。", "Imported holdings can be grouped by account and asset class."),
      pick(language, "无效或未知行会在更新组合视图前先被标记出来。", "Invalid or unknown rows are flagged before the portfolio view updates."),
      pick(language, "完成后可直接前往总览页或推荐页。", "On completion the user can move directly to Dashboard or Recommendations.")
    ],
    spendingSetupCards: [
      {
        label: pick(language, "工作流", "Workflow"),
        title: pick(language, "交易流水导入", "Transaction import"),
        description: pick(language, "消费流水与投资持仓分开导入，便于两条 workflow 独立演进。", "Import spending records separately from portfolio holdings so each workflow can evolve independently.")
      },
      {
        label: pick(language, "支持行", "Supported rows"),
        title: latestSpendingJob
          ? pick(language, `最近文件：${latestSpendingJob.fileName}`, `Latest file: ${latestSpendingJob.fileName}`)
          : pick(language, "仅支持 transaction 行", "Transaction rows only"),
        description: pick(language, "聚焦消费流水、分类、商户以及流入/流出方向。", "Focus on spending transactions, categories, merchants, and inflow/outflow direction.")
      },
      {
        label: pick(language, "复核", "Review"),
        title: pick(language, "先校验再写入", "Validate before write"),
        description: pick(language, "先做预览和校验，再确认本次流水写入。", "Run preview and validation first, then confirm the transaction write.")
      },
      {
        label: pick(language, "后续集成", "Future integrations"),
        title: pick(language, "为 Provider 预留边界", "Provider-ready boundary"),
        description: pick(language, "这条路径独立存在，后续可用 bank 或 card API 替换 CSV，而不影响投资导入。", "This path is isolated so bank or card APIs can replace CSV later without affecting portfolio import.")
      }
    ],
    spendingSuccessStates: [
      pick(language, "导入后的交易会进入 Spending 指标、分类分布和近期交易历史。", "Imported transactions flow into Spending metrics, category breakdowns, and recent transaction history."),
      pick(language, "纯交易导入不会覆盖持仓或 recommendation runs。", "Transaction-only imports do not overwrite holdings or recommendation runs."),
      pick(language, "后续这条路径可以从 CSV 平滑切到 bank 或 card provider，而无需改动投资导入。", "This workflow can later swap CSV for bank or card provider integrations without changing the portfolio import path.")
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

