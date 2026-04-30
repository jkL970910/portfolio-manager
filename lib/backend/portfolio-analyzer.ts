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
      notes.push(`${holding.symbol} 是 USD 标的且放在 TFSA，后续 AI 分析需要提示美股股息预扣税无法在 TFSA 回收。`);
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
  const quoteSourceSummary =
    quoteProviders.length > 0 || historyProviders.length > 0
      ? [
          quoteProviders.length > 0
            ? `quotes=${quoteProviders.slice(0, 3).join("/")}`
            : null,
          historyProviders.length > 0
            ? `history=${historyProviders.slice(0, 3).join("/")}`
            : null,
        ]
          .filter(Boolean)
          .join("；")
      : null;
  const quoteFreshnessSummary = [
    quoteStatuses.length > 0
      ? `quoteStatus=${quoteStatuses.slice(0, 4).join("/")}`
      : null,
    priceHistory.length > 0 ? `historyPoints=${priceHistory.length}` : null,
    fallbackPointCount > 0 ? `fallbackPoints=${fallbackPointCount}` : null,
    stalePointCount > 0 ? `stalePoints=${stalePointCount}` : null,
  ]
    .filter(Boolean)
    .join("；");

  return {
    sourceMode: hasCachedMarketData ? "cached-external" as const : "local" as const,
    quotesAsOf,
    quoteSourceSummary,
    quoteFreshnessSummary: quoteFreshnessSummary || null,
    priceHistoryPointCount: priceHistory.length,
    fallbackPointCount,
    latestSnapshot,
    sources: [
      ...(quoteProviders.length > 0
        ? [
            {
              title: `Cached holding quotes: ${quoteProviders.slice(0, 3).join(" / ")}`,
              sourceType: "quote-cache" as const,
              date: latestHoldingQuoteAsOf?.slice(0, 10),
            },
          ]
        : []),
      ...(historyProviders.length > 0
        ? [
            {
              title: `Cached price history: ${historyProviders.slice(0, 3).join(" / ")}`,
              sourceType: "market-data" as const,
              date: latestHistoryAsOf?.slice(0, 10),
            },
          ]
        : []),
      ...(latestSnapshot
        ? [
            {
              title: `Portfolio snapshot: ${latestSnapshot.sourceMode ?? latestSnapshot.sourceVersion}`,
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
      ...(fallbackPointCount > 0
        ? [`价格历史含 ${fallbackPointCount} 个参考/兜底点，AI 只能低置信使用。`]
        : []),
      ...(stalePointCount > 0
        ? [`价格历史含 ${stalePointCount} 个 stale 点，需要刷新后再提高置信度。`]
        : []),
      ...(quoteProviders.length === 0
        ? ["持仓行没有可审计 quote provider；分析只能使用本地持仓字段。"]
        : []),
    ],
  };
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
  const targetPct = referenceHolding
    ? args.profile.targetAllocation.find((target) => target.assetClass === referenceHolding.assetClass)?.targetPct ?? 0
    : 0;
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
      title: `${normalizedSymbol} AI 快速分析`,
      thesis: matchingHoldings.length > 0
        ? `${normalizedSymbol} 当前在组合中约占 ${round(heldWeightPct, 1)}%，本轮基于本地组合、账户、偏好、缓存报价和价格历史分析。`
        : `${normalizedSymbol} 当前没有匹配到真实持仓，本轮只保留标的身份并等待后续接入候选/外部研究。`,
      confidence:
        matchingHoldings.length > 0 && marketData.priceHistoryPointCount > 0
          ? "medium"
          : "low"
    },
    scorecards: [
      {
        id: "market-data-freshness",
        label: "缓存行情可信度",
        score: Math.max(
          20,
          Math.min(
            90,
            45 +
              Math.min(marketData.priceHistoryPointCount, 60) -
              marketData.fallbackPointCount * 6,
          ),
        ),
        rationale: marketData.quoteFreshnessSummary
          ? `行情口径：${marketData.quoteFreshnessSummary}。`
          : "没有足够缓存行情，不能把分析当成实时研究。"
      },
      {
        id: "portfolio-weight",
        label: "组合权重",
        score: Math.max(0, Math.min(100, 100 - Math.max(0, heldWeightPct - 12) * 5)),
        rationale: `该标的当前约占组合 ${round(heldWeightPct, 1)}%。`
      },
      {
        id: "target-fit",
        label: "目标配置适配",
        score: referenceHolding && targetPct > 0 ? 72 : 45,
        rationale: referenceHolding
          ? `它归入 ${referenceHolding.assetClass}，该资产类别目标约 ${targetPct}%。`
          : "还没有足够的本地持仓上下文判断目标配置。"
      }
    ],
    risks: [
      ...marketData.warnings.map((warning) => ({
        severity: "medium" as const,
        title: "行情缓存限制",
        detail: warning,
        relatedIdentity: identity
      })),
      ...(heldWeightPct >= 15 ? [{
        severity: "high" as const,
        title: "单一标的权重偏高",
        detail: `${normalizedSymbol} 已经超过组合 15%，后续应结合行业和账户分布判断集中度。`,
        relatedIdentity: args.identity
      }] : []),
      ...(args.identity.currency === "USD" ? [{
        severity: "medium" as const,
        title: "USD 交易币种",
        detail: "该标的以 USD 交易，移动端展示和组合聚合需要保留原币种后再转换为 CAD。",
        relatedIdentity: args.identity
      }] : [])
    ],
    taxNotes,
    portfolioFit: [
      accountTypes.length > 0
        ? `当前匹配持仓分布在 ${accountTypes.join(" / ")}。`
        : "当前没有匹配到账户内真实持仓。",
      marketData.quoteSourceSummary
        ? `行情来源：${marketData.quoteSourceSummary}。`
        : "行情来源：当前没有可审计 provider，只能低置信使用本地字段。",
      "分析身份保留 symbol、exchange、currency，避免 CAD 版本和美股正股混淆。"
    ],
    actionItems: [
      {
        priority: "P1",
        title: "确认标的身份",
        detail: `继续分析前确认 ${normalizedSymbol} 的交易所和币种是否与真实持仓一致。`
      }
    ],
    sources: [
      { title: "Local holdings and account data", sourceType: "portfolio-data" },
      { title: "Cached holding quote fields", sourceType: "quote-cache" },
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
      title: "组合 AI 快速诊断",
      thesis: `当前组合健康分为 ${health.score}，本轮使用本地持仓、账户、偏好、健康分和缓存行情来源生成诊断。`,
      confidence: "medium"
    },
    scorecards: [
      {
        id: "market-data-freshness",
        label: "缓存行情可信度",
        score: Math.max(
          20,
          Math.min(90, 45 + Math.min(marketData.priceHistoryPointCount, 60) - marketData.fallbackPointCount * 6),
        ),
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
      { title: "Local portfolio health summary", sourceType: "portfolio-data" },
      { title: "Local holdings and account data", sourceType: "portfolio-data" },
      { title: "Cached holding quote fields", sourceType: "quote-cache" },
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
      title: `${accountLabel} AI 账户快扫`,
      thesis: `${accountLabel} 当前约占总组合 ${round(accountWeightPct, 1)}%，账户健康分为 ${health.score}。本轮只使用本地账户、持仓、偏好和报价缓存。`,
      confidence: accountHoldings.length > 0 ? "medium" : "low"
    },
    scorecards: [
      {
        id: "market-data-freshness",
        label: "缓存行情可信度",
        score: Math.max(
          20,
          Math.min(90, 45 + Math.min(marketData.priceHistoryPointCount, 60) - marketData.fallbackPointCount * 6),
        ),
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
      { title: "Local account health summary", sourceType: "portfolio-data" },
      { title: "Local account holdings", sourceType: "portfolio-data" },
      { title: "Cached holding quote fields", sourceType: "quote-cache" },
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
      title: "推荐运行 AI 解释",
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
      { title: "Local recommendation run", sourceType: "portfolio-data" },
      { title: "Stored recommendation constraints", sourceType: "manual" }
    ],
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER
  });
}
