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

function getPreferenceFitNotes(args: {
  profile: PreferenceProfile;
  sector: string | null | undefined;
  economicAssetClass: string;
  isHeld: boolean;
}) {
  const factors = args.profile.preferenceFactors;
  const sector = args.sector?.trim();
  const preferredSectors = factors.sectorTilts.preferredSectors;
  const avoidedSectors = factors.sectorTilts.avoidedSectors;
  const notes: string[] = [];
  const blockers: string[] = [];
  let score = 62;

  if (sector) {
    const isPreferred = preferredSectors.some(
      (item) => item.trim().toLowerCase() === sector.toLowerCase(),
    );
    const isAvoided = avoidedSectors.some(
      (item) => item.trim().toLowerCase() === sector.toLowerCase(),
    );
    if (isPreferred) {
      notes.push(`行业偏好匹配：你的偏好里包含 ${sector}。`);
      score += 18;
    } else if (isAvoided) {
      notes.push(`行业偏好冲突：你的规避列表里包含 ${sector}。`);
      blockers.push(`行业偏好冲突：${sector} 在你的规避列表里。`);
      score -= 25;
    } else {
      notes.push(`行业偏好中性：${sector} 没有被列为明确偏好或规避。`);
    }
  } else {
    notes.push("行业资料还不完整，偏好匹配只能先按资产类别判断。");
    score -= 8;
  }

  if (factors.behavior.riskCapacity === "high") {
    notes.push("风险容量偏高，可以容忍更高波动，但仍要控制单一标的集中度。");
    score += args.economicAssetClass.includes("Equity") ? 6 : 0;
  } else if (factors.behavior.riskCapacity === "low") {
    notes.push("风险容量偏低，新增或加仓前应更重视回撤和现金缓冲。");
    if (args.economicAssetClass.includes("Equity")) {
      blockers.push("风险容量偏低：新增权益类资产前需要更保守地确认回撤承受能力。");
    }
    score -= args.economicAssetClass.includes("Equity") ? 12 : 0;
  }

  if (factors.lifeGoals.homePurchase.enabled) {
    notes.push("你设置了买房目标，新增波动资产前应确认不会挤压首付或现金计划。");
    if (factors.lifeGoals.homePurchase.priority === "high") {
      blockers.push("买房目标优先级高：新增买入前需要先确认首付和现金计划。");
    }
    score -= 6;
  }

  if (!args.isHeld) {
    notes.push("当前未持有时，应把它当作新增候选标的，而不是现有仓位复盘。");
  }

  return {
    score: Math.max(25, Math.min(90, score)),
    summary: notes.join(" "),
    notes,
    blockers,
  };
}

function getSecurityDecision(args: {
  symbol: string;
  isHeld: boolean;
  heldWeightPct: number;
  economicAssetClass: string;
  targetPct: number;
  currentSleevePct: number;
  preferenceSummary: string;
  blockers: string[];
  marketData: ReturnType<typeof buildMarketDataSummary>;
}) {
  const gapPct = args.targetPct - args.currentSleevePct;
  const hasEnoughMarketData = args.marketData.priceHistoryPointCount >= 5;
  const hasBlockingGates = args.blockers.length > 0 || !hasEnoughMarketData;
  const dataBoundary = hasEnoughMarketData
    ? "缓存行情足够做第一层判断"
    : "行情样本偏少，结论应作为初筛而不是下单依据";

  if (args.targetPct <= 0) {
    return {
      gapPct,
      title: "当前判断",
      detail: `${args.symbol} 暂时不应作为优先新增标的：你的偏好里没有为 ${args.economicAssetClass} 设置明确目标。${dataBoundary}。`,
    };
  }

  if (args.heldWeightPct >= 15) {
    return {
      gapPct,
      title: "当前判断",
      detail: `${args.symbol} 已经是组合里的高权重标的，下一步更像是复核是否继续持有或控制集中度，而不是无条件加仓。${args.economicAssetClass} 当前约 ${formatPercent(args.currentSleevePct)}，目标约 ${formatPercent(args.targetPct)}。`,
    };
  }

  if (gapPct >= 5) {
    if (hasBlockingGates) {
      return {
        gapPct,
        title: "当前判断",
        detail: `${args.symbol} 可以进入候选观察，但暂时不应只因为配置缺口就直接加仓。它会增加 ${args.economicAssetClass} 暴露，该类资产当前约 ${formatPercent(args.currentSleevePct)}、目标约 ${formatPercent(args.targetPct)}，仍有约 ${formatPercent(gapPct)} 缺口；${dataBoundary}。`,
      };
    }
    return {
      gapPct,
      title: "当前判断",
      detail: `${args.symbol} 可以进入候选观察：它会增加 ${args.economicAssetClass} 暴露，而这一类资产当前约 ${formatPercent(args.currentSleevePct)}、目标约 ${formatPercent(args.targetPct)}，仍有约 ${formatPercent(gapPct)} 缺口。${dataBoundary}。`,
    };
  }

  if (gapPct <= -5) {
    return {
      gapPct,
      title: "当前判断",
      detail: `${args.symbol} 更适合先观察而不是优先买入：${args.economicAssetClass} 当前约 ${formatPercent(args.currentSleevePct)}，已经高于目标约 ${formatPercent(args.targetPct)}。如果要买，应优先解释它和现有持仓的差异，而不是只看单个标的。`,
    };
  }

  return {
    gapPct,
    title: "当前判断",
    detail: `${args.symbol} 属于可继续观察的中性候选：${args.economicAssetClass} 当前约 ${formatPercent(args.currentSleevePct)}，接近目标约 ${formatPercent(args.targetPct)}。是否买入主要取决于估值、与现有持仓重复度、账户位置和现金计划。`,
  };
}

function getSecurityDecisionVerdict(args: {
  targetPct: number;
  gapPct: number;
  heldWeightPct: number;
  hasBlockers: boolean;
  hasEnoughMarketData: boolean;
}): "good-candidate" | "watch-only" | "weak-fit" | "review-existing" | "needs-more-data" {
  if (!args.hasEnoughMarketData) {
    return "needs-more-data";
  }
  if (args.heldWeightPct >= 15) {
    return "review-existing";
  }
  if (args.targetPct <= 0 || args.gapPct <= -5) {
    return "weak-fit";
  }
  if (args.hasBlockers) {
    return "watch-only";
  }
  if (args.gapPct >= 5) {
    return "good-candidate";
  }
  return "watch-only";
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
  const matchingHoldings = args.holdings.filter((holding) => {
    const sameSymbol = holding.symbol.trim().toUpperCase() === normalizedSymbol;
    const sameExchange = !args.identity.exchange || holding.exchangeOverride === args.identity.exchange;
    const sameCurrency = !args.identity.currency || holding.currency === args.identity.currency;
    return sameSymbol && sameExchange && sameCurrency;
  });
  const totalPortfolioCad = sum(args.accounts.map((account) => account.marketValueCad));
  const heldValueCad = sum(matchingHoldings.map((holding) => holding.marketValueCad));
  const heldWeightPct = totalPortfolioCad > 0 ? (heldValueCad / totalPortfolioCad) * 100 : 0;
  const referenceHolding = matchingHoldings[0] ?? args.holdings.find((holding) => holding.symbol.trim().toUpperCase() === normalizedSymbol);
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
  const currentSleevePct = getEconomicSleeveWeightPct({
    holdings: args.holdings,
    accounts: args.accounts,
    economicAssetClass,
  });
  const accountTypes = [...new Set(matchingHoldings
    .map((holding) => getHoldingAccount(holding, args.accounts)?.type)
    .filter((type): type is AccountType => Boolean(type)))];
  const taxNotes = getTaxNotes({ holdings: matchingHoldings, accounts: args.accounts });
  const identity = { ...args.identity, symbol: normalizedSymbol };
  const matchingHistory = filterHistoryForIdentity(
    args.marketData?.priceHistory ?? [],
    identity,
  );
  const marketData = buildMarketDataSummary({
    holdings: matchingHoldings,
    priceHistory: matchingHistory,
    portfolioSnapshots: args.marketData?.portfolioSnapshots,
    generatedAt,
  });
  const preferenceFit = getPreferenceFitNotes({
    profile: args.profile,
    sector: referenceHolding?.sector ?? null,
    economicAssetClass,
    isHeld: matchingHoldings.length > 0,
  });
  const blockers = [
    ...preferenceFit.blockers,
    ...(args.identity.currency === "USD" &&
    args.profile.preferenceFactors.taxStrategy.usdFundingPath === "avoid"
      ? ["USD 路径偏好为避免：买入前需要确认换汇、税务和账户位置是否值得。"]
      : []),
    ...(marketData.priceHistoryPointCount < 5
      ? ["价格历史样本偏少：结论只能作为初筛，不能作为下单前价格依据。"]
      : []),
  ];
  const decision = getSecurityDecision({
    symbol: normalizedSymbol,
    isHeld: matchingHoldings.length > 0,
    heldWeightPct,
    economicAssetClass,
    targetPct,
    currentSleevePct,
    preferenceSummary: preferenceFit.summary,
    blockers,
    marketData,
  });
  const decisionVerdict = getSecurityDecisionVerdict({
    targetPct,
    gapPct: decision.gapPct,
    heldWeightPct,
    hasBlockers: blockers.length > 0,
    hasEnoughMarketData: marketData.priceHistoryPointCount >= 5,
  });
  const summaryDecisionLabel = decisionVerdict === "good-candidate"
    ? "可以进入候选观察"
    : decisionVerdict === "review-existing"
      ? "更适合持仓复核"
      : decisionVerdict === "weak-fit"
        ? "适配偏弱，适合先观察"
        : decisionVerdict === "needs-more-data"
          ? blockers.length > 0
            ? "可以进入候选观察，但暂时不应只因为配置缺口就直接加仓"
            : "需补充数据后再判断"
          : "适合先观察";

  return assertAnalyzerResult({
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: "security",
    mode: "quick",
    generatedAt,
    identity: {
      ...identity
    },
    dataFreshness: {
      portfolioAsOf: latestIso(args.holdings.map((holding) => holding.updatedAt), generatedAt),
      quotesAsOf: marketData.quotesAsOf,
      externalResearchAsOf: null,
      sourceMode: marketData.sourceMode,
      quoteSourceSummary: marketData.quoteSourceSummary,
      quoteFreshnessSummary: marketData.quoteFreshnessSummary,
      priceHistoryPointCount: marketData.priceHistoryPointCount,
      fallbackPointCount: marketData.fallbackPointCount
    },
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
      directAnswer: decision.detail,
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
      watchlistTriggers: [
        "刷新报价和价格历史后再确认数据新鲜度。",
        "比较它和现有同类持仓的重复度。",
        "确认买入账户、税务路径、USD/CAD 资金来源和现金计划。",
      ],
      evidence: [
        marketData.quoteFreshnessSummary ?? "行情新鲜度未完整记录。",
        marketData.quoteSourceSummary ?? "行情来源暂不完整。",
        `价格历史样本 ${marketData.priceHistoryPointCount} 个交易日。`,
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
        score: targetPct > 0 ? Math.max(35, Math.min(88, 72 + decision.gapPct)) : 45,
        rationale: referenceHolding
          ? economicAssetClass === referenceHolding.assetClass
            ? `它按 ${economicAssetClass} 评估；该类资产当前约 ${formatPercent(currentSleevePct)}，目标约 ${formatPercent(targetPct)}。`
            : `它交易身份是 ${referenceHolding.exchangeOverride ?? "未知交易所"} / ${referenceHolding.currency ?? "未知币种"}，但底层经济暴露按 ${economicAssetClass} 评估；该类资产当前约 ${formatPercent(currentSleevePct)}，目标约 ${formatPercent(targetPct)}。`
          : targetPct > 0
            ? `这是未持有候选标的，当前组合权重为 0%；按 ${economicAssetClass} 暴露评估，该类资产当前约 ${formatPercent(currentSleevePct)}，目标约 ${formatPercent(targetPct)}。`
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
      `配置关系：${economicAssetClass} 当前约 ${formatPercent(currentSleevePct)}，目标约 ${formatPercent(targetPct)}，差距 ${formatPercent(decision.gapPct)}。`,
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
      ...(hasCompleteAnalyzerIdentity(identity)
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

  return assertAnalyzerResult({
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: "portfolio",
    mode: "quick",
    generatedAt,
    dataFreshness: {
      portfolioAsOf: latestIso(args.holdings.map((holding) => holding.updatedAt), generatedAt),
      quotesAsOf: marketData.quotesAsOf ?? getQuoteFreshness(args.holdings, generatedAt),
      externalResearchAsOf: null,
      sourceMode: marketData.sourceMode,
      quoteSourceSummary: marketData.quoteSourceSummary,
      quoteFreshnessSummary: marketData.quoteFreshnessSummary,
      priceHistoryPointCount: marketData.priceHistoryPointCount,
      fallbackPointCount: marketData.fallbackPointCount
    },
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

  return assertAnalyzerResult({
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: "account",
    mode: "quick",
    generatedAt,
    dataFreshness: {
      portfolioAsOf: latestIso(accountHoldings.map((holding) => holding.updatedAt), generatedAt),
      quotesAsOf: marketData.quotesAsOf,
      externalResearchAsOf: null,
      sourceMode: marketData.sourceMode,
      quoteSourceSummary: marketData.quoteSourceSummary,
      quoteFreshnessSummary: marketData.quoteFreshnessSummary,
      priceHistoryPointCount: marketData.priceHistoryPointCount,
      fallbackPointCount: marketData.fallbackPointCount
    },
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
      sourceMode: "local"
    },
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
