import {
  AccountType,
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
  PortfolioSnapshot,
  RecommendationRun,
  SecurityPriceHistoryPoint
} from "@/lib/backend/models";
import { buildPortfolioHealthSummary } from "@/lib/backend/portfolio-health";
import {
  AnalyzerSecurityIdentity,
  PORTFOLIO_ANALYZER_DISCLAIMER,
  PORTFOLIO_ANALYZER_VERSION,
  PortfolioAnalyzerResult,
  portfolioAnalyzerResultSchema
} from "@/lib/backend/portfolio-analyzer-contracts";
import {
  buildSecurityDecisionContext,
  buildSecurityDecisionNarrative,
} from "@/lib/backend/security-decision/context";
import {
  getHoldingEconomicAssetClass,
  inferEconomicAssetClass,
} from "@/lib/backend/security-economic-exposure";

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function latestIso(values: Array<string | null | undefined>, fallback: string) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? fallback;
}

function asIsoDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value.includes("T") ? value : `${value}T00:00:00.000Z`;
}

function latestIsoOrNull(values: Array<string | null | undefined>) {
  return values
    .map(asIsoDateTime)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function assertAnalyzerResult(result: PortfolioAnalyzerResult): PortfolioAnalyzerResult {
  return portfolioAnalyzerResultSchema.parse(result);
}

function getHoldingIdentity(holding: HoldingPosition): AnalyzerSecurityIdentity {
  return {
    securityId: holding.securityId ?? null,
    symbol: holding.symbol,
    exchange: holding.exchangeOverride ?? null,
    currency: holding.currency ?? null,
    name: holding.name,
    securityType: holding.securityTypeOverride ?? null
  };
}

function getHoldingAccount(holding: HoldingPosition | null | undefined, accounts: InvestmentAccount[]) {
  return holding ? accounts.find((account) => account.id === holding.accountId) : undefined;
}

function buildEconomicExposureNote(args: {
  holding: HoldingPosition;
  economicAssetClass: string;
  identity: AnalyzerSecurityIdentity;
}) {
  const listing = [
    args.identity.symbol,
    args.identity.exchange,
    args.identity.currency,
  ]
    .filter(Boolean)
    .join(" · ");
  if (args.economicAssetClass === args.holding.assetClass) {
    return `经济暴露按 ${args.economicAssetClass} 评估，交易身份仍保留 ${listing}。`;
  }

  return `交易身份仍保留 ${listing}，但配置/目标适配按底层经济暴露 ${args.economicAssetClass} 评估，而不是按 ${args.holding.assetClass} 或交易币种简单归类。`;
}

function buildCandidateEconomicExposureNote(args: {
  identity: AnalyzerSecurityIdentity;
  economicAssetClass: string;
}) {
  const listing = [
    args.identity.symbol,
    args.identity.exchange,
    args.identity.currency,
  ]
    .filter(Boolean)
    .join(" · ");
  return `这是候选标的口径：交易身份保留 ${listing}，组合适配按底层经济暴露 ${args.economicAssetClass} 评估；当前 0% 只代表尚未持有，不代表无法分析。`;
}

function hasCompleteAnalyzerIdentity(identity: AnalyzerSecurityIdentity) {
  return Boolean(
    identity.symbol.trim() &&
      identity.exchange?.trim() &&
      identity.currency?.trim(),
  );
}

function getTaxNotes(args: {
  holdings: HoldingPosition[];
  accounts: InvestmentAccount[];
}) {
  const notes: string[] = [];
  for (const holding of args.holdings) {
    const account = getHoldingAccount(holding, args.accounts);
    if (!account) {
      continue;
    }
    if (holding.currency === "USD" && account.type === "TFSA") {
      notes.push(`${holding.symbol} 是 USD 标的且放在 TFSA，后续智能分析需要提示美股股息预扣税无法在 TFSA 回收。`);
    }
    if (holding.currency === "USD" && account.type === "RRSP") {
      notes.push(`${holding.symbol} 是 USD 标的且放在 RRSP，后续分析应确认是否属于可享受税务协定优势的直接美股/ETF。`);
    }
  }
  return [...new Set(notes)].slice(0, 8);
}

function getQuoteFreshness(holdings: HoldingPosition[], generatedAt: string) {
  return latestIso(
    holdings.map(
      (holding) =>
        holding.lastQuoteSuccessAt ??
        holding.quoteProviderTimestamp ??
        holding.updatedAt,
    ),
    generatedAt,
  );
}

export interface AnalyzerMarketDataContext {
  priceHistory?: SecurityPriceHistoryPoint[];
  portfolioSnapshots?: PortfolioSnapshot[];
}

function normalizeIdentityPart(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

function filterHistoryForIdentity(
  priceHistory: SecurityPriceHistoryPoint[],
  identity: AnalyzerSecurityIdentity,
) {
  if (identity.securityId) {
    return priceHistory.filter((point) => point.securityId === identity.securityId);
  }

  const symbol = normalizeIdentityPart(identity.symbol);
  const exchange = normalizeIdentityPart(identity.exchange);
  const currency = normalizeIdentityPart(identity.currency);
  return priceHistory.filter((point) => {
    const pointSymbol = normalizeIdentityPart(point.symbol);
    const pointExchange = normalizeIdentityPart(point.exchange);
    const pointCurrency = normalizeIdentityPart(point.currency);
    return (
      pointSymbol === symbol &&
      (!exchange || pointExchange === exchange) &&
      (!currency || pointCurrency === currency)
    );
  });
}

function buildMarketDataSummary(args: {
  holdings: HoldingPosition[];
  priceHistory?: SecurityPriceHistoryPoint[];
  portfolioSnapshots?: PortfolioSnapshot[];
  generatedAt: string;
}) {
  const priceHistory = args.priceHistory ?? [];
  const snapshots = args.portfolioSnapshots ?? [];
  const quoteProviders = [
    ...new Set(
      args.holdings
        .map((holding) => holding.quoteProvider)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const quoteStatuses = [
    ...new Set(
      args.holdings
        .map((holding) => holding.quoteStatus)
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
  const latestHistoryAsOf = latestIsoOrNull(
    priceHistory.map((point) => point.priceDate),
  );
  const latestHoldingQuoteAsOf = latestIsoOrNull(
    args.holdings.map(
      (holding) =>
        holding.lastQuoteSuccessAt ??
        holding.quoteProviderTimestamp ??
        holding.updatedAt,
    ),
  );
  const latestSnapshot = [...snapshots].sort((left, right) =>
    right.snapshotDate.localeCompare(left.snapshotDate),
  )[0];
  const quotesAsOf =
    latestHoldingQuoteAsOf ??
    latestHistoryAsOf ??
    asIsoDateTime(latestSnapshot?.snapshotDate) ??
    null;
  const hasCachedMarketData =
    quoteProviders.length > 0 ||
    historyProviders.length > 0 ||
    snapshots.some((snapshot) => snapshot.sourceMode === "cached-external");
  const formatProviders = (providers: string[]) =>
    providers
      .slice(0, 3)
      .map((provider) =>
        provider
          .split(/[-_\s]+/)
          .filter(Boolean)
          .map((part) =>
            part.length <= 3
              ? part.toUpperCase()
              : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`,
          )
          .join(" "),
      )
      .join("、");
  const quoteStatusLabel = quoteStatuses.some((status) =>
    ["success", "fresh"].includes(status),
  )
    ? "报价较新"
    : quoteStatuses.length > 0
      ? "报价需要确认"
      : null;
  const quoteSourceSummary =
    quoteProviders.length > 0 || historyProviders.length > 0
      ? [
          quoteProviders.length > 0
            ? `报价来自 ${formatProviders(quoteProviders)}`
            : null,
          historyProviders.length > 0
            ? `历史价格来自 ${formatProviders(historyProviders)}`
            : null,
        ]
          .filter(Boolean)
          .join("；")
      : null;
  const quoteFreshnessSummary = [
    quoteStatusLabel,
    latestHistoryAsOf ? `历史价格截至 ${latestHistoryAsOf.slice(0, 10)}` : null,
    priceHistory.length > 0 ? `历史样本 ${priceHistory.length} 个交易日` : null,
    fallbackPointCount > 0 ? `其中 ${fallbackPointCount} 个为参考/兜底点` : null,
    stalePointCount > 0 ? `其中 ${stalePointCount} 个可能过期` : null,
  ]
    .filter(Boolean)
    .join("；");

  return {
    sourceMode: hasCachedMarketData ? "cached-external" as const : "local" as const,
    quotesAsOf,
    quoteSourceSummary,
    quoteFreshnessSummary: quoteFreshnessSummary || null,
    priceHistoryPointCount: priceHistory.length,
    freshHistoryPointCount,
    fallbackPointCount,
    stalePointCount,
    quoteProviderCount: quoteProviders.length,
    latestSnapshot,
    sources: [
      ...(quoteProviders.length > 0
        ? [
            {
              title: `缓存持仓报价：${formatProviders(quoteProviders)}`,
              sourceType: "quote-cache" as const,
              date: latestHoldingQuoteAsOf?.slice(0, 10),
            },
          ]
        : []),
      ...(historyProviders.length > 0
        ? [
            {
              title: `缓存价格历史：${formatProviders(historyProviders)}`,
              sourceType: "market-data" as const,
              date: latestHistoryAsOf?.slice(0, 10),
            },
          ]
        : []),
      ...(latestSnapshot
        ? [
            {
              title: `组合快照：${latestSnapshot.sourceMode ?? latestSnapshot.sourceVersion}`,
              sourceType: "portfolio-data" as const,
              date: latestSnapshot.snapshotDate,
            },
          ]
        : []),
    ],
    warnings: [
      ...(priceHistory.length === 0
        ? ["没有匹配的缓存价格历史；分析不能把走势图当作实时市场结论。"]
        : []),
      ...(priceHistory.length > 0 && priceHistory.length < 5
        ? ["缓存里只有最近报价或少量历史点；可以用于确认当前报价，但还不能支撑趋势判断。"]
        : []),
      ...(fallbackPointCount > 0
        ? [`价格历史含 ${fallbackPointCount} 个参考/兜底点，AI 只能低置信使用。`]
        : []),
      ...(stalePointCount > 0
        ? [`价格历史含 ${stalePointCount} 个 stale 点，需要刷新后再提高置信度。`]
        : []),
      ...(quoteProviders.length === 0 && historyProviders.length === 0
        ? ["持仓行没有可审计 quote provider；分析只能使用本地持仓字段。"]
        : []),
    ],
  };
}

function getMarketDataConfidenceScore(marketData: ReturnType<typeof buildMarketDataSummary>) {
  const hasAnyRealMarketData =
    marketData.quoteProviderCount > 0 || marketData.freshHistoryPointCount > 0;
  if (!hasAnyRealMarketData) {
    return 45;
  }

  const baseScore = marketData.freshHistoryPointCount >= 5 ? 70 : 62;
  const historyDepthBonus = Math.min(marketData.freshHistoryPointCount, 25);
  const providerBonus = marketData.quoteProviderCount > 0 ? 8 : 0;
  const penalty =
    marketData.fallbackPointCount * 8 + marketData.stalePointCount * 4;

  return Math.max(
    35,
    Math.min(90, baseScore + historyDepthBonus + providerBonus - penalty),
  );
}

function getAnalyzerFreshnessLabel(marketData: ReturnType<typeof buildMarketDataSummary>) {
  if (marketData.sourceMode === "local") {
    return "仅本地资料";
  }
  if (marketData.fallbackPointCount > 0 || marketData.stalePointCount > 0) {
    return "缓存资料需复核";
  }
  if (marketData.freshHistoryPointCount >= 20) {
    return "缓存行情较完整";
  }
  if (marketData.freshHistoryPointCount >= 5 || marketData.quoteProviderCount > 0) {
    return "缓存行情可初筛";
  }
  return "资料有限";
}

function getAnalyzerReliabilityScore(marketData: ReturnType<typeof buildMarketDataSummary>) {
  return getMarketDataConfidenceScore(marketData);
}

function getAnalyzerLimitationSummary(marketData: ReturnType<typeof buildMarketDataSummary>) {
  const limits = [
    marketData.sourceMode === "local"
      ? "没有可审计外部行情来源"
      : null,
    marketData.priceHistoryPointCount < 5
      ? "价格历史样本不足，不能支撑趋势判断"
      : null,
    marketData.fallbackPointCount > 0
      ? `包含 ${marketData.fallbackPointCount} 个参考/兜底价格点`
      : null,
    marketData.stalePointCount > 0
      ? `包含 ${marketData.stalePointCount} 个可能过期价格点`
      : null,
  ].filter((item): item is string => Boolean(item));
  return limits.length > 0 ? limits.join("；") : "资料足够做第一层快扫，但仍不构成投资建议";
}

function buildAnalyzerEvidenceTrail(args: {
  scope: PortfolioAnalyzerResult["scope"];
  portfolioAsOf: string;
  marketData: ReturnType<typeof buildMarketDataSummary>;
  generatedAt: string;
}) {
  const reliabilityScore = getAnalyzerReliabilityScore(args.marketData);
  const confidence = reliabilityScore >= 75
    ? "high" as const
    : reliabilityScore >= 58
      ? "medium" as const
      : "low" as const;
  const freshness = args.marketData.sourceMode === "local"
    ? "missing" as const
    : args.marketData.fallbackPointCount > 0 || args.marketData.stalePointCount > 0
      ? "partial" as const
      : args.marketData.priceHistoryPointCount >= 5
        ? "fresh" as const
        : "partial" as const;

  return [
    {
      id: "portfolio-data",
      label: args.scope === "account" ? "账户/持仓资料" : "组合/持仓资料",
      sourceType: "portfolio-data" as const,
      sourceMode: "local" as const,
      confidence: "high" as const,
      freshness: "fresh" as const,
      asOf: args.portfolioAsOf,
      detail: "来自项目内已保存的账户、持仓、偏好和组合配置。",
    },
    {
      id: "market-data",
      label: "行情与历史价格",
      sourceType: args.marketData.sourceMode === "local" ? "quote-cache" as const : "market-data" as const,
      sourceMode: args.marketData.sourceMode,
      confidence,
      freshness,
      asOf: args.marketData.quotesAsOf,
      detail: [
        args.marketData.quoteSourceSummary ?? "没有可审计行情 provider。",
        args.marketData.quoteFreshnessSummary ?? "行情新鲜度未完整记录。",
        getAnalyzerLimitationSummary(args.marketData),
      ].join(" "),
    },
    {
      id: "rule-engine",
      label: "Loo国规则引擎",
      sourceType: "derived" as const,
      sourceMode: "derived" as const,
      confidence: "medium" as const,
      freshness: "fresh" as const,
      asOf: args.generatedAt,
      detail: "由确定性规则综合持仓、目标配置、偏好、账户/税务/FX 和行情可信度生成；GPT 只能解释，不能覆盖护栏。",
    },
  ];
}

function formatPercent(value: number, digits = 1) {
  return `${round(value, digits)}%`;
}

function getEconomicSleeveWeightPct(args: {
  holdings: HoldingPosition[];
  accounts: InvestmentAccount[];
  economicAssetClass: string;
}) {
  const totalPortfolioCad = sum(args.accounts.map((account) => account.marketValueCad));
  if (totalPortfolioCad <= 0) {
    return 0;
  }

  const sleeveValueCad = sum(
    args.holdings
      .filter((holding) => getHoldingEconomicAssetClass(holding) === args.economicAssetClass)
      .map((holding) => holding.marketValueCad),
  );

  return (sleeveValueCad / totalPortfolioCad) * 100;
}

function getDecisionConfidenceScore(args: {
  fitScore: number;
  marketDataScore: number;
  blockingGuardrailCount: number;
  softGuardrailCount: number;
}) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        args.fitScore * 0.45 +
          args.marketDataScore * 0.35 +
          Math.max(0, 100 - args.softGuardrailCount * 8) * 0.2 -
          args.blockingGuardrailCount * 22,
      ),
    ),
  );
}

function buildPrimarySecurityAction(args: {
  verdict: string;
  symbol: string;
  blockers: string[];
  isHeld: boolean;
}) {
  if (args.verdict === "needs-more-data") {
    return {
      priority: "P0" as const,
      label: "先补齐数据",
      detail: args.blockers[0] ?? "先刷新报价、补齐价格历史和交易身份，再做候选判断。",
    };
  }
  if (args.verdict === "review-existing") {
    return {
      priority: "P0" as const,
      label: "复核现有仓位",
      detail: `${args.symbol} 已经在组合中有真实权重，优先确认集中度、账户位置和是否仍符合目标配置。`,
    };
  }
  if (args.verdict === "good-candidate") {
    return {
      priority: "P1" as const,
      label: "纳入候选观察",
      detail: "组合目标和偏好方向支持继续研究，但买入前仍需确认报价新鲜度、账户位置、税务路径和现金计划。",
    };
  }
  if (args.verdict === "weak-fit") {
    return {
      priority: "P1" as const,
      label: "暂不优先",
      detail: "当前组合目标或偏好因素不支持把它放在优先新增位置；除非你能说明它和现有持仓的差异。",
    };
  }
  return {
    priority: args.isHeld ? "P0" as const : "P1" as const,
    label: args.isHeld ? "继续观察持仓" : "保持观察",
    detail: args.blockers[0] ?? "当前更适合观察并补充证据，而不是直接形成买入动作。",
  };
}

function buildSecurityDecisionGates(args: {
  blockers: string[];
  fitConcerns: string[];
  priceHistoryPointCount: number;
  currency?: string | null;
}) {
  const gates = [
    ...args.blockers,
    ...args.fitConcerns,
    args.priceHistoryPointCount < 20
      ? `价格历史样本只有 ${args.priceHistoryPointCount} 个交易日，趋势和波动判断仍偏弱。`
      : null,
    args.currency === "USD"
      ? "确认 USD/CAD 换汇路径、账户币种和最终 CAD 汇总影响。"
      : null,
  ].filter((item): item is string => Boolean(item));
  return [...new Set(gates)].slice(0, 8);
}

function buildSecurityNextSteps(args: {
  hasCompleteIdentity: boolean;
  priceHistoryPointCount: number;
  isHeld: boolean;
  verdict: string;
}) {
  const steps = [
    !args.hasCompleteIdentity ? "先补齐 symbol、exchange、currency，避免同 ticker 不同上市地混淆。" : null,
    args.priceHistoryPointCount < 20 ? "刷新报价和历史价格，让快扫证据从低样本升级到可复核状态。" : null,
    args.isHeld ? "对比当前持仓权重、账户位置和目标配置差距。" : "把它和现有同类持仓做一次重合度比较。",
    args.verdict === "good-candidate" ? "如果仍匹配，再进入观察清单或小额分批计划讨论。" : null,
  ].filter((item): item is string => Boolean(item));
  return [...new Set(steps)].slice(0, 6);
}

function buildPositionSizingIdea(args: {
  verdict: string;
  targetGapPct: number;
  heldWeightPct: number;
}) {
  if (args.verdict === "needs-more-data") {
    return "暂不讨论仓位，先补齐数据。";
  }
  if (args.verdict === "review-existing") {
    return "这是现有持仓复核场景，重点是是否控制集中度，而不是新增仓位。";
  }
  if (args.verdict === "weak-fit") {
    return "如果仍想跟踪，适合先放入观察，不适合直接按核心仓位处理。";
  }
  if (args.targetGapPct >= 10 && args.heldWeightPct === 0) {
    return "若后续证据仍支持，可先按小额分批候选讨论，而不是一次性重仓。";
  }
  return "当前只适合形成观察或小额分批讨论，不构成买入建议。";
}

export function buildSecurityAnalyzerQuickScan(args: {
  identity: AnalyzerSecurityIdentity;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  marketData?: AnalyzerMarketDataContext;
  generatedAt?: string;
}): PortfolioAnalyzerResult {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const normalizedSymbol = args.identity.symbol.trim().toUpperCase();
  const identity = { ...args.identity, symbol: normalizedSymbol };
  const matchingHistory = filterHistoryForIdentity(
    args.marketData?.priceHistory ?? [],
    identity,
  );
  const marketData = buildMarketDataSummary({
    holdings: args.holdings.filter((holding) => {
      const sameSymbol = holding.symbol.trim().toUpperCase() === normalizedSymbol;
      const sameExchange = !args.identity.exchange || holding.exchangeOverride === args.identity.exchange;
      const sameCurrency = !args.identity.currency || holding.currency === args.identity.currency;
      return sameSymbol && sameExchange && sameCurrency;
    }),
    priceHistory: matchingHistory,
    portfolioSnapshots: args.marketData?.portfolioSnapshots,
    generatedAt,
  });
  const decisionContext = buildSecurityDecisionContext({
    identity,
    accounts: args.accounts,
    holdings: args.holdings,
    profile: args.profile,
    marketData: {
      priceHistory: matchingHistory,
      portfolioSnapshots: args.marketData?.portfolioSnapshots,
    },
    generatedAt,
  });
  const decisionNarrative = buildSecurityDecisionNarrative(decisionContext);
  const matchingHoldings = decisionContext.matchingHoldings;
  const referenceHolding = decisionContext.referenceHolding;
  const economicAssetClass = decisionContext.economicAssetClass;
  const targetPct = decisionContext.targetPct;
  const currentSleevePct = decisionContext.currentSleevePct;
  const accountTypes = decisionContext.accountTypes;
  const heldWeightPct = decisionContext.heldWeightPct;
  const preferenceFit = decisionContext.preferenceFit;
  const blockers = decisionContext.blockers;
  const decision = decisionNarrative.decision;
  const decisionVerdict = decisionNarrative.verdict;
  const summaryDecisionLabel = decisionNarrative.summaryLabel;
  const guardrails = decisionNarrative.guardrails;
  const fit = decisionNarrative.fit;
  const taxNotes = getTaxNotes({ holdings: matchingHoldings, accounts: args.accounts });
  const blockingGuardrailCount = guardrails.filter((item) => item.blocking).length;
  const softGuardrailCount = guardrails.length - blockingGuardrailCount;
  const confidenceScore = getDecisionConfidenceScore({
    fitScore: fit.score,
    marketDataScore: getMarketDataConfidenceScore(marketData),
    blockingGuardrailCount,
    softGuardrailCount,
  });
  const hasCompleteIdentity = hasCompleteAnalyzerIdentity(identity);
  const primaryAction = buildPrimarySecurityAction({
    verdict: decisionVerdict,
    symbol: normalizedSymbol,
    blockers,
    isHeld: matchingHoldings.length > 0,
  });
  const decisionGates = buildSecurityDecisionGates({
    blockers,
    fitConcerns: fit.concerns,
    priceHistoryPointCount: marketData.priceHistoryPointCount,
    currency: identity.currency,
  });
  const nextSteps = buildSecurityNextSteps({
    hasCompleteIdentity,
    priceHistoryPointCount: marketData.priceHistoryPointCount,
    isHeld: matchingHoldings.length > 0,
    verdict: decisionVerdict,
  });
  const boundary = [
    marketData.quoteFreshnessSummary ?? "行情新鲜度未完整记录",
    `历史样本 ${marketData.priceHistoryPointCount} 个交易日`,
    "本结果由确定性规则生成；GPT 只能增强解释，不能覆盖护栏。",
  ].join("；");
  const portfolioAsOf = latestIso(args.holdings.map((holding) => holding.updatedAt), generatedAt);
  const evidenceTrail = buildAnalyzerEvidenceTrail({
    scope: "security",
    portfolioAsOf,
    marketData,
    generatedAt,
  });
  const positionSizingIdea = buildPositionSizingIdea({
    verdict: decisionVerdict,
    targetGapPct: fit.targetGapPct,
    heldWeightPct,
  });

  return assertAnalyzerResult({
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: "security",
    mode: "quick",
    generatedAt,
    identity: {
      ...identity
    },
    dataFreshness: {
      portfolioAsOf,
      quotesAsOf: marketData.quotesAsOf,
      externalResearchAsOf: null,
      sourceMode: marketData.sourceMode,
      freshnessLabel: getAnalyzerFreshnessLabel(marketData),
      reliabilityScore: getAnalyzerReliabilityScore(marketData),
      limitationSummary: getAnalyzerLimitationSummary(marketData),
      quoteSourceSummary: marketData.quoteSourceSummary,
      quoteFreshnessSummary: marketData.quoteFreshnessSummary,
      priceHistoryPointCount: marketData.priceHistoryPointCount,
      fallbackPointCount: marketData.fallbackPointCount
    },
    evidenceTrail,
    summary: {
      title: `${normalizedSymbol} 智能快速分析`,
      thesis: matchingHoldings.length > 0
        ? `${summaryDecisionLabel}；当前已持有约占组合 ${formatPercent(heldWeightPct)}，本轮按标的本身、组合暴露、偏好因素、账户/税务路径和缓存行情综合判断。`
        : `${summaryDecisionLabel}；当前 0% 只代表尚未持有，本轮按新增候选标的处理。`,
      confidence:
        marketData.priceHistoryPointCount > 0
          ? "medium"
          : "low"
    },
    securityDecision: {
      lens: matchingHoldings.length > 0
        ? "existing-holding-review"
        : "candidate-new-buy",
      verdict: decisionVerdict,
      decisionLabel: summaryDecisionLabel,
      confidenceScore,
      directAnswer: decision.detail,
      primaryAction,
      whyNow: [
        `${economicAssetClass} 当前约 ${formatPercent(currentSleevePct)}，目标约 ${formatPercent(targetPct)}，差距 ${formatPercent(decision.gapPct)}。`,
        preferenceFit.summary,
        matchingHoldings.length > 0
          ? `当前已持有约占组合 ${formatPercent(heldWeightPct)}。`
          : "当前未持有，按新增候选标的处理。",
      ].filter(Boolean).slice(0, 6),
      portfolioFit: [
        `会影响 ${economicAssetClass} 配置袖口。`,
        accountTypes.length > 0
          ? `当前持仓账户：${accountTypes.join(" / ")}。`
          : "新增买入前需要选择账户位置。",
        `交易身份保留 ${identity.symbol} · ${identity.exchange ?? "未知交易所"} · ${identity.currency ?? "未知币种"}。`,
      ],
      keyBlockers: blockers.slice(0, 8),
      guardrails: guardrails.slice(0, 12),
      fit,
      decisionGates,
      nextSteps,
      boundary,
      positionSizingIdea,
      watchlistTriggers: [
        "刷新报价和价格历史后再确认数据新鲜度。",
        "比较它和现有同类持仓的重复度。",
        "确认买入账户、税务路径、USD/CAD 资金来源和现金计划。",
      ],
      evidence: [
        ...evidenceTrail.map((item) => `${item.label}：${item.detail}`),
      ],
    },
    scorecards: [
      {
        id: "market-data-freshness",
        label: "数据可信度",
        score: getMarketDataConfidenceScore(marketData),
        rationale: marketData.quoteFreshnessSummary
          ? `行情口径：${marketData.quoteFreshnessSummary}。`
          : "没有足够缓存行情，不能把分析当成实时研究。"
      },
      {
        id: "portfolio-weight",
        label: "持仓影响",
        score: Math.max(0, Math.min(100, 100 - Math.max(0, heldWeightPct - 12) * 5)),
        rationale: matchingHoldings.length > 0
          ? `该标的当前约占组合 ${formatPercent(heldWeightPct)}，需要和单一标的集中度一起看。`
          : "当前未持有，影响主要来自新增买入后会占用哪一类资产配置和账户位置。"
      },
      {
        id: "target-fit",
        label: "配置适配",
        score: fit.score,
        rationale: referenceHolding
          ? economicAssetClass === referenceHolding.assetClass
            ? fit.summary
            : `它交易身份是 ${referenceHolding.exchangeOverride ?? "未知交易所"} / ${referenceHolding.currency ?? "未知币种"}，但底层经济暴露按 ${economicAssetClass} 评估；${fit.summary}`
          : targetPct > 0
            ? `这是未持有候选标的，当前组合权重为 0%；${fit.summary}`
            : `这是未持有候选标的，当前组合权重为 0%；暂未找到 ${economicAssetClass} 的目标配置，需要先补齐偏好设置。`
      },
      {
        id: "preference-fit",
        label: "偏好匹配",
        score: preferenceFit.score,
        rationale: preferenceFit.summary,
      }
    ],
    risks: [
      ...marketData.warnings.map((warning) => ({
        severity: "medium" as const,
        title: "行情缓存限制",
        detail: warning,
        relatedIdentity: identity
      })),
      ...preferenceFit.blockers.map((blocker) => ({
        severity: "medium" as const,
        title: "偏好护栏",
        detail: blocker,
        relatedIdentity: identity,
      })),
      ...(heldWeightPct >= 15 ? [{
        severity: "high" as const,
        title: "单一标的权重偏高",
        detail: `${normalizedSymbol} 已经超过组合 15%，后续应结合行业和账户分布判断集中度。`,
        relatedIdentity: args.identity
      }] : []),
      ...(args.identity.currency === "USD" ? [{
        severity: "medium" as const,
        title: "汇率与账户路径",
        detail: "该标的以 USD 交易，适合度判断应同时看 USD 资金来源、账户类型和最终 CAD 汇总影响。",
        relatedIdentity: args.identity
      }] : [])
    ],
    taxNotes,
    portfolioFit: [
      ...(matchingHoldings.length === 0
        ? ["当前 0% 只代表尚未持有，不代表无法分析。"]
        : []),
      fit.summary,
      ...fit.strengths,
      ...fit.concerns,
      ...fit.accountNotes,
      preferenceFit.summary,
      referenceHolding && economicAssetClass
        ? buildEconomicExposureNote({
            holding: referenceHolding,
            economicAssetClass,
            identity,
          })
        : buildCandidateEconomicExposureNote({
            identity,
            economicAssetClass,
          }),
      accountTypes.length > 0
        ? `当前匹配持仓分布在 ${accountTypes.join(" / ")}。`
        : "当前没有匹配到账户内真实持仓；如要买入，应结合账户属性、税务口径和现金安排选择落点。",
      "分析身份保留 symbol、exchange、currency，避免 CAD 版本和美股正股混淆。"
    ],
    actionItems: [
      ...(hasCompleteIdentity
        ? []
        : [
            {
              priority: "P0" as const,
              title: "补全交易身份",
              detail: `当前缺少交易所或币种，继续分析前需要补全 ${normalizedSymbol} 的 symbol、exchange、currency，避免混用同 ticker 的 CAD/US 版本。`,
            },
          ]),
      {
        priority: "P0" as const,
        title: "当前判断",
        detail: blockers.length > 0
          ? blockers.slice(0, 2).join("；")
          : matchingHoldings.length > 0
            ? "复核当前持仓权重、同类资产重复度和是否仍符合账户目标。"
            : "确认同类资产是否仍需要补足、现有持仓是否重复，以及账户/税务/现金安排是否匹配。",
      },
      ...(heldWeightPct >= 15
        ? [
            {
              priority: "P1" as const,
              title: "评估集中度",
              detail: `${normalizedSymbol} 当前约占组合 ${round(heldWeightPct, 1)}%，建议结合行业暴露、账户分布和风险偏好判断是否继续增持或降低集中度。`,
            },
          ]
        : []),
      ...(economicAssetClass && targetPct > 0
        ? [
            {
              priority: "P1" as const,
              title: "买入前确认",
              detail: `${normalizedSymbol} 按 ${economicAssetClass} 暴露评估；买入前应确认同类资产是否仍需要补足、和现有持仓是否重复、以及账户/税务/现金安排是否匹配。`,
            },
          ]
        : []),
      ...(marketData.priceHistoryPointCount < 5
        ? [
            {
              priority: "P2" as const,
              title: "补充价格历史",
              detail: "缓存价格历史不足时，快扫只能做低置信判断；后续可通过行情刷新或 worker 补齐历史样本。",
            },
          ]
        : []),
    ],
    sources: [
      { title: "本地持仓与账户数据", sourceType: "portfolio-data" },
      { title: "缓存持仓报价字段", sourceType: "quote-cache" },
      ...marketData.sources
    ],
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER
  });
}

export function buildPortfolioAnalyzerQuickScan(args: {
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  marketData?: AnalyzerMarketDataContext;
  generatedAt?: string;
}): PortfolioAnalyzerResult {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const health = buildPortfolioHealthSummary({
    accounts: args.accounts,
    holdings: args.holdings,
    profile: args.profile,
    language: "zh"
  });
  const largestHolding = [...args.holdings].sort((left, right) => right.weightPct - left.weightPct)[0];
  const taxNotes = getTaxNotes({ holdings: args.holdings, accounts: args.accounts });
  const marketData = buildMarketDataSummary({
    holdings: args.holdings,
    priceHistory: args.marketData?.priceHistory,
    portfolioSnapshots: args.marketData?.portfolioSnapshots,
    generatedAt,
  });
  const portfolioAsOf = latestIso(args.holdings.map((holding) => holding.updatedAt), generatedAt);
  const evidenceTrail = buildAnalyzerEvidenceTrail({
    scope: "portfolio",
    portfolioAsOf,
    marketData,
    generatedAt,
  });

  return assertAnalyzerResult({
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: "portfolio",
    mode: "quick",
    generatedAt,
    dataFreshness: {
      portfolioAsOf,
      quotesAsOf: marketData.quotesAsOf ?? getQuoteFreshness(args.holdings, generatedAt),
      externalResearchAsOf: null,
      sourceMode: marketData.sourceMode,
      freshnessLabel: getAnalyzerFreshnessLabel(marketData),
      reliabilityScore: getAnalyzerReliabilityScore(marketData),
      limitationSummary: getAnalyzerLimitationSummary(marketData),
      quoteSourceSummary: marketData.quoteSourceSummary,
      quoteFreshnessSummary: marketData.quoteFreshnessSummary,
      priceHistoryPointCount: marketData.priceHistoryPointCount,
      fallbackPointCount: marketData.fallbackPointCount
    },
    evidenceTrail,
    summary: {
      title: "组合 智能诊断",
      thesis: `当前组合健康分为 ${health.score}，本轮使用本地持仓、账户、偏好、健康分和缓存行情来源生成诊断。`,
      confidence: "medium"
    },
    scorecards: [
      {
        id: "market-data-freshness",
        label: "缓存行情可信度",
        score: getMarketDataConfidenceScore(marketData),
        rationale: marketData.quoteFreshnessSummary
          ? `行情口径：${marketData.quoteFreshnessSummary}。`
          : "没有足够缓存行情，组合快扫只能低置信使用本地字段。"
      },
      ...health.dimensions.map((dimension) => ({
        id: dimension.id,
        label: dimension.label,
        score: dimension.score,
        rationale: dimension.summary
      }))
    ],
    risks: [
      ...marketData.warnings.map((warning) => ({
        severity: "medium" as const,
        title: "行情缓存限制",
        detail: warning
      })),
      ...health.dimensions
        .filter((dimension) => dimension.score < 68)
        .map((dimension) => ({
          severity: dimension.score < 50 ? "high" as const : "medium" as const,
          title: `${dimension.label}偏弱`,
          detail: dimension.drivers[0] ?? dimension.summary
        })),
      ...(largestHolding && largestHolding.weightPct >= 15 ? [{
        severity: "high" as const,
        title: "最大持仓集中度偏高",
        detail: `${largestHolding.symbol} 当前约占组合 ${round(largestHolding.weightPct, 1)}%。`,
        relatedIdentity: getHoldingIdentity(largestHolding)
      }] : [])
    ].slice(0, 12),
    taxNotes,
    portfolioFit: [
      marketData.quoteSourceSummary
        ? `行情来源：${marketData.quoteSourceSummary}。`
        : "行情来源：当前没有可审计 provider，只能低置信使用本地字段。",
      ...health.highlights,
      ...health.actionQueue.slice(0, 3)
    ].slice(0, 12),
    actionItems: health.actionQueue.slice(0, 5).map((item, index) => ({
      priority: index === 0 ? "P0" : "P1",
      title: `处理事项 ${index + 1}`,
      detail: item
    })),
    sources: [
      { title: "本地组合健康摘要", sourceType: "portfolio-data" },
      { title: "本地持仓与账户数据", sourceType: "portfolio-data" },
      { title: "缓存持仓报价字段", sourceType: "quote-cache" },
      ...marketData.sources
    ],
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER
  });
}

export function buildAccountAnalyzerQuickScan(args: {
  account: InvestmentAccount;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  marketData?: AnalyzerMarketDataContext;
  generatedAt?: string;
}): PortfolioAnalyzerResult {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const accountHoldings = args.holdings.filter((holding) => holding.accountId === args.account.id);
  const accountValueCad = sum(accountHoldings.map((holding) => holding.marketValueCad));
  const totalPortfolioCad = sum(args.accounts.map((account) => account.marketValueCad));
  const accountWeightPct = totalPortfolioCad > 0 ? (accountValueCad / totalPortfolioCad) * 100 : 0;
  const health = buildPortfolioHealthSummary({
    accounts: [args.account],
    holdings: accountHoldings,
    profile: args.profile,
    language: "zh",
    scopeLevel: "account"
  });
  const accountFitDimension = health.dimensions.find((dimension) => dimension.id === "efficiency");
  const portfolioReferenceDimension = health.dimensions.find((dimension) => dimension.id === "allocation");
  const largestHolding = [...accountHoldings].sort((left, right) => right.weightPct - left.weightPct)[0];
  const taxNotes = getTaxNotes({ holdings: accountHoldings, accounts: [args.account] });
  const accountLabel = `${args.account.nickname} (${args.account.type})`;
  const accountHistorySymbols = new Set(
    accountHoldings.map((holding) => holding.symbol.trim().toUpperCase()),
  );
  const accountHistory = (args.marketData?.priceHistory ?? []).filter((point) =>
    accountHistorySymbols.has(point.symbol.trim().toUpperCase()),
  );
  const marketData = buildMarketDataSummary({
    holdings: accountHoldings,
    priceHistory: accountHistory,
    portfolioSnapshots: args.marketData?.portfolioSnapshots,
    generatedAt,
  });
  const portfolioAsOf = latestIso(accountHoldings.map((holding) => holding.updatedAt), generatedAt);
  const evidenceTrail = buildAnalyzerEvidenceTrail({
    scope: "account",
    portfolioAsOf,
    marketData,
    generatedAt,
  });

  return assertAnalyzerResult({
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: "account",
    mode: "quick",
    generatedAt,
    dataFreshness: {
      portfolioAsOf,
      quotesAsOf: marketData.quotesAsOf,
      externalResearchAsOf: null,
      sourceMode: marketData.sourceMode,
      freshnessLabel: getAnalyzerFreshnessLabel(marketData),
      reliabilityScore: getAnalyzerReliabilityScore(marketData),
      limitationSummary: getAnalyzerLimitationSummary(marketData),
      quoteSourceSummary: marketData.quoteSourceSummary,
      quoteFreshnessSummary: marketData.quoteFreshnessSummary,
      priceHistoryPointCount: marketData.priceHistoryPointCount,
      fallbackPointCount: marketData.fallbackPointCount
    },
    evidenceTrail,
    summary: {
      title: `${accountLabel} 智能账户快扫`,
      thesis: `${accountLabel} 当前约占总组合 ${round(accountWeightPct, 1)}%，账户健康分为 ${health.score}。本轮只使用本地账户、持仓、偏好和报价缓存。`,
      confidence: accountHoldings.length > 0 ? "medium" : "low"
    },
    scorecards: [
      {
        id: "market-data-freshness",
        label: "缓存行情可信度",
        score: getMarketDataConfidenceScore(marketData),
        rationale: marketData.quoteFreshnessSummary
          ? `行情口径：${marketData.quoteFreshnessSummary}。`
          : "没有足够缓存行情，账户快扫只能低置信使用本地字段。"
      },
      {
        id: "account-health",
        label: "账户综合分",
        score: health.score,
        rationale: `${health.status}；${health.scopeDetail}`
      },
      {
        id: "account-role-fit",
        label: "账户内适配",
        score: accountFitDimension?.score ?? health.score,
        rationale: accountFitDimension?.summary ?? "检查这个账户里的资产是否适合当前账户属性。"
      },
      {
        id: "portfolio-contribution",
        label: "全组合目标参考",
        score: portfolioReferenceDimension?.score ?? health.score,
        rationale: portfolioReferenceDimension?.summary ?? "检查这个账户对全组合目标配置的贡献。"
      },
      {
        id: "account-weight",
        label: "组合占比",
        score: Math.max(0, Math.min(100, 100 - Math.max(0, accountWeightPct - 45) * 1.2)),
        rationale: `该账户约占总组合 ${round(accountWeightPct, 1)}%。`
      },
      ...health.dimensions.slice(0, 4).map((dimension) => ({
        id: `dimension-${dimension.id}`,
        label: dimension.label,
        score: dimension.score,
        rationale: dimension.summary
      }))
    ].slice(0, 8),
    risks: [
      ...marketData.warnings.map((warning) => ({
        severity: "medium" as const,
        title: "行情缓存限制",
        detail: warning
      })),
      ...health.dimensions
        .filter((dimension) => dimension.score < 68)
        .map((dimension) => ({
          severity: dimension.score < 50 ? "high" as const : "medium" as const,
          title: `${dimension.label}偏弱`,
          detail: dimension.drivers[0] ?? dimension.summary
        })),
      ...(largestHolding && largestHolding.weightPct >= 15 ? [{
        severity: "medium" as const,
        title: "账户内单一持仓偏重",
        detail: `${largestHolding.symbol} 在全组合中约占 ${round(largestHolding.weightPct, 1)}%，需要结合这个账户的税务位置和资产类别判断。`,
        relatedIdentity: getHoldingIdentity(largestHolding)
      }] : []),
      ...(args.account.contributionRoomCad != null && args.account.contributionRoomCad <= 0 ? [{
        severity: "info" as const,
        title: "账户额度已接近用完",
        detail: `${accountLabel} 当前记录的额度不高，后续新增资金可能需要优先考虑其他账户。`
      }] : [])
    ].slice(0, 12),
    taxNotes: taxNotes.length > 0
      ? taxNotes
      : [`${args.account.type} 的账户位置会影响税务效率；本轮只基于本地账户类型和持仓币种提示。`],
    portfolioFit: [
      "本账户分析分两个口径：账户内适配看账户属性是否合适；全组合目标参考看它对总组合配置有没有帮助。",
      marketData.quoteSourceSummary
        ? `行情来源：${marketData.quoteSourceSummary}。`
        : "行情来源：当前没有可审计 provider，只能低置信使用本地字段。",
      ...health.highlights,
      `账户类型：${args.account.type}；账户币种：${args.account.currency ?? "CAD"}。`,
      `当前账户内持仓数：${accountHoldings.length}。`
    ].slice(0, 12),
    actionItems: health.actionQueue.slice(0, 5).map((item, index) => ({
      priority: index === 0 ? "P0" : "P1",
      title: `账户行动 ${index + 1}`,
      detail: item
    })),
    sources: [
      { title: "本地账户健康摘要", sourceType: "portfolio-data" },
      { title: "本地账户持仓", sourceType: "portfolio-data" },
      { title: "缓存持仓报价字段", sourceType: "quote-cache" },
      ...marketData.sources
    ],
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER
  });
}

export function buildRecommendationRunAnalyzerQuickScan(args: {
  run: RecommendationRun;
  profile: PreferenceProfile;
  generatedAt?: string;
}): PortfolioAnalyzerResult {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const leadItem = args.run.items[0];
  const constraints = args.profile.recommendationConstraints;

  return assertAnalyzerResult({
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: "recommendation-run",
    mode: "quick",
    generatedAt,
    dataFreshness: {
      portfolioAsOf: args.run.createdAt,
      quotesAsOf: null,
      externalResearchAsOf: null,
      sourceMode: "local",
      freshnessLabel: "推荐记录",
      reliabilityScore: args.run.confidenceScore ?? 60,
      limitationSummary: "推荐解释来自已落库推荐运行记录，不代表实时行情或外部研究。"
    },
    evidenceTrail: [
      {
        id: "recommendation-run",
        label: "推荐运行记录",
        sourceType: "portfolio-data",
        sourceMode: "local",
        confidence: args.run.confidenceScore != null && args.run.confidenceScore >= 75 ? "high" : "medium",
        freshness: "fresh",
        asOf: args.run.createdAt,
        detail: args.run.objective ?? "使用当前推荐引擎输出作为本地解释来源。",
      },
      {
        id: "recommendation-constraints",
        label: "推荐约束",
        sourceType: "manual",
        sourceMode: "local",
        confidence: "medium",
        freshness: "fresh",
        asOf: generatedAt,
        detail: "来自用户保存的推荐约束和投资偏好。",
      },
    ],
    summary: {
      title: "推荐智能解释",
      thesis: leadItem
        ? `本轮推荐优先处理 ${leadItem.assetClass}，建议金额约 CAD ${round(leadItem.amountCad, 0)}。`
        : "本轮推荐没有生成可执行条目。",
      confidence: args.run.confidenceScore != null && args.run.confidenceScore >= 75 ? "high" : "medium"
    },
    scorecards: [
      {
        id: "engine-confidence",
        label: "推荐置信度",
        score: args.run.confidenceScore ?? 60,
        rationale: args.run.objective ?? "使用当前推荐引擎输出作为本地解释来源。"
      },
      ...(leadItem ? [{
        id: "lead-security-fit",
        label: "首选标的适配",
        score: leadItem.securityScore ?? 60,
        rationale: leadItem.explanation
      }] : [])
    ],
    risks: [
      ...(constraints.excludedSymbols.length > 0 ? [{
        severity: "info" as const,
        title: "存在排除标的约束",
        detail: `本轮需要继续避开：${constraints.excludedSymbols.join(" / ")}。`
      }] : []),
      ...(constraints.allowedSecurityTypes.length > 0 ? [{
        severity: "info" as const,
        title: "存在允许标的类型约束",
        detail: `本轮优先限制在：${constraints.allowedSecurityTypes.join(" / ")}。`
      }] : [])
    ],
    taxNotes: [
      `推荐策略：${args.profile.recommendationStrategy}；税务敏感放置：${args.profile.taxAwarePlacement ? "开启" : "关闭"}。`
    ],
    portfolioFit: [
      ...(args.run.assumptions ?? []),
      ...(args.run.notes ?? [])
    ].slice(0, 12),
    actionItems: args.run.items.slice(0, 5).map((item, index) => ({
      priority: index === 0 ? "P0" : "P1",
      title: `执行 ${item.assetClass}`,
      detail: item.explanation
    })),
    sources: [
      { title: "本地推荐运行记录", sourceType: "portfolio-data" },
      { title: "Stored recommendation constraints", sourceType: "manual" }
    ],
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER
  });
}
