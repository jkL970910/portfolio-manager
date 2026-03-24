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

  const allocationDimension = {
    id: "allocation" as const,
    label: pick(language, "配置贴合", "Allocation"),
    score: round(allocationFit, 0),
    status: getDimensionStatus(allocationFit, language),
    summary: mainGap
      ? pick(
        language,
        `${getAssetClassLabel(mainGap.assetClass, language)} 仍然偏离目标最明显。`,
        `${getAssetClassLabel(mainGap.assetClass, language)} remains the clearest target mismatch.`
      )
      : pick(language, "当前配置已经大致贴近目标。", "Current allocation is broadly aligned with the target."),
    drivers: [
      mainGap
        ? pick(
          language,
          `${getAssetClassLabel(mainGap.assetClass, language)} 的偏差为 ${Math.abs(mainGap.gap).toFixed(1)}%。`,
          `${getAssetClassLabel(mainGap.assetClass, language)} is off target by ${Math.abs(mainGap.gap).toFixed(1)}%.`
        )
        : pick(language, "没有明显的配置偏差。", "No major allocation gap was detected."),
      pick(
        language,
        `当前目标配置包含 ${targetAllocation.length} 个资产袖口。`,
        `The active target mix spans ${targetAllocation.length} sleeves.`
      )
    ],
    actions: [
      mainGap
        ? pick(
          language,
          `下一笔新增资金优先补向 ${getAssetClassLabel(mainGap.assetClass, language)}。`,
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
      `当前有 ${significantSleeves} 个显著资产袖口，覆盖 ${sectors.size} 个行业标签。`,
      `${significantSleeves} meaningful sleeves currently cover ${sectors.size} sector tags.`
    ),
    drivers: [
      pick(
        language,
        `权重超过 5% 的资产袖口共有 ${significantSleeves} 个。`,
        `${significantSleeves} sleeves are above a 5% weight.`
      ),
      pick(
        language,
        `当前行业覆盖数为 ${sectors.size}。`,
        `The current sector coverage count is ${sectors.size}.`
      )
    ],
    actions: [
      significantSleeves < 4
        ? pick(language, "补齐更多目标资产袖口，避免组合只靠少数资产驱动。", "Add missing sleeves so fewer assets are driving the whole portfolio.")
        : pick(language, "当前分散度基础可用，优先修整偏离和集中度。", "Diversification is serviceable; focus next on drift and concentration.")
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
        `${leastEfficientHolding.holding.symbol} 放在 ${getAccountTypeLabel(leastEfficientHolding.account.type, language)} 的适配度最低。`,
        `${leastEfficientHolding.holding.symbol} currently has the weakest account fit inside ${getAccountTypeLabel(leastEfficientHolding.account.type, language)}.`
      )
      : pick(language, "当前缺少足够的账户放置信息。", "There is not enough account-placement detail yet."),
    drivers: [
      leastEfficientHolding?.account
        ? pick(
          language,
          `最低账户适配度约为 ${(leastEfficientHolding.fit * 100).toFixed(0)}/100。`,
          `The weakest account-fit score is about ${(leastEfficientHolding.fit * 100).toFixed(0)}/100.`
        )
        : pick(language, "尚未识别出明显的低效账户放置。", "No obviously inefficient account placement was detected."),
      accounts.some((account) => account.type === "Taxable")
        ? pick(language, "当前组合已经使用到应税账户。", "The portfolio already relies on taxable space.")
        : pick(language, "当前组合主要停留在受保护账户内。", "The portfolio still fits mostly inside sheltered accounts.")
    ],
    actions: [
      leastEfficientHolding?.account
        ? pick(
          language,
          `后续新增资金优先补向更适配 ${leastEfficientHolding.holding.assetClass} 的账户。`,
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
        `${topHolding.symbol} 单独占比 ${topHolding.weightPct.toFixed(1)}%，是当前最大的集中来源。`,
        `${topHolding.symbol} alone represents ${topHolding.weightPct.toFixed(1)}% of the portfolio and is the main concentration source.`
      )
      : pick(language, "先导入持仓，才能评估集中度。", "Import holdings before concentration can be scored."),
    drivers: [
      pick(
        language,
        `当前 HHI 约为 ${hhi.toFixed(2)}。`,
        `Current HHI is about ${hhi.toFixed(2)}.`
      ),
      topHolding
        ? pick(
          language,
          `最大单一持仓为 ${topHolding.symbol}。`,
          `The largest single holding is ${topHolding.symbol}.`
        )
        : pick(language, "当前没有足够持仓数据。", "There is not enough holding data yet.")
    ],
    actions: [
      topHolding && topHolding.weightPct >= 12
        ? pick(language, `控制 ${topHolding.symbol} 的继续加仓，并优先把新资金分散到其他袖口。`, `Limit further adds to ${topHolding.symbol} and diversify new money into other sleeves.`)
        : pick(language, "当前集中度尚可，后续主要关注配置偏离。", "Concentration is manageable; focus next on allocation drift.")
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
        `${dominantHoldingRisk.holding.symbol} 当前大约贡献了 ${dominantHoldingRisk.contributionPct.toFixed(0)}% 的组合风险，是最重的风险来源。`,
        `${dominantHoldingRisk.holding.symbol} currently contributes about ${dominantHoldingRisk.contributionPct.toFixed(0)}% of total portfolio risk and is the heaviest risk source.`
      )
      : pick(
        language,
        `权益、固收和现金当前分别约为 ${currentEquity.toFixed(0)}% / ${fixedIncomeCurrent.toFixed(0)}% / ${cashCurrent.toFixed(0)}%。`,
        `Equity, fixed income, and cash currently sit near ${currentEquity.toFixed(0)}% / ${fixedIncomeCurrent.toFixed(0)}% / ${cashCurrent.toFixed(0)}%.`
      ),
    drivers: [
      pick(
        language,
        `权益目标为 ${targetEquity.toFixed(0)}%，固收目标为 ${fixedIncomeTarget.toFixed(0)}%。`,
        `Equity target is ${targetEquity.toFixed(0)}% and fixed-income target is ${fixedIncomeTarget.toFixed(0)}%.`
      ),
      pick(
        language,
        `现金目标为 ${cashTarget.toFixed(0)}%，当前为 ${cashCurrent.toFixed(0)}%。`,
        `Cash target is ${cashTarget.toFixed(0)}% and current cash is ${cashCurrent.toFixed(0)}%.`
      ),
      dominantHoldingRisk
        ? pick(
          language,
          `${dominantHoldingRisk.holding.symbol} 所在的 ${getAssetClassLabel(dominantHoldingRisk.holding.assetClass, language)} 袖口风险更高，因此它的风险贡献约为 ${dominantHoldingRisk.contributionPct.toFixed(0)}%，可能高于你直观看到的市值占比。`,
          `${dominantHoldingRisk.holding.symbol} sits in a higher-risk ${getAssetClassLabel(dominantHoldingRisk.holding.assetClass, language)} sleeve, so its risk contribution is about ${dominantHoldingRisk.contributionPct.toFixed(0)}% and may exceed its plain market-value weight.`
        )
        : pick(
          language,
          "当前还没有足够持仓来估算风险贡献。",
          "There is not enough holding detail yet to estimate risk contribution."
        )
    ].filter(Boolean),
    actions: [
      dominantHoldingRisk
        ? pick(
          language,
          `如果下一笔资金继续补向 ${dominantHoldingRisk.holding.symbol} 所在的风险袖口，整体风险会更难拉回目标带附近。`,
          `If the next contribution keeps adding to the risk sleeve around ${dominantHoldingRisk.holding.symbol}, it will be harder to pull overall risk back toward the target band.`
        )
        : pick(
          language,
          "先导入完整持仓，才能判断真正的风险主驱动。",
          "Import a fuller holding set before judging the real risk driver."
        ),
      pick(
        language,
        "优先把新增资金引向能降低单一风险来源占比的袖口，而不是只看名义权重最低的资产类。",
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

  const accountDrilldown = [...accounts]
    .map((account) => {
      const accountHoldings = holdings.filter((holding) => holding.accountId === account.id);
      const accountValue = sum(accountHoldings.map((holding) => holding.marketValueCad));
      const sharePct = total > 0 ? (accountValue / total) * 100 : 0;
      const weightedFit = accountHoldings.length > 0 && accountValue > 0
        ? sum(accountHoldings.map((holding) => {
          const fit = placementMatrix[holding.assetClass]?.[account.type] ?? 0.45;
          return fit * (holding.marketValueCad / accountValue) * 100;
        }))
        : 45;
      const accountScore = clamp(weightedFit - Math.max(0, sharePct - 45) * 0.9 + (account.type === "Taxable" ? -4 : 3), 22, 95);
      const topHoldingInAccount = [...accountHoldings].sort((left, right) => right.weightPct - left.weightPct)[0];

      return {
        id: account.id,
        label: `${getAccountTypeLabel(account.type, language)} · ${account.nickname}`,
        href: `/portfolio?account=${account.id}`,
        score: round(accountScore, 0),
        status: getDimensionStatus(accountScore, language),
        summary: pick(
          language,
          `${account.nickname} 当前承载组合约 ${sharePct.toFixed(1)}% 的市值，账户匹配分约 ${weightedFit.toFixed(0)}/100。`,
          `${account.nickname} currently holds about ${sharePct.toFixed(1)}% of the portfolio with an account-fit score near ${weightedFit.toFixed(0)}/100.`
        ),
        impactHints: buildImpactHints(
          language,
          (_amount, amountLabel) => weightedFit < 70
            ? pick(
              language,
              `如果下一笔 ${amountLabel} 资金改投到更适配 ${getAccountTypeLabel(account.type, language)} 的替代账户，最先改善的通常会是账户效率，其次才是集中度。`,
              `If the next ${amountLabel} is redirected away from ${getAccountTypeLabel(account.type, language)} into a better-fitting account, account efficiency should improve first, followed by concentration.`
            )
            : pick(
              language,
              `如果下一笔 ${amountLabel} 仍继续堆在 ${account.nickname}，更容易先拖累集中度；若分流出去，最先改善的是账户拥挤度。`,
              `If the next ${amountLabel} keeps landing in ${account.nickname}, concentration is the first thing likely to worsen; redirecting it elsewhere improves account crowding first.`
            )
        ),
        drivers: [
          pick(
            language,
            `账户类型：${getAccountTypeLabel(account.type, language)}；持仓数：${accountHoldings.length}。`,
            `Account type: ${getAccountTypeLabel(account.type, language)}; holdings: ${accountHoldings.length}.`
          ),
          topHoldingInAccount
            ? pick(
              language,
              `账户内最大仓位为 ${topHoldingInAccount.symbol}，占该账户约 ${topHoldingInAccount.weightPct.toFixed(1)}%。`,
              `Largest position in this account is ${topHoldingInAccount.symbol} at about ${topHoldingInAccount.weightPct.toFixed(1)}% of the account.`
            )
            : pick(language, "当前账户还没有足够持仓明细。", "This account does not yet have enough holding detail.")
        ],
        actions: [
          weightedFit < 70
            ? pick(
              language,
              "后续新增资金可优先转去更适配当前资产类型的账户，减少低效放置。",
              "Route new money toward accounts with a better fit for the current sleeves to reduce inefficient placement."
            )
            : pick(
              language,
              "当前账户放置大致合理，后续主要关注别把新资金进一步堆在单一账户里。",
              "Account placement is broadly fine; focus next on avoiding even more concentration inside one account."
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
    },
    dimensions,
    actionQueue,
    accountDrilldown: accountDrilldown.slice(0, 4),
    holdingDrilldown
  };
}
