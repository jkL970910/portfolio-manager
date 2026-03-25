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

const ASSET_CLASS_RISK_WEIGHTS: Record<string, number> = {
  "Canadian Equity": 1,
  "US Equity": 1.12,
  "International Equity": 1.08,
  "Fixed Income": 0.42,
  Cash: 0.08
};

const IMPACT_HINT_AMOUNTS = [2500, 5000, 10000] as const;

export type PortfolioHealthSummary = {
  score: number;
  status: string;
  radar: Array<{ dimension: string; value: number }>;
  highlights: string[];
  strongestDimension: { label: string; value: number };
  weakestDimension: { label: string; value: number };
  dimensions: Array<{
    id: "allocation" | "diversification" | "efficiency" | "concentration" | "risk-balance";
    label: string;
    score: number;
    status: string;
    summary: string;
    drivers: string[];
    consequences: string[];
    actions: string[];
  }>;
  actionQueue: string[];
  accountDrilldown: Array<{
    id: string;
    label: string;
    score: number;
    status: string;
    summary: string;
    impactHints?: Array<{
      amount: number;
      hint: string;
    }>;
    drivers: string[];
    actions: string[];
  }>;
  holdingDrilldown: Array<{
    id: string;
    label: string;
    score: number;
    status: string;
    summary: string;
    impactHints?: Array<{
      amount: number;
      hint: string;
    }>;
    drivers: string[];
    actions: string[];
  }>;
};

function getDimensionStatus(score: number, language: DisplayLanguage) {
  if (score >= 82) {
    return pick(language, "稳健", "Strong");
  }
  if (score >= 68) {
    return pick(language, "可用", "Workable");
  }
  return pick(language, "待修整", "Needs work");
}

function formatImpactAmount(amount: number, language: DisplayLanguage) {
  return language === "zh"
    ? amount.toLocaleString("zh-CN")
    : `$${amount.toLocaleString("en-CA")}`;
}

function buildImpactHints(
  language: DisplayLanguage,
  createHint: (amount: number, amountLabel: string) => string
) {
  return IMPACT_HINT_AMOUNTS.map((amount) => ({
    amount,
    hint: createHint(amount, formatImpactAmount(amount, language))
  }));
}

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
  const holdingRiskContributionRaw = holdings.map((holding) => ({
    holding,
    weightedRisk: holding.weightPct * (ASSET_CLASS_RISK_WEIGHTS[holding.assetClass] ?? 1)
  }));
  const totalHoldingWeightedRisk = sum(holdingRiskContributionRaw.map((item) => item.weightedRisk)) || 1;
  const holdingRiskContribution = holdingRiskContributionRaw
    .map((item) => ({
      holding: item.holding,
      contributionPct: (item.weightedRisk / totalHoldingWeightedRisk) * 100
    }))
    .sort((left, right) => right.contributionPct - left.contributionPct);
  const dominantHoldingRisk = holdingRiskContribution[0];
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
  const mainGapTargetPct = mainGap
    ? targetAllocation.find((target) => target.assetClass === mainGap.assetClass)?.targetPct ?? 0
    : 0;
  const mainGapCurrentPct = mainGap ? (allocation.get(mainGap.assetClass) ?? 0) : 0;

  const allocationDimension = {
    id: "allocation" as const,
    label: pick(language, "配置贴合", "Allocation"),
    score: round(allocationFit, 0),
    status: getDimensionStatus(allocationFit, language),
    summary: mainGap
      ? pick(
        language,
        `你现在的 ${getAssetClassLabel(mainGap.assetClass, language)} 配得还不够，和你自己设的目标差得最远。`,
        `${getAssetClassLabel(mainGap.assetClass, language)} remains the clearest target mismatch.`
      )
      : pick(language, "当前配置已经大致贴近目标。", "Current allocation is broadly aligned with the target."),
    drivers: [
      mainGap
        ? pick(
          language,
          `${getAssetClassLabel(mainGap.assetClass, language)} 的目标大约是 ${mainGapTargetPct.toFixed(0)}%，你现在大约只有 ${mainGapCurrentPct.toFixed(1)}%，所以差了 ${Math.abs(mainGap.gap).toFixed(1)} 个百分点。`,
          `${getAssetClassLabel(mainGap.assetClass, language)} is off target by ${Math.abs(mainGap.gap).toFixed(1)}%.`
        )
        : pick(language, "没有明显的配置偏差。", "No major allocation gap was detected."),
      pick(
        language,
        `你的目标配置一共分成了 ${targetAllocation.length} 个资产方向。`,
        `The active target mix spans ${targetAllocation.length} sleeves.`
      )
    ],
    consequences: [
      mainGap
        ? pick(
          language,
          `如果先不补这个缺口，后面推荐页大概率还会继续把新钱优先引到 ${getAssetClassLabel(mainGap.assetClass, language)}。`,
          `If this gap is left alone, future funding runs will likely keep routing new money into ${getAssetClassLabel(mainGap.assetClass, language)}.`
        )
        : pick(language, "这一项暂时不会拖后腿，短期内不用优先处理。", "This dimension is not the main drag right now.")
    ],
    actions: [
      mainGap
        ? pick(
          language,
          `下一笔钱先补到 ${getAssetClassLabel(mainGap.assetClass, language)}，先把最大的缺口补起来。`,
          `Route the next contribution toward ${getAssetClassLabel(mainGap.assetClass, language)} first.`
        )
        : pick(language, "当前可优先维护而非大幅调整。", "Maintain the mix instead of making large changes.")
    ]
  };

  const diversificationDimension = {
    id: "diversification" as const,
    label: pick(language, "分散度", "Diversification"),
    score: round(diversification, 0),
    status: getDimensionStatus(diversification, language),
    summary: pick(
      language,
      `你现在的钱主要集中在 ${significantSleeves} 个较大的资产方向里，行业覆盖只有 ${sectors.size} 类。`,
      `${significantSleeves} meaningful sleeves currently cover ${sectors.size} sector tags.`
    ),
    drivers: [
      pick(
        language,
        `占比超过 5% 的主要资产方向有 ${significantSleeves} 个。`,
        `${significantSleeves} sleeves are above a 5% weight.`
      ),
      pick(
        language,
        `目前真正覆盖到的行业只有 ${sectors.size} 类。`,
        `The current sector coverage count is ${sectors.size}.`
      )
    ],
    consequences: [
      significantSleeves < 4
        ? pick(
          language,
          "如果一直不补新的资产方向，组合接下来的涨跌会继续主要靠少数几类资产决定。",
          "If you keep skipping missing sleeves, a small set of assets will keep driving most of the portfolio moves."
        )
        : pick(
          language,
          "这项暂时不是最危险的问题，不处理也不会比配置缺口更先恶化。",
          "This is not the most urgent issue; it is unlikely to deteriorate before allocation drift does."
        )
    ],
    actions: [
      significantSleeves < 4
        ? pick(language, "后面优先把缺的资产方向补起来，别让组合只靠少数几类资产撑着。", "Add missing sleeves so fewer assets are driving the whole portfolio.")
        : pick(language, "分散度还算够用，下一步更该先修配置偏差和集中度。", "Diversification is serviceable; focus next on drift and concentration.")
    ]
  };

  const efficiencyDimension = {
    id: "efficiency" as const,
    label: pick(language, "账户效率", "Efficiency"),
    score: round(accountEfficiency, 0),
    status: getDimensionStatus(accountEfficiency, language),
    summary: leastEfficientHolding?.account
      ? pick(
        language,
        `${leastEfficientHolding.holding.symbol} 现在放在 ${getAccountTypeLabel(leastEfficientHolding.account.type, language)} 里不太合适，账户利用效率最低。`,
        `${leastEfficientHolding.holding.symbol} currently has the weakest account fit inside ${getAccountTypeLabel(leastEfficientHolding.account.type, language)}.`
      )
      : pick(language, "当前缺少足够的账户放置信息。", "There is not enough account-placement detail yet."),
    drivers: [
      leastEfficientHolding?.account
        ? pick(
          language,
          `最不合适的那笔放置，账户匹配分只有 ${(leastEfficientHolding.fit * 100).toFixed(0)}/100 左右。`,
          `The weakest account-fit score is about ${(leastEfficientHolding.fit * 100).toFixed(0)}/100.`
        )
        : pick(language, "尚未识别出明显的低效账户放置。", "No obviously inefficient account placement was detected."),
      accounts.some((account) => account.type === "Taxable")
        ? pick(language, "你已经开始用到应税账户，所以账户放置会更影响长期效率。", "The portfolio already relies on taxable space.")
        : pick(language, "目前大部分资产还在受保护账户里。", "The portfolio still fits mostly inside sheltered accounts.")
    ],
    consequences: [
      leastEfficientHolding?.account
        ? pick(
          language,
          "如果继续把这类资产放在不太合适的账户里，长期效率会慢慢被拖低，推荐也会更常提醒你换账户路径。",
          "If this sleeve stays in a poor-fit account, long-term efficiency will keep slipping and recommendations will keep pointing you toward a different account path."
        )
        : pick(language, "这项现在不会立刻带来明显问题。", "This is not creating a visible short-term problem right now.")
    ],
    actions: [
      leastEfficientHolding?.account
        ? pick(
          language,
          `下一笔钱尽量放进更适合 ${getAssetClassLabel(leastEfficientHolding.holding.assetClass, language)} 的账户里，不要继续加在当前这个账户。`,
          `Route new money into accounts with a better fit for ${leastEfficientHolding.holding.assetClass}.`
        )
        : pick(language, "继续保留现有的账户优先顺序即可。", "Keep the current funding order for now.")
    ]
  };

  const concentrationDimension = {
    id: "concentration" as const,
    label: pick(language, "集中度", "Concentration"),
    score: round(concentration, 0),
    status: getDimensionStatus(concentration, language),
    summary: topHolding
      ? pick(
        language,
        `${topHolding.symbol} 一笔就占了 ${topHolding.weightPct.toFixed(1)}%，已经是组合里最集中的一块。`,
        `${topHolding.symbol} alone represents ${topHolding.weightPct.toFixed(1)}% of the portfolio and is the main concentration source.`
      )
      : pick(language, "先导入持仓，才能评估集中度。", "Import holdings before concentration can be scored."),
    drivers: [
      pick(
        language,
        `从组合集中度看，你现在并不是很分散，HHI 大约是 ${hhi.toFixed(2)}。`,
        `Current HHI is about ${hhi.toFixed(2)}.`
      ),
      topHolding
        ? pick(
          language,
          `目前最大的一笔持仓是 ${topHolding.symbol}。`,
          `The largest single holding is ${topHolding.symbol}.`
        )
        : pick(language, "当前没有足够持仓数据。", "There is not enough holding data yet.")
    ],
    consequences: [
      topHolding && topHolding.weightPct >= 12
        ? pick(
          language,
          `如果还继续往 ${topHolding.symbol} 这类大仓位加钱，组合会越来越像押单一方向，回撤时也会更难受。`,
          `If you keep adding to a large position like ${topHolding.symbol}, the portfolio will behave more like a single bet and drawdowns will feel sharper.`
        )
        : pick(language, "集中度暂时可控，不处理也不会马上失衡。", "Concentration is still manageable and is unlikely to break quickly.")
    ],
    actions: [
      topHolding && topHolding.weightPct >= 12
        ? pick(language, `先别继续往 ${topHolding.symbol} 上加钱，把新资金分到别的方向，先把集中度降下来。`, `Limit further adds to ${topHolding.symbol} and diversify new money into other sleeves.`)
        : pick(language, "集中度还算可控，下一步主要看配置偏离。", "Concentration is manageable; focus next on allocation drift.")
    ]
  };

  const riskBalanceDimension = {
    id: "risk-balance" as const,
    label: pick(language, "风险平衡", "Risk Balance"),
    score: round(riskBalance, 0),
    status: getDimensionStatus(riskBalance, language),
    summary: dominantHoldingRisk
      ? pick(
        language,
        `${dominantHoldingRisk.holding.symbol} 大约扛着你组合里 ${dominantHoldingRisk.contributionPct.toFixed(0)}% 的风险，是现在最重的风险来源。`,
        `${dominantHoldingRisk.holding.symbol} currently contributes about ${dominantHoldingRisk.contributionPct.toFixed(0)}% of total portfolio risk and is the heaviest risk source.`
      )
      : pick(
        language,
        `你现在的股票、固收和现金比例大约是 ${currentEquity.toFixed(0)}% / ${fixedIncomeCurrent.toFixed(0)}% / ${cashCurrent.toFixed(0)}%。`,
        `Equity, fixed income, and cash currently sit near ${currentEquity.toFixed(0)}% / ${fixedIncomeCurrent.toFixed(0)}% / ${cashCurrent.toFixed(0)}%.`
      ),
    drivers: [
      pick(
        language,
        `你的目标里，股票大约应占 ${targetEquity.toFixed(0)}%，固收应占 ${fixedIncomeTarget.toFixed(0)}%。`,
        `Equity target is ${targetEquity.toFixed(0)}% and fixed-income target is ${fixedIncomeTarget.toFixed(0)}%.`
      ),
      pick(
        language,
        `现金目标是 ${cashTarget.toFixed(0)}%，你现在实际大约是 ${cashCurrent.toFixed(0)}%。`,
        `Cash target is ${cashTarget.toFixed(0)}% and current cash is ${cashCurrent.toFixed(0)}%.`
      ),
      dominantHoldingRisk
        ? pick(
          language,
          `${dominantHoldingRisk.holding.symbol} 所在的 ${getAssetClassLabel(dominantHoldingRisk.holding.assetClass, language)} 本来波动就更大，所以它对风险的影响会比你看到的市值占比更重。`,
          `${dominantHoldingRisk.holding.symbol} sits in a higher-risk ${getAssetClassLabel(dominantHoldingRisk.holding.assetClass, language)} sleeve, so its risk contribution is about ${dominantHoldingRisk.contributionPct.toFixed(0)}% and may exceed its plain market-value weight.`
        )
        : pick(
          language,
          "当前还没有足够持仓来估算风险贡献。",
          "There is not enough holding detail yet to estimate risk contribution."
        )
    ].filter(Boolean),
    consequences: [
      dominantHoldingRisk
        ? pick(
          language,
          `如果继续把钱加在 ${dominantHoldingRisk.holding.symbol} 这一类高风险来源上，组合波动会更难压下来，一跌就会感受更明显。`,
          `If money keeps flowing into the risk sleeve around ${dominantHoldingRisk.holding.symbol}, total portfolio volatility will be harder to calm down.`
        )
        : pick(
          language,
          "这项现在缺少足够数据，不代表没问题，只是还看不清。",
          "This area lacks enough data right now; that does not mean there is no issue, only that it cannot be seen clearly yet."
        )
    ],
    actions: [
      dominantHoldingRisk
        ? pick(
          language,
          `如果下一笔钱还继续加在 ${dominantHoldingRisk.holding.symbol} 这一类风险资产上，你的整体风险会更难降下来。`,
          `If the next contribution keeps adding to the risk sleeve around ${dominantHoldingRisk.holding.symbol}, it will be harder to pull overall risk back toward the target band.`
        )
        : pick(
          language,
          "先导入完整持仓，才能判断真正的风险主驱动。",
          "Import a fuller holding set before judging the real risk driver."
        ),
      pick(
        language,
        "先把新钱投向能分散风险的方向，不要只盯着表面占比最低的那一类资产。",
        "Route new money toward sleeves that reduce the dominant risk source, not just the sleeve with the lowest nominal weight."
      )
    ]
  };

  const dimensions = [
    allocationDimension,
    diversificationDimension,
    efficiencyDimension,
    concentrationDimension,
    riskBalanceDimension
  ];

  const actionQueue = [
    allocationDimension.actions[0],
    concentrationDimension.actions[0],
    efficiencyDimension.actions[0]
  ];

  const accountDrilldown = [...new Set(accounts.map((account) => account.type))]
    .map((accountType) => {
      const accountsOfType = accounts.filter((account) => account.type === accountType);
      const accountIds = new Set(accountsOfType.map((account) => account.id));
      const groupedHoldings = holdings.filter((holding) => accountIds.has(holding.accountId));
      const groupedValue = sum(groupedHoldings.map((holding) => holding.marketValueCad));
      const sharePct = total > 0 ? (groupedValue / total) * 100 : 0;
      const weightedFit = groupedHoldings.length > 0 && groupedValue > 0
        ? sum(groupedHoldings.map((holding) => {
          const fit = placementMatrix[holding.assetClass]?.[accountType] ?? 0.45;
          return fit * (holding.marketValueCad / groupedValue) * 100;
        }))
        : 45;
      const groupedScore = clamp(weightedFit - Math.max(0, sharePct - 45) * 0.9 + (accountType === "Taxable" ? -4 : 3), 22, 95);
      const topHoldingInGroup = [...groupedHoldings].sort((left, right) => right.marketValueCad - left.marketValueCad)[0];

      return {
        id: accountType,
        label: getAccountTypeLabel(accountType, language),
        href: `/portfolio?accountType=${accountType}`,
        score: round(groupedScore, 0),
        status: getDimensionStatus(groupedScore, language),
        summary: pick(
          language,
          `${getAccountTypeLabel(accountType, language)} 这一整类账户现在一共放了大约 ${sharePct.toFixed(1)}% 的资产，整体账户匹配分约 ${weightedFit.toFixed(0)}/100。`,
          `${getAccountTypeLabel(accountType, language)} currently holds about ${sharePct.toFixed(1)}% of the portfolio with an account-fit score near ${weightedFit.toFixed(0)}/100.`
        ),
        impactHints: buildImpactHints(
          language,
          (_amount, amountLabel) => weightedFit < 70
            ? pick(
              language,
              `如果下一笔 ${amountLabel} 不再继续往 ${getAccountTypeLabel(accountType, language)} 这类账户里放，而是分到更合适的账户类型，最先改善的通常会是账户效率。`,
              `If the next ${amountLabel} is redirected away from ${getAccountTypeLabel(accountType, language)} into a better-fitting account type, account efficiency should improve first.`
            )
            : pick(
              language,
              `如果下一笔 ${amountLabel} 还继续堆在 ${getAccountTypeLabel(accountType, language)} 里，通常会先让这类账户变得更拥挤。`,
              `If the next ${amountLabel} keeps landing in ${getAccountTypeLabel(accountType, language)}, crowding inside that account type is likely to worsen first.`
            )
        ),
        drivers: [
          pick(
            language,
            `这一类账户共有 ${accountsOfType.length} 个，里面一共有 ${groupedHoldings.length} 笔持仓。`,
            `This account type includes ${accountsOfType.length} accounts and ${groupedHoldings.length} holdings.`
          ),
          topHoldingInGroup
            ? pick(
              language,
              `这一类账户里最大的持仓是 ${topHoldingInGroup.symbol}，大约占你全部资产的 ${topHoldingInGroup.weightPct.toFixed(1)}%。`,
              `The largest holding inside this account type is ${topHoldingInGroup.symbol}, representing about ${topHoldingInGroup.weightPct.toFixed(1)}% of the total portfolio.`
            )
            : pick(language, "这一类账户目前还没有足够的持仓明细。", "This account type does not yet have enough holding detail.")
        ],
        actions: [
          weightedFit < 70
            ? pick(
              language,
              `后续新增资金别优先堆在 ${getAccountTypeLabel(accountType, language)} 里，先看看有没有更合适的账户类别。`,
              `Do not prioritize ${getAccountTypeLabel(accountType, language)} for the next contribution; check whether another account type fits better.`
            )
            : pick(
              language,
              `这类账户整体还算合理，后面主要注意别把太多新钱继续集中到这里。`,
              `${getAccountTypeLabel(accountType, language)} is broadly fine overall; the main risk is adding too much more money into it.`
            )
        ]
      };
    })
    .sort((left, right) => left.score - right.score);

  const holdingDrilldown = [...holdings]
    .map((holding) => {
      const account = accounts.find((entry) => entry.id === holding.accountId);
      const fit = account ? (placementMatrix[holding.assetClass]?.[account.type] ?? 0.45) : 0.45;
      const holdingRisk = holdingRiskContribution.find((item) => item.holding.id === holding.id)?.contributionPct ?? 0;
      const holdingScore = clamp((fit * 100) - Math.max(0, holding.weightPct - 12) * 2.2 + (holding.assetClass === "Cash" && holding.weightPct > 8 ? -8 : 0), 16, 95);

      return {
        id: holding.id,
        label: `${holding.symbol} · ${getAccountTypeLabel(account?.type ?? "Taxable", language)}`,
        href: `/portfolio?holding=${holding.id}`,
        score: round(holdingScore, 0),
        status: getDimensionStatus(holdingScore, language),
        summary: pick(
          language,
          `${holding.symbol} 当前占组合 ${holding.weightPct.toFixed(1)}%，近似风险贡献约 ${holdingRisk.toFixed(0)}%，账户适配度约 ${(fit * 100).toFixed(0)}/100。`,
          `${holding.symbol} currently represents ${holding.weightPct.toFixed(1)}% of the portfolio, contributes about ${holdingRisk.toFixed(0)}% of estimated risk, and carries an account-fit score near ${(fit * 100).toFixed(0)}/100.`
        ),
        impactHints: buildImpactHints(
          language,
          (_amount, amountLabel) => holding.weightPct >= 12 || holdingRisk >= 18
            ? pick(
              language,
              `如果下一笔 ${amountLabel} 不再继续补向 ${holding.symbol}，而是分流到其他袖口，最先改善的通常会是集中度和风险平衡。`,
              `If the next ${amountLabel} avoids adding to ${holding.symbol} and is redirected into other sleeves, concentration and risk balance should improve first.`
            )
            : fit < 0.7
              ? pick(
                language,
                `如果下一笔 ${amountLabel} 继续补这类资产，但改放到更适配的账户，最先改善的通常会是账户效率。`,
                `If the next ${amountLabel} still adds this sleeve but moves into a better-fitting account, account efficiency should improve first.`
              )
              : pick(
                language,
                `如果下一笔 ${amountLabel} 优先补足其他缺口而不是继续加 ${holding.symbol}，最先改善的通常会是配置贴合。`,
                `If the next ${amountLabel} goes toward other gaps instead of adding more ${holding.symbol}, allocation fit should improve first.`
              )
        ),
        drivers: [
          pick(
            language,
            `资产类别：${getAssetClassLabel(holding.assetClass, language)}；账户：${getAccountTypeLabel(account?.type ?? "Taxable", language)}。`,
            `Asset class: ${getAssetClassLabel(holding.assetClass, language)}; account: ${getAccountTypeLabel(account?.type ?? "Taxable", language)}.`
          ),
          pick(
            language,
            `近似风险贡献约为 ${holdingRisk.toFixed(0)}%，说明这笔仓位对整体波动的影响不只取决于名义市值。`,
            `Estimated risk contribution is about ${holdingRisk.toFixed(0)}%, which means its impact on total volatility is not just a function of market value.`
          ),
          holding.weightPct >= 12
            ? pick(
              language,
              "这笔仓位已经足够大，会直接拉低组合集中度分数。",
              "This position is large enough to pull down the concentration score directly."
            )
            : pick(
              language,
              "这笔仓位的主要问题不是体量，而是它与整体配置的关系。",
              "The main issue here is less size and more how the sleeve fits the overall mix."
            )
        ],
        actions: [
          holding.weightPct >= 12
            ? pick(
              language,
              `暂缓继续加仓 ${holding.symbol}，优先把新增资金引导到其他袖口。`,
              `Pause further adds to ${holding.symbol} and direct fresh money into other sleeves first.`
            )
            : fit < 0.7
              ? pick(
                language,
                `后续如继续补这类资产，优先考虑放到更适配的账户，而不是继续放在当前账户。`,
                `If you keep adding this sleeve, move the next contribution into a better-fitting account instead of reusing the current one.`
              )
              : pick(
                language,
                `当前可把 ${holding.symbol} 当成观察项，不必优先处理。`,
                `Treat ${holding.symbol} as a monitor item rather than an urgent fix.`
              )
        ]
      };
    })
    .sort((left, right) => left.score - right.score)
    .slice(0, 5);

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
          `${getAssetClassLabel(mainGap.assetClass, language)} 还是离目标最远的一块，下一笔钱通常会先补这里。`,
          `${getAssetClassLabel(mainGap.assetClass, language)} remains the largest allocation gap.`
        )
        : pick(language, "当前配置已基本贴近目标。", "The portfolio is broadly aligned with its target mix."),
      topHolding
        ? pick(
          language,
          `${topHolding.symbol} 现在已经很重了，占组合 ${topHolding.weightPct.toFixed(1)}%，它最容易把组合带偏。`,
          `${topHolding.symbol} currently represents ${topHolding.weightPct.toFixed(1)}% of the portfolio and is the main concentration driver.`
        )
        : pick(language, "先导入持仓，才能生成集中度诊断。", "Import holdings to unlock concentration diagnostics."),
      leastEfficientHolding?.account
        ? pick(
          language,
          `${leastEfficientHolding.holding.symbol} 放在 ${getAccountTypeLabel(leastEfficientHolding.account.type, language)} 里不算理想，后面可以优先换到更合适的账户。`,
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
    },
    dimensions,
    actionQueue,
    accountDrilldown: accountDrilldown.slice(0, 4),
    holdingDrilldown
  };
}
