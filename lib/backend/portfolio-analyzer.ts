import {
  AccountType,
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
  RecommendationRun
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
  return latestIso(holdings.map((holding) => holding.updatedAt), generatedAt);
}

export function buildSecurityAnalyzerQuickScan(args: {
  identity: AnalyzerSecurityIdentity;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
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

  return assertAnalyzerResult({
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: "security",
    mode: "quick",
    generatedAt,
    identity: {
      ...args.identity,
      symbol: normalizedSymbol
    },
    dataFreshness: {
      portfolioAsOf: latestIso(args.holdings.map((holding) => holding.updatedAt), generatedAt),
      quotesAsOf: matchingHoldings.length > 0 ? getQuoteFreshness(matchingHoldings, generatedAt) : null,
      externalResearchAsOf: null,
      sourceMode: "local"
    },
    summary: {
      title: `${normalizedSymbol} AI 快速分析`,
      thesis: matchingHoldings.length > 0
        ? `${normalizedSymbol} 当前在组合中约占 ${round(heldWeightPct, 1)}%，本轮只基于本地组合、账户、偏好和报价缓存分析。`
        : `${normalizedSymbol} 当前没有匹配到真实持仓，本轮只保留标的身份并等待后续接入候选/外部研究。`,
      confidence: matchingHoldings.length > 0 ? "medium" : "low"
    },
    scorecards: [
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
      { title: "Cached holding quote fields", sourceType: "quote-cache" }
    ],
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER
  });
}

export function buildPortfolioAnalyzerQuickScan(args: {
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
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

  return assertAnalyzerResult({
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: "portfolio",
    mode: "quick",
    generatedAt,
    dataFreshness: {
      portfolioAsOf: latestIso(args.holdings.map((holding) => holding.updatedAt), generatedAt),
      quotesAsOf: getQuoteFreshness(args.holdings, generatedAt),
      externalResearchAsOf: null,
      sourceMode: "local"
    },
    summary: {
      title: "组合 AI 快速诊断",
      thesis: `当前组合健康分为 ${health.score}，本轮只使用本地持仓、账户、偏好和健康分结果生成诊断。`,
      confidence: "medium"
    },
    scorecards: health.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      score: dimension.score,
      rationale: dimension.summary
    })),
    risks: [
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
      { title: "Cached holding quote fields", sourceType: "quote-cache" }
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
