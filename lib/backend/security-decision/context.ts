import type {
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
} from "@/lib/backend/models";
import type { AnalyzerSecurityIdentity } from "@/lib/backend/portfolio-analyzer-contracts";
import type {
  SecurityDecisionContext,
  SecurityDecisionMarketDataContext,
} from "@/lib/backend/security-decision/types";
import { evaluateSecurityGuardrails } from "@/lib/backend/security-decision/guardrails";
import { evaluateSecurityPortfolioFit } from "@/lib/backend/security-decision/portfolio-fit";
import {
  buildCandidateEconomicExposureNote,
  buildEconomicExposureNote,
  buildPreferenceFitNotes,
  formatPercent,
  getHoldingEconomicAssetClass,
  getMarketDataConfidenceScore,
  getSecurityDecisionVerdict,
  inferEconomicAssetClass,
  sum,
} from "@/lib/backend/security-decision/validators";

export function buildSecurityDecisionContext(args: {
  identity: AnalyzerSecurityIdentity;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  marketData?: SecurityDecisionMarketDataContext;
  generatedAt: string;
}): SecurityDecisionContext {
  const normalizedSymbol = args.identity.symbol.trim().toUpperCase();
  const matchingHoldings = args.holdings.filter((holding) => {
    const sameSymbol = holding.symbol.trim().toUpperCase() === normalizedSymbol;
    const sameExchange = !args.identity.exchange || holding.exchangeOverride === args.identity.exchange;
    const sameCurrency = !args.identity.currency || holding.currency === args.identity.currency;
    return sameSymbol && sameExchange && sameCurrency;
  });
  const totalPortfolioCad = sum(args.accounts.map((account) => account.marketValueCad));
  const heldValueCad = sum(matchingHoldings.map((holding) => holding.marketValueCad));
  const heldWeightPct = totalPortfolioCad > 0 ? (heldValueCad / totalPortfolioCad) * 100 : 0;
  const referenceHolding =
    matchingHoldings[0] ??
    args.holdings.find((holding) => holding.symbol.trim().toUpperCase() === normalizedSymbol);
  const economicAssetClass = referenceHolding
    ? getHoldingEconomicAssetClass(referenceHolding)
    : inferEconomicAssetClass({
        symbol: normalizedSymbol,
        name: args.identity.name,
        securityType: args.identity.securityType,
        currency: args.identity.currency,
        exchange: args.identity.exchange,
      });
  const targetPct =
    args.profile.targetAllocation.find((target) => target.assetClass === economicAssetClass)?.targetPct ?? 0;
  const currentSleevePct = totalPortfolioCad > 0
    ? (sum(
        args.holdings
          .filter((holding) => getHoldingEconomicAssetClass(holding) === economicAssetClass)
          .map((holding) => holding.marketValueCad),
      ) / totalPortfolioCad) * 100
    : 0;
  const accountTypes = [...new Set(matchingHoldings
    .map((holding) => args.accounts.find((account) => account.id === holding.accountId)?.type)
    .filter((type): type is InvestmentAccount["type"] => Boolean(type)))];
  const preferenceFit = buildPreferenceFitNotes({
    profile: args.profile,
    sector: referenceHolding?.sector ?? null,
    economicAssetClass,
    isHeld: matchingHoldings.length > 0,
  });
  const marketData = args.marketData ?? {};
  const priceHistory = marketData.priceHistory ?? [];
  const quoteProviders = [
    ...new Set(
      matchingHoldings
        .map((holding) => holding.quoteProvider)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const historyProviders = [
    ...new Set(
      priceHistory
        .map((point) => point.provider ?? point.source)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const fallbackPointCount = priceHistory.filter(
    (point) => point.freshness === "fallback" || point.isReference,
  ).length;
  const stalePointCount = priceHistory.filter(
    (point) => point.freshness === "stale",
  ).length;
  const freshHistoryPointCount = Math.max(
    0,
    priceHistory.length - fallbackPointCount - stalePointCount,
  );
  const hasEnoughMarketData = priceHistory.length >= 5;
  const marketDataConfidenceScore = getMarketDataConfidenceScore({
    quoteProviderCount: quoteProviders.length + historyProviders.length,
    freshHistoryPointCount,
    fallbackPointCount,
    stalePointCount,
  });
  const context: SecurityDecisionContext = {
    identity: {
      ...args.identity,
      symbol: normalizedSymbol,
    },
    accounts: args.accounts,
    holdings: args.holdings,
    profile: args.profile,
    marketData: args.marketData,
    generatedAt: args.generatedAt,
    normalizedSymbol,
    matchingHoldings,
    referenceHolding,
    economicAssetClass,
    targetPct,
    currentSleevePct,
    heldValueCad,
    heldWeightPct,
    accountTypes,
    preferenceFit,
    blockers: [],
    hasEnoughMarketData,
    marketDataConfidenceScore,
  };
  const guardrails = evaluateSecurityGuardrails(context);
  context.blockers = guardrails.guardrails
    .filter((item) => item.blocking || item.category === "preference-conflict" || item.category === "tax-account-mismatch")
    .map((item) => item.detail);

  return context;
}

export function buildSecurityDecisionNarrative(context: SecurityDecisionContext) {
  const gapPct = context.targetPct - context.currentSleevePct;
  const guardrailResult = evaluateSecurityGuardrails(context);
  const fit = evaluateSecurityPortfolioFit(context);
  const hasBlockingGates = guardrailResult.guardrails.length > 0;
  const dataBoundary = context.hasEnoughMarketData
    ? "缓存行情足够做第一层判断"
    : "行情样本偏少，结论应作为初筛而不是下单依据";

  const decision = (() => {
    if (context.targetPct <= 0) {
      return {
        gapPct,
        title: "当前判断",
        detail: `${context.normalizedSymbol} 暂时不应作为优先新增标的：你的偏好里没有为 ${context.economicAssetClass} 设置明确目标。${dataBoundary}。`,
      };
    }

    if (context.heldWeightPct >= 15) {
      return {
        gapPct,
        title: "当前判断",
        detail: `${context.normalizedSymbol} 已经是组合里的高权重标的，下一步更像是复核是否继续持有或控制集中度，而不是无条件加仓。${context.economicAssetClass} 当前约 ${formatPercent(context.currentSleevePct)}，目标约 ${formatPercent(context.targetPct)}。`,
      };
    }

    if (gapPct >= 5) {
      if (hasBlockingGates) {
        return {
          gapPct,
          title: "当前判断",
          detail: `${context.normalizedSymbol} 可以进入候选观察，但暂时不应只因为配置缺口就直接加仓。它会增加 ${context.economicAssetClass} 暴露，该类资产当前约 ${formatPercent(context.currentSleevePct)}、目标约 ${formatPercent(context.targetPct)}，仍有约 ${formatPercent(gapPct)} 缺口；${dataBoundary}。`,
        };
      }
      return {
        gapPct,
        title: "当前判断",
        detail: `${context.normalizedSymbol} 可以进入候选观察：它会增加 ${context.economicAssetClass} 暴露，而这一类资产当前约 ${formatPercent(context.currentSleevePct)}、目标约 ${formatPercent(context.targetPct)}，仍有约 ${formatPercent(gapPct)} 缺口。${dataBoundary}。`,
      };
    }

    if (gapPct <= -5) {
      return {
        gapPct,
        title: "当前判断",
        detail: `${context.normalizedSymbol} 更适合先观察而不是优先买入：${context.economicAssetClass} 当前约 ${formatPercent(context.currentSleevePct)}，已经高于目标约 ${formatPercent(context.targetPct)}。如果要买，应优先解释它和现有持仓的差异，而不是只看单个标的。`,
      };
    }

    return {
      gapPct,
      title: "当前判断",
      detail: `${context.normalizedSymbol} 属于可继续观察的中性候选：${context.economicAssetClass} 当前约 ${formatPercent(context.currentSleevePct)}，接近目标约 ${formatPercent(context.targetPct)}。是否买入主要取决于估值、与现有持仓重复度、账户位置和现金计划。`,
    };
  })();

  const verdict = getSecurityDecisionVerdict({
    targetPct: context.targetPct,
    gapPct,
    heldWeightPct: context.heldWeightPct,
    hasBlockers: context.blockers.length > 0,
    hasEnoughMarketData: context.hasEnoughMarketData,
  });

  const summaryLabel =
    verdict === "good-candidate"
      ? "可以进入候选观察"
      : verdict === "review-existing"
        ? "更适合持仓复核"
        : verdict === "weak-fit"
          ? "适配偏弱，适合先观察"
          : verdict === "needs-more-data"
            ? context.blockers.length > 0
              ? "可以进入候选观察，但暂时不应只因为配置缺口就直接加仓"
              : "需补充数据后再判断"
            : "适合先观察";

  const portfolioFit = [
    `配置关系：${context.economicAssetClass} 当前约 ${formatPercent(context.currentSleevePct)}，目标约 ${formatPercent(context.targetPct)}，差距 ${formatPercent(gapPct)}。`,
    context.preferenceFit.summary,
    context.referenceHolding
      ? buildEconomicExposureNote({
          holding: context.referenceHolding,
          economicAssetClass: context.economicAssetClass,
          symbol: context.normalizedSymbol,
          exchange: context.identity.exchange,
          currency: context.identity.currency,
        })
      : buildCandidateEconomicExposureNote({
          symbol: context.normalizedSymbol,
          exchange: context.identity.exchange,
          currency: context.identity.currency,
          economicAssetClass: context.economicAssetClass,
        }),
    context.accountTypes.length > 0
      ? `当前匹配持仓分布在 ${context.accountTypes.join(" / ")}。`
      : "当前没有匹配到账户内真实持仓；如要买入，应结合账户属性、税务口径和现金安排选择落点。",
    "分析身份保留 symbol、exchange、currency，避免 CAD 版本和美股正股混淆。",
  ];

  return {
    decision,
    verdict,
    summaryLabel,
    portfolioFit,
    guardrails: guardrailResult.guardrails,
    blocked: guardrailResult.blocked,
    fit,
  };
}
