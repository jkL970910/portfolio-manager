import {
  DashboardData,
  ImportData,
  PortfolioAccountDetailData,
  PortfolioHoldingDetailData,
  MobileChartSeries,
  PortfolioSecurityDetailData,
  PortfolioData,
  RecommendationsData,
  SettingsData,
  SpendingData,
} from "@/lib/contracts";
import {
  AllocationTarget,
  CashflowTransaction,
  CurrencyCode,
  HoldingPosition,
  ImportJob,
  InvestmentAccount,
  CashAccount,
  CashAccountBalanceEvent,
  PortfolioEvent,
  PortfolioSnapshot,
  SecurityPriceHistoryPoint,
  PreferenceProfile,
  RecommendationRun,
  RiskProfile,
  UserProfile,
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
  getTransitionPreferenceLabel,
} from "@/lib/i18n/finance";
import { formatMoney, roundAmount } from "@/lib/money/display";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

const MONTH_LABELS_EN = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const MONTH_LABELS_ZH = ["10月", "11月", "12月", "1月", "2月", "3月"];
const PRIORITY_BADGE_VARIANTS = {
  first: "primary",
  second: "success",
  later: "warning",
} as const;

const ACCOUNT_CAPTIONS: Record<
  InvestmentAccount["type"],
  { zh: string; en: string }
> = {
  TFSA: { zh: "免税增长账户", en: "Tax-free growth sleeve" },
  RRSP: { zh: "退休长期账户", en: "Long-horizon retirement sleeve" },
  FHSA: { zh: "买房目标账户", en: "Home down-payment sleeve" },
  Taxable: { zh: "灵活应税账户", en: "Flexible capital account" },
};

const ACCOUNT_TYPE_FIT: Record<
  InvestmentAccount["type"],
  { zh: string; en: string }
> = {
  TFSA: {
    zh: "一般更适合长期免税复利，也适合放第二顺位的新增资金。",
    en: "Generally suitable for tax-free compounding and secondary funding priorities.",
  },
  RRSP: {
    zh: "一般更适合长期封存的钱，常用来放退休相关配置。",
    en: "Commonly preferred for sheltered long-horizon allocations.",
  },
  FHSA: {
    zh: "如果买房目标还在，且额度没用完，通常会排在前面。",
    en: "Commonly preferred when home-goal room remains available.",
  },
  Taxable: {
    zh: "当免税额度用得差不多，或你需要更灵活时，才会更多用到它。",
    en: "Fallback account once sheltered room is consumed or flexibility is needed.",
  },
};

const RISK_DETAILS: Record<RiskProfile, { zh: string; en: string }> = {
  Conservative: {
    zh: "整体偏稳，愿意多放固定收益和现金。",
    en: "Defensive profile with more income and cash tolerance.",
  },
  Balanced: {
    zh: "整体比较均衡，和你设的目标还算接近。",
    en: "Within configured tolerance band.",
  },
  Growth: {
    zh: "股票比例更高，波动也会更明显。",
    en: "Higher equity exposure than target comfort band.",
  },
};

const TARGET_PRESETS: Record<RiskProfile, AllocationTarget[]> = {
  Conservative: [
    { assetClass: "Canadian Equity", targetPct: 18 },
    { assetClass: "US Equity", targetPct: 22 },
    { assetClass: "International Equity", targetPct: 10 },
    { assetClass: "Fixed Income", targetPct: 35 },
    { assetClass: "Cash", targetPct: 15 },
  ],
  Balanced: [
    { assetClass: "Canadian Equity", targetPct: 22 },
    { assetClass: "US Equity", targetPct: 32 },
    { assetClass: "International Equity", targetPct: 16 },
    { assetClass: "Fixed Income", targetPct: 20 },
    { assetClass: "Cash", targetPct: 10 },
  ],
  Growth: [
    { assetClass: "Canadian Equity", targetPct: 16 },
    { assetClass: "US Equity", targetPct: 42 },
    { assetClass: "International Equity", targetPct: 22 },
    { assetClass: "Fixed Income", targetPct: 10 },
    { assetClass: "Cash", targetPct: 10 },
  ],
};

function getSecurityTypeOptionLabel(value: string, language: DisplayLanguage) {
  const labels: Record<string, { zh: string; en: string }> = {
    "Common Stock": { zh: "普通股票", en: "Common Stock" },
    ETF: { zh: "ETF", en: "ETF" },
    "Commodity ETF": { zh: "商品 ETF", en: "Commodity ETF" },
    "Mutual Fund": { zh: "共同基金", en: "Mutual Fund" },
    ADR: { zh: "ADR", en: "ADR" },
    Index: { zh: "指数", en: "Index" },
    REIT: { zh: "REIT", en: "REIT" },
    Trust: { zh: "信托", en: "Trust" },
    "Preferred Share": { zh: "优先股", en: "Preferred Share" },
    Crypto: { zh: "加密资产", en: "Crypto" },
    Forex: { zh: "外汇", en: "Forex" },
    Unknown: { zh: "未知", en: "Unknown" },
  };
  return pick(language, labels[value]?.zh ?? value, labels[value]?.en ?? value);
}

function getExchangeOptionLabel(value: string, language: DisplayLanguage) {
  const labels: Record<string, { zh: string; en: string }> = {
    TSX: { zh: "TSX 多交所", en: "TSX" },
    TSXV: { zh: "TSXV 创业板", en: "TSXV" },
    "Cboe Canada": { zh: "Cboe Canada", en: "Cboe Canada" },
    NYSE: { zh: "NYSE 纽交所", en: "NYSE" },
    NASDAQ: { zh: "NASDAQ 纳指", en: "NASDAQ" },
    "NYSE Arca": { zh: "NYSE Arca", en: "NYSE Arca" },
    OTC: { zh: "OTC 场外市场", en: "OTC" },
    LSE: { zh: "LSE 伦交所", en: "LSE" },
    TSE: { zh: "TSE 东交所", en: "TSE" },
    "Other / Manual": { zh: "其他 / 手动指定", en: "Other / Manual" },
  };
  return pick(language, labels[value]?.zh ?? value, labels[value]?.en ?? value);
}

type DisplayContext = {
  currency: CurrencyCode;
  cadToDisplayRate: number;
  usdToCadRate: number;
  fxRateDate: string | null;
  fxRateSource: string;
  fxRateFreshness: "fresh" | "stale" | "fallback";
};

function convertCadToDisplay(valueCad: number, context: DisplayContext) {
  return context.currency === "CAD"
    ? valueCad
    : roundAmount(valueCad * context.cadToDisplayRate, 2);
}

function formatDisplayCurrency(valueCad: number, context: DisplayContext) {
  return formatMoney(convertCadToDisplay(valueCad, context), context.currency);
}

function buildDisplayContext(
  context: DisplayContext,
  language: DisplayLanguage,
) {
  const fxRate = context.currency === "CAD" ? 1 : context.cadToDisplayRate;
  const freshnessLabel = pick(
    language,
    context.fxRateFreshness === "fresh"
      ? "最新"
      : context.fxRateFreshness === "stale"
        ? "可能过期"
        : "保守兜底",
    context.fxRateFreshness,
  );
  const fxAsOf = context.fxRateDate ?? null;
  const usdCadLabel = `1 USD = ${context.usdToCadRate.toFixed(4)} CAD`;
  const fxSourceLabel =
    context.fxRateSource === "fallback-static"
      ? pick(language, "本地保守兜底", "local fallback")
      : context.fxRateSource;
  return {
    currency: context.currency,
    fxRateLabel:
      context.currency === "CAD"
        ? pick(
            language,
            `当前页面统一按 CAD 展示；USD 折算使用 ${usdCadLabel}。`,
            "Base analytics and display are in CAD.",
          )
        : `1 CAD = ${fxRate.toFixed(4)} USD`,
    fxNote:
      context.currency === "CAD"
        ? pick(
            language,
            `USD 持仓仍保留 USD 原生报价；只在总资产/组合汇总时按独立 FX index 折成 CAD。FX 状态：${freshnessLabel}，日期：${fxAsOf ?? "暂无"}，来源：${fxSourceLabel}。`,
            "CAD is the active display currency. USD-native positions retain their own price inputs, while portfolio analytics stay normalized in CAD.",
          )
        : pick(
            language,
            `现在按 USD 看页面金额。底层分析仍先按 CAD 聚合，再用缓存 FX 展示；USD/CAD index 状态：${freshnessLabel}，日期：${fxAsOf ?? "none"}，来源：${fxSourceLabel}。`,
            "USD is the active display currency. Portfolio analytics remain normalized in CAD and are converted into USD for display using the latest cached USD/CAD FX rate.",
          ),
    fxAsOf,
    fxSource: context.fxRateSource,
    fxFreshness: context.fxRateFreshness,
  };
}

function formatMoneyForDisplay(
  valueAmount: number | null | undefined,
  nativeCurrency: CurrencyCode,
  valueCad: number,
  context: DisplayContext,
) {
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

function formatSignedDisplayCurrency(
  valueCad: number,
  context: DisplayContext,
) {
  const absolute = formatDisplayCurrency(Math.abs(valueCad), context);
  return `${valueCad >= 0 ? "+" : "-"}${absolute}`;
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
  return now.toLocaleString(language === "zh" ? "zh-CN" : "en-CA", {
    month: "long",
    year: "numeric",
  });
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function getAccountGainLossSummary(
  holdings: HoldingPosition[],
  display: DisplayContext,
  language: DisplayLanguage,
) {
  const holdingsWithCost = holdings.filter(
    (holding) =>
      holding.costBasisCad != null && Number.isFinite(holding.costBasisCad),
  );
  if (holdingsWithCost.length === 0) {
    return pick(language, "成本待补", "Cost basis pending");
  }

  const knownMarketValueCad = sum(
    holdingsWithCost.map((holding) => holding.marketValueCad),
  );
  const knownCostBasisCad = sum(
    holdingsWithCost.map((holding) => holding.costBasisCad ?? 0),
  );
  const gainLossCad = knownMarketValueCad - knownCostBasisCad;
  const amount = formatSignedDisplayCurrency(gainLossCad, display);

  if (holdingsWithCost.length === holdings.length && knownCostBasisCad > 0) {
    return `${amount} · ${formatSignedPercent((gainLossCad / knownCostBasisCad) * 100, 1)}`;
  }

  return amount;
}

function groupBy<T>(
  items: T[],
  getKey: (item: T) => string,
  getValue: (item: T) => number,
) {
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

function buildAccountLabelMaps(
  accounts: InvestmentAccount[],
  language: DisplayLanguage,
) {
  const typeLabelMap = new Map(
    accounts.map((account) => [
      account.id,
      getAccountTypeLabel(account.type, language),
    ]),
  );
  const nicknameCounts = new Map<string, number>();

  for (const account of accounts) {
    const nickname = getAccountNickname(account);
    nicknameCounts.set(nickname, (nicknameCounts.get(nickname) ?? 0) + 1);
  }

  const initialLabels = accounts.map((account) => {
    const nickname = getAccountNickname(account);
    const typeLabel = typeLabelMap.get(account.id) ?? account.type;
    const isGenericNickname =
      !nickname || nickname === account.type || nickname === typeLabel;
    const hasDuplicateNickname = (nicknameCounts.get(nickname) ?? 0) > 1;

    return {
      account,
      label:
        isGenericNickname || hasDuplicateNickname
          ? `${account.institution} ${typeLabel}`
          : nickname,
    };
  });

  const labelCounts = new Map<string, number>();
  for (const item of initialLabels) {
    labelCounts.set(item.label, (labelCounts.get(item.label) ?? 0) + 1);
  }

  const secondaryLabels = initialLabels.map((item) => ({
    account: item.account,
    label:
      (labelCounts.get(item.label) ?? 0) > 1
        ? `${item.label} · ${item.account.currency ?? "CAD"}`
        : item.label,
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
    const finalLabel =
      (finalCounts.get(item.label) ?? 0) > 1
        ? `${item.label} · ${rank}`
        : item.label;
    instanceLabelMap.set(item.account.id, finalLabel);
    instanceDetailMap.set(
      item.account.id,
      pick(
        language,
        `${typeLabelMap.get(item.account.id)} · ${item.account.institution} · ${item.account.currency ?? "CAD"}`,
        `${typeLabelMap.get(item.account.id)} · ${item.account.institution} · ${item.account.currency ?? "CAD"}`,
      ),
    );
  }

  return { typeLabelMap, instanceLabelMap, instanceDetailMap };
}

function getCurrentAllocation(holdings: HoldingPosition[]) {
  const total = sum(holdings.map((holding) => holding.marketValueCad));
  if (!total) {
    return new Map<string, number>();
  }
  const byAssetClass = groupBy(
    holdings,
    (holding) => holding.assetClass,
    (holding) => holding.marketValueCad,
  );
  const allocation = new Map<string, number>();
  for (const [assetClass, value] of byAssetClass.entries()) {
    allocation.set(assetClass, round((value / total) * 100, 1));
  }
  return allocation;
}

function getAccountPriorityRank(
  type: InvestmentAccount["type"],
  priorityOrder: InvestmentAccount["type"][],
) {
  const rank = priorityOrder.indexOf(type);
  return rank === -1 ? 99 : rank;
}

function getTargetAllocation(profile: PreferenceProfile) {
  if (profile.targetAllocation.length > 0) {
    return new Map(
      profile.targetAllocation.map((target) => [
        target.assetClass,
        target.targetPct,
      ]),
    );
  }
  return new Map(
    TARGET_PRESETS[profile.riskProfile].map((target) => [
      target.assetClass,
      target.targetPct,
    ]),
  );
}

function getSixMonthSeries(
  latestValue: number,
  profile: PreferenceProfile,
  labels = MONTH_LABELS_EN,
) {
  const growthCurve =
    profile.riskProfile === "Growth"
      ? [0.88, 0.91, 0.93, 0.95, 0.97, 1]
      : profile.riskProfile === "Conservative"
        ? [0.94, 0.95, 0.97, 0.98, 0.99, 1]
        : [0.9, 0.925, 0.945, 0.965, 0.982, 1];

  return labels.map((label, index) => ({
    label,
    value: Math.max(0, Math.round(latestValue * growthCurve[index])),
  }));
}

function formatSnapshotLabel(snapshotDate: string, language: DisplayLanguage) {
  return new Date(`${snapshotDate}T00:00:00`).toLocaleString(
    language === "zh" ? "zh-CN" : "en-CA",
    {
      month: "short",
    },
  );
}

function buildAbsolutePriceHistorySeries(args: {
  priceHistory?: SecurityPriceHistoryPoint[];
  language: DisplayLanguage;
}) {
  const { priceHistory = [], language } = args;
  const recent = [...priceHistory]
    .sort((left, right) => left.priceDate.localeCompare(right.priceDate))
    .map((point) => ({
      label: formatSnapshotLabel(point.priceDate, language),
      rawDate: point.priceDate,
      value: point.adjustedClose ?? point.close,
    }))
    .filter((point) => Number.isFinite(point.value));

  if (recent.length < 2) {
    return null;
  }

  return recent.map((point) => ({
    label: point.label,
    rawDate: point.rawDate,
    value: round(point.value, 2),
  }));
}

function getChartFreshness(args: {
  pointCount: number;
  latestDate: string | null;
  hasFallback: boolean;
  language: DisplayLanguage;
}) {
  if (args.hasFallback || args.pointCount < 2 || !args.latestDate) {
    return {
      status: "fallback" as const,
      label: pick(args.language, "参考曲线", "Reference only"),
      latestDate: args.latestDate,
      detail: pick(
        args.language,
        "缓存历史不足，这条线不能当作真实价格走势。",
        "Cached history is too shallow, so this line should not be treated as a real price trend.",
      ),
    };
  }

  const ageDays = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(`${args.latestDate}T00:00:00.000Z`).getTime()) /
        86400000,
    ),
  );
  if (ageDays > 10) {
    return {
      status: "stale" as const,
      label: pick(args.language, "可能过期", "Possibly stale"),
      latestDate: args.latestDate,
      detail: pick(
        args.language,
        `最近缓存日期是 ${args.latestDate}，已经约 ${ageDays} 天没有更新。`,
        `Latest cached date is ${args.latestDate}, about ${ageDays} days old.`,
      ),
    };
  }

  return {
    status: "fresh" as const,
    label: pick(args.language, "缓存可用", "Cached data available"),
    latestDate: args.latestDate,
    detail: pick(
      args.language,
      `最近缓存日期是 ${args.latestDate}。`,
      `Latest cached date is ${args.latestDate}.`,
    ),
  };
}

function buildSecurityPriceHistoryChartSeries(args: {
  symbol: string;
  exchange?: string | null;
  currency?: CurrencyCode | null;
  priceHistory?: SecurityPriceHistoryPoint[];
  fallbackPerformance: { label: string; value: number; rawDate?: string }[];
  language: DisplayLanguage;
}): MobileChartSeries {
  const normalizedSymbol = args.symbol.trim().toUpperCase();
  const requestedCurrency = args.currency ?? null;
  const requestedExchange = args.exchange?.trim().toUpperCase() || null;
  const matchingHistory = (args.priceHistory ?? [])
    .filter(
      (point) =>
        point.symbol.trim().toUpperCase() === normalizedSymbol &&
        (!requestedCurrency || point.currency === requestedCurrency) &&
        (!requestedExchange ||
          (point.exchange?.trim().toUpperCase() || "") === requestedExchange),
    )
    .sort((left, right) => left.priceDate.localeCompare(right.priceDate));
  const realPoints = buildAbsolutePriceHistorySeries({
    priceHistory: matchingHistory,
    language: args.language,
  });
  const hasFallback = !realPoints;
  const points = (realPoints ?? args.fallbackPerformance).map((point) => ({
    displayLabel: point.label,
    rawDate: point.rawDate,
    value: point.value,
    displayValue:
      requestedCurrency && !hasFallback
        ? formatMoney(point.value, requestedCurrency)
        : point.value.toFixed(1),
  }));
  const latestDate = matchingHistory.at(-1)?.priceDate ?? null;

  return {
    id: "security-price-history",
    title: pick(args.language, "价格走势", "Price trend"),
    kind: "line",
    valueType: hasFallback ? "index" : "money",
    currency: hasFallback
      ? undefined
      : (requestedCurrency ?? matchingHistory.at(-1)?.currency),
    sourceMode: "local",
    freshness: getChartFreshness({
      pointCount: matchingHistory.length,
      latestDate,
      hasFallback,
      language: args.language,
    }),
    identity: {
      symbol: normalizedSymbol,
      exchange: args.exchange ?? null,
      currency: requestedCurrency,
    },
    points,
    notes: [
      hasFallback
        ? pick(
            args.language,
            "缓存价格历史不足，当前显示参考指数曲线，不代表真实价格走势。",
            "Cached price history is too shallow; this is a reference index curve, not a real price trend.",
          )
        : pick(
            args.language,
            "这条线来自本地缓存价格历史，不会在页面加载时触发付费或实时外部请求。",
            "This line uses local cached price history and does not trigger paid or live external requests on page load.",
          ),
      pick(
        args.language,
        `身份：${normalizedSymbol} · ${args.exchange ?? "未指定市场"} · ${requestedCurrency ?? "未指定币种"}`,
        `Identity: ${normalizedSymbol} · ${args.exchange ?? "unspecified exchange"} · ${requestedCurrency ?? "unspecified currency"}`,
      ),
    ],
  };
}

type PortfolioValueSeriesSource = "replayed-prices" | "snapshots" | "reference";

function getLatestSeriesDate(points: { rawDate?: string }[]): string | null {
  return (
    points
      .map((point) => point.rawDate)
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1) ?? null
  );
}

function buildPortfolioValueChartFreshness(args: {
  source: PortfolioValueSeriesSource;
  pointCount: number;
  latestDate: string | null;
  language: DisplayLanguage;
  subjectLabel?: string;
}) {
  const subjectLabel =
    args.subjectLabel ?? pick(args.language, "组合", "portfolio");
  if (args.source === "reference" || args.pointCount < 2 || !args.latestDate) {
    return {
      status: "fallback" as const,
      label: pick(args.language, "参考曲线", "Reference only"),
      latestDate: args.latestDate,
      detail: pick(
        args.language,
        `真实${subjectLabel}历史不足，当前曲线只是参考形状，不能当作真实${subjectLabel}走势。`,
        `Real ${subjectLabel} history is too shallow, so this line is only a reference shape and should not be treated as actual ${subjectLabel} performance.`,
      ),
    };
  }

  const ageDays = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(`${args.latestDate}T00:00:00.000Z`).getTime()) /
        86400000,
    ),
  );
  if (ageDays > 10) {
    return {
      status: "stale" as const,
      label: pick(args.language, "可能过期", "Possibly stale"),
      latestDate: args.latestDate,
      detail: pick(
        args.language,
        `最近${subjectLabel}历史日期是 ${args.latestDate}，已经约 ${ageDays} 天没有更新。`,
        `Latest ${subjectLabel} history date is ${args.latestDate}, about ${ageDays} days old.`,
      ),
    };
  }

  return {
    status: "fresh" as const,
    label: pick(args.language, "本地历史可用", "Local history available"),
    latestDate: args.latestDate,
    detail: pick(
      args.language,
      `最近${subjectLabel}历史日期是 ${args.latestDate}。`,
      `Latest ${subjectLabel} history date is ${args.latestDate}.`,
    ),
  };
}

function buildPortfolioValueChartSeries(args: {
  performance: { label: string; value: number; rawDate?: string }[];
  source: PortfolioValueSeriesSource;
  language: DisplayLanguage;
  display: DisplayContext;
  id?: string;
  title?: string;
  subjectLabel?: string;
}): MobileChartSeries {
  const latestDate = getLatestSeriesDate(args.performance);
  const subjectLabel =
    args.subjectLabel ?? pick(args.language, "组合", "portfolio");
  const sourceNote =
    args.source === "replayed-prices"
      ? pick(
          args.language,
          `这条线来自本地${subjectLabel}持仓数量和缓存价格历史回放，不会在页面加载时触发实时外部请求。`,
          `This line replays local ${subjectLabel} holdings and cached price history and does not trigger live external requests on page load.`,
        )
      : args.source === "snapshots"
        ? pick(
            args.language,
            `这条线来自本地${subjectLabel}快照，用于展示已保存的${subjectLabel}历史。`,
            `This line uses local ${subjectLabel} snapshots to show saved ${subjectLabel} history.`,
          )
        : pick(
            args.language,
            `真实${subjectLabel}历史不足，当前显示参考曲线，不代表真实${subjectLabel}走势。`,
            `Real ${subjectLabel} history is too shallow; this is a reference curve, not actual ${subjectLabel} performance.`,
          );

  return {
    id: args.id ?? "portfolio-value-history",
    title:
      args.title ??
      pick(args.language, "组合价值走势", "Portfolio value trend"),
    kind: "line",
    valueType: "money",
    currency: args.display.currency,
    sourceMode: "local",
    freshness: buildPortfolioValueChartFreshness({
      source: args.source,
      pointCount: args.performance.length,
      latestDate,
      language: args.language,
      subjectLabel,
    }),
    points: args.performance.map((point) => ({
      displayLabel: point.label,
      rawDate: point.rawDate,
      value: point.value,
      displayValue: formatMoney(point.value, args.display.currency),
    })),
    notes: [
      sourceNote,
      pick(
        args.language,
        `显示币种：${args.display.currency}；底层组合分析仍以 CAD 归一化后再展示。`,
        `Display currency: ${args.display.currency}; underlying portfolio analytics remain CAD-normalized before display conversion.`,
      ),
    ],
  };
}

function buildHoldingValueHistorySeries(args: {
  holding: HoldingPosition;
  priceHistory?: SecurityPriceHistoryPoint[];
  events?: PortfolioEvent[];
  language: DisplayLanguage;
  display: DisplayContext;
}) {
  const { holding, priceHistory = [], events = [], language, display } = args;
  const normalizedSymbol = holding.symbol.trim().toUpperCase();
  const normalizedExchange =
    holding.exchangeOverride?.trim().toUpperCase() || "";
  const holdingCurrency = holding.currency ?? "CAD";
  const cadPerHoldingCurrency =
    holdingCurrency === "CAD"
      ? 1
      : holding.lastPriceAmount && holding.lastPriceCad
        ? holding.lastPriceCad / holding.lastPriceAmount
        : null;

  const relevantHistory = [...priceHistory]
    .filter(
      (point) =>
        point.symbol.trim().toUpperCase() === normalizedSymbol &&
        (point.exchange?.trim().toUpperCase() || "") === normalizedExchange &&
        point.currency === holdingCurrency,
    )
    .sort((left, right) => left.priceDate.localeCompare(right.priceDate));

  if (relevantHistory.length < 2 || cadPerHoldingCurrency == null) {
    return null;
  }

  const latestDate = relevantHistory.at(-1)?.priceDate;
  if (!latestDate) {
    return null;
  }

  const sixMonthsAgo = new Date(`${latestDate}T00:00:00.000Z`);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentHistory = relevantHistory.filter(
    (point) => new Date(`${point.priceDate}T00:00:00.000Z`) >= sixMonthsAgo,
  );
  if (recentHistory.length < 2) {
    return null;
  }

  const currentQuantity = getHoldingQuantityForReplay(holding);
  if (currentQuantity <= 0) {
    return null;
  }

  const relevantEvents = events
    .filter(
      (event) =>
        event.accountId === holding.accountId &&
        event.symbol?.trim().toUpperCase() === normalizedSymbol &&
        (!event.currency || event.currency === holdingCurrency),
    )
    .sort((left, right) => left.bookedAt.localeCompare(right.bookedAt));

  const series = recentHistory
    .map((point) => {
      const futureDelta = relevantEvents
        .filter((event) => event.bookedAt > point.priceDate)
        .reduce((sum, event) => sum + getEventQuantityDelta(event), 0);
      const quantityAtDate = Math.max(currentQuantity - futureDelta, 0);
      const close = point.adjustedClose ?? point.close;
      const valueCad = quantityAtDate * close * cadPerHoldingCurrency;
      return {
        label: formatSnapshotLabel(point.priceDate, language),
        rawDate: point.priceDate,
        value: round(convertCadToDisplay(valueCad, display), 2),
      };
    })
    .filter((point) => point.value > 0);

  return series.length >= 2 ? series : null;
}

function buildIndexedHeldPositionSeries(args: {
  priceHistory?: SecurityPriceHistoryPoint[];
  events?: PortfolioEvent[];
  accountId?: string;
  symbol: string;
  language: DisplayLanguage;
}) {
  const { priceHistory = [], events = [], accountId, symbol, language } = args;
  const normalizedSymbol = symbol.trim().toUpperCase();
  const relevantEvents = events
    .filter(
      (event) =>
        (!accountId || event.accountId === accountId) &&
        event.symbol?.trim().toUpperCase() === normalizedSymbol,
    )
    .sort((left, right) => left.bookedAt.localeCompare(right.bookedAt));
  const relevantHistory = [...priceHistory]
    .sort((left, right) => left.priceDate.localeCompare(right.priceDate))
    .slice(-6);

  if (relevantEvents.length === 0 || relevantHistory.length < 2) {
    return null;
  }

  let runningQuantity = 0;
  let eventIndex = 0;
  const rawSeries = relevantHistory.map((point) => {
    while (
      eventIndex < relevantEvents.length &&
      relevantEvents[eventIndex].bookedAt <= point.priceDate
    ) {
      const event = relevantEvents[eventIndex];
      const delta = event.quantity ?? 0;
      runningQuantity += event.eventType === "sell" ? -delta : delta;
      eventIndex += 1;
    }

    return {
      label: formatSnapshotLabel(point.priceDate, language),
      rawDate: point.priceDate,
      value: round(
        (point.adjustedClose ?? point.close) * Math.max(runningQuantity, 0),
        2,
      ),
    };
  });

  const meaningful = rawSeries.filter((point) => point.value > 0);
  if (meaningful.length < 2) {
    return null;
  }

  const baseline = meaningful[0]?.value || 1;
  return meaningful.map((point) => ({
    label: point.label,
    rawDate: point.rawDate,
    value: round((point.value / baseline) * 100, 1),
  }));
}

function getHoldingQuantityForReplay(holding: HoldingPosition) {
  if (holding.quantity != null && Number.isFinite(holding.quantity)) {
    return holding.quantity;
  }

  if (
    holding.marketValueAmount != null &&
    holding.lastPriceAmount != null &&
    holding.lastPriceAmount > 0 &&
    Number.isFinite(holding.marketValueAmount) &&
    Number.isFinite(holding.lastPriceAmount)
  ) {
    return holding.marketValueAmount / holding.lastPriceAmount;
  }

  return 0;
}

function getEventQuantityDelta(event: PortfolioEvent) {
  const quantity = event.quantity ?? 0;
  if (event.eventType === "sell") {
    return -quantity;
  }
  return quantity;
}

function normalizeReplayCurrency(
  value: string | null | undefined,
): CurrencyCode {
  return value === "USD" ? "USD" : "CAD";
}

function getReplayIdentityKey(
  symbol: string,
  exchange: string | null | undefined,
  currency: string | null | undefined,
) {
  return `${symbol.trim().toUpperCase()}::${exchange?.trim().toUpperCase() || ""}::${normalizeReplayCurrency(currency)}`;
}

function convertNativePriceToCad(
  price: number,
  currency: string | null | undefined,
  display: DisplayContext,
) {
  return normalizeReplayCurrency(currency) === "USD"
    ? price * display.usdToCadRate
    : price;
}

function buildReplayedAggregateValueSeries(args: {
  holdings: HoldingPosition[];
  priceHistory: SecurityPriceHistoryPoint[];
  events?: PortfolioEvent[];
  language: DisplayLanguage;
  display: DisplayContext;
  accountId?: string;
}) {
  const {
    holdings,
    priceHistory,
    events = [],
    language,
    display,
    accountId,
  } = args;
  const relevantHoldings = accountId
    ? holdings.filter((holding) => holding.accountId === accountId)
    : holdings;
  if (relevantHoldings.length === 0) {
    return null;
  }

  const groupedCurrentQuantities = new Map<string, number>();
  for (const holding of relevantHoldings) {
    const key = getReplayIdentityKey(
      holding.symbol,
      holding.exchangeOverride,
      holding.currency,
    );
    groupedCurrentQuantities.set(
      key,
      (groupedCurrentQuantities.get(key) ?? 0) +
        getHoldingQuantityForReplay(holding),
    );
  }

  const historiesBySymbol = new Map<string, SecurityPriceHistoryPoint[]>();
  for (const point of priceHistory) {
    const key = getReplayIdentityKey(
      point.symbol,
      point.exchange,
      point.currency,
    );
    if (!groupedCurrentQuantities.has(key)) {
      continue;
    }
    const list = historiesBySymbol.get(key) ?? [];
    list.push(point);
    historiesBySymbol.set(key, list);
  }

  const allDates = [
    ...new Set(
      [...historiesBySymbol.values()]
        .flat()
        .map((point) => point.priceDate)
        .sort(),
    ),
  ];
  if (allDates.length < 2) {
    return null;
  }

  const endDate = new Date(allDates[allDates.length - 1]);
  const sixMonthsAgo = new Date(endDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const replayDates = allDates.filter((date) => new Date(date) >= sixMonthsAgo);
  if (replayDates.length < 2) {
    return null;
  }

  const groupedEvents = new Map<string, PortfolioEvent[]>();
  for (const event of events) {
    const symbol = event.symbol?.trim().toUpperCase();
    const key = symbol
      ? getReplayIdentityKey(symbol, null, event.currency)
      : null;
    if (!key || !groupedCurrentQuantities.has(key)) {
      continue;
    }
    if (accountId && event.accountId !== accountId) {
      continue;
    }
    const list = groupedEvents.get(key) ?? [];
    list.push(event);
    groupedEvents.set(key, list);
  }
  for (const [key, list] of groupedEvents.entries()) {
    groupedEvents.set(
      key,
      list.sort((left, right) => left.bookedAt.localeCompare(right.bookedAt)),
    );
  }

  const latestSeenPriceBySymbol = new Map<string, number>();
  const pointers = new Map<string, number>();
  for (const [key] of historiesBySymbol.entries()) {
    pointers.set(key, 0);
    historiesBySymbol.set(
      key,
      historiesBySymbol
        .get(key)!
        .sort((left, right) => left.priceDate.localeCompare(right.priceDate)),
    );
  }

  const formatter = new Intl.DateTimeFormat(
    language === "zh" ? "zh-CN" : "en-CA",
    {
      month: "short",
      day: "numeric",
    },
  );

  const series = replayDates
    .map((date) => {
      for (const [key, points] of historiesBySymbol.entries()) {
        let pointer = pointers.get(key) ?? 0;
        while (pointer < points.length && points[pointer].priceDate <= date) {
          latestSeenPriceBySymbol.set(
            key,
            convertNativePriceToCad(
              points[pointer].adjustedClose ?? points[pointer].close,
              points[pointer].currency,
              display,
            ),
          );
          pointer += 1;
        }
        pointers.set(key, pointer);
      }

      let totalValueCad = 0;
      for (const [key, currentQuantity] of groupedCurrentQuantities.entries()) {
        const latestPrice = latestSeenPriceBySymbol.get(key);
        if (latestPrice == null) {
          continue;
        }

        const futureDelta = (groupedEvents.get(key) ?? [])
          .filter((event) => event.bookedAt > date)
          .reduce((sum, event) => sum + getEventQuantityDelta(event), 0);
        const quantityAtDate = currentQuantity - futureDelta;
        totalValueCad += Math.max(quantityAtDate, 0) * latestPrice;
      }

      return {
        label: formatter.format(new Date(date)),
        rawDate: date,
        value: round(convertCadToDisplay(totalValueCad, display), 2),
      };
    })
    .filter((point) => point.value > 0);

  return series.length >= 2 ? series : null;
}

function buildAbsoluteSeriesFromSnapshots(args: {
  snapshots?: PortfolioSnapshot[];
  language: DisplayLanguage;
  display: DisplayContext;
  getValue: (snapshot: PortfolioSnapshot) => number;
}) {
  const { snapshots = [], language, display, getValue } = args;
  const recent = [...snapshots]
    .sort((left, right) => left.snapshotDate.localeCompare(right.snapshotDate))
    .slice(-183)
    .map((snapshot) => ({
      label: formatSnapshotLabel(snapshot.snapshotDate, language),
      rawDate: snapshot.snapshotDate,
      value: round(convertCadToDisplay(getValue(snapshot), display), 2),
    }))
    .filter((point) => Number.isFinite(point.value));

  return recent.length >= 2 ? recent : null;
}

function anchorSeriesToCurrentValue(args: {
  series: { label: string; value: number; rawDate?: string }[];
  currentValueCad: number;
  language: DisplayLanguage;
  display: DisplayContext;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentPoint = {
    label: formatSnapshotLabel(today, args.language),
    rawDate: today,
    value: round(convertCadToDisplay(args.currentValueCad, args.display), 2),
  };
  const withoutToday = args.series.filter((point) => point.rawDate !== today);
  return [...withoutToday, currentPoint].sort((left, right) =>
    (left.rawDate ?? left.label).localeCompare(right.rawDate ?? right.label),
  );
}

function buildCashBalanceSeries(args: {
  cashAccounts?: CashAccount[];
  cashAccountBalanceEvents?: CashAccountBalanceEvent[];
  language: DisplayLanguage;
  display: DisplayContext;
}) {
  const {
    cashAccounts = [],
    cashAccountBalanceEvents = [],
    language,
    display,
  } = args;
  if (cashAccounts.length === 0) {
    return null;
  }

  const eventsByAccount = new Map<string, CashAccountBalanceEvent[]>();
  for (const event of cashAccountBalanceEvents) {
    const group = eventsByAccount.get(event.cashAccountId) ?? [];
    group.push(event);
    eventsByAccount.set(event.cashAccountId, group);
  }
  for (const [key, list] of eventsByAccount.entries()) {
    eventsByAccount.set(
      key,
      list.sort((left, right) => left.bookedAt.localeCompare(right.bookedAt)),
    );
  }

  const allDates = [
    ...new Set(cashAccountBalanceEvents.map((event) => event.bookedAt).sort()),
  ];
  if (allDates.length < 2) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat(
    language === "zh" ? "zh-CN" : "en-CA",
    {
      month: "short",
      day: "numeric",
    },
  );

  return allDates.map((date) => {
    let totalBalanceCad = 0;
    for (const account of cashAccounts) {
      const events = eventsByAccount.get(account.id) ?? [];
      const latest = [...events]
        .reverse()
        .find((event) => event.bookedAt <= date);
      totalBalanceCad += latest?.balanceCad ?? account.currentBalanceCad;
    }

    return {
      label: formatter.format(new Date(date)),
      rawDate: date,
      value: round(convertCadToDisplay(totalBalanceCad, display), 2),
    };
  });
}

function getCurrentCashBalanceCad(cashAccounts: CashAccount[]) {
  return sum(cashAccounts.map((account) => account.currentBalanceCad));
}

function getMonthlyTransactionSeries(
  transactions: CashflowTransaction[],
  language: DisplayLanguage,
) {
  const outflows = transactions.filter(
    (transaction) => transaction.direction === "outflow",
  );
  const monthlyTotals = groupBy(
    outflows,
    (transaction) => transaction.bookedAt.slice(0, 7),
    (transaction) => transaction.amountCad,
  );
  const sortedKeys = [...monthlyTotals.keys()].sort();

  if (sortedKeys.length >= 6) {
    return sortedKeys.slice(-6).map((key) => ({
      label: new Date(`${key}-01T00:00:00`).toLocaleString(
        language === "zh" ? "zh-CN" : "en-CA",
        { month: "short" },
      ),
      value: round(monthlyTotals.get(key) ?? 0, 0),
    }));
  }

  const latestValue = round(
    sortedKeys.length > 0
      ? (monthlyTotals.get(sortedKeys[sortedKeys.length - 1]) ?? 0)
      : 0,
    0,
  );
  const fallback = [1.08, 1.05, 1.02, 0.98, 1.01, 1].map((factor) =>
    round(latestValue * factor, 0),
  );
  return getMonthLabels(language).map((label, index) => ({
    label,
    value: fallback[index] ?? latestValue,
  }));
}

function getCurrentMonthTransactions(transactions: CashflowTransaction[]) {
  const latestMonth = transactions
    .map((transaction) => transaction.bookedAt.slice(0, 7))
    .sort()
    .at(-1);

  if (!latestMonth) {
    return [];
  }

  return transactions.filter((transaction) =>
    transaction.bookedAt.startsWith(latestMonth),
  );
}

function buildSpendingSummary(
  transactions: CashflowTransaction[],
  cashBufferTargetCad: number,
) {
  const currentMonthTransactions = getCurrentMonthTransactions(transactions);
  const outflows = currentMonthTransactions.filter(
    (transaction) => transaction.direction === "outflow",
  );
  const inflows = currentMonthTransactions.filter(
    (transaction) => transaction.direction === "inflow",
  );
  const outflowTotal = sum(
    outflows.map((transaction) => transaction.amountCad),
  );
  const inflowTotal = sum(inflows.map((transaction) => transaction.amountCad));
  const investableCashRaw = Math.max(
    0,
    inflowTotal - outflowTotal - cashBufferTargetCad / 12,
  );
  const savingsRate =
    inflowTotal > 0 ? ((inflowTotal - outflowTotal) / inflowTotal) * 100 : 0;
  const categoryTotals = [
    ...groupBy(
      outflows,
      (transaction) => transaction.category,
      (transaction) => transaction.amountCad,
    ).entries(),
  ].sort((left, right) => right[1] - left[1]);

  return {
    outflowTotal,
    inflowTotal,
    investableCash: round(investableCashRaw, 0),
    savingsRate: round(savingsRate, 1),
    categories: categoryTotals,
  };
}

function getRecommendationTheme(
  run: RecommendationRun | null,
  context: DisplayContext,
  language: DisplayLanguage,
  profile: PreferenceProfile,
  accounts: InvestmentAccount[],
) {
  const lead = run?.items[0];
  if (!lead) {
    return {
      theme: pick(
        language,
        "还不能给你下一步建议",
        "The system needs your data and preferences before it can suggest a next step",
      ),
      subtitle: pick(
        language,
        "先把账户、持仓和偏好补齐。",
        "There is no usable next-step recommendation yet.",
      ),
      reason: pick(
        language,
        "只要账户、持仓和目标配置都准备好，系统就能开始判断下一笔钱先补哪里。",
        "Once your accounts, holdings, and target mix are in place, the system can start suggesting where new money likely helps first.",
      ),
      signals: [
        pick(
          language,
          "先导入至少一个账户和一笔持仓，让系统知道你现在有什么。",
          "Import at least one account and one holding so the system can understand the current portfolio.",
        ),
        pick(
          language,
          "再保存你的偏好，系统才知道你想往什么配置靠。",
          "Then save your preferences so the system knows what kind of mix you want to move toward.",
        ),
      ],
    };
  }

  return {
    theme: pick(
      language,
      `${getAccountTypeLabel(lead.targetAccountType, language)} 先补 ${getAssetClassLabel(lead.assetClass, language)}`,
      `${getAssetClassLabel(lead.assetClass, language)} in ${getAccountTypeLabel(lead.targetAccountType, language)}`,
    ),
    subtitle: pick(
      language,
      `如果你下一笔准备投入 ${formatDisplayCurrency(run.contributionAmountCad, context)}，系统现在会先看这条路。`,
      `If you are putting in ${formatDisplayCurrency(run.contributionAmountCad, context)} next, this is the path the system would check first.`,
    ),
    reason: getRecommendationItemExplanation(lead, context, language),
    signals: getRecommendationAssumptions(profile, accounts, language).slice(
      0,
      2,
    ),
  };
}

function getSignalForHolding(
  holding: HoldingPosition,
  driftMap: Map<string, number>,
  language: DisplayLanguage,
) {
  const gap = driftMap.get(holding.assetClass) ?? 0;
  if (holding.symbol === "CASH" && holding.weightPct > 8) {
    return pick(
      language,
      "Loo皇看你这笔现金留得偏多，先别继续囤着了，不然会拖慢整体配置。",
      "There is too much idle cash here right now. Leaving it untouched would keep dragging the overall mix.",
    );
  }
  if (gap < -4) {
    return pick(
      language,
      `Loo皇看这类资产还没补够，离你定的目标大约还差 ${formatCompactPercent(Math.abs(gap), 0)}。`,
      `This sleeve remains underweight by ${formatCompactPercent(Math.abs(gap), 0)} versus target.`,
    );
  }
  if (holding.weightPct >= 15) {
    return pick(
      language,
      "Loo皇看这笔仓位已经够重，再往上加只会让整体波动更扎眼。",
      "This position is already heavy enough. Adding more would make total portfolio swings stand out even more.",
    );
  }
  return pick(
    language,
    "Loo皇暂时没有把这笔列成重点，它现在还算放得稳。",
    "This position is not being flagged as urgent right now. It still sits reasonably well in the current mix.",
  );
}

function formatHoldingLastUpdated(
  value: string | null | undefined,
  language: DisplayLanguage,
) {
  if (!value) {
    return pick(language, "还没拿到价格", "Not refreshed");
  }

  return new Date(value).toLocaleString(language === "zh" ? "zh-CN" : "en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getHoldingFreshnessVariant(
  value?: string | null,
): "success" | "warning" | "neutral" {
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

function getPortfolioQuoteStatus(
  holdings: HoldingPosition[],
  language: DisplayLanguage,
) {
  const quotedHoldings = holdings.filter(
    (holding) => (holding.lastPriceCad ?? 0) > 0 && holding.updatedAt,
  );
  const coverage =
    holdings.length > 0
      ? pick(
          language,
          `${quotedHoldings.length}/${holdings.length} 笔持仓已经拿到可参考价格`,
          `${quotedHoldings.length}/${holdings.length} holdings already have usable prices`,
        )
      : pick(
          language,
          "现在还没有可刷新的持仓价格。",
          "There are no holdings with refreshable prices yet",
        );

  if (quotedHoldings.length === 0) {
    return {
      lastRefreshed: pick(language, "还没有刷新过价格", "No price refresh yet"),
      freshness: pick(language, "暂时未知", "Unknown"),
      coverage,
    };
  }

  const latestUpdatedAt = quotedHoldings
    .map((holding) => new Date(holding.updatedAt!))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  const ageMs = Date.now() - latestUpdatedAt.getTime();
  const ageMinutes = Math.max(0, Math.round(ageMs / 60000));
  const freshness =
    ageMinutes <= 30
      ? pick(language, "较新，可以直接参考", "Fresh within cache window")
      : ageMinutes <= 180
        ? pick(language, "稍微旧一点，但还能参考", "Stale but still usable")
        : pick(language, "建议再刷新一次", "Refresh recommended");

  return {
    lastRefreshed: latestUpdatedAt.toLocaleString(
      language === "zh" ? "zh-CN" : "en-CA",
      {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      },
    ),
    freshness,
    coverage,
  };
}

function sortTargetsForDisplay(targets: AllocationTarget[]) {
  return [...targets].sort((left, right) => {
    const order = [
      "Canadian Equity",
      "US Equity",
      "International Equity",
      "Fixed Income",
      "Cash",
    ];
    return order.indexOf(left.assetClass) - order.indexOf(right.assetClass);
  });
}

function getRiskDetail(riskProfile: RiskProfile, language: DisplayLanguage) {
  const detail = RISK_DETAILS[riskProfile];
  return pick(language, detail.zh, detail.en);
}

function getAccountCaption(
  type: InvestmentAccount["type"],
  language: DisplayLanguage,
) {
  const caption = ACCOUNT_CAPTIONS[type];
  return pick(language, caption.zh, caption.en);
}

function getAccountTypeFit(
  type: InvestmentAccount["type"],
  language: DisplayLanguage,
) {
  const fit = ACCOUNT_TYPE_FIT[type];
  return pick(language, fit.zh, fit.en);
}

function formatRoomDetail(
  account: InvestmentAccount,
  display: DisplayContext,
  language: DisplayLanguage,
) {
  if (account.contributionRoomCad == null) {
    return pick(language, "这类账户没有免税额度概念", "No tax shelter");
  }
  return pick(
    language,
    `还剩 ${formatDisplayCurrency(account.contributionRoomCad, display)} 可用额度`,
    `${formatDisplayCurrency(account.contributionRoomCad, display)} room left`,
  );
}

function getAccountBadgeLabel(
  index: number,
  includedInPriority: boolean,
  language: DisplayLanguage,
) {
  if (index === 0) {
    return pick(language, "优先", "Priority");
  }
  if (includedInPriority) {
    return pick(language, "账户匹配", "Tax fit");
  }
  return pick(language, "复核", "Review");
}

function formatAccountPriorityOrder(
  priorityOrder: InvestmentAccount["type"][],
  language: DisplayLanguage,
) {
  return priorityOrder
    .map((type) => getAccountTypeLabel(type, language))
    .join(" -> ");
}

function getEffectiveAccountPriorityOrder(
  accounts: InvestmentAccount[],
  priorityOrder: InvestmentAccount["type"][],
) {
  const accountTypes = new Set(accounts.map((account) => account.type));
  const availableShelteredTypes = new Set(
    accounts
      .filter(
        (account) =>
          account.type === "Taxable" ||
          account.contributionRoomCad == null ||
          account.contributionRoomCad > 0,
      )
      .map((account) => account.type),
  );

  return priorityOrder.filter(
    (type) => accountTypes.has(type) && availableShelteredTypes.has(type),
  );
}

function getExhaustedPriorityTypes(
  accounts: InvestmentAccount[],
  priorityOrder: InvestmentAccount["type"][],
) {
  const accountTypes = new Set(accounts.map((account) => account.type));
  const availableShelteredTypes = new Set(
    accounts
      .filter(
        (account) =>
          account.type === "Taxable" ||
          account.contributionRoomCad == null ||
          account.contributionRoomCad > 0,
      )
      .map((account) => account.type),
  );

  return priorityOrder.filter(
    (type) => accountTypes.has(type) && !availableShelteredTypes.has(type),
  );
}

function formatHoldingPrice(
  amount: number | null | undefined,
  currency: CurrencyCode | null | undefined,
  amountCad: number | null | undefined,
  display: DisplayContext,
  language: DisplayLanguage,
) {
  if (amountCad != null && amountCad > 0) {
    return formatMoneyForDisplay(
      amount ?? amountCad,
      currency ?? "CAD",
      amountCad,
      display,
    );
  }
  return pick(language, "暂时没有价格", "Not priced");
}

function formatHoldingQuantity(
  quantity: number | null | undefined,
  language: DisplayLanguage,
) {
  if (quantity == null || !Number.isFinite(quantity)) {
    return pick(language, "还没填", "Not set");
  }
  return quantity.toLocaleString(language === "zh" ? "zh-CN" : "en-CA", {
    maximumFractionDigits: 4,
  });
}

function formatHoldingAmount(
  amount: number | null | undefined,
  currency: CurrencyCode | null | undefined,
  amountCad: number | null | undefined,
  display: DisplayContext,
  language: DisplayLanguage,
) {
  if (amountCad == null || !Number.isFinite(amountCad) || amountCad <= 0) {
    return pick(language, "还没填", "Not set");
  }
  return formatMoneyForDisplay(
    amount ?? amountCad,
    currency ?? "CAD",
    amountCad,
    display,
  );
}

function getRecommendationAssumptions(
  profile: PreferenceProfile,
  accounts: InvestmentAccount[],
  language: DisplayLanguage,
) {
  const effectiveOrder = getEffectiveAccountPriorityOrder(
    accounts,
    profile.accountFundingPriority,
  );
  const exhaustedTypes = getExhaustedPriorityTypes(
    accounts,
    profile.accountFundingPriority,
  );
  return [
    pick(
      language,
      "Loo皇会先拿你现在的持仓，去对照你自己设的目标配置。",
      "The system first compares your current mix with the target mix you set.",
    ),
    pick(
      language,
      `Loo皇也会参考你想先用哪些账户。这次真正还能先用的是 ${formatAccountPriorityOrder(effectiveOrder, language)}。`,
      `It also considers which accounts you prefer to use first. The usable order for this contribution is ${formatAccountPriorityOrder(effectiveOrder, language)}.`,
    ),
    ...(exhaustedTypes.length > 0
      ? [
          pick(
            language,
            `${formatAccountPriorityOrder(exhaustedTypes, language)} 这次会先往后排，因为 Loo皇看到账户额度已经用完了。`,
            `${formatAccountPriorityOrder(exhaustedTypes, language)} drops back for this contribution because the available room is already used up.`,
          ),
        ]
      : []),
    profile.taxAwarePlacement
      ? pick(
          language,
          "你打开了账户放置引导，所以 Loo皇会更在意钱放在哪个账户里更顺手。",
          "You have account placement guidance turned on, so the system pays more attention to which account is a better long-term home.",
        )
      : pick(
          language,
          "你没有打开账户放置引导，所以 Loo皇会更直接地先补最大的配置缺口。",
          "Account placement guidance is off, so the run leans more on allocation gaps and room availability.",
        ),
  ];
}

function getRecommendationItemExplanation(
  item: RecommendationRun["items"][number],
  display: DisplayContext,
  language: DisplayLanguage,
) {
  const assetClass = getAssetClassLabel(item.assetClass, language);
  const accountType = getAccountTypeLabel(item.targetAccountType, language);
  return pick(
    language,
    `Loo皇看 ${assetClass} 现在还没补够，所以这次会先把 ${formatDisplayCurrency(item.amountCad, display)} 放进 ${accountType}。`,
    `${assetClass} is currently underweight relative to the configured target, so this run allocates ${formatDisplayCurrency(item.amountCad, display)} to ${accountType}.`,
  );
}

function getGuidedQuestions(
  profile: PreferenceProfile,
  language: DisplayLanguage,
) {
  if (profile.riskProfile === "Growth") {
    return [
      pick(
        language,
        "买房目标和长期增长相比，对你来说哪个更重要？",
        "How important is the home goal compared with long-term portfolio growth?",
      ),
      pick(
        language,
        "如果组合短期波动变大，你大概能接受到什么程度？",
        "How much short-term volatility can you tolerate before changing course?",
      ),
      pick(
        language,
        "这套推荐是先顾账户额度，还是先补配置缺口？",
        "Should the engine prioritize sheltered room before broader drift correction?",
      ),
      pick(
        language,
        "你希望手头大概留多少现金，来应对近期开销？",
        "How much cash should remain available for shorter-term milestones?",
      ),
    ];
  }

  return [
    pick(
      language,
      "你这笔钱主要是为了什么，打算放多久？",
      "What is your primary financial goal and time horizon?",
    ),
    pick(
      language,
      "如果组合回撤或波动变大，你大概能接受多少？",
      "How comfortable are you with portfolio volatility and drawdowns?",
    ),
    pick(
      language,
      "你更在意长期税务效率，还是更想贴近现在的持仓结构？",
      "Should the engine prioritize tax efficiency or staying close to current holdings?",
    ),
    pick(
      language,
      "为了应对近期开销，你要不要多留一点现金缓冲？",
      "Should recommendations preserve a larger cash buffer for upcoming spending?",
    ),
  ];
}

function getManualGroups(
  profile: PreferenceProfile,
  language: DisplayLanguage,
): SettingsData["manualGroups"] {
  return [
    {
      title: pick(
        language,
        "风险和目标配置",
        "Risk profile and target allocation",
      ),
      description: pick(
        language,
        `你现在是${getRiskProfileLabel(profile.riskProfile, language)}，一共设了 ${sortTargetsForDisplay(profile.targetAllocation).length} 类目标配置。`,
        `Current profile is ${profile.riskProfile.toLowerCase()} with ${sortTargetsForDisplay(profile.targetAllocation).length} target sleeves configured.`,
      ),
    },
    {
      title: pick(language, "账户使用顺序", "Account funding priorities"),
      description: pick(
        language,
        `你保存的顺序是：${profile.accountFundingPriority.join(" -> ")}`,
        `Current order: ${profile.accountFundingPriority.join(" -> ")}`,
      ),
      badge: pick(language, "可调整", "Sortable"),
    },
    {
      title: pick(language, "推荐怎么偏向", "Recommendation behavior"),
      description: pick(
        language,
        `现在更偏向${getTransitionPreferenceLabel(profile.transitionPreference, language)}，推荐方式是${getRecommendationStrategyLabel(profile.recommendationStrategy, language)}。`,
        `Transition is ${profile.transitionPreference}, strategy is ${profile.recommendationStrategy}.`,
      ),
    },
    {
      title: pick(language, "账户放置引导", "Tax-aware placement"),
      description: profile.taxAwarePlacement
        ? pick(
            language,
            "已经打开。Loo皇会更认真地判断钱放在哪类账户里更顺手。",
            "Tax-aware placement is enabled. Advanced province and marginal bracket fields can stay collapsed by default.",
          )
        : pick(
            language,
            "现在关闭。Loo皇会更直接地先补配置缺口。",
            "Tax-aware placement is disabled. The engine will favor simpler account-fit rules.",
          ),
      badge: pick(language, "高级", "Advanced"),
    },
  ];
}

export function buildDashboardData(args: {
  viewer: UserProfile;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  transactions: CashflowTransaction[];
  cashAccounts?: CashAccount[];
  cashAccountBalanceEvents?: CashAccountBalanceEvent[];
  portfolioEvents?: PortfolioEvent[];
  priceHistory?: SecurityPriceHistoryPoint[];
  snapshots?: PortfolioSnapshot[];
  profile: PreferenceProfile;
  latestRun: RecommendationRun | null;
  display: DisplayContext;
}): DashboardData {
  const {
    viewer,
    accounts,
    holdings,
    transactions,
    cashAccounts = [],
    cashAccountBalanceEvents = [],
    portfolioEvents = [],
    priceHistory = [],
    snapshots = [],
    profile,
    latestRun,
    display,
  } = args;
  const language = viewer.displayLanguage;
  const { typeLabelMap, instanceLabelMap } = buildAccountLabelMaps(
    accounts,
    language,
  );
  const totalPortfolio = sum(accounts.map((account) => account.marketValueCad));
  const currentCashBalanceCad = getCurrentCashBalanceCad(cashAccounts);
  const totalNetWorthCad = totalPortfolio + currentCashBalanceCad;
  const availableRoom = sum(
    accounts.map((account) => account.contributionRoomCad ?? 0),
  );
  const currentAllocation = getCurrentAllocation(holdings);
  const targetAllocation = getTargetAllocation(profile);
  const health = buildPortfolioHealthSummary({
    accounts,
    holdings,
    profile,
    language,
  });
  const drift = [...targetAllocation.entries()]
    .map(([assetClass, targetPct]) => ({
      assetClass,
      current: round(currentAllocation.get(assetClass) ?? 0, 0),
      target: targetPct,
      delta: round((currentAllocation.get(assetClass) ?? 0) - targetPct, 0),
    }))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 3);
  const spending = buildSpendingSummary(
    transactions,
    profile.cashBufferTargetCad,
  );
  const accountPriorityOrder = profile.accountFundingPriority;
  const recommendation = getRecommendationTheme(
    latestRun,
    display,
    language,
    profile,
    accounts,
  );
  const replayedInvestedAssetTrend = buildReplayedAggregateValueSeries({
    holdings,
    priceHistory,
    events: portfolioEvents,
    language,
    display,
  });
  const snapshotInvestedAssetTrend = buildAbsoluteSeriesFromSnapshots({
    snapshots,
    language,
    display,
    getValue: (snapshot) => snapshot.totalValueCad,
  });
  const investedAssetTrend =
    replayedInvestedAssetTrend ??
    snapshotInvestedAssetTrend ??
    getSixMonthSeries(totalPortfolio, profile, getMonthLabels(language));
  const investedAssetTrendSource: PortfolioValueSeriesSource =
    replayedInvestedAssetTrend != null
      ? "replayed-prices"
      : snapshotInvestedAssetTrend != null
        ? "snapshots"
        : "reference";
  const cashBalanceTrend = buildCashBalanceSeries({
    cashAccounts,
    cashAccountBalanceEvents,
    language,
    display,
  });
  const unanchoredNetWorthTrend =
    cashBalanceTrend && investedAssetTrend.length > 0
      ? investedAssetTrend.map((point) => {
          const cashPoint =
            "rawDate" in point && typeof point.rawDate === "string"
              ? cashBalanceTrend.find(
                  (entry) => entry.rawDate === point.rawDate,
                )
              : null;
          return {
            ...point,
            value: round(point.value + (cashPoint?.value ?? 0), 2),
          };
        })
      : investedAssetTrend;
  const netWorthTrend = anchorSeriesToCurrentValue({
    series: unanchoredNetWorthTrend,
    currentValueCad: totalNetWorthCad,
    language,
    display,
  });

  return {
    displayContext: buildDisplayContext(display, language),
    metrics: [
      {
        label: pick(language, "总资产", "Total Portfolio"),
        value: formatDisplayCurrency(totalNetWorthCad, display),
        detail: pick(
          language,
          currentCashBalanceCad > 0
            ? `投资账户 ${accounts.length} 个，已合并现金账户余额。`
            : `你现在一共连了 ${accounts.length} 个投资账户`,
          currentCashBalanceCad > 0
            ? `${accounts.length} investment accounts plus cash balances.`
            : `${accounts.length} investment accounts connected`,
        ),
      },
      {
        label: pick(language, "可用额度", "Available Room"),
        value: formatDisplayCurrency(availableRoom, display),
        detail: pick(
          language,
          "这里合并了 TFSA、RRSP 和 FHSA 还能继续放的钱。",
          "TFSA, RRSP, and FHSA contribution room remaining",
        ),
      },
      {
        label: pick(language, "风险风格", "Portfolio Risk"),
        value: getRiskProfileLabel(profile.riskProfile, language),
        detail: getRiskDetail(profile.riskProfile, language),
      },
      {
        label: pick(language, "组合健康分", "Portfolio Health Score"),
        value: `${health.score}`,
        detail: health.status,
      },
    ],
    accounts: [...accounts]
      .sort((left, right) => {
        const priorityDelta =
          getAccountPriorityRank(left.type, accountPriorityOrder) -
          getAccountPriorityRank(right.type, accountPriorityOrder);
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
          `${typeLabelMap.get(account.id) ?? account.type} · ${getAccountCaption(account.type, language)}`,
        ),
        value: formatMoneyForDisplay(
          account.marketValueAmount,
          account.currency ?? "CAD",
          account.marketValueCad,
          display,
        ),
        room: formatRoomDetail(account, display, language),
        badge: getAccountBadgeLabel(
          index,
          accountPriorityOrder.includes(account.type),
          language,
        ),
        badgeVariant:
          index === 0
            ? PRIORITY_BADGE_VARIANTS.first
            : accountPriorityOrder.includes(account.type)
              ? PRIORITY_BADGE_VARIANTS.second
              : PRIORITY_BADGE_VARIANTS.later,
        href: `/portfolio/account/${account.id}`,
      })),
    drift: drift.map((item) => ({
      assetClass: getAssetClassLabel(item.assetClass, language),
      current: formatCompactPercent(item.current, 0),
      target: formatCompactPercent(item.target, 0),
      delta: formatSignedPercent(item.delta, 0),
    })),
    assetMix: [...currentAllocation.entries()].map(([name, value]) => ({
      name: getAssetClassLabel(name, language),
      value: round(value, 0),
    })),
    topHoldings: [...holdings]
      .sort((left, right) => right.marketValueCad - left.marketValueCad)
      .slice(0, 3)
      .map((holding) => ({
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        account:
          instanceLabelMap.get(holding.accountId) ??
          pick(language, "账户", "Account"),
        href: `/portfolio/holding/${holding.id}`,
        securityHref: `/portfolio/security/${encodeURIComponent(holding.symbol)}`,
        lastPrice: formatHoldingPrice(
          holding.lastPriceAmount,
          holding.currency,
          holding.lastPriceCad,
          display,
          language,
        ),
        lastUpdated: formatHoldingLastUpdated(holding.updatedAt, language),
        freshnessVariant: getHoldingFreshnessVariant(holding.updatedAt),
        weight: formatCompactPercent(holding.weightPct, 1),
        value: formatMoneyForDisplay(
          holding.marketValueAmount,
          holding.currency ?? "CAD",
          holding.marketValueCad,
          display,
        ),
      })),
    trendContext: {
      title: cashBalanceTrend
        ? pick(language, "总净资产走势", "Net worth trend")
        : pick(language, "投资资产走势", "Invested asset trend"),
      description: pick(
        language,
        cashBalanceTrend
          ? "这里已经把投资资产和现金账户余额一起合进净资产曲线。"
          : "这里目前只回放投资账户里的资产价值，不包含后续会接入的 spending / cash account 余额。",
        cashBalanceTrend
          ? "This curve now combines invested assets with the cash-account layer."
          : "This currently replays invested-asset value only and does not yet include the spending/cash account layer planned for later net worth support.",
      ),
      scopeLabel: pick(language, "当前范围", "Current scope"),
      scopeDetail: cashBalanceTrend
        ? pick(
            language,
            "投资资产 + 现金账户",
            "Invested assets + cash accounts",
          )
        : pick(language, "仅投资资产", "Invested assets only"),
      sourceLabel: pick(language, "数据来源", "Data source"),
      sourceDetail: cashBalanceTrend
        ? pick(
            language,
            `${investedAssetTrendSource === "replayed-prices" ? "真实持仓价格回放" : investedAssetTrendSource === "snapshots" ? "组合历史快照" : "参考曲线"} + 现金余额历史`,
            `${investedAssetTrendSource === "replayed-prices" ? "replayed holding prices" : investedAssetTrendSource === "snapshots" ? "portfolio snapshots" : "reference curve"} + cash balance history`,
          )
        : investedAssetTrendSource === "replayed-prices"
          ? pick(language, "真实持仓价格回放", "Replayed holding prices")
          : investedAssetTrendSource === "snapshots"
            ? pick(language, "组合历史快照", "Portfolio snapshots")
            : pick(language, "参考曲线", "Reference curve"),
    },
    netWorthTrend,
    chartSeries: {
      netWorth: buildPortfolioValueChartSeries({
        performance: netWorthTrend,
        source: investedAssetTrendSource,
        language,
        display,
        id: "overview-net-worth-history",
        title: pick(language, "总资产走势", "Total asset trend"),
      }),
    },
    spendingMonthLabel: getLatestMonthLabel(language),
    savingsPattern: formatCompactPercent(spending.savingsRate, 1),
    investableCash: formatDisplayCurrency(spending.investableCash, display),
    spendingCategories: spending.categories
      .slice(0, 3)
      .map(([name, value]) => ({
        name: getCategoryLabel(name, language),
        value: formatDisplayCurrency(value, display),
      })),
    healthPreview: health.radar,
    healthScore: {
      score: health.score,
      status: health.status,
      strongestDimension: `${health.strongestDimension.label} ${health.strongestDimension.value}`,
      weakestDimension: `${health.weakestDimension.label} ${health.weakestDimension.value}`,
      highlights: health.highlights,
    },
    recommendation,
  };
}

export function buildPortfolioData(args: {
  language: DisplayLanguage;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  portfolioEvents?: PortfolioEvent[];
  priceHistory?: SecurityPriceHistoryPoint[];
  snapshots?: PortfolioSnapshot[];
  profile: PreferenceProfile;
  display: DisplayContext;
}): PortfolioData {
  const {
    language,
    accounts,
    holdings,
    portfolioEvents = [],
    priceHistory = [],
    snapshots = [],
    profile,
    display,
  } = args;
  const { typeLabelMap, instanceLabelMap, instanceDetailMap } =
    buildAccountLabelMaps(accounts, language);
  const currentAllocation = getCurrentAllocation(holdings);
  const targetAllocation = getTargetAllocation(profile);
  const health = buildPortfolioHealthSummary({
    accounts,
    holdings,
    profile,
    language,
  });
  const totalPortfolio = sum(accounts.map((account) => account.marketValueCad));
  const replayedPortfolioPerformance = buildReplayedAggregateValueSeries({
    holdings,
    priceHistory,
    events: portfolioEvents,
    language,
    display,
  });
  const snapshotPortfolioPerformance = buildAbsoluteSeriesFromSnapshots({
    snapshots,
    language,
    display,
    getValue: (snapshot) => snapshot.totalValueCad,
  });
  const portfolioPerformance = anchorSeriesToCurrentValue({
    series:
      replayedPortfolioPerformance ??
      snapshotPortfolioPerformance ??
      getSixMonthSeries(totalPortfolio || 1, profile, getMonthLabels(language)),
    currentValueCad: totalPortfolio,
    language,
    display,
  });
  const portfolioPerformanceSource: PortfolioValueSeriesSource =
    replayedPortfolioPerformance != null
      ? "replayed-prices"
      : snapshotPortfolioPerformance != null
        ? "snapshots"
        : "reference";
  const driftMap = new Map<string, number>();
  for (const [assetClass, targetPct] of targetAllocation.entries()) {
    driftMap.set(
      assetClass,
      round((currentAllocation.get(assetClass) ?? 0) - targetPct, 1),
    );
  }

  const sectors = [
    ...groupBy(
      holdings,
      (holding) =>
        holding.sector === "Multi-sector" ? holding.assetClass : holding.sector,
      (holding) => holding.marketValueCad,
    ).entries(),
  ].sort((left, right) => right[1] - left[1]);

  const sectorExposure = sectors.slice(0, 4).map(([name, value]) => ({
    name: getSectorLabel(name, language),
    value: totalPortfolio > 0 ? round((value / totalPortfolio) * 100, 0) : 0,
  }));
  const sectorRemainder = round(
    100 - sum(sectorExposure.map((item) => item.value)),
    0,
  );
  if (sectorRemainder > 0) {
    sectorExposure.push({
      name: pick(language, "其他", "Other"),
      value: sectorRemainder,
    });
  }

  const largestHolding = [...holdings].sort(
    (left, right) => right.weightPct - left.weightPct,
  )[0];
  const mainGap = [...driftMap.entries()].sort(
    (left, right) => Math.abs(right[1]) - Math.abs(left[1]),
  )[0];
  const accountTypeAllocation = [
    ...groupBy(
      accounts,
      (account) => account.type,
      (account) => account.marketValueCad,
    ).entries(),
  ]
    .sort((left, right) => right[1] - left[1])
    .map(([accountType, value]) => {
      const accountCount = accounts.filter(
        (account) => account.type === accountType,
      ).length;
      return {
        id: accountType,
        name: getAccountTypeLabel(
          accountType as InvestmentAccount["type"],
          language,
        ),
        value:
          totalPortfolio > 0 ? round((value / totalPortfolio) * 100, 0) : 0,
        detail: pick(
          language,
          `${accountCount} 个账户`,
          `${accountCount} account${accountCount > 1 ? "s" : ""}`,
        ),
      };
    });
  const accountInstanceAllocation = [...accounts]
    .sort((left, right) => right.marketValueCad - left.marketValueCad)
    .map((account) => ({
      id: account.id,
      name: instanceLabelMap.get(account.id) ?? account.nickname,
      value:
        totalPortfolio > 0
          ? round((account.marketValueCad / totalPortfolio) * 100, 0)
          : 0,
      detail: instanceDetailMap.get(account.id),
    }));
  const assetClassIds = new Set<string>([
    ...targetAllocation.keys(),
    ...currentAllocation.keys(),
  ]);
  const assetClassDrilldown = [...assetClassIds]
    .map((assetClass) => {
      const classHoldings = holdings
        .filter((holding) => holding.assetClass === assetClass)
        .sort((left, right) => right.marketValueCad - left.marketValueCad);
      const classValueCad = sum(
        classHoldings.map((holding) => holding.marketValueCad),
      );
      const currentPct = round(currentAllocation.get(assetClass) ?? 0, 1);
      const targetPct = round(targetAllocation.get(assetClass) ?? 0, 1);
      const driftPct = round(currentPct - targetPct, 1);
      const label = getAssetClassLabel(assetClass, language);
      const replayedClassPerformance = buildReplayedAggregateValueSeries({
        holdings: classHoldings,
        priceHistory,
        events: portfolioEvents,
        language,
        display,
      });
      const snapshotClassPerformance = buildAbsoluteSeriesFromSnapshots({
        snapshots,
        language,
        display,
        getValue: (snapshot) =>
          sum(
            classHoldings.map(
              (holding) => snapshot.holdingBreakdown[holding.id] ?? 0,
            ),
          ),
      });
      const classPerformance =
        replayedClassPerformance ??
        snapshotClassPerformance ??
        getSixMonthSeries(classValueCad, profile, getMonthLabels(language));
      const classPerformanceSource: PortfolioValueSeriesSource =
        replayedClassPerformance != null
          ? "replayed-prices"
          : snapshotClassPerformance != null
            ? "snapshots"
            : "reference";
      const actions =
        Math.abs(driftPct) <= 2
          ? [
              pick(
                language,
                "这一类资产已经接近目标，下一笔钱不需要优先修这里。",
                "This sleeve is close to target; the next contribution does not need to prioritize it.",
              ),
              pick(
                language,
                "继续监控最大持仓，避免单一标的把这个类别重新拉偏。",
                "Keep watching the largest holdings so one security does not pull the sleeve off target again.",
              ),
            ]
          : driftPct < 0
            ? [
                pick(
                  language,
                  `这类资产低于目标，下一笔新增资金可以优先考虑补 ${label}。`,
                  `This sleeve is below target, so the next contribution can prioritize ${label}.`,
                ),
                classHoldings[0]
                  ? pick(
                      language,
                      `如果继续买已有标的，先比较 ${classHoldings[0].symbol} 是否仍然符合账户和币种规划。`,
                      `If adding to an existing holding, first check whether ${classHoldings[0].symbol} still fits the account and currency plan.`,
                    )
                  : pick(
                      language,
                      "这个类别当前没有持仓，新增前先通过观察列表或推荐页选标的。",
                      "There are no holdings in this sleeve yet; use the watchlist or recommendations before adding a security.",
                    ),
              ]
            : [
                pick(
                  language,
                  `这类资产高于目标，下一笔钱先不要继续加到 ${label}。`,
                  `This sleeve is above target, so avoid adding the next contribution to ${label}.`,
                ),
                pick(
                  language,
                  "优先把新增资金放到低于目标的资产类别，除非你主动调整了目标配置。",
                  "Route new money toward underweight sleeves unless you intentionally changed the target allocation.",
                ),
              ];

      return {
        id: assetClass,
        name: label,
        value: formatDisplayCurrency(classValueCad, display),
        currentPct,
        targetPct,
        driftPct,
        current: formatCompactPercent(currentPct, 1),
        target: formatCompactPercent(targetPct, 1),
        driftLabel: formatSignedPercent(driftPct, 1),
        summary: pick(
          language,
          `${label} 当前是 ${formatCompactPercent(currentPct, 1)}，目标是 ${formatCompactPercent(targetPct, 1)}，偏离 ${formatSignedPercent(driftPct, 1)}。`,
          `${label} is currently ${formatCompactPercent(currentPct, 1)} versus a ${formatCompactPercent(targetPct, 1)} target, a ${formatSignedPercent(driftPct, 1)} drift.`,
        ),
        actions,
        chartSeries: {
          valueHistory: buildPortfolioValueChartSeries({
            performance: classPerformance,
            source: classPerformanceSource,
            language,
            display,
            id: "asset-class-value-history",
            title: pick(language, `${label} 资产走势`, `${label} asset trend`),
            subjectLabel: label,
          }),
        },
        holdings: classHoldings.slice(0, 12).map((holding) => ({
          id: holding.id,
          symbol: holding.symbol,
          name: holding.name,
          account: instanceLabelMap.get(holding.accountId) ?? holding.accountId,
          accountType: typeLabelMap.get(holding.accountId) ?? "",
          value: formatDisplayCurrency(holding.marketValueCad, display),
          portfolioShare:
            totalPortfolio > 0
              ? formatCompactPercent(
                  (holding.marketValueCad / totalPortfolio) * 100,
                  1,
                )
              : "0%",
        })),
      };
    })
    .sort((left, right) => Math.abs(right.driftPct) - Math.abs(left.driftPct));
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
        gainLoss: getAccountGainLossSummary(accountHoldings, display, language),
        share:
          totalPortfolio > 0
            ? pick(
                language,
                `大约占整个组合 ${formatCompactPercent((account.marketValueCad / totalPortfolio) * 100, 0)}`,
                `About ${formatCompactPercent((account.marketValueCad / totalPortfolio) * 100, 0)} of the full portfolio`,
              )
            : pick(language, "还没有资产", "No assets yet"),
        room:
          account.contributionRoomCad !== null
            ? pick(
                language,
                `按规划基准 CAD 还剩 ${formatMoney(account.contributionRoomCad, "CAD")}`,
                `${formatMoney(account.contributionRoomCad, "CAD")} of planning-base CAD room left`,
              )
            : pick(
                language,
                "这类账户这里不记录额度。",
                "This account type does not track room here",
              ),
        topHoldings: accountHoldings
          .slice(0, 3)
          .map((holding) => holding.symbol),
        href: `/portfolio/account/${account.id}`,
      };
    });
  const accountContexts = [...accounts]
    .sort((left, right) => right.marketValueCad - left.marketValueCad)
    .map((account) => {
      const accountHoldings = holdings.filter(
        (holding) => holding.accountId === account.id,
      );
      const accountHealth = buildPortfolioHealthSummary({
        accounts: [account],
        holdings: accountHoldings,
        profile,
        language,
        scopeLevel: "account",
      });
      const accountTotal = account.marketValueCad || 1;
      const replayedAccountPerformance = buildReplayedAggregateValueSeries({
        holdings,
        priceHistory,
        events: portfolioEvents,
        language,
        display,
        accountId: account.id,
      });
      const snapshotAccountPerformance = buildAbsoluteSeriesFromSnapshots({
        snapshots,
        language,
        display,
        getValue: (snapshot) => snapshot.accountBreakdown[account.id] ?? 0,
      });
      const accountPerformance =
        replayedAccountPerformance ??
        snapshotAccountPerformance ??
        getSixMonthSeries(accountTotal, profile, getMonthLabels(language));
      const accountPerformanceSource: PortfolioValueSeriesSource =
        replayedAccountPerformance != null
          ? "replayed-prices"
          : snapshotAccountPerformance != null
            ? "snapshots"
            : "reference";
      const accountName = instanceLabelMap.get(account.id) ?? account.nickname;
      return {
        id: account.id,
        name: accountName,
        typeId: account.type,
        typeLabel: typeLabelMap.get(account.id) ?? account.type,
        performance: accountPerformance,
        chartSeries: {
          accountValue: buildPortfolioValueChartSeries({
            performance: accountPerformance,
            source: accountPerformanceSource,
            language,
            display,
            id: "account-value-history",
            title: pick(
              language,
              `${accountName} 资产走势`,
              `${accountName} asset trend`,
            ),
            subjectLabel: pick(language, "账户", "account"),
          }),
        },
        healthScore: {
          score: accountHealth.score,
          status: accountHealth.status,
          scopeLabel: accountHealth.scopeLabel,
          scopeDetail: accountHealth.scopeDetail,
          radar: accountHealth.radar,
          highlights: accountHealth.highlights,
          strongestDimension: `${accountHealth.strongestDimension.label} ${accountHealth.strongestDimension.value}`,
          weakestDimension: `${accountHealth.weakestDimension.label} ${accountHealth.weakestDimension.value}`,
        },
        healthDetail: {
          score: accountHealth.score,
          status: accountHealth.status,
          scopeLabel: accountHealth.scopeLabel,
          scopeDetail: accountHealth.scopeDetail,
          radar: accountHealth.radar,
          highlights: accountHealth.highlights,
          strongestDimension: `${accountHealth.strongestDimension.label} ${accountHealth.strongestDimension.value}`,
          weakestDimension: `${accountHealth.weakestDimension.label} ${accountHealth.weakestDimension.value}`,
          dimensions: accountHealth.dimensions,
          actionQueue: accountHealth.actionQueue,
          accountDrilldown: accountHealth.accountDrilldown,
          holdingDrilldown: accountHealth.holdingDrilldown,
        },
        summaryPoints: [
          pick(
            language,
            `${instanceLabelMap.get(account.id) ?? account.nickname} 现在大约装了你 ${formatCompactPercent(totalPortfolio > 0 ? (account.marketValueCad / totalPortfolio) * 100 : 0, 0)} 的组合。`,
            `${instanceLabelMap.get(account.id) ?? account.nickname} currently holds about ${formatCompactPercent(totalPortfolio > 0 ? (account.marketValueCad / totalPortfolio) * 100 : 0, 0)} of the portfolio.`,
          ),
          accountHoldings[0]
            ? pick(
                language,
                `这个账户里现在最重的持仓是 ${accountHoldings.sort((left, right) => right.marketValueCad - left.marketValueCad)[0]?.symbol}。`,
                `${accountHoldings.sort((left, right) => right.marketValueCad - left.marketValueCad)[0]?.symbol} is currently the largest holding in this account.`,
              )
            : pick(
                language,
                "这个账户里现在还没有持仓。",
                "There are no holdings in this account yet.",
              ),
          account.contributionRoomCad !== null
            ? pick(
                language,
                `这个账户按规划基准还剩 ${formatMoney(account.contributionRoomCad, "CAD")} 可用额度。`,
                `This account still has ${formatMoney(account.contributionRoomCad, "CAD")} of planning-base room left.`,
              )
            : pick(
                language,
                "这类账户这里没有额度概念。",
                "This account type does not track contribution room here.",
              ),
        ],
      };
    });

  return {
    displayContext: buildDisplayContext(display, language),
    trendContext: {
      title: pick(language, "投资资产走势", "Invested asset trend"),
      description: pick(
        language,
        "这里只回放投资账户里的资产价值，不包含现金账户或未来会接入的负债层。",
        "This only replays invested-asset value and does not include the cash-account or future liability layers.",
      ),
      scopeLabel: pick(language, "当前范围", "Current scope"),
      scopeDetail: pick(language, "仅投资资产", "Invested assets only"),
      sourceLabel: pick(language, "数据来源", "Data source"),
      sourceDetail:
        portfolioPerformanceSource === "replayed-prices"
          ? pick(language, "真实持仓价格回放", "Replayed holding prices")
          : portfolioPerformanceSource === "snapshots"
            ? pick(language, "组合历史快照", "Portfolio snapshots")
            : pick(language, "参考曲线", "Reference curve"),
    },
    performance: portfolioPerformance,
    chartSeries: {
      portfolioValue: buildPortfolioValueChartSeries({
        performance: portfolioPerformance,
        source: portfolioPerformanceSource,
        language,
        display,
      }),
    },
    accountTypeAllocation,
    accountInstanceAllocation,
    assetClassDrilldown,
    accountCards,
    accountContexts,
    sectorExposure,
    quoteStatus: getPortfolioQuoteStatus(holdings, language),
    healthScore: {
      score: health.score,
      status: health.status,
      scopeLabel: health.scopeLabel,
      scopeDetail: health.scopeDetail,
      radar: health.radar,
      highlights: health.highlights,
      strongestDimension: `${health.strongestDimension.label} ${health.strongestDimension.value}`,
      weakestDimension: `${health.weakestDimension.label} ${health.weakestDimension.value}`,
      dimensions: health.dimensions,
      actionQueue: health.actionQueue,
      accountDrilldown: health.accountDrilldown,
      holdingDrilldown: health.holdingDrilldown,
    },
    holdings: [...holdings]
      .sort((left, right) => right.marketValueCad - left.marketValueCad)
      .map((holding) => {
        const accountHoldings = holdings.filter(
          (entry) => entry.accountId === holding.accountId,
        );
        const accountTotalCad = sum(
          accountHoldings.map((entry) => entry.marketValueCad),
        );
        const accountSharePct =
          accountTotalCad > 0
            ? (holding.marketValueCad / accountTotalCad) * 100
            : 0;
        return {
          id: holding.id,
          symbol: holding.symbol,
          name: holding.name,
          assetClass: holding.assetClass,
          sector: holding.sector,
          accountId: holding.accountId,
          accountType:
            accounts.find((account) => account.id === holding.accountId)
              ?.type ?? "Taxable",
          account:
            instanceLabelMap.get(holding.accountId) ??
            pick(language, "账户", "Account"),
          href: `/portfolio/holding/${holding.id}`,
          securityHref: `/portfolio/security/${encodeURIComponent(holding.symbol)}`,
          quantity: formatHoldingQuantity(holding.quantity, language),
          avgCost: formatHoldingAmount(
            holding.avgCostPerShareAmount,
            (holding.currency as CurrencyCode | undefined) ?? "CAD",
            holding.avgCostPerShareCad,
            display,
            language,
          ),
          value: formatMoneyForDisplay(
            holding.marketValueAmount,
            (holding.currency as CurrencyCode | undefined) ?? "CAD",
            holding.marketValueCad,
            display,
          ),
          lastPrice: formatHoldingPrice(
            holding.lastPriceAmount,
            (holding.currency as CurrencyCode | undefined) ?? "CAD",
            holding.lastPriceCad,
            display,
            language,
          ),
          lastUpdated: formatHoldingLastUpdated(holding.updatedAt, language),
          freshnessVariant: getHoldingFreshnessVariant(holding.updatedAt),
          portfolioShare: formatCompactPercent(holding.weightPct, 1),
          accountShare: formatCompactPercent(accountSharePct, 1),
          gainLoss: formatSignedPercent(holding.gainLossPct, 1),
          signal: getSignalForHolding(holding, driftMap, language),
        };
      }),
    summaryPoints: [
      mainGap
        ? pick(
            language,
            `${getAssetClassLabel(mainGap[0], language)} 现在和目标差得最远，最该先补。`,
            `${getAssetClassLabel(mainGap[0], language)} is the clearest allocation gap versus the configured target.`,
          )
        : pick(
            language,
            "先把目标配置设好，系统才能看出哪一类最缺。",
            "Set a target mix first so the system can see which sleeve is missing the most.",
          ),
      largestHolding
        ? pick(
            language,
            `${largestHolding.symbol} 是你现在最大的仓位，对集中度影响也最大。`,
            `${largestHolding.symbol} is the largest position and drives the current concentration score.`,
          )
        : pick(
            language,
            "先把持仓导进来，系统才能看出会不会太集中。",
            "Import holdings first so the system can tell whether a few positions are getting too heavy.",
          ),
      accounts.some((account) => account.type === "Taxable")
        ? pick(
            language,
            "你已经开始用应税账户了，所以新钱放哪类账户会更影响长期结果。",
            "You are already using taxable accounts, so where new money goes matters more over the long run.",
          )
        : pick(
            language,
            "大部分钱还在受保护账户里，所以账户放置目前还算简单。",
            "Most of the money is still inside sheltered accounts, so account placement is still fairly straightforward.",
          ),
    ],
  };
}

export function buildPortfolioAccountDetailData(args: {
  language: DisplayLanguage;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  snapshots?: PortfolioSnapshot[];
  profile: PreferenceProfile;
  display: DisplayContext;
  accountId: string;
}): PortfolioAccountDetailData | null {
  const {
    language,
    accounts,
    holdings,
    snapshots = [],
    profile,
    display,
    accountId,
  } = args;
  const portfolio = buildPortfolioData({
    language,
    accounts,
    holdings,
    snapshots,
    profile,
    display,
  });
  const accountCard = portfolio.accountCards.find(
    (account) => account.id === accountId,
  );
  const accountContext = portfolio.accountContexts.find(
    (account) => account.id === accountId,
  );
  const rawAccount = accounts.find((account) => account.id === accountId);

  if (!accountCard || !accountContext) {
    return null;
  }

  const rawHoldings = holdings.filter(
    (holding) => holding.accountId === accountId,
  );
  const accountTotalCad = sum(
    rawHoldings.map((holding) => holding.marketValueCad),
  );
  const allocation = [
    ...groupBy(
      rawHoldings,
      (holding) => holding.assetClass,
      (holding) => holding.marketValueCad,
    ).entries(),
  ]
    .sort((left, right) => right[1] - left[1])
    .map(([assetClass, value]) => ({
      name: getAssetClassLabel(assetClass, language),
      value:
        accountTotalCad > 0 ? round((value / accountTotalCad) * 100, 0) : 0,
    }));

  return {
    displayContext: portfolio.displayContext,
    trendContext: {
      title: pick(
        language,
        `${accountCard.name} 资产走势`,
        `${accountCard.name} asset trend`,
      ),
      description: pick(
        language,
        "这里只回放这个投资账户内的资产价值，不包含现金账户层。",
        "This only replays the invested assets inside this account and does not include the cash-account layer.",
      ),
      scopeLabel: pick(language, "当前范围", "Current scope"),
      scopeDetail: pick(
        language,
        "仅当前投资账户",
        "Current invested account only",
      ),
      sourceLabel: pick(language, "数据来源", "Data source"),
      sourceDetail: pick(
        language,
        "真实持仓价格回放",
        "Replayed holding prices",
      ),
    },
    account: {
      id: accountCard.id,
      name: accountCard.name,
      typeId: accountCard.typeId,
      typeLabel: accountCard.typeLabel,
      institution: accountCard.institution,
      currency: accountCard.currency,
      value: accountCard.value,
      gainLoss: getAccountGainLossSummary(rawHoldings, display, language),
      portfolioShare: accountCard.share,
      room: accountCard.room,
      topHoldings: accountCard.topHoldings,
      summaryPoints: accountContext.summaryPoints,
    },
    facts: [],
    performance: accountContext.performance,
    chartSeries: accountContext.chartSeries,
    allocation,
    healthScore: accountContext.healthDetail,
    holdings: portfolio.holdings.filter(
      (holding) => holding.accountId === accountId,
    ),
    editContext: {
      typeOptions: ["TFSA", "RRSP", "FHSA", "Taxable"].map((value) => ({
        value,
        label: getAccountTypeLabel(
          value as InvestmentAccount["type"],
          language,
        ),
      })),
      currencyOptions: [
        { value: "CAD" as const, label: "CAD" },
        { value: "USD" as const, label: "USD" },
      ],
      current: {
        nickname: rawAccount?.nickname ?? "",
        institution: rawAccount?.institution ?? "",
        type: rawAccount?.type ?? accountCard.typeId,
        currency: (rawAccount?.currency ?? "CAD") as "CAD" | "USD",
        contributionRoomCad: rawAccount?.contributionRoomCad ?? null,
      },
      mergeTargets: accounts
        .filter(
          (item) =>
            item.id !== accountId &&
            item.type === (rawAccount?.type ?? accountCard.typeId),
        )
        .map((item) => ({
          value: item.id,
          label:
            portfolio.accountCards.find((card) => card.id === item.id)?.name ??
            item.nickname,
          detail: `${getAccountTypeLabel(item.type, language)} · ${item.institution} · ${item.currency ?? "CAD"}`,
        })),
      holdingCreateContext: {
        currencyOptions: [
          { value: "CAD" as const, label: "CAD" },
          { value: "USD" as const, label: "USD" },
        ],
        assetClassOptions: [
          "Canadian Equity",
          "US Equity",
          "International Equity",
          "Fixed Income",
          "Cash",
        ].map((value) => ({
          value,
          label: getAssetClassLabel(value, language),
        })),
        securityTypeOptions: [
          "Common Stock",
          "ETF",
          "Commodity ETF",
          "Mutual Fund",
          "ADR",
          "Index",
          "REIT",
          "Trust",
          "Preferred Share",
          "Crypto",
          "Forex",
          "Unknown",
        ].map((value) => ({
          value,
          label: getSecurityTypeOptionLabel(value, language),
        })),
        exchangeOptions: [
          "TSX",
          "TSXV",
          "Cboe Canada",
          "NYSE",
          "NASDAQ",
          "NYSE Arca",
          "OTC",
          "LSE",
          "TSE",
          "Other / Manual",
        ].map((value) => ({
          value,
          label: getExchangeOptionLabel(value, language),
        })),
        sectorSuggestions: [
          "Multi-sector",
          "Technology",
          "Financials",
          "Healthcare",
          "Industrials",
          "Consumer",
          "Energy",
          "Utilities",
          "Materials",
          "Real Estate",
          "Precious Metals",
          "Gold",
          "Commodities",
          "Mining",
        ],
        marketSectorSuggestions: [
          "Broad Market",
          "Precious Metals",
          "Gold",
          "Commodities",
          "Semiconductors",
          "Consumer Internet",
          "Energy Infrastructure",
          "Real Estate",
        ],
        defaults: {
          currency: (rawAccount?.currency ?? "CAD") as "CAD" | "USD",
        },
      },
    },
  };
}

export function buildPortfolioHoldingDetailData(args: {
  language: DisplayLanguage;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  portfolioEvents?: PortfolioEvent[];
  priceHistory?: SecurityPriceHistoryPoint[];
  snapshots?: PortfolioSnapshot[];
  profile: PreferenceProfile;
  display: DisplayContext;
  holdingId: string;
}): PortfolioHoldingDetailData | null {
  const {
    language,
    accounts,
    holdings,
    portfolioEvents = [],
    priceHistory = [],
    snapshots = [],
    profile,
    display,
    holdingId,
  } = args;
  const portfolio = buildPortfolioData({
    language,
    accounts,
    holdings,
    snapshots,
    profile,
    display,
  });
  const health = buildPortfolioHealthSummary({
    accounts,
    holdings,
    profile,
    language,
  });
  const rawHolding = holdings.find((holding) => holding.id === holdingId);
  const viewHolding = portfolio.holdings.find(
    (holding) => holding.id === holdingId,
  );
  const accountCardsById = new Map(
    portfolio.accountCards.map((entry) => [entry.id, entry]),
  );

  if (!rawHolding || !viewHolding) {
    return null;
  }

  const account = accounts.find((entry) => entry.id === rawHolding.accountId);
  const accountCard = portfolio.accountCards.find(
    (entry) => entry.id === rawHolding.accountId,
  );
  const accountTotalCad = sum(
    holdings
      .filter((holding) => holding.accountId === rawHolding.accountId)
      .map((holding) => holding.marketValueCad),
  );
  const accountSharePct =
    accountTotalCad > 0
      ? round((rawHolding.marketValueCad / accountTotalCad) * 100, 1)
      : 0;
  const assetClassTargetPct =
    getTargetAllocation(profile).get(rawHolding.assetClass) ?? 0;
  const assetClassCurrentPct =
    getCurrentAllocation(holdings).get(rawHolding.assetClass) ?? 0;
  const holdingHealth = health.holdingDrilldown.find(
    (item) => item.id === holdingId,
  );
  const replayedHoldingValueSeries = buildHoldingValueHistorySeries({
    holding: rawHolding,
    priceHistory,
    events: portfolioEvents,
    language,
    display,
  });
  const holdingValueSeries =
    replayedHoldingValueSeries ??
    getSixMonthSeries(
      convertCadToDisplay(rawHolding.marketValueCad || 1, display),
      profile,
      getMonthLabels(language),
    ).map((point) => ({
      label: point.label,
      value: point.value,
    }));

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
      accountType: account
        ? getAccountTypeLabel(account.type, language)
        : pick(language, "账户", "Account"),
      accountHref: `/portfolio/account/${rawHolding.accountId}`,
      value: formatMoneyForDisplay(
        rawHolding.marketValueAmount,
        rawHolding.currency ?? "CAD",
        rawHolding.marketValueCad,
        display,
      ),
      quantity: formatHoldingQuantity(rawHolding.quantity, language),
      avgCost: formatHoldingAmount(
        rawHolding.avgCostPerShareAmount,
        rawHolding.currency,
        rawHolding.avgCostPerShareCad,
        display,
        language,
      ),
      costBasis: formatHoldingAmount(
        rawHolding.costBasisAmount,
        rawHolding.currency,
        rawHolding.costBasisCad,
        display,
        language,
      ),
      lastPrice: viewHolding.lastPrice,
      lastUpdated: viewHolding.lastUpdated,
      freshnessVariant: viewHolding.freshnessVariant,
      portfolioShare: viewHolding.portfolioShare,
      accountShare: viewHolding.accountShare,
      gainLoss: viewHolding.gainLoss,
      securityType: pick(language, "正在识别", "Resolving"),
      exchange: pick(language, "正在识别", "Resolving"),
      marketSector: pick(language, "正在识别", "Resolving"),
    },
    facts: [],
    marketData: {
      summary: pick(
        language,
        "这页会尽量补一笔最新价格和标的识别结果，帮你先确认这是什么、现在值多少。",
        "This page tries to pull a fresh quote and security identity so you can confirm what this is and what it roughly looks like right now.",
      ),
      notes: [
        pick(
          language,
          "真实历史回放还没接进来，所以这里的 6 个月曲线先当参考。",
          "Full historical replay is not wired in yet, so treat the 6-month chart as reference context.",
        ),
      ],
      facts: [],
    },
    performance: getSixMonthSeries(
      rawHolding.marketValueCad || 1,
      profile,
      getMonthLabels(language),
    ).map((point, index, series) => ({
      label: point.label,
      value: round((point.value / (series[0]?.value || 1)) * 100, 1),
    })),
    chartSeries: {
      holdingValue: buildPortfolioValueChartSeries({
        id: `holding-value-history-${rawHolding.id}`,
        title: pick(
          language,
          `${rawHolding.symbol} 持仓价值走势`,
          `${rawHolding.symbol} holding value trend`,
        ),
        performance: holdingValueSeries,
        source: replayedHoldingValueSeries ? "replayed-prices" : "reference",
        language,
        display,
        subjectLabel: pick(
          language,
          `${rawHolding.symbol} 持仓`,
          `${rawHolding.symbol} holding`,
        ),
      }),
    },
    portfolioRole: [
      pick(
        language,
        `${rawHolding.symbol} 现在大约占你整个组合 ${rawHolding.weightPct.toFixed(1)}%，在 ${accountCard?.name ?? pick(language, "当前账户", "the current account")} 里大约占 ${accountSharePct.toFixed(1)}%。`,
        `${rawHolding.symbol} currently represents about ${rawHolding.weightPct.toFixed(1)}% of the full portfolio and about ${accountSharePct.toFixed(1)}% of ${accountCard?.name ?? "the current account"}.`,
      ),
      pick(
        language,
        `它属于 ${getAssetClassLabel(rawHolding.assetClass, language)}。你给这类资产设的目标大约是 ${assetClassTargetPct.toFixed(1)}%，现在实际大约是 ${assetClassCurrentPct.toFixed(1)}%。`,
        `It belongs to ${getAssetClassLabel(rawHolding.assetClass, language)}. Your target for this sleeve is about ${assetClassTargetPct.toFixed(1)}%, and the current mix is about ${assetClassCurrentPct.toFixed(1)}%.`,
      ),
      viewHolding.signal,
    ],
    healthSummary: {
      score: holdingHealth?.score ?? 68,
      status: holdingHealth?.status ?? pick(language, "可用", "Usable"),
      summary:
        holdingHealth?.summary ??
        pick(
          language,
          "这笔仓位暂时没有被系统判定成最急的问题。",
          "The system does not currently treat this holding as the most urgent issue.",
        ),
      drivers: holdingHealth?.drivers ?? [
        pick(
          language,
          "先看这笔仓位占整体和占账户各是多少。",
          "Start with how large this position is in the full portfolio and inside its account.",
        ),
        pick(
          language,
          "再看它属于哪类资产，以及这类资产现在是不是已经配多了或配少了。",
          "Then check which sleeve it belongs to and whether that sleeve is already over- or under-filled.",
        ),
      ],
      actions: holdingHealth?.actions ?? [
        pick(
          language,
          "如果暂时没有明显问题，就先别急着动，等下一笔资金安排时再一起看。",
          "If nothing stands out yet, leave it alone for now and review it again with the next contribution.",
        ),
      ],
    },
    editContext: {
      accountOptions: accounts.map((account) => ({
        value: account.id,
        label: accountCardsById.get(account.id)?.name ?? account.nickname,
        detail: `${getAccountTypeLabel(account.type, language)} · ${account.institution} · ${account.currency ?? "CAD"}`,
      })),
      currencyOptions: [
        { value: "CAD" as const, label: "CAD" },
        { value: "USD" as const, label: "USD" },
      ],
      assetClassOptions: [
        "Canadian Equity",
        "US Equity",
        "International Equity",
        "Fixed Income",
        "Cash",
      ].map((value) => ({
        value,
        label: getAssetClassLabel(value, language),
      })),
      securityTypeOptions: [
        "Common Stock",
        "ETF",
        "Commodity ETF",
        "Mutual Fund",
        "ADR",
        "Index",
        "REIT",
        "Trust",
        "Preferred Share",
        "Crypto",
        "Forex",
        "Unknown",
      ].map((value) => ({
        value,
        label: getSecurityTypeOptionLabel(value, language),
      })),
      exchangeOptions: [
        "TSX",
        "TSXV",
        "Cboe Canada",
        "NYSE",
        "NASDAQ",
        "NYSE Arca",
        "OTC",
        "LSE",
        "TSE",
        "Other / Manual",
      ].map((value) => ({
        value,
        label: getExchangeOptionLabel(value, language),
      })),
      sectorSuggestions: [
        "Multi-sector",
        "Technology",
        "Financials",
        "Healthcare",
        "Industrials",
        "Consumer",
        "Energy",
        "Utilities",
        "Materials",
        "Real Estate",
        "Precious Metals",
        "Gold",
        "Commodities",
        "Mining",
      ],
      marketSectorSuggestions: [
        "Broad Market",
        "Precious Metals",
        "Gold",
        "Commodities",
        "Semiconductors",
        "Consumer Internet",
        "Energy Infrastructure",
        "Real Estate",
      ],
      current: {
        name: rawHolding.name,
        currency: (rawHolding.currency ?? "CAD") as "CAD" | "USD",
        quantity: rawHolding.quantity ?? null,
        avgCostPerShareAmount: rawHolding.avgCostPerShareAmount ?? null,
        costBasisAmount: rawHolding.costBasisAmount ?? null,
        lastPriceAmount: rawHolding.lastPriceAmount ?? null,
        marketValueAmount: rawHolding.marketValueAmount ?? null,
        assetClassOverride: rawHolding.assetClassOverride ?? null,
        sectorOverride: rawHolding.sectorOverride ?? null,
        securityTypeOverride: rawHolding.securityTypeOverride ?? null,
        exchangeOverride: rawHolding.exchangeOverride ?? null,
        marketSectorOverride: rawHolding.marketSectorOverride ?? null,
      },
      raw: {
        assetClass: rawHolding.rawAssetClass ?? rawHolding.assetClass,
        sector: rawHolding.rawSector ?? rawHolding.sector,
        securityType: pick(language, "正在识别", "Resolving"),
        exchange: pick(language, "正在识别", "Resolving"),
        marketSector: pick(language, "正在识别", "Resolving"),
      },
    },
  };
}

export function buildPortfolioSecurityDetailData(args: {
  language: DisplayLanguage;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  portfolioEvents?: PortfolioEvent[];
  priceHistory?: SecurityPriceHistoryPoint[];
  snapshots?: PortfolioSnapshot[];
  profile: PreferenceProfile;
  display: DisplayContext;
  symbol: string;
  exchange?: string | null;
  currency?: CurrencyCode | null;
}): PortfolioSecurityDetailData | null {
  const {
    language,
    accounts,
    holdings,
    portfolioEvents = [],
    priceHistory = [],
    snapshots = [],
    profile,
    display,
    symbol,
    exchange,
    currency,
  } = args;
  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedExchange = exchange?.trim().toUpperCase() || null;
  const normalizedCurrency = currency ?? null;
  const matchesRequestedIdentity = (holding: HoldingPosition) =>
    holding.symbol.trim().toUpperCase() === normalizedSymbol &&
    (!normalizedCurrency || holding.currency === normalizedCurrency) &&
    (!normalizedExchange ||
      (holding.exchangeOverride?.trim().toUpperCase() || "") ===
        normalizedExchange);
  const portfolio = buildPortfolioData({
    language,
    accounts,
    holdings,
    snapshots,
    profile,
    display,
  });
  const matchingHoldings = holdings.filter(matchesRequestedIdentity);
  const matchingHoldingIds = new Set(
    matchingHoldings.map((holding) => holding.id),
  );
  const matchingViewHoldings = portfolio.holdings.filter((holding) =>
    matchingHoldingIds.has(holding.id),
  );
  const referenceHolding = matchingHoldings[0];
  const referenceViewHolding = matchingViewHoldings[0];

  const totalValueCad = sum(
    matchingHoldings.map((holding) => holding.marketValueCad),
  );
  const totalPortfolioCad = sum(
    holdings.map((holding) => holding.marketValueCad),
  );
  const accountCount = new Set(
    matchingHoldings.map((holding) => holding.accountId),
  ).size;
  const latestUpdatedAt = matchingHoldings
    .map((holding) => holding.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const assetClassTargetPct = referenceHolding
    ? (getTargetAllocation(profile).get(referenceHolding.assetClass) ?? 0)
    : 0;
  const assetClassCurrentPct = referenceHolding
    ? (getCurrentAllocation(holdings).get(referenceHolding.assetClass) ?? 0)
    : 0;
  const totalQuantity = sum(
    matchingHoldings
      .map((holding) => holding.quantity ?? 0)
      .filter((value) => Number.isFinite(value)),
  );
  const totalCostBasisCad = sum(
    matchingHoldings.map((holding) => holding.costBasisCad ?? 0),
  );
  const totalCostBasisAmount = sum(
    matchingHoldings.map((holding) => holding.costBasisAmount ?? 0),
  );
  const weightedAvgCostAmount =
    totalQuantity > 0
      ? sum(
          matchingHoldings.map(
            (holding) =>
              (holding.quantity ?? 0) * (holding.avgCostPerShareAmount ?? 0),
          ),
        ) / totalQuantity
      : null;
  const weightedAvgCostCad =
    totalQuantity > 0
      ? sum(
          matchingHoldings.map(
            (holding) =>
              (holding.quantity ?? 0) * (holding.avgCostPerShareCad ?? 0),
          ),
        ) / totalQuantity
      : null;
  const aggregateGainLossPct =
    totalCostBasisCad > 0
      ? ((totalValueCad - totalCostBasisCad) / totalCostBasisCad) * 100
      : null;
  const accountViews = matchingHoldings
    .map((holding) =>
      buildPortfolioHoldingDetailData({
        language,
        accounts,
        holdings,
        snapshots,
        profile,
        display,
        holdingId: holding.id,
      }),
    )
    .filter((detail): detail is PortfolioHoldingDetailData => detail !== null)
    .map((detail) => ({
      ...detail,
      performance:
        buildIndexedHeldPositionSeries({
          priceHistory,
          events: portfolioEvents,
          accountId: detail.holding.accountId,
          symbol: detail.holding.symbol,
          language,
        }) ?? detail.performance,
    }))
    .sort((left, right) => {
      const leftRaw = matchingHoldings.find(
        (holding) => holding.id === left.holding.id,
      );
      const rightRaw = matchingHoldings.find(
        (holding) => holding.id === right.holding.id,
      );
      return (rightRaw?.marketValueCad ?? 0) - (leftRaw?.marketValueCad ?? 0);
    });
  const accountSummaries = [
    ...new Set(accountViews.map((detail) => detail.holding.accountId)),
  ].map((accountId) => {
    const accountHoldings = matchingHoldings.filter(
      (holding) => holding.accountId === accountId,
    );
    const representativeView = accountViews.find(
      (detail) => detail.holding.accountId === accountId,
    );
    const accountTotalCad = sum(
      holdings
        .filter((holding) => holding.accountId === accountId)
        .map((holding) => holding.marketValueCad),
    );
    const accountValueCad = sum(
      accountHoldings.map((holding) => holding.marketValueCad),
    );
    const accountQuantity = sum(
      accountHoldings.map((holding) => holding.quantity ?? 0),
    );
    const accountCostBasisCad = sum(
      accountHoldings.map((holding) => holding.costBasisCad ?? 0),
    );
    const accountCostBasisAmount = sum(
      accountHoldings.map((holding) => holding.costBasisAmount ?? 0),
    );
    const accountWeightedAvgCostAmount =
      accountQuantity > 0
        ? sum(
            accountHoldings.map(
              (holding) =>
                (holding.quantity ?? 0) * (holding.avgCostPerShareAmount ?? 0),
            ),
          ) / accountQuantity
        : null;
    const accountWeightedAvgCostCad =
      accountQuantity > 0
        ? sum(
            accountHoldings.map(
              (holding) =>
                (holding.quantity ?? 0) * (holding.avgCostPerShareCad ?? 0),
            ),
          ) / accountQuantity
        : null;
    const accountGainLossPct =
      accountCostBasisCad > 0
        ? ((accountValueCad - accountCostBasisCad) / accountCostBasisCad) * 100
        : null;

    return {
      accountId,
      accountLabel:
        representativeView?.holding.accountName ??
        pick(language, "账户", "Account"),
      accountType:
        representativeView?.holding.accountType ??
        pick(language, "账户", "Account"),
      quantity: formatHoldingQuantity(accountQuantity, language),
      avgCost: formatHoldingAmount(
        accountWeightedAvgCostAmount,
        accountHoldings[0]?.currency ?? "CAD",
        accountWeightedAvgCostCad,
        display,
        language,
      ),
      costBasis: formatHoldingAmount(
        accountCostBasisAmount,
        accountHoldings[0]?.currency ?? "CAD",
        accountCostBasisCad,
        display,
        language,
      ),
      value: formatMoneyForDisplay(
        sum(accountHoldings.map((holding) => holding.marketValueAmount ?? 0)),
        accountHoldings[0]?.currency ?? "CAD",
        accountValueCad,
        display,
      ),
      lastPrice: formatHoldingPrice(
        accountHoldings[0]?.lastPriceAmount ?? null,
        accountHoldings[0]?.currency ?? "CAD",
        accountHoldings[0]?.lastPriceCad ?? null,
        display,
        language,
      ),
      gainLoss:
        accountGainLossPct == null
          ? pick(language, "成本待补", "Cost basis pending")
          : formatSignedPercent(accountGainLossPct, 1),
      portfolioShare:
        totalPortfolioCad > 0
          ? formatCompactPercent((accountValueCad / totalPortfolioCad) * 100, 1)
          : "0%",
      accountShare:
        accountTotalCad > 0
          ? formatCompactPercent((accountValueCad / accountTotalCad) * 100, 1)
          : "0%",
      positionShare:
        totalValueCad > 0
          ? formatCompactPercent((accountValueCad / totalValueCad) * 100, 1)
          : "0%",
      positionSharePct:
        totalValueCad > 0
          ? round((accountValueCad / totalValueCad) * 100, 1)
          : 0,
      holdingCount: String(accountHoldings.length),
      summaryPoints: [
        pick(
          language,
          `${representativeView?.holding.accountName ?? pick(language, "这个账户", "this account")} 里一共持有 ${formatHoldingQuantity(accountQuantity, language)} 的 ${normalizedSymbol}。`,
          `${representativeView?.holding.accountName ?? "This account"} currently holds ${formatHoldingQuantity(accountQuantity, language)} of ${normalizedSymbol}.`,
        ),
        pick(
          language,
          `这部分在当前账户里大约占 ${accountTotalCad > 0 ? formatCompactPercent((accountValueCad / accountTotalCad) * 100, 1) : "0%"}，在整个组合里大约占 ${totalPortfolioCad > 0 ? formatCompactPercent((accountValueCad / totalPortfolioCad) * 100, 1) : "0%"}。`,
          `This slice is about ${accountTotalCad > 0 ? formatCompactPercent((accountValueCad / accountTotalCad) * 100, 1) : "0%"} of the account and about ${totalPortfolioCad > 0 ? formatCompactPercent((accountValueCad / totalPortfolioCad) * 100, 1) : "0%"} of the full portfolio.`,
        ),
      ],
    };
  });
  const aggregatePerformance = buildIndexedHeldPositionSeries({
    priceHistory,
    events: portfolioEvents,
    symbol: normalizedSymbol,
    language,
  });
  const heldPosition =
    matchingHoldings.length > 0
      ? {
          aggregate: {
            quantity: formatHoldingQuantity(totalQuantity, language),
            avgCost: formatHoldingAmount(
              weightedAvgCostAmount,
              referenceHolding?.currency ?? "CAD",
              weightedAvgCostCad,
              display,
              language,
            ),
            costBasis: formatHoldingAmount(
              totalCostBasisAmount,
              referenceHolding?.currency ?? "CAD",
              totalCostBasisCad,
              display,
              language,
            ),
            value:
              totalValueCad > 0
                ? formatMoneyForDisplay(
                    sum(
                      matchingHoldings.map(
                        (holding) => holding.marketValueAmount ?? 0,
                      ),
                    ),
                    referenceHolding?.currency ?? "CAD",
                    totalValueCad,
                    display,
                  )
                : pick(language, "还没持有", "Not held yet"),
            lastPrice: formatHoldingPrice(
              referenceHolding?.lastPriceAmount ?? null,
              referenceHolding?.currency ?? "CAD",
              referenceHolding?.lastPriceCad ?? null,
              display,
              language,
            ),
            gainLoss:
              aggregateGainLossPct == null
                ? pick(language, "成本待补", "Cost basis pending")
                : formatSignedPercent(aggregateGainLossPct, 1),
            portfolioShare:
              totalPortfolioCad > 0
                ? formatCompactPercent(
                    (totalValueCad / totalPortfolioCad) * 100,
                    1,
                  )
                : "0%",
            accountCount: String(accountCount),
            summaryPoints: [
              pick(
                language,
                `默认先把 ${normalizedSymbol} 在你所有账户里的持仓合在一起看，这样能先判断它整体是不是已经够重。`,
                `The default view combines ${normalizedSymbol} across your accounts so you can judge the overall exposure first.`,
              ),
              pick(
                language,
                `如果想看某个账户里的这笔仓位，再切到账户视角，就会补上那个账户里的比例、审核、刷新和编辑信息。`,
                `Switch to an account view when you want the exact account-level ratio, review notes, refresh controls, and edit tools for that position.`,
              ),
            ],
          },
          accountOptions: accountSummaries.map((summary) => ({
            accountId: summary.accountId,
            label: summary.accountLabel,
            detail: summary.accountType,
            holdingId:
              accountViews.find(
                (view) => view.holding.accountId === summary.accountId,
              )?.holding.id ?? summary.accountId,
            summary: pick(
              language,
              `${summary.value} · 占这个账户 ${summary.accountShare}`,
              `${summary.value} · ${summary.accountShare} of this account`,
            ),
          })),
          accountSummaries,
          accountViews,
        }
      : null;
  const performance =
    buildAbsolutePriceHistorySeries({
      priceHistory,
      language,
    }) ??
    aggregatePerformance ??
    getSixMonthSeries(
      totalValueCad || 1,
      profile,
      getMonthLabels(language),
    ).map((point, index, series) => ({
      label: point.label,
      value: round((point.value / (series[0]?.value || 1)) * 100, 1),
    }));

  return {
    displayContext: portfolio.displayContext,
    security: {
      symbol: normalizedSymbol,
      name: referenceHolding?.name ?? normalizedSymbol,
      assetClass: referenceHolding
        ? getAssetClassLabel(referenceHolding.assetClass, language)
        : pick(language, "未知资产类别", "Unknown sleeve"),
      sector: referenceHolding
        ? getSectorLabel(referenceHolding.sector, language)
        : pick(language, "未知行业", "Unknown sector"),
      currency: referenceHolding?.currency ?? "CAD",
      securityType: pick(language, "正在识别", "Resolving"),
      exchange:
        referenceHolding?.exchangeOverride ??
        pick(language, "正在识别", "Resolving"),
      marketSector: pick(language, "正在识别", "Resolving"),
      lastPrice:
        referenceViewHolding?.lastPrice ??
        pick(language, "还没拿到价格", "No quote yet"),
      quoteTimestamp:
        referenceViewHolding?.lastUpdated ??
        pick(language, "还没刷新过", "Not refreshed yet"),
      freshnessVariant: referenceViewHolding?.freshnessVariant ?? "neutral",
    },
    facts: [
      {
        label: pick(language, "现在大约值多少", "Estimated current value"),
        value:
          totalValueCad > 0
            ? formatDisplayCurrency(totalValueCad, display)
            : pick(language, "你现在还没持有它", "You do not hold it yet"),
        detail:
          totalValueCad > 0
            ? pick(
                language,
                "这里会把你账户里同一代码的仓位合在一起看。",
                "This combines all of your positions in the same symbol.",
              )
            : pick(
                language,
                "这是推荐页里的候选标的详情，还没在你的账户里形成持仓。",
                "This is a recommendation candidate and is not yet a live position in your accounts.",
              ),
      },
      {
        label: pick(language, "占整个组合多少", "Share of total portfolio"),
        value:
          totalPortfolioCad > 0
            ? formatCompactPercent((totalValueCad / totalPortfolioCad) * 100, 1)
            : "0%",
        detail:
          totalValueCad > 0
            ? pick(
                language,
                "分母是你全部投资资产。",
                "This uses your full invested portfolio as the denominator.",
              )
            : pick(
                language,
                "因为你现在还没持有它，所以这里会先是 0%。",
                "Because you do not hold it yet, this starts at 0%.",
              ),
      },
      {
        label: pick(
          language,
          "现在分散在几个账户",
          "How many accounts hold it",
        ),
        value: String(accountCount),
        detail:
          accountCount > 0
            ? pick(
                language,
                "这样能看出这支标的是集中放在一个账户，还是分散在多个账户里。",
                "This shows whether the symbol sits in one account or is spread across several.",
              )
            : pick(
                language,
                "还没有任何账户持有它。",
                "No account holds it yet.",
              ),
      },
      {
        label: pick(language, "最近一次价格时间", "Latest quote timestamp"),
        value: latestUpdatedAt
          ? new Date(latestUpdatedAt).toLocaleString(
              language === "zh" ? "zh-CN" : "en-CA",
              {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              },
            )
          : pick(language, "还没刷新过", "Not refreshed yet"),
        detail: pick(
          language,
          "这是你当前缓存里最近一次成功拿到这支标的价格的时间。",
          "This is the latest successful cached quote timestamp for this symbol.",
        ),
      },
    ],
    marketData: {
      summary: pick(
        language,
        "这里会把这支标的是什么、主要在哪个市场、最近大概是什么价格整理出来，方便你决定要不要真的按推荐去买。",
        "This page pulls together what the security is, where it mainly trades, and roughly where its latest price sits before you decide whether to act.",
      ),
      notes: [
        pick(
          language,
          "如果你已经持有这支标的，下面也会列出它在不同账户里的分布。",
          "If you already hold this symbol, the page also shows how it is distributed across your accounts.",
        ),
        pick(
          language,
          "6 个月走势目前还是参考曲线，不是完整历史回放。",
          "The 6-month trend is still a reference curve, not a full replayed history.",
        ),
      ],
      facts: [],
    },
    analysis: {
      assetClassLabel: referenceHolding
        ? getAssetClassLabel(referenceHolding.assetClass, language)
        : pick(language, "未知资产类别", "Unknown sleeve"),
      targetAllocationPct: round(assetClassTargetPct, 1),
      currentAllocationPct: round(assetClassCurrentPct, 1),
      driftPct: round(assetClassCurrentPct - assetClassTargetPct, 1),
      targetAllocation: formatCompactPercent(assetClassTargetPct, 1),
      currentAllocation: formatCompactPercent(assetClassCurrentPct, 1),
      driftLabel: formatSignedPercent(
        assetClassCurrentPct - assetClassTargetPct,
        1,
      ),
      portfolioSharePct:
        totalPortfolioCad > 0
          ? round((totalValueCad / totalPortfolioCad) * 100, 1)
          : 0,
      portfolioShare:
        totalPortfolioCad > 0
          ? formatCompactPercent((totalValueCad / totalPortfolioCad) * 100, 1)
          : "0%",
      summary: referenceHolding
        ? pick(
            language,
            `${normalizedSymbol} 属于 ${getAssetClassLabel(referenceHolding.assetClass, language)}，这一类资产目标是 ${formatCompactPercent(assetClassTargetPct, 1)}，当前是 ${formatCompactPercent(assetClassCurrentPct, 1)}。`,
            `${normalizedSymbol} sits in ${getAssetClassLabel(referenceHolding.assetClass, language)}. The target is ${formatCompactPercent(assetClassTargetPct, 1)} and the current allocation is ${formatCompactPercent(assetClassCurrentPct, 1)}.`,
          )
        : pick(
            language,
            "这个候选标的还没有足够的组合上下文来判断目标偏离。",
            "This candidate does not yet have enough portfolio context for target drift analysis.",
          ),
    },
    performance,
    chartSeries: {
      priceHistory: buildSecurityPriceHistoryChartSeries({
        symbol: normalizedSymbol,
        exchange: normalizedExchange,
        currency: normalizedCurrency,
        priceHistory,
        fallbackPerformance: performance,
        language,
      }),
    },
    summaryPoints: [
      totalValueCad > 0
        ? pick(
            language,
            `${normalizedSymbol} 现在一共大约占你整个组合 ${totalPortfolioCad > 0 ? formatCompactPercent((totalValueCad / totalPortfolioCad) * 100, 1) : "0%"}。`,
            `${normalizedSymbol} currently makes up about ${totalPortfolioCad > 0 ? formatCompactPercent((totalValueCad / totalPortfolioCad) * 100, 1) : "0%"} of the full portfolio.`,
          )
        : pick(
            language,
            `${normalizedSymbol} 现在还是推荐候选，还没变成你组合里的真实持仓。`,
            `${normalizedSymbol} is currently a recommendation candidate and not yet a live position in your portfolio.`,
          ),
      referenceHolding
        ? pick(
            language,
            `它归在 ${getAssetClassLabel(referenceHolding.assetClass, language)}。你给这类资产设的目标大约是 ${assetClassTargetPct.toFixed(1)}%，现在实际大约是 ${assetClassCurrentPct.toFixed(1)}%。`,
            `It sits inside ${getAssetClassLabel(referenceHolding.assetClass, language)}. Your target for this sleeve is about ${assetClassTargetPct.toFixed(1)}%, and the current portfolio mix is about ${assetClassCurrentPct.toFixed(1)}%.`,
          )
        : pick(
            language,
            "等你真正持有它以后，这里会告诉你它在目标配置里属于哪一类资产。",
            "Once you actually hold it, this page will tell you which sleeve it belongs to in your target mix.",
          ),
      accountCount > 1
        ? pick(
            language,
            "这支标的现在分散在多个账户里，判断它是否过重要一起看。",
            "This symbol is spread across multiple accounts, so concentration should be judged across all of them together.",
          )
        : accountCount === 1
          ? pick(
              language,
              "这支标的目前只出现在一个账户里，看起来会更直接。",
              "This symbol currently sits in one account, which makes it easier to inspect.",
            )
          : pick(
              language,
              "你现在还没持有它，所以这页更像是一张候选标的说明卡。",
              "You do not hold it yet, so this page works more like a candidate-security brief.",
            ),
    ],
    relatedHoldings: matchingViewHoldings.map((holding) => {
      const rawHolding = matchingHoldings.find(
        (entry) => entry.id === holding.id,
      );
      return {
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        account: holding.account,
        href: holding.href,
        value: rawHolding
          ? formatMoneyForDisplay(
              rawHolding.marketValueAmount,
              rawHolding.currency ?? "CAD",
              rawHolding.marketValueCad,
              display,
            )
          : pick(language, "暂时未知", "Unknown"),
        portfolioShare: holding.portfolioShare,
        accountShare: holding.accountShare,
        gainLoss: holding.gainLoss,
      };
    }),
    heldPosition,
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
  const {
    language,
    profile,
    accounts,
    latestRun,
    scenarioRuns = [],
    display,
  } = args;
  const equityTarget = sum(
    profile.targetAllocation
      .filter(
        (target) =>
          target.assetClass !== "Fixed Income" && target.assetClass !== "Cash",
      )
      .map((target) => target.targetPct),
  );
  const fixedIncomeTarget =
    profile.targetAllocation.find(
      (target) => target.assetClass === "Fixed Income",
    )?.targetPct ?? 0;
  const cashTarget =
    profile.targetAllocation.find((target) => target.assetClass === "Cash")
      ?.targetPct ?? 0;
  const baselineItems = latestRun?.items ?? [];
  const effectiveAccountPriorityOrder = getEffectiveAccountPriorityOrder(
    accounts,
    profile.accountFundingPriority,
  );
  const exhaustedPriorityTypes = getExhaustedPriorityTypes(
    accounts,
    profile.accountFundingPriority,
  );

  const buildScenarioDiffs = (
    scenarioRun: RecommendationRun,
    scenarioIndex: number,
  ) => {
    if (baselineItems.length === 0) {
      return [
        pick(
          language,
          "现在没有可对照的旧推荐，所以这里只单看这一档投入会怎么分配。",
          "There is no saved baseline recommendation yet, so this card only shows the standalone result for this amount.",
        ),
      ];
    }

    if (
      scenarioRun.contributionAmountCad === latestRun?.contributionAmountCad
    ) {
      return [
        pick(
          language,
          "这一档就是你当前页面正在看的结果，其它档位都拿它来做对比。",
          "This is the current recommendation shown on the page, and the other amounts are compared against it.",
        ),
      ];
    }

    const diffs: string[] = [];
    const baselineTop = baselineItems[0];
    const scenarioTop = scenarioRun.items[0];

    if (
      baselineTop &&
      scenarioTop &&
      (baselineTop.assetClass !== scenarioTop.assetClass ||
        baselineTop.targetAccountType !== scenarioTop.targetAccountType)
    ) {
      diffs.push(
        pick(
          language,
          `第一优先从 ${getAssetClassLabel(baselineTop.assetClass, language)} -> ${getAccountTypeLabel(baselineTop.targetAccountType, language)}，变成了 ${getAssetClassLabel(scenarioTop.assetClass, language)} -> ${getAccountTypeLabel(scenarioTop.targetAccountType, language)}。`,
          `The top priority shifts from ${getAssetClassLabel(baselineTop.assetClass, language)} -> ${getAccountTypeLabel(baselineTop.targetAccountType, language)} to ${getAssetClassLabel(scenarioTop.assetClass, language)} -> ${getAccountTypeLabel(scenarioTop.targetAccountType, language)}.`,
        ),
      );
    } else {
      diffs.push(
        pick(
          language,
          "第一优先没变，说明金额变化主要影响的是大小，不是方向。",
          "The top priority stays the same, so the amount change mainly affects sizing rather than ranking.",
        ),
      );
    }

    const baselineMap = new Map(
      baselineItems.map((item) => [item.assetClass, item]),
    );
    const accountShift = scenarioRun.items.find((item) => {
      const baseline = baselineMap.get(item.assetClass);
      return baseline && baseline.targetAccountType !== item.targetAccountType;
    });
    if (accountShift) {
      const baseline = baselineMap.get(accountShift.assetClass)!;
      diffs.push(
        pick(
          language,
          `${getAssetClassLabel(accountShift.assetClass, language)} 这类资产从 ${getAccountTypeLabel(baseline.targetAccountType, language)} 改到了 ${getAccountTypeLabel(accountShift.targetAccountType, language)}。`,
          `${getAssetClassLabel(accountShift.assetClass, language)} shifts from ${getAccountTypeLabel(baseline.targetAccountType, language)} to ${getAccountTypeLabel(accountShift.targetAccountType, language)}.`,
        ),
      );
    }

    const newAsset = scenarioRun.items.find(
      (item) => !baselineMap.has(item.assetClass),
    );
    if (newAsset) {
      diffs.push(
        pick(
          language,
          `${getAssetClassLabel(newAsset.assetClass, language)} 在这档投入下开始值得优先补。`,
          `${getAssetClassLabel(newAsset.assetClass, language)} becomes worth prioritizing at this contribution size.`,
        ),
      );
    }

    const removedAsset = baselineItems.find(
      (item) =>
        !scenarioRun.items.some(
          (candidate) => candidate.assetClass === item.assetClass,
        ),
    );
    if (removedAsset) {
      diffs.push(
        pick(
          language,
          `${getAssetClassLabel(removedAsset.assetClass, language)} 在这档投入下掉出了前三优先。`,
          `${getAssetClassLabel(removedAsset.assetClass, language)} falls out of the top priorities at this contribution size.`,
        ),
      );
    }

    if (diffs.length === 1 && scenarioIndex !== 1) {
      diffs.push(
        pick(
          language,
          "整体方向没有明显变，系统主要是在放大或缩小同一套思路。",
          "This suggests the overall path stays similar as the amount changes, and the system is mostly scaling the same idea up or down.",
        ),
      );
    }

    return diffs.slice(0, 3);
  };

  return {
    displayContext: buildDisplayContext(display, language),
    contributionAmount: formatDisplayCurrency(
      latestRun?.contributionAmountCad ?? 0,
      display,
    ),
    engine: {
      version: latestRun?.engineVersion?.toUpperCase() ?? "V2",
      objective: latestRun?.objective
        ? pick(
            language,
            latestRun.objective === "target-tracking"
              ? "Loo皇先补离目标最远的缺口"
              : latestRun.objective,
            latestRun.objective === "target-tracking"
              ? "Close the biggest target gap first"
              : latestRun.objective,
          )
        : pick(
            language,
            "Loo皇先补离目标最远的缺口",
            "Close the biggest target gap first",
          ),
      confidence:
        latestRun?.confidenceScore != null
          ? `${latestRun.confidenceScore.toFixed(0)}/100`
          : pick(language, "待生成", "Pending"),
    },
    inputs: [
      {
        label: pick(language, "目标配置", "Target allocation"),
        value: `${equityTarget} / ${fixedIncomeTarget} / ${cashTarget}`,
      },
      {
        label: pick(language, "你设的账户顺序", "Saved account order"),
        value: formatAccountPriorityOrder(
          profile.accountFundingPriority,
          language,
        ),
        tone: exhaustedPriorityTypes.length > 0 ? "muted" : "default",
      },
      {
        label: pick(
          language,
          "这次还能用的顺序",
          "Usable order for this contribution",
        ),
        value:
          effectiveAccountPriorityOrder.length > 0
            ? formatAccountPriorityOrder(
                effectiveAccountPriorityOrder,
                language,
              )
            : pick(
                language,
                "现在基本只剩应税账户还能继续放",
                "Only taxable room is effectively available right now",
              ),
      },
      ...(exhaustedPriorityTypes.length > 0
        ? [
            {
              label: pick(
                language,
                "这次先不排前面的账户",
                "De-prioritized for this contribution",
              ),
              value: pick(
                language,
                `${formatAccountPriorityOrder(exhaustedPriorityTypes, language)}（额度已满）`,
                `${formatAccountPriorityOrder(exhaustedPriorityTypes, language)} (room exhausted)`,
              ),
              tone: "warning" as const,
            },
          ]
        : []),
      {
        label: pick(language, "账户放置引导", "Tax-aware placement"),
        value: profile.taxAwarePlacement
          ? pick(language, "已打开", "Enabled")
          : pick(language, "未打开", "Disabled"),
      },
      {
        label: pick(language, "过渡偏好", "Transition preference"),
        value: getTransitionPreferenceLabel(
          profile.transitionPreference,
          language,
        ),
      },
    ],
    explainer: latestRun?.assumptions?.length
      ? getRecommendationAssumptions(profile, accounts, language)
      : [
          pick(
            language,
            "Loo皇会先看你现在持有什么，再和目标配置做对照。",
            "The system first looks at what you already hold and compares it with your target mix.",
          ),
          pick(
            language,
            "离目标差得最远的那一类，Loo皇通常会先把它排到前面。",
            "The asset sleeve furthest from target usually moves to the front of the queue.",
          ),
          pick(
            language,
            "Loo皇会先决定钱放进哪个账户更顺手，再挑具体标的。",
            "The system first chooses the best account home, then picks a security inside that sleeve.",
          ),
        ],
    priorities: (latestRun?.items ?? []).map((item, index) => {
      const leadSecurity =
        item.securitySymbol && item.securityName
          ? `${item.securitySymbol} - ${item.securityName}`
          : (item.tickerOptions[0] ??
            pick(language, "还没确定标的", "Pending security"));
      const alternatives = item.tickerOptions.filter(
        (symbol) => symbol !== item.securitySymbol,
      );
      return {
        id: `${item.assetClass}-${item.securitySymbol ?? item.tickerOptions[0] ?? index}`,
        assetClass: getAssetClassLabel(item.assetClass, language),
        description: getRecommendationItemExplanation(item, display, language),
        amount: formatDisplayCurrency(item.amountCad, display),
        account: getAccountTypeLabel(item.targetAccountType, language),
        security: leadSecurity,
        securityHref: item.securitySymbol
          ? `/portfolio/security/${encodeURIComponent(item.securitySymbol)}`
          : undefined,
        tickers: item.tickerOptions.join(", "),
        accountFit:
          item.accountFitScore != null
            ? pick(
                language,
                `${getAccountTypeFit(item.targetAccountType, language)}，Loo皇给它的大致顺手度是 ${item.accountFitScore.toFixed(0)}/100`,
                `${getAccountTypeFit(item.targetAccountType, language)} Rough fit ${item.accountFitScore.toFixed(0)}/100`,
              )
            : getAccountTypeFit(item.targetAccountType, language),
        scoreline: pick(
          language,
          `Loo皇给这条路的印象是：标的合适度 ${item.securityScore?.toFixed(0) ?? "--"} / 账户顺手度 ${item.accountFitScore?.toFixed(0) ?? "--"} / 税务友好度 ${item.taxFitScore?.toFixed(0) ?? "--"}`,
          `Security fit ${item.securityScore?.toFixed(0) ?? "--"} / Account fit ${item.accountFitScore?.toFixed(0) ?? "--"} / Tax fit ${item.taxFitScore?.toFixed(0) ?? "--"}`,
        ),
        gapSummary:
          item.allocationGapBeforePct != null &&
          item.allocationGapAfterPct != null
            ? pick(
                language,
                `如果按这条路去投，这个缺口会从 ${item.allocationGapBeforePct.toFixed(1)}% 缩到 ${item.allocationGapAfterPct.toFixed(1)}%。`,
                `Gap narrows from ${item.allocationGapBeforePct.toFixed(1)}% to ${item.allocationGapAfterPct.toFixed(1)}%`,
              )
            : pick(
                language,
                "重新生成后，这里会显示缺口缩小了多少。",
                "Gap change appears after generation.",
              ),
        alternatives:
          alternatives.length > 0
            ? alternatives
            : [
                pick(
                  language,
                  "现在没有更像样的备选标的。",
                  "No stronger alternative security is available right now.",
                ),
              ],
        alternativeLinks: alternatives.map((symbol) => ({
          label: symbol,
          href: `/portfolio/security/${encodeURIComponent(symbol)}`,
        })),
        whyThis: [
          item.rationale
            ? pick(
                language,
                `${getAssetClassLabel(item.assetClass, language)} 现在离目标还差 ${item.rationale.gapBeforePct.toFixed(1)} 个百分点。`,
                `${getAssetClassLabel(item.assetClass, language)} is currently ${item.rationale.gapBeforePct.toFixed(1)}% below target.`,
              )
            : pick(
                language,
                "Loo皇会先补现在最明显的配置缺口。",
                "The engine prioritizes the largest current allocation gap.",
              ),
          pick(
            language,
            `${getAccountTypeLabel(item.targetAccountType, language)} 在当前条件下是更顺手的账户。`,
            `${getAccountTypeLabel(item.targetAccountType, language)} produced the strongest account fit under the current constraints.`,
          ),
          item.rationale?.existingHoldingSymbol &&
          item.rationale.existingHoldingRiskContributionPct != null
            ? pick(
                language,
                `${item.rationale.existingHoldingSymbol} 已经贡献了大约 ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% 的组合风险，所以 Loo皇不想再把新钱继续压到同一处。`,
                `${item.rationale.existingHoldingSymbol} already contributes about ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% of total portfolio risk, so this path redirects new money toward an account and security combination that spreads risk out instead of reinforcing it.`,
              )
            : pick(
                language,
                "这条路不只是在补缺口，也是在避免把新钱继续堆到现在最重的风险来源上，这是 Loo皇刻意绕开的地方。",
                "This path not only closes the allocation gap, it also avoids stacking fresh money onto the current heaviest risk source.",
              ),
          item.rationale?.watchlistMatched
            ? pick(
                language,
                "这支主标的也刚好符合你的关注名单。",
                "The lead security also matched your watchlist.",
              )
            : pick(
                language,
                "在当前候选池里，Loo皇觉得它是最顺手的主标的。",
                "The lead security is the highest-scoring expression in the current candidate set.",
              ),
          item.rationale?.preferredSymbolMatched
            ? pick(
                language,
                `${item.securitySymbol ?? "这支标的"} 命中了你的偏好标的规则，因此评分获得了额外加权。`,
                `${item.securitySymbol ?? "This security"} matched your preferred-symbol rule, so it received an explicit scoring boost.`,
              )
            : profile.recommendationConstraints.preferredSymbols.length > 0
              ? pick(
                  language,
                  "它没有命中偏好标的列表，但在当前资产类别和账户条件下仍然排在前面。",
                  "It did not match the preferred-symbol list, but it still ranked highest under the current sleeve and account constraints.",
                )
              : pick(
                  language,
                  "你还没有设置偏好标的，所以这次没有额外偏好加权。",
                  "No preferred-symbol rule is set, so no explicit preference boost was applied.",
                ),
        ],
        whyNot: [
          alternatives.length > 0
            ? pick(
                language,
                `${alternatives.join(" / ")} 这些备选都没有当前主标的顺手，所以 Loo皇没先点它们。`,
                `Alternatives ${alternatives.join(" / ")} scored below the current lead security.`,
              )
            : pick(
                language,
                "Loo皇现在没看到明显更强的备选。",
                "No clearly stronger alternative is available in this sleeve.",
              ),
          item.rationale?.existingHoldingSymbol &&
          item.rationale.existingHoldingRiskContributionPct != null
            ? pick(
                language,
                `${item.rationale.existingHoldingSymbol} 已经贡献了大约 ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% 的组合风险，所以 Loo皇不会继续优先加它。`,
                `${item.rationale.existingHoldingSymbol} already contributes about ${item.rationale.existingHoldingRiskContributionPct.toFixed(0)}% of total portfolio risk, so the engine avoids doubling down on the same risk source.`,
              )
            : pick(
                language,
                "Loo皇会尽量回避已经太集中的风险来源。",
                "The engine avoids leaning even harder into risk sources that are already concentrated inside the sleeve.",
              ),
          (item.fxFrictionPenaltyBps ?? 0) > 0
            ? pick(
                language,
                `这条路大约要多承担 ${item.fxFrictionPenaltyBps} bps 的换汇成本，所以部分 USD 想法被往后压了。`,
                `Cross-currency friction of about ${item.fxFrictionPenaltyBps} bps pushed some USD ideas lower.`,
              )
            : pick(
                language,
                "这条路没有明显的换汇成本压力。",
                "This path does not carry a material FX friction cost.",
              ),
          profile.recommendationConstraints.excludedSymbols.length > 0
            ? pick(
                language,
                `已排除 ${profile.recommendationConstraints.excludedSymbols.join(" / ")}，这些标的不会参与本轮主候选排序。`,
                `Excluded ${profile.recommendationConstraints.excludedSymbols.join(" / ")} from this run's lead-candidate ranking.`,
              )
            : pick(
                language,
                "没有设置排除标的，所以候选池没有被硬性缩小。",
                "No excluded-symbol rule is set, so the candidate pool was not hard-filtered.",
              ),
        ],
        constraints: [
          {
            label: pick(language, "配置缺口", "Allocation gap"),
            detail:
              item.allocationGapBeforePct != null &&
              item.allocationGapAfterPct != null
                ? pick(
                    language,
                    `如果照 Loo皇这条路去做，缺口会从 ${item.allocationGapBeforePct.toFixed(1)}% 缩到 ${item.allocationGapAfterPct.toFixed(1)}%。`,
                    `Narrows from ${item.allocationGapBeforePct.toFixed(1)}% to ${item.allocationGapAfterPct.toFixed(1)}%.`,
                  )
                : pick(
                    language,
                    "Loo皇下次重审后，这里会更新。",
                    "Will update on the next run.",
                  ),
            variant: "success" as const,
          },
          {
            label: pick(language, "账户放哪里更顺", "Tax / account placement"),
            detail: pick(
              language,
              `${getAccountTypeLabel(item.targetAccountType, language)} 在 Loo皇眼里更顺手，账户顺手度 ${item.accountFitScore?.toFixed(0) ?? "--"}，税务友好度 ${item.taxFitScore?.toFixed(0) ?? "--"}。`,
              `${getAccountTypeLabel(item.targetAccountType, language)} looks like a smoother home here, with account fit ${item.accountFitScore?.toFixed(0) ?? "--"} and tax fit ${item.taxFitScore?.toFixed(0) ?? "--"}.`,
            ),
            variant: profile.taxAwarePlacement ? "success" : "neutral",
          },
          {
            label: pick(language, "FX 成本", "FX friction"),
            detail:
              (item.fxFrictionPenaltyBps ?? 0) > 0
                ? pick(
                    language,
                    `Loo皇看这条路大约会吃掉 ${item.fxFrictionPenaltyBps} bps 的换汇成本。`,
                    `This path absorbs about ${item.fxFrictionPenaltyBps} bps of FX cost.`,
                  )
                : pick(
                    language,
                    "Loo皇看这条路基本避开了明显的换汇成本。",
                    "This path avoids material FX friction.",
                  ),
            variant:
              (item.fxFrictionPenaltyBps ?? 0) > 0 ? "warning" : "success",
          },
          {
            label: pick(
              language,
              "标的偏好 / 排除",
              "Preferred / excluded securities",
            ),
            detail: pick(
              language,
              [
                profile.recommendationConstraints.preferredSymbols.length > 0
                  ? `偏好 ${profile.recommendationConstraints.preferredSymbols.join(" / ")}`
                  : "未设置偏好标的",
                profile.recommendationConstraints.excludedSymbols.length > 0
                  ? `排除 ${profile.recommendationConstraints.excludedSymbols.join(" / ")}`
                  : "未设置排除标的",
              ].join("；"),
              [
                profile.recommendationConstraints.preferredSymbols.length > 0
                  ? `Preferred ${profile.recommendationConstraints.preferredSymbols.join(" / ")}`
                  : "No preferred securities",
                profile.recommendationConstraints.excludedSymbols.length > 0
                  ? `Excluded ${profile.recommendationConstraints.excludedSymbols.join(" / ")}`
                  : "No excluded securities",
              ].join("; "),
            ),
            variant:
              profile.recommendationConstraints.excludedSymbols.length > 0 ||
              profile.recommendationConstraints.preferredSymbols.length > 0
                ? ("warning" as const)
                : ("neutral" as const),
          },
          {
            label: pick(language, "允许标的类型", "Allowed security types"),
            detail:
              profile.recommendationConstraints.allowedSecurityTypes.length > 0
                ? pick(
                    language,
                    `本轮优先限制在 ${profile.recommendationConstraints.allowedSecurityTypes.join(" / ")}。`,
                    `This run prioritizes ${profile.recommendationConstraints.allowedSecurityTypes.join(" / ")}.`,
                  )
                : pick(
                    language,
                    "未限制 ETF、股票或商品 ETF 等类型。",
                    "No ETF, stock, or commodity-type restriction is active.",
                  ),
            variant:
              profile.recommendationConstraints.allowedSecurityTypes.length > 0
                ? ("warning" as const)
                : ("neutral" as const),
          },
        ],
        execution: [
          {
            label: pick(language, "建议金额", "Suggested amount"),
            value: formatDisplayCurrency(item.amountCad, display),
          },
          {
            label: pick(language, "主标的", "Lead security"),
            value:
              item.securitySymbol ??
              item.tickerOptions[0] ??
              pick(language, "待定", "Pending"),
          },
          {
            label: pick(language, "先放去哪", "Target account"),
            value: getAccountTypeLabel(item.targetAccountType, language),
          },
          {
            label: pick(language, "执行提醒", "Execution note"),
            value: item.rationale?.minTradeApplied
              ? pick(
                  language,
                  "Loo皇提醒你：这笔比较小，可以考虑和下一笔一起做。",
                  "This is a small trade; consider batching it with the next contribution.",
                )
              : pick(
                  language,
                  "Loo皇提醒你：这笔金额已经够单独执行。",
                  "The current amount is large enough to stand on its own.",
                ),
          },
        ],
        relatedLinks:
          item.rationale?.existingHoldingId &&
          item.rationale.existingHoldingSymbol
            ? [
                {
                  label: pick(
                    language,
                    `打开 ${item.rationale.existingHoldingSymbol} 详情，看看它为什么已经算偏重`,
                    `Open ${item.rationale.existingHoldingSymbol} detail to see why it is already heavy`,
                  ),
                  href: item.rationale.existingHoldingAccountId
                    ? `/portfolio/security/${encodeURIComponent(item.rationale.existingHoldingSymbol)}?account=${encodeURIComponent(item.rationale.existingHoldingAccountId)}&holding=${encodeURIComponent(item.rationale.existingHoldingId)}`
                    : `/portfolio/security/${encodeURIComponent(item.rationale.existingHoldingSymbol)}?holding=${encodeURIComponent(item.rationale.existingHoldingId)}`,
                },
              ]
            : [],
      };
    }),
    scenarios: scenarioRuns.map((scenarioRun, scenarioIndex) => ({
      id: `scenario-${scenarioRun.contributionAmountCad}-${scenarioIndex}`,
      label:
        scenarioIndex === 0
          ? pick(language, "轻投入", "Light contribution")
          : scenarioIndex === scenarioRuns.length - 1
            ? pick(language, "加倍投入", "Double-sized contribution")
            : pick(language, "当前投入", "Current contribution"),
      amount: formatDisplayCurrency(scenarioRun.contributionAmountCad, display),
      summary: pick(
        language,
        "这里会按不同投入金额重新跑一遍，让你看清金额变了以后，优先顺序会不会跟着变。",
        "This is a fresh solve at this amount, so you can see whether a different contribution size would change the next step.",
      ),
      diffs: buildScenarioDiffs(scenarioRun, scenarioIndex),
      allocations: scenarioRun.items.map((item) => ({
        assetClass: getAssetClassLabel(item.assetClass, language),
        amount: formatDisplayCurrency(item.amountCad, display),
        account: getAccountTypeLabel(item.targetAccountType, language),
      })),
    })),
    notes: [
      profile.taxAwarePlacement
        ? pick(
            language,
            "Loo皇也会看钱放在哪类账户更顺手，但这不是正式税务建议。",
            "The system also considers which account type is a better home for the money, but this is not formal tax advice.",
          )
        : pick(
            language,
            "你没打开账户放置引导，所以 Loo皇会更直接地先补最大缺口。",
            "Account placement guidance is off, so the system leans more heavily on closing the biggest allocation gap first.",
          ),
      pick(
        language,
        `你现在用的是“${getRecommendationStrategyLabel(profile.recommendationStrategy, language)}”。当偏离大到 ${profile.rebalancingTolerancePct}% 左右时，Loo皇会更愿意主动出手调整。`,
        `Your current strategy is "${getRecommendationStrategyLabel(profile.recommendationStrategy, language)}". Once drift moves beyond about ${profile.rebalancingTolerancePct}%, the system becomes more willing to nudge changes.`,
      ),
      ...sanitizeRecommendationNotes(latestRun?.notes),
    ],
  };
}

export function buildSpendingData(args: {
  language: DisplayLanguage;
  transactions: CashflowTransaction[];
  profile: PreferenceProfile;
  display: DisplayContext;
}): SpendingData {
  const { language, transactions, profile, display } = args;
  const spending = buildSpendingSummary(
    transactions,
    profile.cashBufferTargetCad,
  );
  const latestTransactions = [...transactions]
    .sort((left, right) => right.bookedAt.localeCompare(left.bookedAt))
    .slice(0, 10);
  const discipline =
    spending.savingsRate >= 30
      ? pick(language, "稳", "Stable")
      : spending.savingsRate >= 20
        ? pick(language, "留意", "Watch")
        : pick(language, "偏紧", "At risk");

  return {
    displayContext: buildDisplayContext(display, language),
    metrics: [
      {
        label: pick(language, "本月支出", "Monthly spend"),
        value: formatDisplayCurrency(spending.outflowTotal, display),
        detail: pick(
          language,
          "这是当前月份已经流出去的钱。",
          "Current month outflow total",
        ),
      },
      {
        label: pick(language, "结余率", "Savings rate"),
        value: formatCompactPercent(spending.savingsRate, 1),
        detail: pick(
          language,
          "按这个月的流入和流出粗略算出来。",
          "Based on current month inflows and outflows",
        ),
      },
      {
        label: pick(language, "可继续投资的钱", "Investable cash"),
        value: formatDisplayCurrency(spending.investableCash, display),
        detail: pick(
          language,
          "等于本月流入减去支出，再扣掉你想保留的现金缓冲。",
          "Monthly inflow minus spending and buffer reserve",
        ),
      },
      {
        label: pick(language, "现金纪律", "Cash discipline"),
        value: discipline,
        detail: pick(
          language,
          `你设的现金缓冲目标是 ${formatDisplayCurrency(profile.cashBufferTargetCad, display)}`,
          `Cash buffer target is ${formatDisplayCurrency(profile.cashBufferTargetCad, display)}`,
        ),
      },
    ],
    trend: getMonthlyTransactionSeries(transactions, language),
    categories: spending.categories.slice(0, 4).map(([name, value]) => ({
      name: getCategoryLabel(name, language),
      share:
        spending.outflowTotal > 0
          ? formatCompactPercent((value / spending.outflowTotal) * 100, 0)
          : "0%",
      amount: formatDisplayCurrency(value, display),
    })),
    transactions: latestTransactions.map((transaction) => ({
      date: transaction.bookedAt,
      merchant: getMerchantLabel(transaction.merchant, language),
      category: getCategoryLabel(transaction.category, language),
      amount: `${transaction.direction === "outflow" ? "-" : "+"}${formatDisplayCurrency(transaction.amountCad, display)}`,
    })),
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
        title: pick(language, "先选账户类型", "Choose account type"),
        description: pick(
          language,
          "先把账户桶选对，再往下填细节，不要一开始就看长表单。",
          "Start with the account structure, not a long form.",
        ),
      },
      {
        title: pick(language, "再选导入方式", "Choose import method"),
        description: pick(
          language,
          "现在先走 CSV，后面再接 broker 集成。",
          "CSV import first, account integrations later.",
        ),
      },
      {
        title: pick(language, "把账户信息补齐", "Provide account data"),
        description: pick(
          language,
          "先把账户信息、额度和初始持仓补齐，确认没问题再写入。",
          "Enter account details, room, and starter holding context before any write.",
        ),
      },
      {
        title: pick(language, "先检查再确认", "Review and confirm"),
        description: latestPortfolioJob
          ? pick(
              language,
              `最近一次导入现在是 ${latestPortfolioJob.status}，先把要写进去的内容看清楚。`,
              `Latest portfolio import is ${latestPortfolioJob.status}. Confirm what should be written next.`,
            )
          : pick(
              language,
              "先把账户和持仓会怎么写进去看清楚，再正式确认。",
              "Review the exact account and holding actions before writing them to the database.",
            ),
      },
      {
        title: pick(language, "完成这轮设置", "Complete setup"),
        description: pick(
          language,
          "确认保存结果以后，你可以继续去设置偏好，或者回到首页。",
          "Confirm the saved result, then continue to preferences or the dashboard.",
        ),
      },
    ],
    portfolioSetupCards: [
      {
        label: pick(language, "账户类型", "Account type"),
        title:
          accounts.length > 0
            ? `${accounts.map((account) => getAccountTypeLabel(account.type, language)).join(" / ")}`
            : `${getAccountTypeLabel("TFSA", language)} / ${getAccountTypeLabel("RRSP", language)} / ${getAccountTypeLabel("Taxable", language)} / ${getAccountTypeLabel("FHSA", language)}`,
        description: pick(
          language,
          "先把账户桶选对，再往下填机构和账户细节。",
          "Pick the right account bucket before asking for institution detail.",
        ),
      },
      {
        label: pick(language, "导入方式", "Import method"),
        title: pick(language, "先用 CSV 导入", "CSV upload first"),
        description: pick(
          language,
          "先走 CSV，能先把流程跑通，也方便后面再补 broker 直连。",
          "Keeps MVP friction low while we define stable broker integrations.",
        ),
      },
      {
        label: pick(language, "字段对照", "Field mapping"),
        title: latestPortfolioJob
          ? pick(
              language,
              `当前文件：${latestPortfolioJob.fileName}`,
              `Current file: ${latestPortfolioJob.fileName}`,
            )
          : pick(
              language,
              "先看看账户和持仓列怎么对上",
              "Review account and holding columns",
            ),
        description: pick(
          language,
          "字段对照保持明确，用户才会相信导进来的数据没有对错列。",
          "Mapping stays explicit so the user trusts the imported portfolio data.",
        ),
      },
      {
        label: pick(language, "偏好交接", "Preference handoff"),
        title: pick(
          language,
          "接着去设投资偏好",
          "Move into Investment Preferences",
        ),
        description: pick(
          language,
          "导入完成后，可以顺着去设目标配置和账户顺序。",
          "The import flow hands off cleanly into target allocation and account priorities.",
        ),
      },
    ],
    portfolioSuccessStates: [
      pick(
        language,
        "导入后的持仓会按账户和资产类别整理好。",
        "Imported holdings can be grouped by account and asset class.",
      ),
      pick(
        language,
        "有问题或认不出的行，会先标出来，不会直接写进组合页。",
        "Invalid or unknown rows are flagged before the portfolio view updates.",
      ),
      pick(
        language,
        "完成以后，你可以直接去首页或推荐页继续看下一步。",
        "On completion the user can move directly to Dashboard or Recommendations.",
      ),
    ],
    spendingSetupCards: [
      {
        label: pick(language, "流程", "Workflow"),
        title: pick(language, "导入消费流水", "Transaction import"),
        description: pick(
          language,
          "消费流水和投资持仓分开处理，后面各自扩展时不会互相牵连。",
          "Import spending records separately from portfolio holdings so each workflow can evolve independently.",
        ),
      },
      {
        label: pick(language, "支持内容", "Supported rows"),
        title: latestSpendingJob
          ? pick(
              language,
              `最近文件：${latestSpendingJob.fileName}`,
              `Latest file: ${latestSpendingJob.fileName}`,
            )
          : pick(language, "只处理交易流水", "Transaction rows only"),
        description: pick(
          language,
          "这里主要看交易、分类、商户和流入流出方向。",
          "Focus on spending transactions, categories, merchants, and inflow/outflow direction.",
        ),
      },
      {
        label: pick(language, "复核", "Review"),
        title: pick(language, "先检查再写入", "Validate before write"),
        description: pick(
          language,
          "先跑预览和校验，确认没问题以后再正式写入。",
          "Run preview and validation first, then confirm the transaction write.",
        ),
      },
      {
        label: pick(language, "后续扩展", "Future integrations"),
        title: pick(
          language,
          "给未来的 Provider 留好边界",
          "Provider-ready boundary",
        ),
        description: pick(
          language,
          "这条路先用 CSV，后面就算换成 bank 或 card API，也不会影响投资导入。",
          "This path is isolated so bank or card APIs can replace CSV later without affecting portfolio import.",
        ),
      },
    ],
    spendingSuccessStates: [
      pick(
        language,
        "导入后的流水会进入 Spending 页面，更新分类、指标和最近交易。",
        "Imported transactions flow into Spending metrics, category breakdowns, and recent transaction history.",
      ),
      pick(
        language,
        "只导消费流水，不会改动你的持仓和推荐结果。",
        "Transaction-only imports do not overwrite holdings or recommendation runs.",
      ),
      pick(
        language,
        "以后就算把 CSV 换成 bank 或 card provider，这条路也能平滑替换。",
        "This workflow can later swap CSV for bank or card provider integrations without changing the portfolio import path.",
      ),
    ],
    existingAccounts: accounts.map((account) => ({
      id: account.id,
      type: account.type,
      institution: account.institution,
      nickname: account.nickname,
      currency: account.currency ?? "CAD",
      contributionRoomCad: account.contributionRoomCad,
      marketValueAmount: account.marketValueAmount ?? account.marketValueCad,
      marketValueCad: account.marketValueCad,
    })),
  };
}

export function buildSettingsData(
  profile: PreferenceProfile,
  language: DisplayLanguage,
): SettingsData {
  return {
    guidedQuestions: getGuidedQuestions(profile, language),
    manualGroups: getManualGroups(profile, language),
  };
}
