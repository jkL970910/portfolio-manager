import { apiSuccess } from "@/lib/backend/contracts";
import type {
  ExternalResearchDocumentRecord,
  PortfolioAnalysisRun,
} from "@/lib/backend/models";
import { getExternalResearchPolicy } from "@/lib/backend/portfolio-external-research";
import {
  getOrCreateLatestMarketSentiment,
  mapMarketSentimentForMobile,
} from "@/lib/backend/market-sentiment";
import { getRepositories } from "@/lib/backend/repositories/factory";
import type {
  DailyIntelligenceData,
  RecommendationsData,
} from "@/lib/contracts";

type DailyIntelligenceItem = DailyIntelligenceData["items"][number];

function readNestedMap(value: unknown) {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

function normalizeToken(value: string | null | undefined) {
  return value?.trim().toUpperCase() || undefined;
}

function getSourceLabel(
  sourceType: DailyIntelligenceItem["sourceType"],
  sourceMode: DailyIntelligenceItem["sourceMode"],
) {
  if (sourceType === "market-data") {
    return "缓存行情情报";
  }
  if (sourceType === "news") {
    return "缓存新闻/公告";
  }
  if (sourceType === "institutional") {
    return "缓存机构资料";
  }
  if (sourceType === "forum") {
    return "社区情绪（低权重）";
  }
  if (sourceType === "manual") {
    return "手动研究记录";
  }
  return sourceMode === "cached-external"
    ? "缓存外部研究"
    : sourceMode === "live-external"
      ? "实时外部研究"
      : "本地快扫";
}

function getConfidenceLabel(
  confidence?: ExternalResearchDocumentRecord["confidence"],
) {
  switch (confidence) {
    case "high":
      return "可信度高";
    case "medium":
      return "可信度中";
    case "low":
      return "可信度低";
    default:
      return "可信度待校准";
  }
}

function getRelevanceLabel(score?: number) {
  if (typeof score !== "number") {
    return "相关度待校准";
  }
  if (score >= 75) {
    return "高相关";
  }
  if (score >= 50) {
    return "中相关";
  }
  return "低相关";
}

function getAnalysisTitle(result: Record<string, unknown>) {
  const summary = readNestedMap(result.summary);
  return typeof summary.title === "string" && summary.title.trim()
    ? summary.title.trim()
    : "智能快扫记录";
}

function getAnalysisSummary(result: Record<string, unknown>) {
  const summary = readNestedMap(result.summary);
  return typeof summary.thesis === "string" && summary.thesis.trim()
    ? summary.thesis.trim()
    : "这条记录来自已缓存的组合、账户、持仓和行情上下文。";
}

function getRunIdentity(
  run: PortfolioAnalysisRun,
): DailyIntelligenceItem["identity"] {
  const resultIdentity = readNestedMap(run.result.identity);
  const request = readNestedMap(run.request);
  const requestSecurity = readNestedMap(request.security);
  const symbol = normalizeToken(
    typeof resultIdentity.symbol === "string"
      ? resultIdentity.symbol
      : typeof requestSecurity.symbol === "string"
        ? requestSecurity.symbol
        : undefined,
  );
  const exchange = normalizeToken(
    typeof resultIdentity.exchange === "string"
      ? resultIdentity.exchange
      : typeof requestSecurity.exchange === "string"
        ? requestSecurity.exchange
        : undefined,
  );
  const currencyValue =
    typeof resultIdentity.currency === "string"
      ? normalizeToken(resultIdentity.currency)
      : typeof requestSecurity.currency === "string"
        ? normalizeToken(requestSecurity.currency)
        : undefined;
  const currency = currencyValue === "CAD" || currencyValue === "USD"
    ? currencyValue
    : undefined;

  return {
    securityId:
      typeof resultIdentity.securityId === "string" &&
        resultIdentity.securityId.trim()
        ? resultIdentity.securityId.trim()
        : undefined,
    symbol,
    exchange,
    currency,
  };
}

function mapRunSources(run: PortfolioAnalysisRun) {
  const rawSources = Array.isArray(run.result.sources) ? run.result.sources : [];
  return rawSources.slice(0, 4).map((source) => {
    const value = readNestedMap(source);
    return {
      title:
        typeof value.title === "string" && value.title.trim()
          ? value.title.trim()
          : "来源",
      sourceType:
        typeof value.sourceType === "string" && value.sourceType.trim()
          ? value.sourceType.trim()
          : "portfolio-data",
      date: typeof value.date === "string" ? value.date : undefined,
      url: typeof value.url === "string" ? value.url : undefined,
    };
  });
}

function getRunRiskFlags(run: PortfolioAnalysisRun) {
  const risks = Array.isArray(run.result.risks) ? run.result.risks : [];
  return risks.slice(0, 3).map((risk) => {
    const value = readNestedMap(risk);
    return typeof value.detail === "string" && value.detail.trim()
      ? value.detail.trim()
      : typeof value.title === "string" && value.title.trim()
        ? value.title.trim()
        : "请复核该分析记录。";
  });
}

function getSecurityActionPayload(identity: DailyIntelligenceItem["identity"]) {
  if (!identity.symbol) {
    return undefined;
  }
  return {
    symbol: identity.symbol,
    ...(identity.securityId ? { securityId: identity.securityId } : {}),
    ...(identity.exchange ? { exchange: identity.exchange } : {}),
    ...(identity.currency ? { currency: identity.currency } : {}),
  };
}

export function mapExternalResearchDocumentForDailyIntelligence(
  document: ExternalResearchDocumentRecord,
): DailyIntelligenceItem {
  const identity = {
    securityId: document.security?.securityId ?? undefined,
    symbol: normalizeToken(document.security?.symbol ?? undefined),
    exchange: normalizeToken(document.security?.exchange ?? undefined),
    currency: document.security?.currency === "CAD" ||
        document.security?.currency === "USD"
      ? document.security.currency
      : undefined,
    underlyingId: document.underlyingId ?? undefined,
  };
  const payload = getSecurityActionPayload(identity);

  return {
    id: `doc:${document.id}`,
    title: document.title,
    summary: document.summary,
    sourceLabel: getSourceLabel(document.sourceType, "cached-external"),
    sourceType: document.sourceType,
    sourceMode: "cached-external",
    confidenceLabel: getConfidenceLabel(document.confidence),
    confidence: document.confidence,
    relevanceScore: document.relevanceScore,
    sourceReliability: document.sourceReliability,
    freshnessLabel: [
      document.publishedAt
        ? `来源 ${document.publishedAt.slice(0, 10)}`
        : `捕获 ${document.capturedAt.slice(0, 10)}`,
      `过期 ${document.expiresAt.slice(0, 10)}`,
    ].join(" · "),
    relevanceLabel: getRelevanceLabel(document.relevanceScore),
    generatedAt: document.capturedAt,
    expiresAt: document.expiresAt,
    identity,
    reason: identity.symbol
      ? `关联 ${[identity.symbol, identity.exchange, identity.currency].filter(Boolean).join(" · ")}。`
      : "作为组合层面的缓存研究背景展示。",
    keyPoints: document.keyPoints.slice(0, 5),
    riskFlags: document.riskFlags.slice(0, 5),
    actions: [
      ...(payload
        ? [
            {
              label: "查看标的",
              type: "view-security" as const,
              payload,
            },
          ]
        : []),
      {
        label: "问大臣",
        type: "ask-minister",
        payload: {
          intelligenceId: `doc:${document.id}`,
        },
      },
      {
        label: "忽略",
        type: "ignore",
      },
    ],
    sources: [
      {
        title: document.sourceName,
        sourceType: document.sourceType,
        date:
          document.publishedAt?.slice(0, 10) ??
          document.capturedAt.slice(0, 10),
        url: document.url ?? undefined,
      },
    ],
  };
}

export function mapAnalysisRunForDailyIntelligence(
  run: PortfolioAnalysisRun,
): DailyIntelligenceItem {
  const identity = getRunIdentity(run);
  const payload = getSecurityActionPayload(identity);
  const sourceMode = run.sourceMode;
  return {
    id: `analysis:${run.id}`,
    title: getAnalysisTitle(run.result),
    summary: getAnalysisSummary(run.result),
    sourceLabel: getSourceLabel("analysis", sourceMode),
    sourceType: "analysis",
    sourceMode,
    confidenceLabel: sourceMode === "local" ? "本地缓存分析" : "缓存研究分析",
    freshnessLabel: `生成 ${run.generatedAt.slice(0, 10)} · 过期 ${run.expiresAt.slice(0, 10)}`,
    relevanceLabel: "关联最近分析",
    generatedAt: run.generatedAt,
    expiresAt: run.expiresAt,
    identity,
    reason: identity.symbol
      ? `来自 ${[identity.symbol, identity.exchange, identity.currency].filter(Boolean).join(" · ")} 的已保存分析。`
      : "来自组合/账户级已保存分析。",
    keyPoints: [getAnalysisSummary(run.result)],
    riskFlags: getRunRiskFlags(run),
    actions: [
      ...(payload
        ? [
            {
              label: "查看标的",
              type: "view-security" as const,
              payload,
            },
          ]
        : []),
      {
        label: "问大臣",
        type: "ask-minister",
        payload: {
          intelligenceId: `analysis:${run.id}`,
        },
      },
    ],
    sources: mapRunSources(run),
  };
}

export function mapMarketSentimentForDailyIntelligence(
  sentiment: Awaited<ReturnType<typeof getOrCreateLatestMarketSentiment>>,
): DailyIntelligenceItem {
  const view = mapMarketSentimentForMobile(sentiment);
  const sourceMode = view.sourceMode === "manual" ? "local" : view.sourceMode;
  return {
    id: `sentiment:${sentiment.id}`,
    title: `今日市场脉搏：象限 ${view.quadrant ?? "-"} · ${view.strategyLabel}`,
    summary: `${view.quadrantLabel}。VIX ${view.vixValue?.toFixed(2) ?? "--"}（${view.vixLevelLabel}），FGI ${view.fgiScore}/100（${view.fgiLevelLabel}）。${view.strategyDetail}`,
    sourceLabel: view.sourceLabel,
    sourceType: "market-sentiment",
    sourceMode,
    confidenceLabel:
      view.sourceMode === "derived" ? "派生指标" : "缓存外部指数",
    confidence: view.sourceMode === "derived" ? "medium" : "high",
    relevanceScore: 65,
    sourceReliability: view.sourceMode === "derived" ? 58 : 82,
    freshnessLabel: view.freshnessLabel,
    relevanceLabel: "组合级市场脉搏",
    generatedAt: sentiment.asOf,
    expiresAt: sentiment.expiresAt,
    identity: {},
    reason:
      "市场脉搏用于辅助判断今日买入节奏，只影响分批/谨慎提示，不直接覆盖目标配置。",
    keyPoints: [
      `VIX ${view.vixValue?.toFixed(2) ?? "--"} · ${view.vixLevelLabel}`,
      `FGI ${view.fgiScore}/100 · ${view.fgiLevelLabel}`,
      `象限 ${view.quadrant ?? "-"} · ${view.strategyLabel}`,
      view.buySignalLabel,
      view.riskNote,
    ],
    riskFlags: [view.riskNote],
    actions: [
      {
        label: "问大臣",
        type: "ask-minister",
        payload: {
          intelligenceId: `sentiment:${sentiment.id}`,
        },
      },
    ],
    sources: [
      {
        title: sentiment.provider,
        sourceType: "market-sentiment",
        date: sentiment.asOf.slice(0, 10),
        url: sentiment.sourceUrl ?? undefined,
      },
    ],
  };
}

function dedupeItems(items: DailyIntelligenceItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [
      item.sourceType,
      item.identity.securityId ??
        [
          item.identity.symbol,
          item.identity.exchange,
          item.identity.currency,
        ].filter(Boolean).join(":"),
      item.title.trim().toUpperCase(),
    ].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function mapDailyIntelligenceItemToRecommendationBrief(
  item: DailyIntelligenceItem,
): RecommendationsData["intelligenceBriefs"][number] {
  return {
    id: item.id,
    title: item.title,
    detail: item.summary,
    sourceLabel: item.sourceLabel,
    sourceMode: item.sourceMode,
    freshnessLabel: [
      item.freshnessLabel,
      item.confidenceLabel,
      item.relevanceLabel,
    ].filter(Boolean).join(" · "),
    generatedAt: item.generatedAt,
    symbols: [
      item.identity.symbol,
      item.identity.exchange,
      item.identity.currency,
    ].filter((value): value is string => Boolean(value)),
    identity: {
      securityId: item.identity.securityId,
      symbol: item.identity.symbol ?? "UNKNOWN",
      exchange: item.identity.exchange,
      currency: item.identity.currency,
    },
    sources: item.sources.map((source) => ({
      title: source.title,
      sourceType: source.sourceType,
      date: source.date,
    })),
    confidence: item.confidenceLabel.includes("高")
      ? "high"
      : item.confidence ?? (item.confidenceLabel.includes("中")
        ? "medium"
        : item.confidenceLabel.includes("低")
          ? "low"
          : undefined),
    relevanceScore: item.relevanceScore,
    sourceReliability: item.sourceReliability,
    riskFlags: item.riskFlags,
  };
}

export async function getDailyIntelligenceItemsForUser(
  userId: string,
  limit = 8,
  now = new Date(),
) {
  const repositories = getRepositories();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const [documents, analysisRuns, marketSentiment] = await Promise.all([
    repositories.externalResearchDocuments.listFreshByUserId(userId, {
      now,
      limit: safeLimit,
    }),
    repositories.analysisRuns.listRecentByUserId(userId, safeLimit),
    getOrCreateLatestMarketSentiment(now),
  ]);

  return dedupeItems([
    mapMarketSentimentForDailyIntelligence(marketSentiment),
    ...documents.map(mapExternalResearchDocumentForDailyIntelligence),
    ...analysisRuns.map(mapAnalysisRunForDailyIntelligence),
  ])
    .sort((left, right) =>
      Date.parse(right.generatedAt) - Date.parse(left.generatedAt)
    )
    .slice(0, safeLimit);
}

export async function getMobileDailyIntelligenceView(
  userId: string,
  limit = 8,
) {
  const policy = getExternalResearchPolicy();
  const items = await getDailyIntelligenceItemsForUser(userId, limit);

  return apiSuccess<DailyIntelligenceData>({
    generatedAt: new Date().toISOString(),
    policy: {
      manualTriggerOnly: !policy.scheduledOverviewEnabled,
      scheduledOverviewEnabled: policy.scheduledOverviewEnabled,
      securityManualRefreshEnabled: policy.securityManualRefreshEnabled,
      sourceMode: policy.sourceMode,
      disclaimer:
        "Loo国今日秘闻只展示后台每日缓存资料和已保存分析；页面加载不会触发实时新闻、论坛或付费外部 API。",
    },
    items,
    emptyState: {
      title: "暂时没有可用秘闻",
      detail:
        "等待每日 worker 缓存组合秘闻，或在标的详情手动刷新单个标的资料；系统不会在页面加载时抓取新闻或论坛。",
    },
  }, "database");
}
