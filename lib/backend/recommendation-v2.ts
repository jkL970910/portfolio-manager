import {
  AccountType,
  CurrencyCode,
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
  RecommendationRun
} from "@/lib/backend/models";
import { getAssetClassLabel, getAccountTypeLabel, getRiskProfileLabel } from "@/lib/i18n/finance";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

const DEFAULT_TARGETS_BY_RISK = {
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
} as const;

type SecurityCandidate = {
  symbol: string;
  name: string;
  assetClass: string;
  currency: CurrencyCode;
  expenseBps: number;
  liquidityScore: number;
  tags: string[];
};

type FxPolicy = {
  hasUsdFundingPath: boolean;
  brokerFxFrictionBps: number;
  allowCrossCurrencyTrades: boolean;
  preferredTradingCurrency: "CAD" | "USD" | "mixed";
};

type AccountScore = {
  account: InvestmentAccount;
  accountFitScore: number;
  taxFitScore: number;
  fxPenaltyBps: number;
};

const SECURITY_UNIVERSE: Record<string, SecurityCandidate[]> = {
  "Canadian Equity": [
    { symbol: "VCN", name: "Vanguard FTSE Canada All Cap Index ETF", assetClass: "Canadian Equity", currency: "CAD", expenseBps: 6, liquidityScore: 94, tags: ["broad-market"] },
    { symbol: "XIC", name: "iShares Core S&P/TSX Capped Composite ETF", assetClass: "Canadian Equity", currency: "CAD", expenseBps: 6, liquidityScore: 95, tags: ["broad-market"] },
    { symbol: "ZCN", name: "BMO S&P/TSX Capped Composite Index ETF", assetClass: "Canadian Equity", currency: "CAD", expenseBps: 6, liquidityScore: 90, tags: ["broad-market"] }
  ],
  "US Equity": [
    { symbol: "VFV", name: "Vanguard S&P 500 Index ETF", assetClass: "US Equity", currency: "CAD", expenseBps: 9, liquidityScore: 97, tags: ["cad-listed", "core"] },
    { symbol: "XUU", name: "iShares Core S&P U.S. Total Market Index ETF", assetClass: "US Equity", currency: "CAD", expenseBps: 7, liquidityScore: 92, tags: ["cad-listed", "core"] },
    { symbol: "VTI", name: "Vanguard Total Stock Market ETF", assetClass: "US Equity", currency: "USD", expenseBps: 3, liquidityScore: 99, tags: ["usd-listed", "core"] }
  ],
  "International Equity": [
    { symbol: "XEF", name: "iShares Core MSCI EAFE IMI Index ETF", assetClass: "International Equity", currency: "CAD", expenseBps: 22, liquidityScore: 90, tags: ["developed"] },
    { symbol: "VIU", name: "Vanguard FTSE Developed All Cap ex North America Index ETF", assetClass: "International Equity", currency: "CAD", expenseBps: 23, liquidityScore: 88, tags: ["developed"] },
    { symbol: "XAW", name: "iShares Core MSCI All Country World ex Canada Index ETF", assetClass: "International Equity", currency: "CAD", expenseBps: 22, liquidityScore: 91, tags: ["all-world"] }
  ],
  "Fixed Income": [
    { symbol: "XBB", name: "iShares Core Canadian Universe Bond Index ETF", assetClass: "Fixed Income", currency: "CAD", expenseBps: 9, liquidityScore: 95, tags: ["core-bonds"] },
    { symbol: "ZAG", name: "BMO Aggregate Bond Index ETF", assetClass: "Fixed Income", currency: "CAD", expenseBps: 9, liquidityScore: 92, tags: ["core-bonds"] },
    { symbol: "VAB", name: "Vanguard Canadian Aggregate Bond Index ETF", assetClass: "Fixed Income", currency: "CAD", expenseBps: 8, liquidityScore: 89, tags: ["core-bonds"] }
  ],
  Cash: [
    { symbol: "CASH", name: "Global X High Interest Savings ETF", assetClass: "Cash", currency: "CAD", expenseBps: 11, liquidityScore: 96, tags: ["cash-parking"] },
    { symbol: "PSA", name: "Purpose High Interest Savings ETF", assetClass: "Cash", currency: "CAD", expenseBps: 15, liquidityScore: 92, tags: ["cash-parking"] },
    { symbol: "HSAV", name: "Horizons Cash Maximizer ETF", assetClass: "Cash", currency: "CAD", expenseBps: 18, liquidityScore: 88, tags: ["cash-parking"] }
  ]
};

const ACCOUNT_FIT_MATRIX: Record<string, Record<AccountType, number>> = {
  "Canadian Equity": { TFSA: 0.9, RRSP: 0.82, FHSA: 0.9, Taxable: 0.78 },
  "US Equity": { TFSA: 0.74, RRSP: 0.95, FHSA: 0.78, Taxable: 0.68 },
  "International Equity": { TFSA: 0.72, RRSP: 0.86, FHSA: 0.74, Taxable: 0.5 },
  "Fixed Income": { TFSA: 0.66, RRSP: 0.95, FHSA: 0.78, Taxable: 0.24 },
  Cash: { TFSA: 0.78, RRSP: 0.56, FHSA: 0.9, Taxable: 0.72 }
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTargetAllocation(profile: PreferenceProfile) {
  return profile.targetAllocation.length > 0
    ? profile.targetAllocation
    : DEFAULT_TARGETS_BY_RISK[profile.riskProfile];
}

function getCurrentAllocationFromHoldings(holdings: HoldingPosition[]) {
  const total = holdings.reduce((sum, holding) => sum + holding.marketValueCad, 0);
  const allocation = new Map<string, number>();
  if (total <= 0) {
    return { total, allocation };
  }

  for (const holding of holdings) {
    allocation.set(holding.assetClass, (allocation.get(holding.assetClass) ?? 0) + holding.marketValueCad);
  }

  return {
    total,
    allocation: new Map(
      [...allocation.entries()].map(([assetClass, value]) => [assetClass, round((value / total) * 100, 2)])
    )
  };
}

const ASSET_CLASS_RISK_WEIGHTS: Record<string, number> = {
  "Canadian Equity": 1,
  "US Equity": 1.12,
  "International Equity": 1.08,
  "Fixed Income": 0.42,
  Cash: 0.08
};

function inferFxPolicy(accounts: InvestmentAccount[], holdings: HoldingPosition[]): FxPolicy {
  const hasUsdAccount = accounts.some((account) => (account.currency ?? "CAD") === "USD");
  const hasUsdHoldings = holdings.some((holding) => (holding.currency ?? "CAD") === "USD");

  return {
    hasUsdFundingPath: hasUsdAccount,
    brokerFxFrictionBps: hasUsdAccount ? 25 : 150,
    allowCrossCurrencyTrades: true,
    preferredTradingCurrency: hasUsdAccount || hasUsdHoldings ? "mixed" : "CAD"
  };
}

function scoreAccountPlacement(
  accounts: InvestmentAccount[],
  profile: PreferenceProfile,
  assetClass: string,
  securityCurrency: CurrencyCode,
  fxPolicy: FxPolicy
): AccountScore {
  const orderedAccounts = [...accounts].sort((left, right) => {
    const leftRank = profile.accountFundingPriority.indexOf(left.type);
    const rightRank = profile.accountFundingPriority.indexOf(right.type);
    return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
  });

  const scores = orderedAccounts.map((account) => {
    const baseScore = ACCOUNT_FIT_MATRIX[assetClass]?.[account.type] ?? 0.45;
    const roomPenalty = account.type !== "Taxable" && (account.contributionRoomCad ?? 0) <= 0 ? 0.28 : 0;
    const priorityBoost = Math.max(0, 0.08 - Math.max(profile.accountFundingPriority.indexOf(account.type), 0) * 0.02);
    const taxBoost = profile.taxAwarePlacement ? 0.04 : 0;
    const accountCurrency = account.currency ?? "CAD";
    const rawFxPenalty = accountCurrency === securityCurrency
      ? 0
      : fxPolicy.allowCrossCurrencyTrades
        ? fxPolicy.brokerFxFrictionBps
        : fxPolicy.brokerFxFrictionBps + 150;
    const fxPenalty = round(rawFxPenalty / 10000, 4);
    const accountFitScore = clamp(baseScore + priorityBoost + taxBoost - roomPenalty - fxPenalty, 0.05, 0.99);
    return {
      account,
      accountFitScore,
      taxFitScore: clamp(baseScore + (profile.taxAwarePlacement ? 0.06 : 0), 0.05, 0.99),
      fxPenaltyBps: rawFxPenalty
    };
  });

  return scores.sort((left, right) => right.accountFitScore - left.accountFitScore)[0] ?? {
    account: accounts[0] ?? { id: "", userId: "", institution: "", type: "Taxable", nickname: "", marketValueCad: 0, contributionRoomCad: null },
    accountFitScore: 0.4,
    taxFitScore: 0.4,
    fxPenaltyBps: fxPolicy.brokerFxFrictionBps
  };
}

function scoreSecurityCandidate(
  candidate: SecurityCandidate,
  assetClass: string,
  selectedAccount: InvestmentAccount,
  holdings: HoldingPosition[],
  profile: PreferenceProfile,
  fxPolicy: FxPolicy
) {
  const watchlistBoost = profile.watchlistSymbols.includes(candidate.symbol) ? 0.14 : 0;
  const expensePenalty = clamp(candidate.expenseBps / 200, 0, 0.18);
  const liquidityBoost = candidate.liquidityScore / 1000;
  const currencyPenalty = (selectedAccount.currency ?? "CAD") === candidate.currency
    ? 0
    : fxPolicy.brokerFxFrictionBps / 1000;
  const existingHolding = holdings.find((holding) => holding.symbol === candidate.symbol);
  const concentrationPenalty = existingHolding && existingHolding.weightPct >= 12 ? 0.1 : 0;
  const exposureMatch = candidate.assetClass === assetClass ? 0.62 : 0.4;

  const score = clamp(exposureMatch + watchlistBoost + liquidityBoost - expensePenalty - (currencyPenalty / 10) - concentrationPenalty, 0.05, 0.99);
  return {
    candidate,
    score: round(score * 100, 1),
    fxPenaltyBps: (selectedAccount.currency ?? "CAD") === candidate.currency ? 0 : fxPolicy.brokerFxFrictionBps
  };
}

function buildSecurityUniverse(assetClass: string) {
  return SECURITY_UNIVERSE[assetClass] ?? [
    { symbol: "VCN", name: "Fallback Core ETF", assetClass, currency: "CAD", expenseBps: 12, liquidityScore: 75, tags: ["fallback"] }
  ];
}

function buildRunNotes(profile: PreferenceProfile, fxPolicy: FxPolicy, language: DisplayLanguage) {
  return [
    pick(
      language,
      `当前 run 以 ${getRiskProfileLabel(profile.riskProfile, language)} 风险档位为起点，优先补足最明显的配置缺口。`,
      `This run uses the ${profile.riskProfile.toLowerCase()} target allocation and prioritizes the widest portfolio gaps.`
    ),
    pick(
      language,
      `账户放置遵循 ${profile.accountFundingPriority.map((type) => getAccountTypeLabel(type, language)).join(" -> ")}，并结合账户匹配与税务感知评分。`,
      `Account placement follows ${profile.accountFundingPriority.map((type) => getAccountTypeLabel(type, language)).join(" -> ")} with tax-aware scoring.`
    ),
    fxPolicy.hasUsdFundingPath
      ? pick(language, "已检测到 USD 入金路径，因此跨币种方案只会受到较轻的 FX 惩罚。", "A USD funding path is available, so cross-currency ideas carry only a light FX penalty.")
      : pick(language, "未检测到 USD 入金路径，因此跨币种方案会承担更高的 FX 摩擦惩罚。", "No USD funding path was detected, so cross-currency ideas carry a higher FX friction penalty.")
  ];
}

export function buildRecommendationV2(args: {
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  contributionAmountCad: number;
  language: DisplayLanguage;
}): Pick<RecommendationRun, "assumptions" | "items" | "notes" | "engineVersion" | "objective" | "confidenceScore"> {
  const { accounts, holdings, profile, contributionAmountCad, language } = args;
  const { total, allocation } = getCurrentAllocationFromHoldings(holdings);
  const targetAllocation = getTargetAllocation(profile);
  const fxPolicy = inferFxPolicy(accounts, holdings);
  const holdingRiskContributionRaw = holdings.map((holding) => ({
    holding,
    weightedRisk: holding.weightPct * (ASSET_CLASS_RISK_WEIGHTS[holding.assetClass] ?? 1)
  }));
  const totalHoldingWeightedRisk = holdingRiskContributionRaw.reduce((sum, item) => sum + item.weightedRisk, 0) || 1;
  const holdingRiskContribution = new Map(
    holdingRiskContributionRaw.map((item) => [
      item.holding.symbol.toUpperCase(),
      round((item.weightedRisk / totalHoldingWeightedRisk) * 100, 1)
    ])
  );

  const targetGaps = targetAllocation
    .map((target) => {
      const currentPct = allocation.get(target.assetClass) ?? 0;
      const gapPct = Math.max(0, round(target.targetPct - currentPct, 2));
      return {
        assetClass: target.assetClass,
        currentPct,
        targetPct: target.targetPct,
        gapPct
      };
    })
    .filter((target) => target.gapPct > 0)
    .sort((left, right) => right.gapPct - left.gapPct);

  const priorities = (targetGaps.length > 0 ? targetGaps : targetAllocation
    .slice()
    .sort((left, right) => right.targetPct - left.targetPct)
    .map((target) => ({
      assetClass: target.assetClass,
      currentPct: allocation.get(target.assetClass) ?? 0,
      targetPct: target.targetPct,
      gapPct: target.targetPct
    })))
    .slice(0, 3);

  const totalGap = priorities.reduce((sum, item) => sum + item.gapPct, 0) || 1;
  let allocatedSoFar = 0;
  const items: RecommendationRun["items"] = priorities.map((priority, index) => {
    const share = priority.gapPct / totalGap;
    const rawAmount = index === priorities.length - 1
      ? Math.max(0, contributionAmountCad - allocatedSoFar)
      : Math.max(0, Math.round((contributionAmountCad * share) / 100) * 100);
    allocatedSoFar += rawAmount;

    const candidates = buildSecurityUniverse(priority.assetClass);
    const accountPlacements = candidates.map((candidate) => {
      const placement = scoreAccountPlacement(accounts, profile, priority.assetClass, candidate.currency, fxPolicy);
      const security = scoreSecurityCandidate(candidate, priority.assetClass, placement.account, holdings, profile, fxPolicy);
      return {
        placement,
        security,
        combined: round(placement.accountFitScore * 55 + (security.score / 100) * 45, 2)
      };
    }).sort((left, right) => right.combined - left.combined);

    const best = accountPlacements[0];
    const topTickers = accountPlacements.slice(0, 3).map((entry) => entry.security.candidate.symbol);
    const projectedValue = total + contributionAmountCad;
    const currentAssetValue = (allocation.get(priority.assetClass) ?? 0) / 100 * total;
    const postTradeGapPct = projectedValue > 0
      ? round(priority.targetPct - (((currentAssetValue + rawAmount) / projectedValue) * 100), 2)
      : 0;
    const existingHolding = holdings
      .filter((holding) => holding.assetClass === priority.assetClass)
      .sort((left, right) => right.weightPct - left.weightPct)[0];
    return {
      assetClass: priority.assetClass,
      amountCad: rawAmount,
      targetAccountType: best.placement.account.type,
      tickerOptions: topTickers,
      explanation: pick(
        language,
        `${getAssetClassLabel(priority.assetClass, language)} 仍然落后于目标配置，因此把 ${rawAmount.toLocaleString("en-CA")} CAD 优先放进 ${getAccountTypeLabel(best.placement.account.type, language)}，并由 ${best.security.candidate.symbol} 作为主表达标的。`,
        `${getAssetClassLabel(priority.assetClass, language)} remains under target, so ${rawAmount.toLocaleString("en-CA")} CAD is routed into ${getAccountTypeLabel(best.placement.account.type, language)}, led by ${best.security.candidate.symbol}.`
      ),
      securitySymbol: best.security.candidate.symbol,
      securityName: best.security.candidate.name,
      securityScore: best.security.score,
      allocationGapBeforePct: priority.gapPct,
      allocationGapAfterPct: Math.max(0, postTradeGapPct),
      accountFitScore: round(best.placement.accountFitScore * 100, 1),
      taxFitScore: round(best.placement.taxFitScore * 100, 1),
      fxFrictionPenaltyBps: best.security.fxPenaltyBps,
      rationale: {
        assetClass: priority.assetClass,
        targetPct: priority.targetPct,
        currentPct: priority.currentPct,
        gapBeforePct: priority.gapPct,
        gapAfterPct: Math.max(0, postTradeGapPct),
        selectedAccountType: best.placement.account.type,
        selectedSecurity: best.security.candidate.symbol,
        selectedSecurityName: best.security.candidate.name,
        accountFitScore: round(best.placement.accountFitScore * 100, 1),
        taxFitScore: round(best.placement.taxFitScore * 100, 1),
        securityScore: best.security.score,
        fxPolicy: fxPolicy.hasUsdFundingPath ? "usd-funded" : "retail-fx",
        fxPenaltyBps: best.security.fxPenaltyBps,
        minTradeApplied: rawAmount < 500,
        watchlistMatched: profile.watchlistSymbols.includes(best.security.candidate.symbol),
        existingHoldingSymbol: existingHolding?.symbol,
        existingHoldingWeightPct: existingHolding?.weightPct,
        existingHoldingRiskContributionPct: existingHolding ? holdingRiskContribution.get(existingHolding.symbol.toUpperCase()) ?? undefined : undefined
      }
    };
  });

  const confidenceScore = round(
    items.reduce((sum, item) => sum + (((item.accountFitScore ?? 0) + (item.securityScore ?? 0)) / 2), 0) / Math.max(items.length, 1),
    1
  );

  return {
    engineVersion: "v2",
    objective: "target-tracking",
    confidenceScore,
    assumptions: buildRunNotes(profile, fxPolicy, language),
    notes: [
      pick(language, "这一版只帮你安排新增的钱，不会主动建议你先卖出旧持仓。", "This version only plans new money and does not ask you to sell old holdings first."),
      pick(language, "账户匹配和税务放置现在还是规则型判断，后面还能继续变得更细。", "Account fit and tax placement are still rule-based and can get more detailed later."),
      fxPolicy.hasUsdFundingPath
        ? pick(language, "因为你有 USD 入金路径，系统不会自动回避美股，只会轻度考虑换汇成本。", "Because a USD funding path is available, the engine does not automatically avoid USD securities.")
        : pick(language, "因为系统没看到稳定的 USD 入金路径，美股方案会更容易被换汇成本压低。", "Because no stable USD funding path was detected, USD ideas are pushed down more by FX drag.")
    ],
    items
  };
}

export function getAccountPlacementMatrix() {
  return ACCOUNT_FIT_MATRIX;
}

