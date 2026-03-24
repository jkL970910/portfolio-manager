import { HoldingPosition, InvestmentAccount, PreferenceProfile } from "@/lib/backend/models";
import { getAssetClassLabel, getAccountTypeLabel } from "@/lib/i18n/finance";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";
import { getAccountPlacementMatrix } from "@/lib/backend/recommendation-v2";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function getTargetAllocation(profile: PreferenceProfile) {
  return profile.targetAllocation.length > 0
    ? profile.targetAllocation
    : [
      { assetClass: "Canadian Equity", targetPct: 22 },
      { assetClass: "US Equity", targetPct: 32 },
      { assetClass: "International Equity", targetPct: 16 },
      { assetClass: "Fixed Income", targetPct: 20 },
      { assetClass: "Cash", targetPct: 10 }
    ];
}

function getCurrentAllocation(holdings: HoldingPosition[]) {
  const total = sum(holdings.map((holding) => holding.marketValueCad));
  const byAssetClass = new Map<string, number>();
  for (const holding of holdings) {
    byAssetClass.set(holding.assetClass, (byAssetClass.get(holding.assetClass) ?? 0) + holding.marketValueCad);
  }

  return {
    total,
    allocation: new Map([...byAssetClass.entries()].map(([key, value]) => [key, total > 0 ? (value / total) * 100 : 0]))
  };
}

export type PortfolioHealthSummary = {
  score: number;
  status: string;
  radar: Array<{ dimension: string; value: number }>;
  highlights: string[];
  strongestDimension: { label: string; value: number };
  weakestDimension: { label: string; value: number };
};

export function buildPortfolioHealthSummary(args: {
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  language: DisplayLanguage;
}): PortfolioHealthSummary {
  const { accounts, holdings, profile, language } = args;
  const { total, allocation } = getCurrentAllocation(holdings);
  const targetAllocation = getTargetAllocation(profile);
  const gaps = targetAllocation.map((target) => Math.abs((allocation.get(target.assetClass) ?? 0) - target.targetPct));
  const allocationFit = clamp(100 - sum(gaps) * 1.8, 20, 96);

  const significantSleeves = [...allocation.values()].filter((value) => value >= 5).length;
  const sleeveCountScore = 40 + significantSleeves * 9;
  const sectors = new Set(holdings.map((holding) => holding.sector || holding.assetClass));
  const diversification = clamp(sleeveCountScore + Math.min(sectors.size, 6) * 3, 28, 92);

  const placementMatrix = getAccountPlacementMatrix();
  const weightedFit = holdings.map((holding) => {
    const account = accounts.find((entry) => entry.id === holding.accountId);
    if (!account || total <= 0) {
      return 0;
    }
    const fit = placementMatrix[holding.assetClass]?.[account.type] ?? 0.45;
    return fit * (holding.marketValueCad / total) * 100;
  });
  const accountEfficiency = clamp(sum(weightedFit), 24, 95);

  const weights = holdings.map((holding) => holding.weightPct / 100).filter((value) => value > 0);
  const hhi = sum(weights.map((weight) => weight ** 2));
  const largestHoldingPct = Math.max(...holdings.map((holding) => holding.weightPct), 0);
  const concentration = clamp(100 - (hhi * 140 + largestHoldingPct * 1.1), 18, 94);

  const targetEquity = targetAllocation
    .filter((target) => !["Fixed Income", "Cash"].includes(target.assetClass))
    .reduce((totalPct, target) => totalPct + target.targetPct, 0);
  const currentEquity = [...allocation.entries()]
    .filter(([assetClass]) => !["Fixed Income", "Cash"].includes(assetClass))
    .reduce((totalPct, [, value]) => totalPct + value, 0);
  const fixedIncomeTarget = targetAllocation.find((target) => target.assetClass === "Fixed Income")?.targetPct ?? 0;
  const fixedIncomeCurrent = allocation.get("Fixed Income") ?? 0;
  const cashTarget = targetAllocation.find((target) => target.assetClass === "Cash")?.targetPct ?? 0;
  const cashCurrent = allocation.get("Cash") ?? 0;
  const riskBalance = clamp(
    100 - Math.abs(currentEquity - targetEquity) * 1.4 - Math.abs(fixedIncomeCurrent - fixedIncomeTarget) * 1.6 - Math.abs(cashCurrent - cashTarget) * 1.1,
    24,
    95
  );

  const radar = [
    { dimension: pick(language, "配置贴合", "Allocation"), value: round(allocationFit, 0) },
    { dimension: pick(language, "分散度", "Diversification"), value: round(diversification, 0) },
    { dimension: pick(language, "账户效率", "Efficiency"), value: round(accountEfficiency, 0) },
    { dimension: pick(language, "集中度", "Concentration"), value: round(concentration, 0) },
    { dimension: pick(language, "风险平衡", "Risk Balance"), value: round(riskBalance, 0) }
  ];

  const score = round((allocationFit * 0.28) + (diversification * 0.18) + (accountEfficiency * 0.2) + (concentration * 0.18) + (riskBalance * 0.16), 0);
  const strongestDimensionBase = [...radar].sort((left, right) => right.value - left.value)[0];
  const weakestDimensionBase = [...radar].sort((left, right) => left.value - right.value)[0];
  const mainGap = targetAllocation
    .map((target) => ({ assetClass: target.assetClass, gap: (allocation.get(target.assetClass) ?? 0) - target.targetPct }))
    .sort((left, right) => Math.abs(right.gap) - Math.abs(left.gap))[0];
  const topHolding = [...holdings].sort((left, right) => right.weightPct - left.weightPct)[0];
  const leastEfficientHolding = [...holdings]
    .map((holding) => {
      const account = accounts.find((entry) => entry.id === holding.accountId);
      return {
        holding,
        fit: account ? (placementMatrix[holding.assetClass]?.[account.type] ?? 0.45) : 0.45,
        account
      };
    })
    .sort((left, right) => left.fit - right.fit)[0];

  return {
    score,
    status: score >= 82
      ? pick(language, "状态稳健", "Strong shape")
      : score >= 68
        ? pick(language, "状态可用", "Workable")
        : pick(language, "需要修整", "Needs work"),
    radar,
    highlights: [
      mainGap
        ? pick(
          language,
          `${getAssetClassLabel(mainGap.assetClass, language)} 仍是最大的配置偏差来源。`,
          `${getAssetClassLabel(mainGap.assetClass, language)} remains the largest allocation gap.`
        )
        : pick(language, "当前配置已基本贴近目标。", "The portfolio is broadly aligned with its target mix."),
      topHolding
        ? pick(
          language,
          `${topHolding.symbol} 当前占组合 ${topHolding.weightPct.toFixed(1)}%，是集中度的主要驱动项。`,
          `${topHolding.symbol} currently represents ${topHolding.weightPct.toFixed(1)}% of the portfolio and is the main concentration driver.`
        )
        : pick(language, "先导入持仓，才能生成集中度诊断。", "Import holdings to unlock concentration diagnostics."),
      leastEfficientHolding?.account
        ? pick(
          language,
          `${leastEfficientHolding.holding.symbol} 目前放在 ${getAccountTypeLabel(leastEfficientHolding.account.type, language)}，账户效率还有提升空间。`,
          `${leastEfficientHolding.holding.symbol} currently sits in ${getAccountTypeLabel(leastEfficientHolding.account.type, language)}, leaving room to improve account efficiency.`
        )
        : pick(language, "当前没有足够数据评估账户放置效率。", "There is not enough data yet to evaluate account placement efficiency.")
    ],
    strongestDimension: {
      label: strongestDimensionBase?.dimension ?? pick(language, "配置贴合", "Allocation"),
      value: strongestDimensionBase?.value ?? 0
    },
    weakestDimension: {
      label: weakestDimensionBase?.dimension ?? pick(language, "配置贴合", "Allocation"),
      value: weakestDimensionBase?.value ?? 0
    }
  };
}
