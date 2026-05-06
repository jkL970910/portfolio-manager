import { apiSuccess } from "@/lib/backend/contracts";
import {
  getOrBuildContextPack,
  globalUserContextPackKey,
  latestRecommendationPackKey,
  LOO_MINISTER_CONTEXT_PACK_TTL_MS,
  projectKnowledgePackKey,
  securityContextPackKey,
  userPreferencePackKey,
} from "@/lib/backend/loo-minister-context-pack-cache";
import { resolveLooMinisterContext } from "@/lib/backend/loo-minister-context-resolver";
import {
  LOO_MINISTER_VERSION,
  type LooMinisterAnswerResult,
  type LooMinisterFact,
  type LooMinisterQuestionRequest,
  type LooMinisterQuestionRequestInput,
  looMinisterQuestionRequestSchema,
  looMinisterAnswerResultSchema,
} from "@/lib/backend/loo-minister-contracts";
import {
  recordLooMinisterUsage,
  resolveLooMinisterSettings,
  type ResolvedLooMinisterSettings,
} from "@/lib/backend/loo-minister-settings";
import type {
  CashAccount,
  HoldingPosition,
  InvestmentAccount,
  PortfolioAnalysisRun,
  PortfolioSnapshot,
  PreferenceProfile,
  RecommendationRun,
} from "@/lib/backend/models";
import { getDailyIntelligenceItemsForUser } from "@/lib/backend/mobile-daily-intelligence";
import { buildPortfolioHealthSummary } from "@/lib/backend/portfolio-health";
import { PORTFOLIO_ANALYZER_DISCLAIMER } from "@/lib/backend/portfolio-analyzer-contracts";
import { getRepositories } from "@/lib/backend/repositories/factory";
import {
  getHoldingEconomicAssetClass,
  inferEconomicAssetClass,
} from "@/lib/backend/security-economic-exposure";
import { extractSecurityMentions } from "@/lib/backend/loo-minister-tools";
import { inferLooMinisterProjectKnowledgeIntent } from "@/lib/backend/loo-minister-domain-knowledge";

const pageLabels: Record<
  LooMinisterQuestionRequest["pageContext"]["page"],
  string
> = {
  overview: "总览",
  portfolio: "组合",
  "account-detail": "账户",
  "holding-detail": "持仓",
  "security-detail": "标的",
  "portfolio-health": "健康巡查",
  recommendations: "推荐",
  import: "导入",
  settings: "设置",
  spending: "收支",
};

const projectKnowledgeItems: Array<{
  id: string;
  label: string;
  pages: Array<LooMinisterQuestionRequest["pageContext"]["page"]>;
  triggers: RegExp[];
  value: string;
  detail: string;
}> = [
  {
    id: "project-feature-overview",
    label: "功能说明：总览",
    pages: ["overview"],
    triggers: [/总览|首页|净资产|total asset|走势|曲线/i],
    value: "总览负责展示 Loo国当前全局状态：总资产、走势图、健康巡查、重点账户、头部持仓和今日秘闻。",
    detail:
      "总览是最高层摘要，不负责深度编辑；如果用户追问具体账户/持仓/标的，应引导进入对应详情页。走势图必须说明真实历史、本地缓存、参考曲线或 stale 状态。",
  },
  {
    id: "project-feature-portfolio",
    label: "功能说明：组合",
    pages: ["portfolio"],
    triggers: [/组合|portfolio|账户|持仓|资产类别|allocation|配置/i],
    value: "组合页负责解释账户、持仓、资产类别分布、FX 折算、报价新鲜度和组合级健康状态。",
    detail:
      "组合页不重复完整今日秘闻，避免每个页面都加载相同情报；它应优先帮助用户定位配置偏离、持仓状态和账户层面的下一步操作。",
  },
  {
    id: "project-feature-security",
    label: "功能说明：标的详情",
    pages: ["security-detail", "holding-detail"],
    triggers: [/标的|security|ticker|listing|买入|适合|适配|价格|报价|刷新/i],
    value: "标的/持仓详情必须按 securityId 或完整 symbol + exchange + currency 回答，不能只按 ticker 合并。",
    detail:
      "价格、走势图、智能快扫、今日秘闻和推荐解释都要保留 listing 身份。US 正股与 CAD listed/CDR/hedged 版本可以共享 underlying 研究背景，但不能共享 listing 价格、FX 和持仓事实。",
  },
  {
    id: "project-feature-recommendations",
    label: "功能说明：推荐",
    pages: ["recommendations"],
    triggers: [/推荐|recommend|v2|v3|候选|买什么|优先/i],
    value: "推荐页当前使用 V2.1 规则核心，并叠加 V3 外部情报层。",
    detail:
      "V2.1 负责目标配置、账户/税务/FX/约束和偏好因子；V3 读取缓存外部情报，不应在页面加载时实时抓新闻或论坛。大臣可解释推荐原因，但保存/执行仍需用户确认。",
  },
  {
    id: "project-feature-preferences",
    label: "功能说明：投资偏好",
    pages: ["settings", "recommendations", "portfolio-health"],
    triggers: [/偏好|preference|factor|风险|行业|科技|能源|买房|税务|现金/i],
    value: "投资偏好保留两条线：新手引导式问答生成完整参数，进阶用户手动编辑所有参数。",
    detail:
      "AI 大臣可以辅助生成草稿，但草稿必须展示给用户确认后才应用。偏好因素会影响健康分解释和推荐排序，但不能绕过目标配置和风险约束。",
  },
  {
    id: "project-feature-health",
    label: "功能说明：健康巡查",
    pages: ["portfolio-health", "overview", "portfolio", "account-detail"],
    triggers: [/health|健康|评分|score|分数|风险护栏|雷达|再平衡|偏离|目标/i],
    value: "Health Score 分全组合和账户两个层级：全组合看总体配置/风险，账户页看账户内适配并参考全组合目标。",
    detail:
      "账户评分不要求每个账户复制全组合目标。大臣解释健康分时应区分 portfolio lens 与 account lens，并说明配置偏离、集中度、现金/流动性、税务/账户位置和数据新鲜度。",
  },
  {
    id: "project-feature-recommendation-constraints",
    label: "功能说明：推荐约束",
    pages: ["recommendations", "settings"],
    triggers: [/约束|constraints|排除|preferred|excluded|偏好标的|账户规则|资产类别区间|security type/i],
    value: "推荐约束是 V2.1 的硬边界/软偏好层：排除标的、偏好标的、账户规则、资产类别区间和 security type 规则会影响推荐排序。",
    detail:
      "排除规则优先级高于偏好规则；偏好标的不会无条件买入，仍要满足目标配置、账户/税务/FX、数据新鲜度和身份匹配。大臣必须解释规则影响，不应直接建议绕过约束。",
  },
  {
    id: "project-feature-daily-intelligence",
    label: "功能说明：Loo国今日秘闻",
    pages: ["overview", "recommendations", "security-detail"],
    triggers: [/秘闻|新闻|论坛|外部信息|external|research|情报|可信度|相关度/i],
    value: "今日秘闻是缓存后的精选情报层，不是页面加载时实时爬新闻或论坛。",
    detail:
      "总览显示全局精选，推荐页显示折叠摘要，标的详情只显示同一 securityId 或完整 symbol/exchange/currency listing 的情报。缺失情报应显示边界，而不是 ticker-only 混入。",
  },
  {
    id: "project-feature-import",
    label: "功能说明：手动导入",
    pages: ["import"],
    triggers: [/导入|import|csv|新增账户|新增持仓|搜索标的|验证/i],
    value: "移动端导入保留手动/引导式账户和持仓导入，不做 CSV MVP。",
    detail:
      "导入时标的搜索/验证必须显示 symbol、exchange/listing market、currency，避免 US common share 和 CAD listing/CDR 混淆。",
  },
  {
    id: "project-feature-data-freshness",
    label: "功能说明：数据新鲜度",
    pages: [
      "overview",
      "portfolio",
      "account-detail",
      "holding-detail",
      "security-detail",
      "settings",
    ],
    triggers: [/新鲜|stale|缓存|刷新|provider|行情|fx|汇率|真实数据|mock|fallback/i],
    value: "行情、历史价格、FX 和外部情报都必须显示来源、新鲜度和 fallback 边界。",
    detail:
      "报价使用 native trading currency 存储，CAD 汇总只在显示/聚合时通过独立 FX cache 折算。刷新失败不能清空旧价格，也不能把参考曲线说成真实走势。",
  },
  {
    id: "project-feature-minister",
    label: "功能说明：AI 大臣",
    pages: [
      "overview",
      "portfolio",
      "account-detail",
      "holding-detail",
      "security-detail",
      "portfolio-health",
      "recommendations",
      "import",
      "settings",
      "spending",
    ],
    triggers: [/大臣|ai|gpt|chatgpt|问答|助手|管家|解释|怎么用|下一步/i],
    value: "AI 大臣是跨页面 Loo国管家，用当前页面资料、用户偏好、推荐、缓存分析和对话上下文回答问题。",
    detail:
      "大臣可以解释功能、数据、推荐、偏好和下一步；它不能自动修改真实数据，不能在未启用 worker/cache 策略时实时抓新闻/论坛，投资相关回答必须保留免责声明。",
  },
];

type CandidateFitContext = {
  version: "candidate-fit.v1";
  analysisMode: "candidate-new-buy" | "existing-holding-review";
  identity: {
    securityId: string | null;
    symbol: string;
    exchange: string | null;
    currency: string | null;
    name: string | null;
  };
  isHeld: boolean;
  currentExposure: {
    holdingCount: number;
    marketValueCad: number;
    holdingWeightPct: number;
    interpretation: string;
  };
  economicExposure: {
    assetClass: string;
    rawAssetClass: string | null;
    source: "page-fact" | "holding" | "inferred";
  };
  target: {
    assetClass: string;
    targetPct: number | null;
    currentSleevePct: number | null;
    gapPct: number | null;
    status: "under-target" | "over-target" | "near-target" | "unknown";
  };
  preference: {
    summary: string;
    completeness: "available" | "missing";
  };
  recommendation: {
    status: "matched-latest-run" | "not-selected-latest-run" | "no-latest-run";
    summary: string;
    detail: string | null;
  };
  dataFreshness: LooMinisterQuestionRequest["pageContext"]["dataFreshness"];
  contextCompleteness: {
    score: number;
    missing: string[];
    blocking: string[];
  };
  rules: string[];
};

type SecurityContext = {
  version: "security-context.v1";
  page: "security-detail" | "holding-detail";
  identity: {
    securityId: string | null;
    symbol: string;
    exchange: string | null;
    currency: string | null;
    name: string | null;
    securityType: string | null;
  };
  holdingExposure: {
    isHeld: boolean;
    holdingCount: number;
    marketValueCad: number;
    holdingWeightPct: number;
    accounts: Array<{
      accountId: string;
      holdingId: string;
      valueCad: number;
      weightPct: number;
    }>;
    interpretation: string;
  };
  economicExposure: {
    assetClass: string;
    rawAssetClass: string | null;
    sector: string | null;
    source: "page-fact" | "holding" | "inferred";
  };
  marketContext: {
    priceLabel: string | null;
    trendLabel: string | null;
    quoteAsOf: string | null;
    chartFreshness: string;
    sourceMode: string;
    provider: string | null;
    warnings: string[];
  };
  cachedIntelligence: {
    count: number;
    summaries: string[];
  };
  analysisCache: {
    count: number;
    summaries: string[];
  };
  contextCompleteness: {
    score: number;
    missing: string[];
    blocking: string[];
  };
  rules: string[];
};

type PortfolioContext = {
  version: "portfolio-context.v1";
  page: "overview" | "portfolio" | "portfolio-health" | "recommendations";
  summary: {
    totalMarketValueCad: number;
    cashBalanceCad: number;
    totalNetWorthCad: number;
    accountCount: number;
    holdingCount: number;
    topHolding: string | null;
  };
  accounts: Array<{
    accountId: string;
    label: string;
    type: string;
    valueCad: number;
    weightPct: number;
  }>;
  assetAllocation: Array<{
    assetClass: string;
    valueCad: number;
    currentPct: number;
    targetPct: number | null;
    gapPct: number | null;
    status: "under-target" | "over-target" | "near-target" | "unknown";
  }>;
  concentration: {
    topHoldings: Array<{
      holdingId: string;
      symbol: string;
      name: string;
      valueCad: number;
      weightPct: number;
      assetClass: string;
    }>;
    topFiveWeightPct: number;
    largestHoldingWeightPct: number;
  };
  health: {
    score: number | null;
    status: string | null;
    weakestDimension: string | null;
    strongestDimension: string | null;
    actionQueue: string[];
  };
  preference: {
    summary: string;
    riskProfile: string;
    cashBufferTargetCad: number;
    source: string | null;
  };
  recommendation: {
    runId: string | null;
    engineVersion: string | null;
    topItems: string[];
    assumptions: string[];
  };
  dataFreshness: LooMinisterQuestionRequest["pageContext"]["dataFreshness"];
  cachedIntelligence: {
    count: number;
    summaries: string[];
  };
  analysisCache: {
    count: number;
    summaries: string[];
  };
  contextCompleteness: {
    score: number;
    missing: string[];
    blocking: string[];
  };
  rules: string[];
};

type GlobalUserContext = {
  version: "global-user-context.v1";
  summary: PortfolioContext["summary"];
  topHoldings: PortfolioContext["concentration"]["topHoldings"];
  leadAllocation: PortfolioContext["assetAllocation"][number] | null;
  health: PortfolioContext["health"];
  preference: PortfolioContext["preference"];
  recommendation: PortfolioContext["recommendation"];
  contextCompleteness: PortfolioContext["contextCompleteness"];
  asOf: string;
};

function factDisplayPriority(fact: LooMinisterFact) {
  if (fact.source === "external-intelligence") return 0;
  if (fact.source === "analysis-cache") return 1;
  if (fact.source === "quote-cache") return 2;
  if (fact.source === "portfolio-data") return 3;
  if (fact.source === "fx-cache") return 4;
  if (fact.source === "user-input") return 5;
  if (fact.id.startsWith("context-resolver-status-")) return 6;
  if (fact.id.startsWith("project-feature-")) return 8;
  return 7;
}

function summarizeFacts(facts: LooMinisterFact[]) {
  const sorted = [...facts].sort((a, b) => {
    return factDisplayPriority(a) - factDisplayPriority(b);
  });
  return sorted
    .slice(0, 5)
    .map(
      (fact) =>
        `${fact.label}: ${fact.value}${fact.detail ? `（${fact.detail}）` : ""}`,
    );
}

function isUserFacingFact(fact: LooMinisterFact) {
  if (
    [
      "candidate-fit-context",
      "portfolio-context",
      "security-context",
      "global-user-context",
    ].includes(fact.id)
  ) {
    return false;
  }
  return !fact.detail?.trim().startsWith("{");
}

function formatSourceModeForUser(sourceMode: string | null | undefined) {
  switch (sourceMode) {
    case "local":
      return "本地资料";
    case "cached-external":
      return "已缓存外部资料";
    case "live-external":
      return "实时外部资料";
    case "reference":
      return "参考资料";
    default:
      return sourceMode ?? "未知";
  }
}

function formatChartFreshnessForUser(chartFreshness: string | null | undefined) {
  switch (chartFreshness) {
    case "fresh":
      return "正常";
    case "stale":
      return "可能过期";
    case "reference":
      return "参考曲线";
    case "missing":
      return "缺少历史";
    case "unknown":
      return "未知";
    default:
      return chartFreshness ?? "未知";
  }
}

function formatTargetStatusForUser(
  status: CandidateFitContext["target"]["status"],
) {
  switch (status) {
    case "under-target":
      return "同类资产低于目标";
    case "over-target":
      return "同类资产高于目标";
    case "near-target":
      return "同类资产接近目标";
    default:
      return "目标暂未完全匹配";
  }
}

function formatCandidateMissingItemForUser(item: string) {
  switch (item) {
    case "asset-class target":
      return "这类资产的目标比例";
    case "latest recommendation run":
      return "最新推荐结果";
    case "quote timestamp":
      return "报价时间";
    default:
      return item;
  }
}

function formatDataBoundaryForUser(
  freshness: LooMinisterQuestionRequest["pageContext"]["dataFreshness"],
) {
  return [
    `组合：${freshness.portfolioAsOf ?? "未知"}`,
    `报价：${freshness.quotesAsOf ?? "未知"}`,
    `汇率：${freshness.fxAsOf ?? "未知"}`,
    `图表：${formatChartFreshnessForUser(freshness.chartFreshness)}`,
    `来源：${formatSourceModeForUser(freshness.sourceMode)}`,
  ].join("；");
}

function dedupeFacts(facts: LooMinisterFact[]) {
  return Array.from(new Map(facts.map((fact) => [fact.id, fact])).values());
}

function mergeMinisterRequests(
  ...requests: LooMinisterQuestionRequest[]
): LooMinisterQuestionRequest {
  const [first] = requests;
  const mergedFacts = dedupeFacts(
    requests.flatMap((request) => request.pageContext.facts),
  ).slice(0, 40);
  const mergedWarnings = Array.from(
    new Set(requests.flatMap((request) => request.pageContext.warnings)),
  ).slice(0, 20);

  return {
    ...first,
    pageContext: {
      ...first.pageContext,
      facts: mergedFacts,
      warnings: mergedWarnings,
    },
  };
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function isCandidateFitQuestion(question: string) {
  return /适合|适配|买入|能买吗|值得|加仓|建仓|candidate|buy|fit/i.test(
    question,
  );
}

function isAnalysisRequestQuestion(question: string) {
  return /帮我.*分析|分析一下|做.*分析|跑.*快扫|运行.*快扫|生成.*快扫|quick.?scan|analy[sz]e|analysis/i.test(
    question,
  );
}

function isComparisonQuestion(question: string) {
  return /对比|比较|相比|比呢|和.+比|versus| vs\.? |compare/i.test(question);
}

function isProductHelpQuestion(question: string) {
  return /是什么|怎么|如何|为什么|哪里|入口|功能|流程|页面|tab|使用|下一步|区别|解释|作用|meaning|how|what|why/i.test(
    question,
  );
}

function isPreferenceQuestion(question: string) {
  return /偏好|preference|factor|风险|行业|科技|能源|买房|税务|现金|新手|进阶/i.test(
    question,
  );
}

function isRecommendationQuestion(question: string) {
  return /推荐|recommend|v2|v3|overlay|候选|买什么|优先|为什么推荐|约束|排除|preferred|excluded/i.test(
    question,
  );
}

function isHealthQuestion(question: string) {
  return /health|健康|评分|score|风险护栏|雷达|偏离|再平衡|目标|账户评分|组合评分/i.test(
    question,
  );
}

function isPortfolioQuestion(question: string) {
  return /整体|组合|持仓|总资产|资产配置|配置|集中度|最大问题|最大风险|下一步|调整|再平衡|账户分布|现金|净资产|portfolio|allocation|holdings/i.test(
    question,
  );
}

function isSecurityDetailQuestion(question: string) {
  return /这个标的|这个持仓|走势|价格|秘闻|新闻|风险|作用|表现|详情|怎么看|需要注意/i.test(
    question,
  );
}

function isSecurityMentionQuestion(question: string) {
  return (
    extractSecurityMentions(question).length > 0 &&
    (isCandidateFitQuestion(question) ||
      isSecurityDetailQuestion(question) ||
      /标的|股票|ETF|基金|ticker|代码|候选|买|风险|作用|表现|走势|价格|适合|适配/i.test(
        question,
      ))
  );
}

function isFreshnessQuestion(question: string) {
  return /新鲜|stale|缓存|刷新|provider|行情|fx|汇率|真实数据|mock|fallback|过期|报价|走势/i.test(
    question,
  );
}

function findFact(facts: LooMinisterFact[], id: string) {
  return facts.find((fact) => fact.id === id);
}

function isUsableAssetClass(value: string | null | undefined) {
  const normalized = value?.trim();
  return Boolean(
    normalized &&
      !/未知|未确认|unknown|n\/a|--/i.test(normalized),
  );
}

function prioritizeFactsForPrompt(
  facts: LooMinisterFact[],
  input: LooMinisterQuestionRequest,
) {
  const candidateQuestion =
    input.pageContext.page === "security-detail" &&
    Boolean(input.pageContext.subject.security) &&
    isCandidateFitQuestion(input.question);

  return [...facts].sort((a, b) => {
    const aSecurity = a.id.startsWith("security-context") ? 0 : 1;
    const bSecurity = b.id.startsWith("security-context") ? 0 : 1;
    if (aSecurity !== bSecurity) return aSecurity - bSecurity;

    if (candidateQuestion) {
      const aCandidate = a.id.startsWith("candidate-") ? 0 : 1;
      const bCandidate = b.id.startsWith("candidate-") ? 0 : 1;
      if (aCandidate !== bCandidate) return aCandidate - bCandidate;
    }

    const aPortfolio = a.id.startsWith("portfolio-context") ? 0 : 1;
    const bPortfolio = b.id.startsWith("portfolio-context") ? 0 : 1;
    if (aPortfolio !== bPortfolio) return aPortfolio - bPortfolio;

    const aGlobal = a.id.startsWith("global-user-context") ? 0 : 1;
    const bGlobal = b.id.startsWith("global-user-context") ? 0 : 1;
    if (aGlobal !== bGlobal) return aGlobal - bGlobal;

    return factDisplayPriority(a) - factDisplayPriority(b);
  });
}

function getRunAnalysisActions(input: LooMinisterQuestionRequest) {
  if (!isAnalysisRequestQuestion(input.question)) {
    return [];
  }
  return input.pageContext.allowedActions
    .filter((action) => action.actionType === "run-analysis")
    .map((action) => ({
      ...action,
      requiresConfirmation: true,
    }))
    .slice(0, 3);
}

function attachDeterministicSuggestedActions(
  input: LooMinisterQuestionRequest,
  answer: LooMinisterAnswerResult,
) {
  const runAnalysisActions = getRunAnalysisActions(input);
  if (runAnalysisActions.length === 0) {
    return looMinisterAnswerResultSchema.parse(
      ensureStructuredMinisterAnswer(answer),
    );
  }

  return looMinisterAnswerResultSchema.parse({
    ...ensureStructuredMinisterAnswer(answer),
    suggestedActions: runAnalysisActions,
  });
}

function splitAnswerLines(answer: string) {
  return answer
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function truncateStructuredText(value: string | null, maxLength: number) {
  if (!value) {
    return value;
  }
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function ensureStructuredMinisterAnswer(
  answer: LooMinisterAnswerResult,
): LooMinisterAnswerResult {
  if (answer.structured) {
    return answer;
  }

  const lines = splitAnswerLines(answer.answer);
  const directAnswer = lines[0] ?? answer.answer;
  const reasoning = lines.slice(1, 4);
  const decisionGates = [
    ...answer.keyPoints.slice(0, 3),
    ...lines.filter((line) =>
      /确认|护栏|边界|新鲜|缺口|账户|税务|汇率|风险/.test(line),
    ).slice(0, 3),
  ].slice(0, 6);
  const boundary =
    lines.find((line) => /边界|新鲜|缓存|不构成|实时|来源|资料完整度/.test(line)) ??
    null;
  const nextStep =
    lines.find((line) => /下一步|建议|确认|运行|进入|点击/.test(line)) ??
    answer.keyPoints[0] ??
    null;

  return {
    ...answer,
    structured: {
      directAnswer: truncateStructuredText(directAnswer, 700) ?? answer.title,
      reasoning: reasoning
        .map((line) => truncateStructuredText(line, 500))
        .filter((line): line is string => Boolean(line)),
      decisionGates: decisionGates
        .map((line) => truncateStructuredText(line, 500))
        .filter((line): line is string => Boolean(line)),
      boundary: truncateStructuredText(boundary, 700),
      nextStep: truncateStructuredText(nextStep, 500),
    },
  };
}

async function buildProjectKnowledgeFacts(
  input: LooMinisterQuestionRequest,
): Promise<LooMinisterFact[]> {
  return (
    await getOrBuildContextPack({
      key: projectKnowledgePackKey({
        version: LOO_MINISTER_VERSION,
        page: input.pageContext.page,
        intent: inferLooMinisterProjectKnowledgeIntent({
          page: input.pageContext.page,
          question: input.question,
        }),
      }),
      kind: "project-knowledge",
      ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.projectKnowledge,
      build: () => {
        const { pageContext, question } = input;
        const selected = projectKnowledgeItems.filter(
          (item) =>
            item.pages.includes(pageContext.page) ||
            item.triggers.some((trigger) => trigger.test(question)),
        );
        const unique = new Map<
          string,
          (typeof projectKnowledgeItems)[number]
        >();
        for (const item of selected) {
          unique.set(item.id, item);
        }

        const items = Array.from(unique.values()).slice(0, 5);
        return items.map((item) => ({
          id: item.id,
          label: item.label,
          value: item.value.slice(0, 240),
          detail: item.detail.slice(0, 600),
          source: "system" as const,
        }));
      },
    })
  ).data;
}

function hasProjectKnowledge(facts: LooMinisterFact[]) {
  return facts.some((fact) => fact.id.startsWith("project-feature-"));
}

function getSecurityDisplayName(
  security: LooMinisterQuestionRequest["pageContext"]["subject"]["security"],
) {
  if (!security) return "这个标的";
  return [security.symbol, security.exchange, security.currency]
    .filter(Boolean)
    .join(" · ");
}

function matchesSecurityIdentity(
  security: LooMinisterQuestionRequest["pageContext"]["subject"]["security"],
  input: {
    securityId?: string | null;
    symbol?: string | null;
    exchange?: string | null;
    currency?: string | null;
  },
) {
  if (!security) return false;
  const securityId = normalizeKey(security.securityId);
  if (securityId && normalizeKey(input.securityId) === securityId) {
    return true;
  }

  const symbol = normalizeKey(security.symbol);
  const exchange = normalizeKey(security.exchange);
  const currency = normalizeKey(security.currency);
  return Boolean(symbol && exchange && currency) &&
    normalizeKey(input.symbol) === symbol &&
    normalizeKey(input.exchange) === exchange &&
    normalizeKey(input.currency) === currency;
}

function formatPct(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(1)}%`
    : "未记录";
}

function formatCad(value: number) {
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function summarizePreferenceProfile(profile: PreferenceProfile) {
  const factors = profile.preferenceFactors;
  const preferred = [
    ...factors.sectorTilts.preferredSectors,
    ...factors.sectorTilts.styleTilts,
    ...factors.sectorTilts.thematicInterests,
  ].slice(0, 5);
  const avoided = factors.sectorTilts.avoidedSectors.slice(0, 4);
  const homeGoal = factors.lifeGoals.homePurchase.enabled
    ? `买房目标：${factors.lifeGoals.homePurchase.priority} 优先级，期限 ${factors.lifeGoals.homePurchase.horizonYears ?? "未填"} 年`
    : "买房目标：未启用";

  return [
    `风险档位 ${profile.riskProfile}`,
    `集中度容忍 ${factors.behavior.concentrationTolerance}`,
    preferred.length > 0 ? `偏好 ${preferred.join(" / ")}` : "未设置行业/风格偏好",
    avoided.length > 0 ? `回避 ${avoided.join(" / ")}` : "未设置回避行业",
    homeGoal,
    `USD 路径 ${factors.taxStrategy.usdFundingPath}`,
  ].join("；");
}

function getTargetAllocationForAssetClass(
  profile: PreferenceProfile,
  assetClass: string,
) {
  return profile.targetAllocation.find(
    (target) =>
      normalizeKey(target.assetClass) === normalizeKey(assetClass),
  )?.targetPct;
}

function findRecommendationMatch(
  security: LooMinisterQuestionRequest["pageContext"]["subject"]["security"],
  run: RecommendationRun,
) {
  return run.items.find((item) =>
    matchesSecurityIdentity(security, {
      securityId: item.securityId,
      symbol: item.securitySymbol,
      exchange: item.securityExchange,
      currency: item.securityCurrency,
    }),
  );
}

function getMatchingHoldings(
  security: LooMinisterQuestionRequest["pageContext"]["subject"]["security"],
  holdings: HoldingPosition[],
) {
  return holdings.filter((holding) =>
    matchesSecurityIdentity(security, {
      securityId: holding.securityId,
      symbol: holding.symbol,
      exchange: holding.exchangeOverride,
      currency: holding.currency,
    }),
  );
}

function isPortfolioContextPage(
  page: LooMinisterQuestionRequest["pageContext"]["page"],
): page is PortfolioContext["page"] {
  return (
    page === "overview" ||
    page === "portfolio" ||
    page === "portfolio-health" ||
    page === "recommendations"
  );
}

function portfolioContextPageForInput(
  page: LooMinisterQuestionRequest["pageContext"]["page"],
): PortfolioContext["page"] {
  return isPortfolioContextPage(page) ? page : "portfolio";
}

function getPortfolioContext(input: LooMinisterQuestionRequest) {
  const fact = findFact(input.pageContext.facts, "portfolio-context");
  if (!fact?.detail) return null;
  try {
    const parsed = JSON.parse(fact.detail) as PortfolioContext;
    return parsed.version === "portfolio-context.v1" ? parsed : null;
  } catch {
    return null;
  }
}

function getGlobalUserContext(input: LooMinisterQuestionRequest) {
  const fact = findFact(input.pageContext.facts, "global-user-context");
  if (!fact?.detail) return null;
  try {
    const parsed = JSON.parse(fact.detail) as GlobalUserContext;
    return parsed.version === "global-user-context.v1" ? parsed : null;
  } catch {
    return null;
  }
}

function formatGlobalUserContextLine(context: GlobalUserContext) {
  return `全局用户背景：净资产 ${formatCad(context.summary.totalNetWorthCad)}；投资资产 ${formatCad(context.summary.totalMarketValueCad)}；现金 ${formatCad(context.summary.cashBalanceCad)}；账户 ${context.summary.accountCount}；持仓 ${context.summary.holdingCount}；风险档位 ${context.preference.riskProfile}。`;
}

function formatGlobalUserTopHoldings(context: GlobalUserContext) {
  return context.topHoldings.length > 0
    ? context.topHoldings
        .slice(0, 5)
        .map(
          (holding) =>
            `${holding.symbol} ${formatPct(holding.weightPct)} / ${holding.assetClass}`,
        )
        .join("、")
    : "未记录";
}

function buildPortfolioContext(args: {
  input: LooMinisterQuestionRequest;
  accounts: InvestmentAccount[];
  cashAccounts: CashAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  recommendationRun: RecommendationRun | null;
  snapshots: PortfolioSnapshot[];
  analysisRuns: PortfolioAnalysisRun[];
}): PortfolioContext {
  const totalMarketValueCad = args.holdings.reduce(
    (sum, holding) => sum + holding.marketValueCad,
    0,
  );
  const cashBalanceCad = args.cashAccounts.reduce(
    (sum, account) => sum + account.currentBalanceCad,
    0,
  );
  const totalNetWorthCad = totalMarketValueCad + cashBalanceCad;
  const accountValueTotal = args.accounts.reduce(
    (sum, account) => sum + account.marketValueCad,
    0,
  );
  const accountRows = args.accounts
    .map((account) => ({
      accountId: account.id,
      label: account.nickname || account.institution || account.type,
      type: account.type,
      valueCad: account.marketValueCad,
      weightPct:
        accountValueTotal > 0
          ? (account.marketValueCad / accountValueTotal) * 100
          : 0,
    }))
    .sort((left, right) => right.valueCad - left.valueCad);
  const byAssetClass = new Map<string, number>();
  for (const holding of args.holdings) {
    const assetClass = getHoldingEconomicAssetClass(holding);
    byAssetClass.set(
      assetClass,
      (byAssetClass.get(assetClass) ?? 0) + holding.marketValueCad,
    );
  }
  const targetMap = new Map(
    args.profile.targetAllocation.map((target) => [
      normalizeKey(target.assetClass),
      target.targetPct,
    ]),
  );
  const allocationRows = Array.from(byAssetClass.entries())
    .map(([assetClass, valueCad]) => {
      const currentPct =
        totalMarketValueCad > 0 ? (valueCad / totalMarketValueCad) * 100 : 0;
      const targetPct = targetMap.get(normalizeKey(assetClass)) ?? null;
      const gapPct =
        typeof targetPct === "number" ? targetPct - currentPct : null;
      const status: PortfolioContext["assetAllocation"][number]["status"] =
        gapPct == null
          ? "unknown"
          : Math.abs(gapPct) <= args.profile.rebalancingTolerancePct
            ? "near-target"
            : gapPct > 0
              ? "under-target"
              : "over-target";
      return {
        assetClass,
        valueCad,
        currentPct,
        targetPct,
        gapPct,
        status,
      };
    })
    .sort((left, right) => right.valueCad - left.valueCad);
  const topHoldings = [...args.holdings]
    .sort((left, right) => right.marketValueCad - left.marketValueCad)
    .slice(0, 8)
    .map((holding) => ({
      holdingId: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      valueCad: holding.marketValueCad,
      weightPct: holding.weightPct ?? 0,
      assetClass: getHoldingEconomicAssetClass(holding),
    }));
  const health =
    args.accounts.length > 0 || args.holdings.length > 0
      ? buildPortfolioHealthSummary({
          accounts: args.accounts,
          holdings: args.holdings,
          profile: args.profile,
          language: "zh",
          scopeLevel: "portfolio",
        })
      : null;
  const intelligenceFacts = args.input.pageContext.facts.filter(
    (fact) => fact.source === "external-intelligence",
  );
  const analysisFacts = args.input.pageContext.facts.filter(
    (fact) => fact.source === "analysis-cache",
  );
  const latestSnapshot = [...args.snapshots].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )[0];
  const missing = [
    args.accounts.length > 0 ? null : "accounts",
    args.holdings.length > 0 ? null : "holdings",
    args.profile ? null : "preference profile",
    args.recommendationRun ? null : "latest recommendation run",
    latestSnapshot ? null : "portfolio snapshot",
    args.input.pageContext.dataFreshness.quotesAsOf ? null : "quote timestamp",
  ].filter((item): item is string => Boolean(item));

  return {
    version: "portfolio-context.v1",
    page: portfolioContextPageForInput(args.input.pageContext.page),
    summary: {
      totalMarketValueCad,
      cashBalanceCad,
      totalNetWorthCad,
      accountCount: args.accounts.length,
      holdingCount: args.holdings.length,
      topHolding: topHoldings[0]
        ? `${topHoldings[0].symbol} ${formatPct(topHoldings[0].weightPct)}`
        : null,
    },
    accounts: accountRows.slice(0, 8),
    assetAllocation: allocationRows.slice(0, 8),
    concentration: {
      topHoldings,
      topFiveWeightPct: topHoldings
        .slice(0, 5)
        .reduce((sum, holding) => sum + holding.weightPct, 0),
      largestHoldingWeightPct: topHoldings[0]?.weightPct ?? 0,
    },
    health: {
      score: health?.score ?? null,
      status: health?.status ?? null,
      weakestDimension: health?.weakestDimension.label ?? null,
      strongestDimension: health?.strongestDimension.label ?? null,
      actionQueue: health?.actionQueue.slice(0, 5) ?? [],
    },
    preference: {
      summary: summarizePreferenceProfile(args.profile),
      riskProfile: args.profile.riskProfile,
      cashBufferTargetCad: args.profile.cashBufferTargetCad,
      source: args.profile.source ?? null,
    },
    recommendation: {
      runId: args.recommendationRun?.id ?? null,
      engineVersion: args.recommendationRun?.engineVersion ?? null,
      topItems:
        args.recommendationRun?.items
          .slice(0, 4)
          .map(
            (item) =>
              `${item.assetClass}: ${formatCad(item.amountCad)} -> ${item.targetAccountType}${item.securitySymbol ? ` / ${item.securitySymbol}` : ""}`,
          ) ?? [],
      assumptions: args.recommendationRun?.assumptions.slice(0, 3) ?? [],
    },
    dataFreshness: args.input.pageContext.dataFreshness,
    cachedIntelligence: {
      count: intelligenceFacts.length,
      summaries: intelligenceFacts
        .slice(0, 3)
        .map((fact) => `${fact.label}: ${fact.value}`),
    },
    analysisCache: {
      count: analysisFacts.length + args.analysisRuns.length,
      summaries: [
        ...analysisFacts
          .filter((fact) => fact.id !== "portfolio-context")
          .slice(0, 3)
          .map((fact) => `${fact.label}: ${fact.value}`),
        ...args.analysisRuns
          .slice(0, 3)
          .map((run) => `${run.scope}: ${run.generatedAt}`),
      ].slice(0, 5),
    },
    contextCompleteness: {
      score: Math.max(35, 100 - missing.length * 10),
      missing,
      blocking: [],
    },
    rules: [
      "Use portfolio-context.v1 for whole-portfolio, overall holdings, allocation, risk, Health, and Recommendation questions.",
      "Do not answer whole-portfolio questions from a single security context.",
      "Preserve data freshness and quote/FX boundaries.",
      "Security-specific follow-ups must switch to security-context.v1.",
    ],
  };
}

async function buildPortfolioContextDataPack(userId: string) {
  const repositories = getRepositories();
  const [
    accounts,
    cashAccounts,
    holdings,
    profile,
    recommendationRun,
    snapshots,
    analysisRuns,
  ] = await Promise.all([
    repositories.accounts.listByUserId(userId),
    repositories.cashAccounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.preferences.getByUserId(userId),
    repositories.recommendations
      .getLatestByUserId(userId)
      .catch(() => null),
    repositories.snapshots.listByUserId(userId),
    repositories.analysisRuns.listRecentByUserId(userId, 5),
  ]);
  return {
    accounts,
    cashAccounts,
    holdings,
    profile,
    recommendationRun,
    snapshots,
    analysisRuns,
  };
}

function mapPortfolioContextFacts(context: PortfolioContext): LooMinisterFact[] {
  const leadAllocation = context.assetAllocation[0];
  return [
    {
      id: "portfolio-context",
      label: "组合上下文",
      value: `${formatCad(context.summary.totalNetWorthCad)} · ${context.summary.holdingCount} holdings · context ${context.contextCompleteness.score}/100`,
      detail: JSON.stringify(context),
      source: "analysis-cache",
    },
    {
      id: "portfolio-context-summary",
      label: "组合总览上下文",
      value: `投资资产 ${formatCad(context.summary.totalMarketValueCad)}；现金 ${formatCad(context.summary.cashBalanceCad)}；账户 ${context.summary.accountCount}；持仓 ${context.summary.holdingCount}`,
      detail: context.summary.topHolding
        ? `最大持仓：${context.summary.topHolding}`
        : undefined,
      source: "portfolio-data",
    },
    {
      id: "portfolio-context-allocation",
      label: "组合配置上下文",
      value: leadAllocation
        ? `${leadAllocation.assetClass} ${formatPct(leadAllocation.currentPct)}；目标 ${formatPct(leadAllocation.targetPct)}；缺口 ${formatPct(leadAllocation.gapPct)}`
        : "暂无资产类别配置",
      detail: context.assetAllocation
        .slice(0, 5)
        .map(
          (item) =>
            `${item.assetClass}: 当前 ${formatPct(item.currentPct)} / 目标 ${formatPct(item.targetPct)} / gap ${formatPct(item.gapPct)} / ${item.status}`,
        )
        .join("；"),
      source: "analysis-cache",
    },
    {
      id: "portfolio-context-health",
      label: "组合健康上下文",
      value:
        context.health.score == null
          ? "健康分未生成"
          : `健康分 ${context.health.score} · ${context.health.status ?? "状态未记录"}`,
      detail: [
        context.health.weakestDimension
          ? `最弱：${context.health.weakestDimension}`
          : null,
        context.health.strongestDimension
          ? `最强：${context.health.strongestDimension}`
          : null,
        ...context.health.actionQueue.slice(0, 2),
      ]
        .filter(Boolean)
        .join("；") || undefined,
      source: "analysis-cache",
    },
  ];
}

function buildGlobalUserContext(
  portfolioContext: PortfolioContext,
  asOf: string,
): GlobalUserContext {
  return {
    version: "global-user-context.v1",
    summary: portfolioContext.summary,
    topHoldings: portfolioContext.concentration.topHoldings.slice(0, 5),
    leadAllocation: portfolioContext.assetAllocation[0] ?? null,
    health: portfolioContext.health,
    preference: portfolioContext.preference,
    recommendation: {
      ...portfolioContext.recommendation,
      topItems: portfolioContext.recommendation.topItems.slice(0, 3),
      assumptions: portfolioContext.recommendation.assumptions.slice(0, 2),
    },
    contextCompleteness: portfolioContext.contextCompleteness,
    asOf,
  };
}

function mapGlobalUserContextFacts(context: GlobalUserContext): LooMinisterFact[] {
  const leadAllocation = context.leadAllocation;
  return [
    {
      id: "global-user-context",
      label: "全局用户上下文",
      value: `${formatCad(context.summary.totalNetWorthCad)} · ${context.summary.holdingCount} 个持仓 · ${context.preference.riskProfile}`,
      detail: JSON.stringify(context),
      source: "analysis-cache",
    },
    {
      id: "global-user-context-summary",
      label: "用户组合摘要",
      value: `投资资产 ${formatCad(context.summary.totalMarketValueCad)}；现金 ${formatCad(context.summary.cashBalanceCad)}；账户 ${context.summary.accountCount}；持仓 ${context.summary.holdingCount}`,
      detail: context.topHoldings.length > 0
        ? `前几大持仓：${context.topHoldings
            .map((holding) => `${holding.symbol} ${formatPct(holding.weightPct)}`)
            .join("、")}`
        : undefined,
      source: "portfolio-data",
    },
    {
      id: "global-user-context-preference",
      label: "用户投资偏好",
      value: context.preference.summary.slice(0, 240),
      detail: [
        `风险档位：${context.preference.riskProfile}`,
        `现金缓冲目标：${formatCad(context.preference.cashBufferTargetCad)}`,
        context.preference.source ? `来源：${context.preference.source}` : null,
      ]
        .filter(Boolean)
        .join("；") || undefined,
      source: "user-input",
    },
    {
      id: "global-user-context-allocation",
      label: "用户配置背景",
      value: leadAllocation
        ? `${leadAllocation.assetClass} 当前 ${formatPct(leadAllocation.currentPct)}；目标 ${formatPct(leadAllocation.targetPct)}；缺口 ${formatPct(leadAllocation.gapPct)}`
        : "暂无主要配置缺口",
      detail:
        context.health.score == null
          ? undefined
          : `Health ${context.health.score}；最弱维度 ${context.health.weakestDimension ?? "未记录"}；最强维度 ${context.health.strongestDimension ?? "未记录"}`,
      source: "analysis-cache",
    },
    {
      id: "global-user-context-recommendation",
      label: "用户最新推荐背景",
      value: context.recommendation.runId
        ? `${context.recommendation.engineVersion ?? "推荐版本未记录"}；${context.recommendation.topItems[0] ?? "无推荐摘要"}`
        : "暂无最新推荐批次",
      detail: [
        ...context.recommendation.topItems.slice(0, 3),
        ...context.recommendation.assumptions.slice(0, 2),
      ].join("；") || undefined,
      source: "analysis-cache",
    },
  ];
}

function getSecurityContext(input: LooMinisterQuestionRequest) {
  const fact = findFact(input.pageContext.facts, "security-context");
  if (!fact?.detail) return null;
  try {
    const parsed = JSON.parse(fact.detail) as SecurityContext;
    return parsed.version === "security-context.v1" ? parsed : null;
  } catch {
    return null;
  }
}

function getSecurityFromHolding(holding: HoldingPosition) {
  return {
    securityId: holding.securityId ?? null,
    symbol: holding.symbol,
    exchange: holding.exchangeOverride ?? null,
    currency: holding.currency ?? null,
    name: holding.name,
    securityType: holding.securityTypeOverride ?? null,
  } satisfies NonNullable<
    LooMinisterQuestionRequest["pageContext"]["subject"]["security"]
  >;
}

function getSecurityContextSubject(args: {
  input: LooMinisterQuestionRequest;
  holdings: HoldingPosition[];
}) {
  const security = args.input.pageContext.subject.security;
  if (security) {
    return {
      security,
      currentHolding: args.input.pageContext.subject.holdingId
        ? args.holdings.find(
            (holding) => holding.id === args.input.pageContext.subject.holdingId,
          ) ?? null
        : null,
    };
  }

  const holdingId = args.input.pageContext.subject.holdingId;
  const currentHolding = holdingId
    ? args.holdings.find((holding) => holding.id === holdingId) ?? null
    : null;
  if (!currentHolding) return null;
  return {
    security: getSecurityFromHolding(currentHolding),
    currentHolding,
  };
}

function getFactValue(
  facts: LooMinisterFact[],
  patterns: Array<string | RegExp>,
) {
  return facts.find((fact) =>
    patterns.some((pattern) =>
      typeof pattern === "string"
        ? fact.id === pattern || fact.label.includes(pattern)
        : pattern.test(fact.id) || pattern.test(fact.label),
    ),
  )?.value ?? null;
}

function buildSecurityContext(args: {
  input: LooMinisterQuestionRequest;
  holdings: HoldingPosition[];
}): SecurityContext {
  if (
    args.input.pageContext.page !== "security-detail" &&
    args.input.pageContext.page !== "holding-detail"
  ) {
    throw new Error("Security context requires a security or holding detail page.");
  }

  const subject = getSecurityContextSubject(args);
  if (!subject) {
    throw new Error("Security context requires security identity or holdingId.");
  }

  const { security, currentHolding } = subject;
  const matchingHoldings = getMatchingHoldings(security, args.holdings);
  const holdingsForContext =
    matchingHoldings.length > 0
      ? matchingHoldings
      : currentHolding
        ? [currentHolding]
        : [];
  const marketValueCad = holdingsForContext.reduce(
    (sum, holding) => sum + holding.marketValueCad,
    0,
  );
  const holdingWeightPct = holdingsForContext.reduce(
    (sum, holding) => sum + (holding.weightPct ?? 0),
    0,
  );
  const facts = args.input.pageContext.facts;
  const pageAssetClass = getFactValue(facts, ["asset-class", "资产类别"]);
  const holdingAssetClass = holdingsForContext[0]?.assetClass ?? null;
  const rawAssetClass = pageAssetClass ?? holdingAssetClass;
  const assetClassSource: SecurityContext["economicExposure"]["source"] =
    isUsableAssetClass(pageAssetClass)
      ? "page-fact"
      : holdingAssetClass
        ? "holding"
        : "inferred";
  const assetClass = inferEconomicAssetClass({
    symbol: security.symbol,
    name: security.name,
    assetClass: isUsableAssetClass(rawAssetClass) ? rawAssetClass : null,
    securityType: security.securityType ?? holdingsForContext[0]?.securityTypeOverride,
    currency: security.currency ?? holdingsForContext[0]?.currency,
  });
  const sector =
    getFactValue(facts, ["sector", "行业"]) ??
    holdingsForContext[0]?.sector ??
    null;
  const quoteFacts = facts.filter(
    (fact) => fact.source === "quote-cache" || fact.source === "fx-cache",
  );
  const analysisFacts = facts.filter((fact) => fact.source === "analysis-cache");
  const intelligenceFacts = facts.filter(
    (fact) => fact.source === "external-intelligence",
  );
  const provider =
    getFactValue(facts, [/provider/i, "来源", "Provider"]) ??
    holdingsForContext.find((holding) => holding.quoteProvider)?.quoteProvider ??
    null;
  const missing = [
    security.securityId ? null : "securityId",
    security.exchange ? null : "exchange",
    security.currency ? null : "currency",
    args.input.pageContext.dataFreshness.quotesAsOf ? null : "quote timestamp",
    holdingsForContext.length > 0 ? null : "holding exposure",
  ].filter((item): item is string => Boolean(item));
  const blocking = [
    security.symbol ? null : "symbol",
    !security.exchange || !security.currency
      ? "listing identity exchange/currency"
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    version: "security-context.v1",
    page: args.input.pageContext.page,
    identity: {
      securityId: security.securityId ?? null,
      symbol: security.symbol,
      exchange: security.exchange ?? null,
      currency: security.currency ?? null,
      name: security.name ?? null,
      securityType: security.securityType ?? holdingsForContext[0]?.securityTypeOverride ?? null,
    },
    holdingExposure: {
      isHeld: holdingsForContext.length > 0,
      holdingCount: holdingsForContext.length,
      marketValueCad,
      holdingWeightPct,
      accounts: holdingsForContext.slice(0, 8).map((holding) => ({
        accountId: holding.accountId,
        holdingId: holding.id,
        valueCad: holding.marketValueCad,
        weightPct: holding.weightPct ?? 0,
      })),
      interpretation:
        holdingsForContext.length > 0
          ? "这是当前组合里的已持有 listing；回答可同时解释持仓角色、风险和是否继续加仓。"
          : "当前组合未持有该 listing；回答应按标的本身、目标配置、偏好和数据新鲜度分析，不得把未持有当成缺少标的 context。",
    },
    economicExposure: {
      assetClass,
      rawAssetClass: rawAssetClass ?? null,
      sector,
      source: assetClassSource,
    },
    marketContext: {
      priceLabel: getFactValue(facts, ["last-price", "最新价格", "价格"]),
      trendLabel: getFactValue(facts, ["price-trend", "走势", "图表"]),
      quoteAsOf: args.input.pageContext.dataFreshness.quotesAsOf,
      chartFreshness: args.input.pageContext.dataFreshness.chartFreshness,
      sourceMode: args.input.pageContext.dataFreshness.sourceMode,
      provider,
      warnings: args.input.pageContext.warnings.slice(0, 4),
    },
    cachedIntelligence: {
      count: intelligenceFacts.length,
      summaries: intelligenceFacts
        .slice(0, 3)
        .map((fact) => `${fact.label}: ${fact.value}`),
    },
    analysisCache: {
      count: analysisFacts.length,
      summaries: analysisFacts
        .filter((fact) => fact.id !== "security-context")
        .slice(0, 4)
        .map((fact) => `${fact.label}: ${fact.value}`),
    },
    contextCompleteness: {
      score: Math.max(35, 100 - missing.length * 10 - blocking.length * 20),
      missing,
      blocking,
    },
    rules: [
      "Use securityId or symbol+exchange+currency as listing identity.",
      "Do not merge CAD and USD listings by ticker alone.",
      "Missing holding exposure is not missing security context.",
      "All security questions should read this context before falling back to raw facts.",
    ],
  };
}

function mapSecurityContextFacts(context: SecurityContext): LooMinisterFact[] {
  return [
    {
      id: "security-context",
      label: "标的上下文",
      value: `${context.identity.symbol} · ${context.identity.exchange ?? "exchange?"} · ${context.identity.currency ?? "currency?"} · ${context.economicExposure.assetClass} · context ${context.contextCompleteness.score}/100`,
      detail: JSON.stringify(context),
      source: "analysis-cache",
    },
    {
      id: "security-context-identity",
      label: "标的身份上下文",
      value: [
        context.identity.symbol,
        context.identity.exchange,
        context.identity.currency,
      ]
        .filter(Boolean)
        .join(" · "),
      detail: context.identity.securityId
        ? `securityId=${context.identity.securityId}`
        : "缺少 securityId；必须保留 symbol + exchange + currency，不能 ticker-only 合并。",
      source: "analysis-cache",
    },
    {
      id: "security-context-exposure",
      label: "标的持仓上下文",
      value: context.holdingExposure.isHeld
        ? `${context.holdingExposure.holdingCount} 笔持仓 · ${formatCad(context.holdingExposure.marketValueCad)} · ${formatPct(context.holdingExposure.holdingWeightPct)}`
        : "当前未持有该 listing",
      detail: context.holdingExposure.interpretation,
      source: "portfolio-data",
    },
    {
      id: "security-context-market",
      label: "标的行情上下文",
      value: [
        context.marketContext.priceLabel,
        `chart=${context.marketContext.chartFreshness}`,
        `source=${context.marketContext.sourceMode}`,
      ]
        .filter(Boolean)
        .join("；"),
      detail: [
        context.marketContext.quoteAsOf
          ? `quotesAsOf=${context.marketContext.quoteAsOf}`
          : null,
        context.marketContext.provider
          ? `provider=${context.marketContext.provider}`
          : null,
        context.marketContext.trendLabel
          ? `trend=${context.marketContext.trendLabel}`
          : null,
      ]
        .filter(Boolean)
        .join("；") || undefined,
      source: "quote-cache",
    },
  ];
}

function getCandidateFitContext(input: LooMinisterQuestionRequest) {
  const fact = findFact(input.pageContext.facts, "candidate-fit-context");
  if (!fact?.detail) return null;
  try {
    const parsed = JSON.parse(fact.detail) as CandidateFitContext;
    return parsed.version === "candidate-fit.v1" ? parsed : null;
  } catch {
    return null;
  }
}

function buildCandidateFitContext(args: {
  input: LooMinisterQuestionRequest;
  securityContext: SecurityContext | null;
  profile: PreferenceProfile;
  holdings: HoldingPosition[];
  recommendationRun: RecommendationRun | null;
}): CandidateFitContext {
  const security = args.input.pageContext.subject.security;
  if (!security) {
    throw new Error("Candidate fit context requires security identity.");
  }

  const matchingHoldings = getMatchingHoldings(security, args.holdings);
  const totalPortfolioCad = args.holdings.reduce(
    (sum, holding) => sum + holding.marketValueCad,
    0,
  );
  const totalMarketValueCad =
    args.securityContext?.holdingExposure.marketValueCad ??
    matchingHoldings.reduce((sum, holding) => sum + holding.marketValueCad, 0);
  const totalWeightPct =
    args.securityContext?.holdingExposure.holdingWeightPct ??
    matchingHoldings.reduce(
      (sum, holding) => sum + (holding.weightPct ?? 0),
      0,
    );
  const pageAssetClass = findFact(args.input.pageContext.facts, "asset-class")
    ?.value;
  const rawAssetClass =
    args.securityContext?.economicExposure.rawAssetClass ??
    pageAssetClass ??
    matchingHoldings[0]?.assetClass ??
    null;
  const assetClassSource: CandidateFitContext["economicExposure"]["source"] =
    args.securityContext?.economicExposure.source ??
    (isUsableAssetClass(pageAssetClass)
      ? "page-fact"
      : matchingHoldings[0]?.assetClass
        ? "holding"
        : "inferred");
  const assetClass =
    args.securityContext?.economicExposure.assetClass ??
    inferEconomicAssetClass({
      symbol: security.symbol,
      name: security.name,
      assetClass: isUsableAssetClass(rawAssetClass) ? rawAssetClass : null,
      securityType: security.securityType,
      currency: security.currency,
    });
  const sleeveValueCad = args.holdings
    .filter((holding) => getHoldingEconomicAssetClass(holding) === assetClass)
    .reduce((sum, holding) => sum + holding.marketValueCad, 0);
  const currentSleevePct =
    totalPortfolioCad > 0 ? (sleeveValueCad / totalPortfolioCad) * 100 : null;
  const targetPct = getTargetAllocationForAssetClass(args.profile, assetClass);
  const gapPct =
    typeof targetPct === "number" && typeof currentSleevePct === "number"
      ? targetPct - currentSleevePct
      : null;
  const targetStatus: CandidateFitContext["target"]["status"] =
    gapPct == null
      ? "unknown"
      : Math.abs(gapPct) <= args.profile.rebalancingTolerancePct
        ? "near-target"
        : gapPct > 0
          ? "under-target"
          : "over-target";
  const recommendationMatch = args.recommendationRun
    ? findRecommendationMatch(security, args.recommendationRun)
    : null;
  const missing = [
    targetPct == null ? "asset-class target" : null,
    !args.recommendationRun ? "latest recommendation run" : null,
    args.input.pageContext.dataFreshness.quotesAsOf ? null : "quote timestamp",
  ].filter((item): item is string => Boolean(item));
  const score = Math.max(40, 100 - missing.length * 15);

  return {
    version: "candidate-fit.v1",
    analysisMode:
      (args.securityContext?.holdingExposure.isHeld ?? matchingHoldings.length > 0)
        ? "existing-holding-review"
        : "candidate-new-buy",
    identity: {
      securityId: security.securityId ?? null,
      symbol: security.symbol,
      exchange: security.exchange ?? null,
      currency: security.currency ?? null,
      name: security.name ?? null,
    },
    isHeld: args.securityContext?.holdingExposure.isHeld ?? matchingHoldings.length > 0,
    currentExposure: {
      holdingCount:
        args.securityContext?.holdingExposure.holdingCount ??
        matchingHoldings.length,
      marketValueCad: totalMarketValueCad,
      holdingWeightPct: totalWeightPct,
      interpretation:
        (args.securityContext?.holdingExposure.isHeld ??
          matchingHoldings.length > 0)
          ? "这是已持有标的，可同时做持仓复盘和新增资金适配。"
          : "0% 只代表当前未持有该 listing；这是候选新增标的分析，不得因此停止分析。",
    },
    economicExposure: {
      assetClass,
      rawAssetClass: rawAssetClass ?? null,
      source: assetClassSource,
    },
    target: {
      assetClass,
      targetPct: targetPct ?? null,
      currentSleevePct,
      gapPct,
      status: targetStatus,
    },
    preference: {
      summary: summarizePreferenceProfile(args.profile),
      completeness: "available",
    },
    recommendation: recommendationMatch
      ? {
          status: "matched-latest-run",
          summary: `最新推荐包含该 listing：${formatCad(recommendationMatch.amountCad)} → ${recommendationMatch.targetAccountType}`,
          detail: [
            recommendationMatch.securityScore != null
              ? `标的分 ${recommendationMatch.securityScore.toFixed(1)}`
              : null,
            recommendationMatch.preferenceFitScore != null
              ? `偏好契合 ${recommendationMatch.preferenceFitScore.toFixed(1)}`
              : null,
            recommendationMatch.accountFitScore != null
              ? `账户契合 ${recommendationMatch.accountFitScore.toFixed(1)}`
              : null,
            recommendationMatch.taxFitScore != null
              ? `税务契合 ${recommendationMatch.taxFitScore.toFixed(1)}`
              : null,
            recommendationMatch.fxFrictionPenaltyBps != null
              ? `FX 摩擦 ${recommendationMatch.fxFrictionPenaltyBps} bps`
              : null,
            recommendationMatch.explanation,
          ]
            .filter(Boolean)
            .join("；")
            .slice(0, 700),
        }
      : {
          status: args.recommendationRun
            ? "not-selected-latest-run"
            : "no-latest-run",
          summary: args.recommendationRun
            ? "最新推荐没有把该 listing 选为首选。"
            : "尚无最新推荐结果。",
          detail: args.recommendationRun
            ? "这不是否定买入；只是说明当前推荐资金路径没有优先选择它。"
            : "如需结合推荐路径，应先生成推荐，再用候选适配资料解释买入优先级。",
        },
    dataFreshness: args.input.pageContext.dataFreshness,
    contextCompleteness: {
      score,
      missing,
      blocking: [],
    },
    rules: [
      "currentExposurePct=0 never blocks candidate-new-buy analysis.",
      "Do not convert a missing holding into missing security context.",
      "Use symbol+exchange+currency or securityId as listing identity.",
      "Analyze the candidate against portfolio target, preference factors, recommendation path, account/tax/FX, cached intelligence, and data freshness.",
    ],
  };
}

function mapCandidateFitContextFacts(
  context: CandidateFitContext,
): LooMinisterFact[] {
  return [
    {
      id: "candidate-fit-context",
      label: "候选适配资料",
      value: `${context.analysisMode} · ${context.economicExposure.assetClass} · context ${context.contextCompleteness.score}/100`,
      detail: JSON.stringify(context),
      source: "analysis-cache",
    },
    {
      id: "candidate-current-exposure",
      label: "候选标的当前暴露",
      value: context.isHeld
        ? `${formatPct(context.currentExposure.holdingWeightPct)} · ${formatCad(context.currentExposure.marketValueCad)}`
        : "0% · 当前未持有该 listing",
      detail: context.currentExposure.interpretation,
      source: "portfolio-data",
    },
    {
      id: "candidate-target-fit",
      label: "候选标的资产类别目标",
      value:
        context.target.targetPct == null
          ? `${context.target.assetClass} 目标未记录`
          : `${context.target.assetClass} 目标 ${formatPct(context.target.targetPct)} · 当前 ${formatPct(context.target.currentSleevePct)} · 缺口 ${formatPct(context.target.gapPct)}`,
      detail: `targetStatus=${context.target.status}; economicExposureSource=${context.economicExposure.source}`,
      source: "analysis-cache",
    },
    {
      id: "candidate-preference-fit",
      label: "候选标的偏好上下文",
      value: context.preference.summary,
      detail: "买入适配必须同时看风险容量、行业/风格倾向、现金/买房目标、税务和 USD 路径。",
      source: "user-input",
    },
    {
      id: "candidate-recommendation-fit",
      label: "候选标的当前推荐匹配",
      value: context.recommendation.summary,
      detail: context.recommendation.detail ?? undefined,
      source: "analysis-cache",
    },
  ];
}

function buildCandidateFitAnswer(input: LooMinisterQuestionRequest) {
  const security = input.pageContext.subject.security;
  const securityName = getSecurityDisplayName(security);
  const context = getCandidateFitContext(input);
  const facts = input.pageContext.facts;
  const intelligenceFacts = facts.filter(
    (fact) => fact.source === "external-intelligence",
  );
  const freshness = input.pageContext.dataFreshness;
  const freshnessNote = [
    freshness.quotesAsOf ? `报价 ${freshness.quotesAsOf}` : null,
    `图表 ${formatChartFreshnessForUser(freshness.chartFreshness)}`,
    `来源 ${formatSourceModeForUser(freshness.sourceMode)}`,
  ].filter(Boolean).join("；");
  const recommendationLine = context
    ? context.recommendation.status === "matched-latest-run"
      ? `当前资金路径已经把它列入候选。${context.recommendation.detail ? `参考因素：${context.recommendation.detail}` : ""}`
      : context.recommendation.status === "not-selected-latest-run"
        ? "当前资金路径没有优先选它。这不是否定买入，只代表在现有现金、目标配置和账户路径下，它不是最优先的新增选择。"
        : "当前还没有最新推荐结果，所以只能先按组合目标、用户偏好和已缓存资料做初步判断。"
    : "当前还没有足够推荐资料，所以只能先做方向判断。";
  const intelligenceLine =
    intelligenceFacts.length > 0
      ? `可参考的近期信息：${intelligenceFacts.slice(0, 2).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "目前没有匹配到这支标的的近期秘闻或外部研究；这不代表利好或利空，只代表本轮不能把新闻因素作为主要依据。";
  const dataBoundaryLine = context
    ? context.contextCompleteness.missing.length > 0
      ? `参考范围：还缺少 ${context.contextCompleteness.missing.map(formatCandidateMissingItemForUser).join("、")}，所以适合做方向判断，不适合作为下单前价格依据。`
      : "参考范围：当前已有持仓、偏好、推荐和行情时间信息，适合做初步适配判断；真正下单前仍要看最新价格。"
    : "参考范围：候选资料不完整，只能做方向判断，不能作为下单前价格依据。";
  const conclusionLine =
    context?.analysisMode === "candidate-new-buy"
      ? "结论：可以把它当作新增候选继续观察，但不应只因为当前持仓是 0% 就直接买入或直接排除。更合理的做法是先确认它是否补足目标缺口、是否符合你的行业/风格偏好，再决定是否小额试探或等待更好的价格。"
      : "结论：它已经在组合中时，重点不是“能不能买”，而是继续加仓是否会让同类资产更偏离目标，以及账户、税务、汇率路径是否仍然合适。";

  return [
    context
      ? `先说结论：我会把「${securityName} 是否适合买入」当作一支候选标的来判断。${context.isHeld ? "它已在组合中，所以还要看继续加仓是否合适。" : "它当前未持有，0% 只代表还没买入，不代表不能分析。"}`
      : `先说结论：我会把「${securityName} 是否适合买入」当作候选标的问题处理；本轮资料不完整，所以只给方向判断。`,
    context
      ? context.isHeld
        ? `你现在持有：组合占比 ${formatPct(context.currentExposure.holdingWeightPct)}，市值 ${formatCad(context.currentExposure.marketValueCad)}。`
        : "你现在还没有持有它；下面按“如果新增买入”来判断。"
      : "当前页面没有给出持仓暴露；如果是未持有标的，会按候选标的继续评估。",
    context
      ? `它主要会增加你的 ${context.economicExposure.assetClass} 暴露。这里看的是标的实际资产属性，不是只看交易币种或上市地点。`
      : "底层经济暴露暂时不完整，不能只靠交易币种判断。",
    context
      ? `和组合目标的关系：${formatTargetStatusForUser(context.target.status)}。你的目标是 ${formatPct(context.target.targetPct)}，当前同类资产约 ${formatPct(context.target.currentSleevePct)}，差距 ${formatPct(context.target.gapPct)}。`
      : "组合适配：暂时没有精确匹配到这类资产的目标比例，所以不能给出强结论。",
    context
      ? `和你偏好的关系：${context.preference.summary}。`
      : "偏好适配资料不足，建议先确认风险、行业/风格倾向、买房/现金目标和 USD 路径。",
    recommendationLine,
    intelligenceLine,
    dataBoundaryLine,
    freshnessNote
      ? `数据时间：${freshnessNote}。如果报价或图表不是最新，只适合做方向判断，不适合下单前定价。`
      : "数据边界不完整，实际交易前需要刷新报价和检查来源。",
    conclusionLine,
  ].join("\n");
}

function buildProductHelpAnswer(input: LooMinisterQuestionRequest) {
  const { pageContext, question } = input;
  const knowledgeFacts = pageContext.facts.filter((fact) =>
    fact.id.startsWith("project-feature-"),
  );
  const currentPageKnowledge =
    knowledgeFacts.find((fact) =>
      projectKnowledgeItems
        .find((item) => item.id === fact.id)
        ?.pages.includes(pageContext.page),
    ) ?? knowledgeFacts[0];
  const related = knowledgeFacts
    .filter((fact) => fact.id !== currentPageKnowledge?.id)
    .slice(0, 3);
  const dataFreshness = pageContext.dataFreshness;
  const freshnessLine = [
    dataFreshness.portfolioAsOf ? `组合 ${dataFreshness.portfolioAsOf}` : null,
    dataFreshness.quotesAsOf ? `报价 ${dataFreshness.quotesAsOf}` : null,
    dataFreshness.fxAsOf ? `汇率 ${dataFreshness.fxAsOf}` : null,
    `图表 ${formatChartFreshnessForUser(dataFreshness.chartFreshness)}`,
    `来源 ${formatSourceModeForUser(dataFreshness.sourceMode)}`,
  ]
    .filter(Boolean)
    .join("；");
  const actionLine =
    pageContext.allowedActions.length > 0
      ? `如果你要继续操作，当前页面允许的安全动作包括：${pageContext.allowedActions
          .slice(0, 3)
          .map((action) => action.label)
          .join("、")}。需要刷新、运行分析或修改设置时，仍必须由你确认。`
      : "当前页面没有提供可直接执行的安全动作；大臣只能解释、建议路径或告诉你应去哪个页面操作。";

  return [
    `你问的是「${question}」，大臣按项目内功能上下文回答，而不是只复述页面数值。`,
    currentPageKnowledge
      ? `当前页面定位：${currentPageKnowledge.value}${currentPageKnowledge.detail ? `（${currentPageKnowledge.detail}）` : ""}`
      : `当前页面是「${pageLabels[pageContext.page]}」，但还没有注入更细的产品说明。`,
    related.length > 0
      ? `相关功能边界：${related
          .map((fact) => `${fact.label.replace("功能说明：", "")}：${fact.value}`)
          .join("；")}`
      : "相关功能边界暂时较少；后续会继续补充产品知识库。",
    freshnessLine
      ? `数据口径：${freshnessLine}。如果页面显示过期、参考曲线或缓存资料，大臣必须把它当作边界说明，不能说成实时事实。`
      : "数据口径：当前上下文没有完整新鲜度标记，所以回答只能作为功能解释。",
    actionLine,
    "产品原则：AI 大臣负责解释和草拟，真实保存、刷新、导入、推荐生成和偏好应用都必须走后端校验与用户确认。",
  ].join("\n");
}

function buildGlobalUserContextAnswer(input: LooMinisterQuestionRequest) {
  const context = getGlobalUserContext(input);
  const freshness = input.pageContext.dataFreshness;

  if (!context) {
    return [
      "大臣会按用户级背景回答，但本轮没有可用的全局持仓/偏好上下文，只能给保守解释。",
      `数据边界：${formatDataBoundaryForUser(freshness)}。`,
    ].join("\n");
  }

  return [
    `大臣会按用户级背景回答，而不是只看当前页面。`,
    formatGlobalUserContextLine(context),
    `前几大持仓：${formatGlobalUserTopHoldings(context)}。`,
    context.leadAllocation
      ? `主要配置缺口：${context.leadAllocation.assetClass} 当前 ${formatPct(context.leadAllocation.currentPct)}，目标 ${formatPct(context.leadAllocation.targetPct)}，缺口 ${formatPct(context.leadAllocation.gapPct)}。`
      : "主要配置缺口：暂无可用资产类别缺口。",
    `偏好：${context.preference.summary}。`,
    context.recommendation.runId
      ? `最新推荐：${context.recommendation.engineVersion ?? "版本未记录"}；${context.recommendation.topItems.slice(0, 3).join("；")}。`
      : "最新推荐：暂无最新推荐批次。",
    `资料完整度：${context.contextCompleteness.score}/100；缺口：${context.contextCompleteness.missing.length > 0 ? context.contextCompleteness.missing.join("、") : "无主要缺口"}。`,
    `数据边界：${formatDataBoundaryForUser(freshness)}。`,
    "这层背景可以帮助解释用户持仓、类似标的、偏好影响和推荐路径，但不会覆盖当前页面的标的身份和行情事实。",
  ].join("\n");
}

function buildComparisonAnswer(input: LooMinisterQuestionRequest) {
  const current = getSecurityDisplayName(input.pageContext.subject.security);
  const comparisonFacts = input.pageContext.facts.filter((fact) =>
    fact.id.startsWith("comparison-subject-"),
  );
  const intelligenceFacts = input.pageContext.facts.filter((fact) =>
    fact.id.startsWith("comparison-intelligence-"),
  );
  const status = input.pageContext.facts.find((fact) =>
    fact.id.startsWith("context-resolver-status-"),
  );
  const freshness = input.pageContext.dataFreshness;

  return [
    `大臣会按对比问题处理：当前页面标的是「${current}」，对比对象是 ${comparisonFacts.map((fact) => fact.value).join("、")}。`,
    "比较时不会只按 ticker 合并；每个标的都必须保留 securityId 或完整 symbol + exchange + currency。",
    comparisonFacts
      .map((fact) => `${fact.label}：${fact.value}${fact.detail ? `（${fact.detail}）` : ""}`)
      .join("\n"),
    intelligenceFacts.length > 0
      ? `可用缓存情报：${intelligenceFacts.map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "当前没有匹配到对比标的的缓存秘闻；这不是利好或利空，只是外部情报缓存不足。",
    status
      ? `资料补齐状态：${status.value}（${status.detail ?? "无补充说明"}）。`
      : "当前状态：已基于当前页面和本地缓存回答。",
    `数据边界：${formatDataBoundaryForUser(freshness)}。`,
    "下一步判断应该看：资产类别是否重叠、费用/税务/账户位置、CAD/USD 或 hedged 差异、集中度、推荐路径，以及你的偏好因素。",
  ].join("\n");
}

function buildMentionedSecurityAnswer(input: LooMinisterQuestionRequest) {
  const mentionedFacts = input.pageContext.facts.filter(
    (fact) =>
      fact.id.startsWith("comparison-subject-") ||
      fact.id.startsWith("security-mention-"),
  );
  const resolvedFacts = mentionedFacts.filter((fact) =>
    fact.id.startsWith("comparison-subject-"),
  );
  const unresolvedFacts = mentionedFacts.filter((fact) =>
    fact.id.startsWith("security-mention-"),
  );
  const intelligenceFacts = input.pageContext.facts.filter(
    (fact) =>
      fact.id.startsWith("comparison-intelligence-") ||
      fact.source === "external-intelligence",
  );
  const portfolioContext = getPortfolioContext(input);
  const globalContext = getGlobalUserContext(input);
  const statusFacts = input.pageContext.facts.filter((fact) =>
    fact.id.startsWith("context-resolver-status-"),
  );
  const freshness = input.pageContext.dataFreshness;
  const intent = isCandidateFitQuestion(input.question)
    ? "候选买入/适配"
    : "标的相关";

  return [
    `大臣会把这个问题按「${intent}」处理；虽然当前页不是单个标的详情页，但问题里提到的 ticker 会先尝试补齐资料，不能只因为页面主体为空就说没有相关信息。`,
    resolvedFacts.length > 0
      ? `已识别标的：${resolvedFacts.map((fact) => `${fact.label}：${fact.value}${fact.detail ? `（${fact.detail}）` : ""}`).join("；")}。`
      : "本轮没有得到唯一可用的 listing 身份；大臣不会只按 ticker 猜测 CAD/US 或不同交易所版本。",
    unresolvedFacts.length > 0
      ? `未补齐项：${unresolvedFacts.map((fact) => `${fact.label}：${fact.value}${fact.detail ? `（${fact.detail}）` : ""}`).join("；")}。`
      : "所有已识别对象都会保留 symbol + exchange + currency 或 securityId，不会把同 ticker 的不同 listing 合并。",
    portfolioContext
      ? `组合背景：净资产 ${formatCad(portfolioContext.summary.totalNetWorthCad)}；投资资产 ${formatCad(portfolioContext.summary.totalMarketValueCad)}；现金 ${formatCad(portfolioContext.summary.cashBalanceCad)}；Health ${portfolioContext.health.score ?? "未记录"}。`
      : globalContext
        ? `${formatGlobalUserContextLine(globalContext)} 前几大持仓：${formatGlobalUserTopHoldings(globalContext)}。`
        : "组合背景：本轮没有完整组合上下文，只能使用页面事实和已补齐资料保守分析。",
    intelligenceFacts.length > 0
      ? `缓存外部信息：${intelligenceFacts.slice(0, 3).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "缓存外部信息：当前没有匹配到这些标的的秘闻缓存；这不是利好或利空，只是外部资料还不够。",
    isCandidateFitQuestion(input.question)
      ? "买入判断口径：把这些标的当作候选新增标的，先看标的身份、资产类别、行业和数据新鲜度，再结合组合配置缺口、偏好、现金/买房目标、账户/税务/FX 和最新推荐路径。当前未持有不代表不能分析。"
      : "标的判断口径：先确认身份，再看它在组合里的角色、风险来源、缓存行情/秘闻和偏好匹配；如果是跨标的比较，应分别说明每个标的的数据边界。",
    statusFacts.length > 0
      ? `资料补齐状态：${statusFacts.map((fact) => `${fact.value}${fact.detail ? `（${fact.detail}）` : ""}`).join("；")}。`
      : "当前状态：已基于当前页面和本地缓存处理。",
    `数据边界：${formatDataBoundaryForUser(freshness)}。`,
  ].join("\n");
}

function buildPortfolioContextAnswer(input: LooMinisterQuestionRequest) {
  const context = getPortfolioContext(input);
  const globalContext = getGlobalUserContext(input);
  const freshness = input.pageContext.dataFreshness;
  if (!context) {
    if (globalContext) {
      return [
        "大臣会按整体组合问题回答。本轮没有页面级组合 DTO，但已经读取到全局用户持仓和偏好背景。",
        formatGlobalUserContextLine(globalContext),
        `前几大持仓：${formatGlobalUserTopHoldings(globalContext)}。`,
        globalContext.leadAllocation
          ? `主要配置背景：${globalContext.leadAllocation.assetClass} 当前 ${formatPct(globalContext.leadAllocation.currentPct)}，目标 ${formatPct(globalContext.leadAllocation.targetPct)}，缺口 ${formatPct(globalContext.leadAllocation.gapPct)}。`
          : "主要配置背景：暂无可用资产类别缺口。",
        globalContext.health.score == null
          ? "Health：本轮没有可用健康分。"
          : `Health：${globalContext.health.score} / ${globalContext.health.status ?? "状态未记录"}；最弱维度 ${globalContext.health.weakestDimension ?? "未记录"}。`,
        `偏好：${globalContext.preference.summary}。`,
        globalContext.recommendation.runId
          ? `最新推荐：${globalContext.recommendation.engineVersion ?? "版本未记录"}；${globalContext.recommendation.topItems.slice(0, 3).join("；")}。`
          : "最新推荐：尚未读取到最新推荐结果。",
        `资料完整度：${globalContext.contextCompleteness.score}/100；缺口：${globalContext.contextCompleteness.missing.length > 0 ? globalContext.contextCompleteness.missing.join("、") : "无主要缺口"}。`,
        `数据边界：${formatDataBoundaryForUser(freshness)}。`,
      ].join("\n");
    }
    const facts = summarizeFacts(input.pageContext.facts);
    return [
      "大臣会按整体组合问题回答，但本轮没有生成完整组合上下文，只能使用页面事实保守解释。",
      facts.length > 0
        ? `页面事实：${facts.join("；")}。`
        : "当前页面没有足够组合事实。",
      `数据边界：${formatDataBoundaryForUser(freshness)}。`,
    ].join("\n");
  }

  const weakest = context.health.weakestDimension ?? "未记录";
  const leadGap = [...context.assetAllocation]
    .filter((item) => item.gapPct != null)
    .sort((left, right) => Math.abs(right.gapPct ?? 0) - Math.abs(left.gapPct ?? 0))[0];

  return [
    `大臣会按组合上下文回答整体持仓/组合问题。当前净资产为 ${formatCad(context.summary.totalNetWorthCad)}，其中投资资产 ${formatCad(context.summary.totalMarketValueCad)}，现金 ${formatCad(context.summary.cashBalanceCad)}。`,
    `账户与持仓：${context.summary.accountCount} 个投资账户，${context.summary.holdingCount} 个持仓；最大持仓 ${context.summary.topHolding ?? "未记录"}；前五大持仓约 ${formatPct(context.concentration.topFiveWeightPct)}。`,
    leadGap
      ? `配置缺口：${leadGap.assetClass} 当前 ${formatPct(leadGap.currentPct)}，目标 ${formatPct(leadGap.targetPct)}，缺口 ${formatPct(leadGap.gapPct)}，状态 ${leadGap.status}。`
      : "配置缺口：当前没有可计算的资产类别目标缺口。",
    context.health.score == null
      ? "Health：本轮没有可用健康分。"
      : `Health：${context.health.score} / ${context.health.status ?? "状态未记录"}；最弱维度 ${weakest}；最强维度 ${context.health.strongestDimension ?? "未记录"}。`,
    `偏好：${context.preference.summary}。`,
    context.recommendation.runId
      ? `最新推荐：${context.recommendation.engineVersion ?? "版本未记录"}；${context.recommendation.topItems.slice(0, 3).join("；")}。`
      : "最新推荐：尚未读取到最新推荐结果，因此组合调整建议只能先看配置和健康分。",
    context.cachedIntelligence.count > 0
      ? `缓存情报：${context.cachedIntelligence.summaries.slice(0, 2).join("；")}。`
      : "缓存情报：当前没有可用秘闻；页面不会自动抓取新闻或论坛。",
    `资料完整度：${context.contextCompleteness.score}/100；缺口：${context.contextCompleteness.missing.length > 0 ? context.contextCompleteness.missing.join("、") : "无主要缺口"}。`,
    `数据边界：${formatDataBoundaryForUser(context.dataFreshness)}。`,
    "判断顺序：先看配置偏离和集中度，再看账户/税务/FX 与现金缓冲，最后才看单个标的或短期新闻。单个标的追问应切换到标的上下文。",
  ].join("\n");
}

function buildRecommendationAnswer(input: LooMinisterQuestionRequest) {
  const facts = input.pageContext.facts;
  const context = getPortfolioContext(input);
  const globalContext = getGlobalUserContext(input);
  const recommendationFacts = facts.filter(
    (fact) =>
      fact.id.includes("recommendation") ||
      fact.label.includes("推荐") ||
      fact.value.includes("V2") ||
      fact.value.includes("V3"),
  );
  const preferenceFacts = facts.filter(
    (fact) =>
      fact.id.includes("preference") ||
      fact.label.includes("偏好") ||
      fact.label.includes("投资偏好"),
  );
  const intelligenceFacts = facts.filter(
    (fact) => fact.source === "external-intelligence",
  );
  const constraintFacts = facts.filter(
    (fact) =>
      fact.id.includes("constraint") ||
      fact.label.includes("约束") ||
      fact.label.includes("排除") ||
      fact.label.includes("偏好标的") ||
      fact.value.includes("排除") ||
      fact.value.includes("偏好"),
  );

  return [
    "推荐页的大臣回答会分四层：目标配置缺口、账户/税务/FX 路径、偏好因素、外部情报层。",
    context
      ? `组合上下文：净资产 ${formatCad(context.summary.totalNetWorthCad)}；健康分 ${context.health.score ?? "未记录"}；最大配置缺口 ${context.assetAllocation[0] ? `${context.assetAllocation[0].assetClass} ${formatPct(context.assetAllocation[0].gapPct)}` : "未记录"}。`
      : globalContext
        ? `用户级背景：${formatGlobalUserContextLine(globalContext)} 前几大持仓：${formatGlobalUserTopHoldings(globalContext)}；主要配置背景：${globalContext.leadAllocation ? `${globalContext.leadAllocation.assetClass} 缺口 ${formatPct(globalContext.leadAllocation.gapPct)}` : "未记录"}。`
        : "组合上下文：本轮没有完整组合上下文，只能解释推荐页面事实。",
    "V2 已经是历史/deprecated 口径；当前产品应称为 V2.1 Core，外部信息层称为 V3 Overlay。",
    "V2.1 Core 是确定性规则，不会因为外部消息直接跳过目标配置；V3 Overlay 只读取已缓存情报，不会在页面加载时实时抓新闻或论坛。",
    recommendationFacts.length > 0
      ? `当前推荐上下文：${recommendationFacts.slice(0, 4).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "当前页面没有足够推荐 run 细节；如果你要问某个具体标的，最好先进入该标的详情或生成最新推荐。",
    constraintFacts.length > 0
      ? `约束影响：${constraintFacts.slice(0, 4).map((fact) => `${fact.label}：${fact.value}`).join("；")}。排除规则优先于偏好规则，偏好标的也必须通过配置/账户/税务/FX 检查。`
      : "约束影响：如果设置了排除标的、偏好标的、账户规则、资产类别区间或 security type 限制，它们会改变候选排序或直接过滤候选。",
    preferenceFacts.length > 0
      ? `偏好影响：${preferenceFacts.slice(0, 3).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "偏好影响：偏好因素会影响排序和解释，但不会绕过目标配置。",
    intelligenceFacts.length > 0
      ? `缓存外部情报：${intelligenceFacts.slice(0, 2).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "当前没有可用外部情报；推荐仍以确定性核心为主。",
    "如果你问“为什么推荐/为什么不推荐”，大臣应该说明资产类别缺口、账户位置、税务/FX 摩擦、偏好因素、观察/排除规则和数据新鲜度。",
  ].join("\n");
}

function buildHealthAnswer(input: LooMinisterQuestionRequest) {
  const { pageContext } = input;
  const portfolioContext = getPortfolioContext(input);
  const globalContext = getGlobalUserContext(input);
  const healthFacts = pageContext.facts.filter(
    (fact) =>
      fact.id.includes("health") ||
      fact.label.includes("健康") ||
      fact.label.includes("评分") ||
      fact.label.includes("风险") ||
      fact.label.includes("偏离") ||
      fact.label.includes("配置"),
  );
  const preferenceFacts = pageContext.facts.filter(
    (fact) =>
      fact.id.includes("preference") ||
      fact.label.includes("偏好") ||
      fact.label.includes("目标"),
  );
  const lens =
    pageContext.page === "account-detail" || pageContext.subject.accountId
      ? "账户级 Health：先看账户内适配，再参考全组合目标；单个账户不必复制全组合目标。"
      : "全组合 Health：先看总体资产配置、集中度、现金/流动性、税务/账户位置和数据新鲜度。";
  const freshness = pageContext.dataFreshness;

  return [
    `大臣会按 Health Score 问题处理。评分口径：${lens}`,
    portfolioContext
      ? `组合上下文：净资产 ${formatCad(portfolioContext.summary.totalNetWorthCad)}；投资资产 ${formatCad(portfolioContext.summary.totalMarketValueCad)}；前五大持仓 ${formatPct(portfolioContext.concentration.topFiveWeightPct)}；Health ${portfolioContext.health.score ?? "未记录"}。`
      : globalContext
        ? `${formatGlobalUserContextLine(globalContext)} 前几大持仓：${formatGlobalUserTopHoldings(globalContext)}；Health ${globalContext.health.score ?? "未记录"}。`
        : "组合上下文：本轮没有完整组合上下文，只能读取页面 Health 事实。",
    "层级边界：全组合 Health 用来判断总体风险和配置目标；账户级 Health 用来判断该账户内部是否适配，并把全组合目标作为参考而不是硬复制。",
    healthFacts.length > 0
      ? `当前健康相关事实：${healthFacts.slice(0, 5).map((fact) => `${fact.label}：${fact.value}${fact.detail ? `（${fact.detail}）` : ""}`).join("；")}。`
      : "当前页面没有足够健康分细项；大臣只能解释评分框架，不能假设哪个维度一定最差。",
    preferenceFacts.length > 0
      ? `偏好/目标约束：${preferenceFacts.slice(0, 4).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "偏好/目标约束没有完整注入；如果 Health 结果与你主观目标不一致，应先检查偏好因素和资产类别目标范围。",
    `数据边界：${formatDataBoundaryForUser(freshness)}。`,
    "优先修复顺序建议：先处理明显超出范围的资产类别和集中度，再看账户位置/税务/FX，最后才是主题偏好或单个标的喜好。",
  ].join("\n");
}

function buildPreferenceAnswer(input: LooMinisterQuestionRequest) {
  const facts = input.pageContext.facts;
  const globalContext = getGlobalUserContext(input);
  const preferenceFacts = facts.filter(
    (fact) =>
      fact.id.includes("preference") ||
      fact.label.includes("偏好") ||
      fact.label.includes("投资偏好") ||
      fact.value.includes("新手引导") ||
      fact.value.includes("手动"),
  );

  return [
    "投资偏好现在应理解为两条线：新手引导式问答生成完整参数，进阶用户直接手动编辑所有参数。",
    preferenceFacts.length > 0
      ? `当前可见偏好上下文：${preferenceFacts.slice(0, 4).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : globalContext
        ? `当前已应用偏好：${globalContext.preference.summary}。现金缓冲目标 ${formatCad(globalContext.preference.cashBufferTargetCad)}；来源 ${globalContext.preference.source ?? "未记录"}。`
        : "当前页面没有给出具体偏好值；大臣只能解释设置方式，不能假设你的风险/行业/税务目标。",
    "新手流程应该覆盖完整 factors：风险容量、波动舒适度、投资期限、行业/风格/主题倾向、回避行业、现金缓冲、买房目标、税务敏感度、USD 路径、账户放置偏好、外部信息偏好和再平衡节奏。",
    "AI 大臣可以根据问答生成结构化草稿，但必须先展示给你确认；应用前仍允许手动微调，不能自动写入真实偏好。",
    "这些参数会进入 Health Score 解释和 Recommendation V2.1/V3：Health 用它解释目标偏离和风险护栏，Recommendation 用它调整候选排序和解释，但不能绕过目标配置、账户/税务/FX 和身份隔离规则。",
  ].join("\n");
}

function buildSecurityDetailAnswer(input: LooMinisterQuestionRequest) {
  const securityName = getSecurityDisplayName(input.pageContext.subject.security);
  const context = getSecurityContext(input);
  const globalContext = getGlobalUserContext(input);
  const facts = input.pageContext.facts;
  const identityFacts = facts.filter(
    (fact) =>
      fact.id.includes("security") ||
      fact.label.includes("身份") ||
      fact.label.includes("资产类别") ||
      fact.label.includes("行业"),
  );
  const marketFacts = facts.filter(
    (fact) =>
      fact.source === "quote-cache" ||
      fact.source === "analysis-cache" ||
      fact.label.includes("价格") ||
      fact.label.includes("走势") ||
      fact.label.includes("市场"),
  );
  const intelligenceFacts = facts.filter(
    (fact) => fact.source === "external-intelligence",
  );
  const freshness = input.pageContext.dataFreshness;

  return [
    context
      ? `大臣会按标的上下文回答，并保留 listing 身份：「${context.identity.symbol} · ${context.identity.exchange ?? "exchange?"} · ${context.identity.currency ?? "currency?"}」。不会只按 ticker 合并 CAD/US 或不同交易所版本。`
      : `大臣会按标的/持仓详情回答，并保留 listing 身份：「${securityName}」。不会只按 ticker 合并 CAD/US 或不同交易所版本。`,
    context
      ? `身份与分类：底层经济暴露 ${context.economicExposure.assetClass}${context.economicExposure.sector ? `；行业/板块 ${context.economicExposure.sector}` : ""}；来源 ${context.economicExposure.source}。`
      : identityFacts.length > 0
      ? `身份与分类：${identityFacts.slice(0, 4).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "当前上下文没有完整身份/分类事实；如果缺少 exchange/currency，应先补齐 listing 身份。",
    context
      ? `持仓上下文：${context.holdingExposure.isHeld ? `${context.holdingExposure.holdingCount} 笔持仓，${formatCad(context.holdingExposure.marketValueCad)}，组合占比 ${formatPct(context.holdingExposure.holdingWeightPct)}` : "当前未持有该 listing"}。${context.holdingExposure.interpretation}`
      : "",
    globalContext
      ? `全局组合背景：${globalContext.preference.riskProfile} 风险档位；前几大持仓 ${formatGlobalUserTopHoldings(globalContext)}。这里是背景信息，不能覆盖当前标的的 listing 身份和行情事实。`
      : "",
    context
      ? `行情/分析：价格 ${context.marketContext.priceLabel ?? "未记录"}；走势 ${context.marketContext.trendLabel ?? "未记录"}；报价时间 ${context.marketContext.quoteAsOf ?? "未知"}；来源 ${formatSourceModeForUser(context.marketContext.sourceMode)}${context.marketContext.provider ? `；资料源 ${context.marketContext.provider}` : ""}。`
      : marketFacts.length > 0
      ? `行情/分析：${marketFacts.slice(0, 4).map((fact) => `${fact.label}：${fact.value}${fact.detail ? `（${fact.detail}）` : ""}`).join("；")}。`
      : "当前没有足够行情或分析事实；不能把缺失历史或参考曲线当成真实趋势。",
    context
      ? `资料完整度：${context.contextCompleteness.score}/100；缺口：${context.contextCompleteness.missing.length > 0 ? context.contextCompleteness.missing.join("、") : "无主要缺口"}；阻塞项：${context.contextCompleteness.blocking.length > 0 ? context.contextCompleteness.blocking.join("、") : "无"}。`
      : "",
    context?.cachedIntelligence.count
      ? `秘闻/缓存外部信息：${context.cachedIntelligence.summaries.slice(0, 2).join("；")}。`
      : intelligenceFacts.length > 0
      ? `秘闻/缓存外部信息：${intelligenceFacts.slice(0, 2).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "当前没有同一标的的缓存秘闻；这不是利好或利空，只表示外部资料不足。",
    `数据边界：${formatDataBoundaryForUser(freshness)}。`,
    "判断顺序：先确认身份和数据新鲜度，再看资产类别和行业暴露、与偏好因素的适配、推荐路径、账户/税务/FX 摩擦，最后才看短期价格走势。",
  ].filter(Boolean).join("\n");
}

function buildAnalysisHandoffAnswer(input: LooMinisterQuestionRequest) {
  const actions = getRunAnalysisActions(input);
  const scopeLine =
    actions.length > 0
      ? `当前页面可运行：${actions.map((action) => action.label).join("、")}。`
      : "当前页面没有提供可直接运行的智能快扫动作；请进入标的详情、Health Score、账户 Health 或推荐页后再触发。";

  return [
    "这类问题不应该只靠聊天回答。大臣会把它当作智能快扫分析交接：先解释可分析范围，再让你确认是否运行后端受控分析。",
    scopeLine,
    "安全边界：运行分析属于显式动作，必须由你点击确认；大臣不会在聊天里自动修改数据、自动刷新行情、自动抓新闻论坛或绕过 provider quota。",
    "分析会复用现有 portfolio-analyzer 合约和缓存策略：标的分析保留 securityId / symbol + exchange + currency，组合/账户分析使用当前 Health 和持仓上下文，推荐分析使用当前 recommendation run。",
    "如果你只是想先听解释，可以继续追问；如果要生成结构化报告，请点击下方建议动作。",
  ].join("\n");
}

function buildFreshnessAnswer(input: LooMinisterQuestionRequest) {
  const freshness = input.pageContext.dataFreshness;
  const quoteFacts = input.pageContext.facts.filter(
    (fact) => fact.source === "quote-cache" || fact.source === "fx-cache",
  );
  const statusFacts = input.pageContext.facts.filter(
    (fact) =>
      fact.id.startsWith("context-resolver-status-") ||
      fact.label.includes("新鲜度") ||
      fact.label.includes("行情") ||
      fact.label.includes("报价"),
  );

  return [
    "数据新鲜度要分开看：标的报价用 native trading currency，CAD 汇总只在显示/聚合时通过独立 FX cache 折算。",
    `当前数据边界：${formatDataBoundaryForUser(freshness)}。`,
    quoteFacts.length > 0
      ? `报价/FX 事实：${quoteFacts.slice(0, 4).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "当前页面没有足够报价/FX 事实；大臣不会把缺失数据说成实时行情。",
    statusFacts.length > 0
      ? `状态提示：${statusFacts.slice(0, 3).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "没有额外状态提示。",
    "刷新失败不能清空旧价格；外部资料源限流时应沿用旧缓存并说明边界。真实历史不足时应显示参考曲线或缺少历史，不能画成真实线性走势。",
  ].join("\n");
}

function buildAnswer(input: LooMinisterQuestionRequest) {
  const { pageContext, question } = input;
  if (isAnalysisRequestQuestion(question)) {
    return buildAnalysisHandoffAnswer(input);
  }
  if (
    pageContext.page === "security-detail" &&
    pageContext.subject.security &&
    isCandidateFitQuestion(question)
  ) {
    return buildCandidateFitAnswer(input);
  }
  if (isSecurityMentionQuestion(question)) {
    return buildMentionedSecurityAnswer(input);
  }
  if (isComparisonQuestion(question) && findFact(pageContext.facts, "comparison-subject-1")) {
    return buildComparisonAnswer(input);
  }
  if (isHealthQuestion(question) || pageContext.page === "portfolio-health") {
    return buildHealthAnswer(input);
  }
  if (isRecommendationQuestion(question)) {
    return buildRecommendationAnswer(input);
  }
  if (isPortfolioContextPage(pageContext.page) && isPortfolioQuestion(question)) {
    return buildPortfolioContextAnswer(input);
  }
  if (
    (pageContext.page === "security-detail" ||
      pageContext.page === "holding-detail") &&
    isSecurityDetailQuestion(question) &&
    !isFreshnessQuestion(question)
  ) {
    return buildSecurityDetailAnswer(input);
  }
  if (isPreferenceQuestion(question)) {
    return buildPreferenceAnswer(input);
  }
  if (isFreshnessQuestion(question)) {
    return buildFreshnessAnswer(input);
  }
  if (
    !isPortfolioContextPage(pageContext.page) &&
    getGlobalUserContext(input) &&
    (isPortfolioQuestion(question) ||
      isPreferenceQuestion(question) ||
      isHealthQuestion(question))
  ) {
    return buildGlobalUserContextAnswer(input);
  }
  if (
    (pageContext.page === "security-detail" ||
      pageContext.page === "holding-detail") &&
    isSecurityDetailQuestion(question)
  ) {
    return buildSecurityDetailAnswer(input);
  }
  if (isProductHelpQuestion(question) && hasProjectKnowledge(pageContext.facts)) {
    return buildProductHelpAnswer(input);
  }

  const facts = summarizeFacts(pageContext.facts);
  const globalContext = getGlobalUserContext(input);
  const freshness = pageContext.dataFreshness;
  const freshnessNotes = [
    freshness.chartFreshness !== "unknown"
      ? `图表状态：${formatChartFreshnessForUser(freshness.chartFreshness)}`
      : "",
    freshness.sourceMode !== "local"
      ? `数据来源：${formatSourceModeForUser(freshness.sourceMode)}`
      : "",
    freshness.quotesAsOf ? `报价时间：${freshness.quotesAsOf}` : "",
    freshness.fxAsOf ? `FX 时间：${freshness.fxAsOf}` : "",
  ].filter(Boolean);
  const warnings = pageContext.warnings.slice(0, 4);

  return [
    `大臣收到你在「${pageLabels[pageContext.page]}」页面的问题：「${question}」。`,
    facts.length > 0
      ? `当前页面最关键的数据是：${facts.join("；")}。`
      : globalContext
        ? `${formatGlobalUserContextLine(globalContext)} 这能支持大臣回答用户级持仓、偏好和推荐背景问题，但具体页面操作仍以当前页面事实为准。`
        : "当前页面没有提供足够的结构化事实，大臣只能先给出保守解释。",
    freshnessNotes.length > 0
      ? `需要先看数据新鲜度：${freshnessNotes.join("；")}。`
      : "当前上下文没有明确的数据新鲜度标记，建议先确认行情、FX 和图表来源。",
    warnings.length > 0
      ? `页面已经提示的风险/备注包括：${warnings.join("；")}。`
      : "页面没有提供额外风险提示。",
    "这是基于当前页面资料的保守回答；如果需要更完整结论，应先补齐报价、图表或外部情报缓存。",
  ].join("\n");
}

type LooMinisterAnswerSourceType =
  | "page-context"
  | "portfolio-data"
  | "quote-cache"
  | "fx-cache"
  | "analysis-cache"
  | "external-intelligence"
  | "manual";

function toAnswerSourceType(
  sourceType: LooMinisterFact["source"],
): LooMinisterAnswerSourceType {
  return sourceType === "user-input" || sourceType === "system"
    ? "manual"
    : sourceType;
}

function buildLocalAnswer(
  input: LooMinisterQuestionRequest,
  fallbackReason?: string,
) {
  const pageContext = input.pageContext;
  const prioritizedFacts = [...pageContext.facts]
    .filter(isUserFacingFact)
    .sort((a, b) => {
      return factDisplayPriority(a) - factDisplayPriority(b);
    });
  const qualityGuardPrefix = "quality_guard:";
  const fallbackNote = fallbackReason?.startsWith(qualityGuardPrefix)
    ? "我会按当前页面、持仓和缓存资料重新整理，避免把未持有或资料不足误读成不能分析。\n"
    : fallbackReason
      ? "这轮先基于当前页面、持仓和缓存资料回答。\n"
      : "";
  const answer: LooMinisterAnswerResult = {
    version: LOO_MINISTER_VERSION,
    generatedAt: new Date().toISOString(),
    role: "loo-minister",
    page: pageContext.page,
    title: `${pageLabels[pageContext.page]}大臣答复`,
    answer: `${fallbackNote}${buildAnswer(input)}`,
    keyPoints: [
      ...prioritizedFacts
        .slice(0, 4)
        .map((fact) => `${fact.label}: ${fact.value}`),
      ...pageContext.warnings.slice(0, 2),
    ].slice(0, 8),
    suggestedActions: pageContext.allowedActions.slice(0, 4),
    sources: [
      {
        title: `${pageContext.title} 页面上下文`,
        sourceType: "page-context",
        asOf: pageContext.asOf,
      },
      ...prioritizedFacts.slice(0, 5).map((fact) => ({
        title: fact.label,
        sourceType: toAnswerSourceType(fact.source),
        asOf: pageContext.asOf,
      })),
    ],
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER,
  };

  return attachDeterministicSuggestedActions(input, answer);
}

function shouldReplaceMisleadingCandidateFitAnswer(
  input: LooMinisterQuestionRequest,
  answer: LooMinisterAnswerResult,
) {
  if (
    input.pageContext.page !== "security-detail" ||
    !input.pageContext.subject.security ||
    !isCandidateFitQuestion(input.question)
  ) {
    return false;
  }

  const text = answer.answer.replace(
    /0%[^。；\n]*(?:不代表|不能只因为|不是)[^。；\n]*/gi,
    "",
  );
  return (
    /0%[^。；\n]*(?:因此|所以|则|就)[^。；\n]*(?:无法|不能|不足|不适配|不进行|没法)/i.test(text) ||
    /(?:没有|缺少|不足)[^。；\n]*(?:context|上下文)[^。；\n]*(?:无法|不能|不足|判断)/i.test(text) ||
    /当前页面[^。；\n]*(?:没有足够|不足)[^。；\n]*(?:判断|分析|适配)/i.test(text)
  );
}

function hasRunAnalysisAction(input: LooMinisterQuestionRequest) {
  return input.pageContext.allowedActions.some(
    (action) => action.actionType === "run-analysis",
  );
}

function hasUnavailableRunAnalysisPromise(answer: LooMinisterAnswerResult) {
  return /确认式\s*AI\s*快扫流程|由你确认后再运行|确认后再运行|点击确认.*快扫|应用里.*确认.*快扫/i.test(
    answer.answer,
  );
}

function sanitizeUnavailableRunAnalysisPromise(
  input: LooMinisterQuestionRequest,
  answer: LooMinisterAnswerResult,
) {
  if (hasRunAnalysisAction(input) || !hasUnavailableRunAnalysisPromise(answer)) {
    return attachDeterministicSuggestedActions(input, answer);
  }

  const cleanedAnswer = answer.answer
    .split(/(?<=[。！？\n])/u)
    .filter(
      (sentence) =>
        !/确认式\s*AI\s*快扫流程|由你确认后再运行|确认后再运行|点击确认.*快扫|应用里.*确认.*快扫/i.test(
          sentence,
        ),
    )
    .join("")
    .trim();
  const boundary =
    "动作边界修正：本轮回答下方没有可确认的智能快扫按钮，所以当前聊天只做轻量解释；如需智能快扫，请进入标的详情、Health Score、账户 Health 或推荐页，使用页面里的智能快扫卡片。";

  return attachDeterministicSuggestedActions(
    input,
    looMinisterAnswerResultSchema.parse({
      ...answer,
      answer: [
        cleanedAnswer ||
          "GPT 主回答只包含不可执行的快扫确认承诺，已移除该动作承诺。",
        boundary,
      ].join("\n\n"),
      keyPoints: [
        "本轮没有可确认的智能快扫按钮；已保留 GPT 主回答并修正动作边界。",
        ...answer.keyPoints,
      ].slice(0, 8),
    }),
  );
}

function buildRouterCompatiblePrompt(input: LooMinisterQuestionRequest) {
  const pageContext = input.pageContext;
  const freshness = pageContext.dataFreshness;
  const portfolioContext = getPortfolioContext(input);
  const securityContext = getSecurityContext(input);
  const candidateFitContext = getCandidateFitContext(input);
  const globalUserContext = getGlobalUserContext(input);
  const mentionedSecurityFacts = pageContext.facts.filter(
    (fact) =>
      fact.id.startsWith("comparison-subject-") ||
      fact.id.startsWith("security-mention-") ||
      fact.id.startsWith("context-resolver-status-"),
  );
  const mentionedSecurityBrief =
    mentionedSecurityFacts.length > 0
      ? [
          "问题中提到的标的 context（适用于总览/组合/推荐页里临时提到 ticker 的问题）：",
          ...mentionedSecurityFacts.map(
            (fact) =>
              `- ${fact.label}: ${fact.value}${fact.detail ? ` (${fact.detail})` : ""} [source=${fact.source}]`,
          ),
          "如果这里已有 comparison-subject，则不得回答“没有标的资料”；如果只有 security-mention-unavailable/ambiguous，则说明缺少唯一 listing，而不是说页面没有资料。",
        ].join("\n")
      : "";
  const facts = prioritizeFactsForPrompt(pageContext.facts, input)
    .slice(0, 12)
    .map(
      (fact) =>
        `- ${fact.label}: ${fact.value}${fact.detail ? ` (${fact.detail})` : ""} [source=${fact.source}]`,
    )
    .join("\n");
  const warnings = pageContext.warnings
    .slice(0, 6)
    .map((warning) => `- ${warning}`)
    .join("\n");
  const subjectSecurity = pageContext.subject.security
    ? [
        pageContext.subject.security.symbol,
        pageContext.subject.security.exchange,
        pageContext.subject.security.currency,
      ]
        .filter(Boolean)
        .join(" / ")
    : "无";

  return [
    "你是 Loo国大臣。你是项目内的投资管家型助手，不是数据字段解释器。只使用下面的页面摘要、用户持仓/偏好背景和缓存资料回答中文问题。",
    "回答必须先给清晰结论，再说明为什么和用户相关、组合影响、主要风险、下一步可确认事项。不要把 provider、sourceMode、context pack、DTO、fallback、run-analysis 等工程词直接说给用户。",
    "不要编造实时行情、新闻或论坛结论；投资相关回答必须包含不构成投资建议的免责声明。",
    "如果用户要求帮忙分析、运行快扫或生成分析报告，只有在本轮 allowedActions 里存在 run-analysis 动作时，才可以说页面会提供确认式智能快扫按钮；否则必须说明当前聊天只能给轻量解释，并引导用户进入标的详情、Health Score、账户 Health 或推荐页运行对应快扫。suggestedActions 必须返回 []，后端会基于 allowedActions 附加确认动作。",
    "如果用户问整体持仓、组合、配置、Health 或推荐，必须优先解释组合上下文；如果用户问标的或持仓详情，必须优先解释标的上下文；如果进一步问是否适合买入/适配，必须解释候选适配；currentExposure=0 只代表未持有，不得阻止分析。",
    "上下文优先级必须是：当前页面事实和 security-context/candidate-fit > 用户明确提到的标的 > recentSubjects 补齐资料 > portfolio-context > global-user-context > project knowledge。global-user-context 是用户级背景，只能补足持仓/偏好/推荐背景，不能覆盖当前页面或当前标的事实。",
    "如果用户在总览、组合或推荐页直接提到 ticker，必须先使用问题中提到的标的资料；有 comparison-subject 时表示 resolver 已补齐至少一个候选标的，不得再说没有资料。没有候选适配资料时，可以说明这是轻量问答而非完整快扫，但仍要基于已补齐标的、组合资料、偏好因素和数据边界回答。",
    "如果用户问 Health Score，要明确全组合评分和账户级评分是两个层级；账户级评分不是要求单个账户复制全组合目标。",
    "如果用户问推荐或约束，要分清确定性核心、偏好因素、推荐约束和外部情报层。",
    "如果用户问投资偏好，要说明新手引导和手动进阶两条线，并覆盖风险、行业/风格、现金、买房、税务、USD 路径、账户位置和外部信息偏好。",
    "如果关键事实里有 analysis-cache 或 external-intelligence 结果，优先引用它；没有时说明当前只能基于页面上下文和本地缓存回答。引用时要解释这些资料对决策有什么影响，不要只罗列资料来源。",
    "用户问某个标的是否值得买/加仓/比较时，必须把它当成投资判断问题：标的本身、底层经济暴露、现有持仓重复度、目标配置缺口、Preference Factors、账户/税务/FX、数据新鲜度都要纳入；不要只用组合占比或是否已持有作结论。",
    "只返回合法 JSON object，不要 markdown，不要额外解释。",
    "JSON 字段必须是：version, generatedAt, role, page, title, answer, structured, keyPoints, suggestedActions, sources, disclaimer。",
    "structured 必须包含 directAnswer, reasoning, decisionGates, boundary, nextStep。directAnswer 是 1-2 句直接结论；reasoning 是 2-4 条原因；decisionGates 是会改变判断的确认项；boundary 是数据/身份/新鲜度边界；nextStep 是一个具体下一步。",
    `固定字段：version=${LOO_MINISTER_VERSION}; role=loo-minister; page=${pageContext.page}。suggestedActions 必须返回 []；产品动作由后端 deterministic 附加，不能由模型生成。`,
    "sources 至少包含一个 {title, sourceType, asOf}，sourceType 可用 page-context、portfolio-data、quote-cache、fx-cache、analysis-cache、external-intelligence、manual。",
    `disclaimer 必须是 {"zh":"仅用于研究学习，不构成投资建议。","en":"For research and education only. This is not investment advice."}`,
    "",
    `页面：${pageContext.title}`,
    `币种：${pageContext.displayCurrency}`,
    `页面时间：${pageContext.asOf}`,
    `标的身份：${subjectSecurity}`,
    `数据新鲜度：portfolio=${freshness.portfolioAsOf ?? "未知"}; quotes=${freshness.quotesAsOf ?? "未知"}; fx=${freshness.fxAsOf ?? "未知"}; chart=${freshness.chartFreshness}; source=${freshness.sourceMode}`,
    portfolioContext
      ? `组合上下文：净资产 ${formatCad(portfolioContext.summary.totalNetWorthCad)}；投资资产 ${formatCad(portfolioContext.summary.totalMarketValueCad)}；现金 ${formatCad(portfolioContext.summary.cashBalanceCad)}；账户 ${portfolioContext.summary.accountCount}；持仓 ${portfolioContext.summary.holdingCount}；Health ${portfolioContext.health.score ?? "未记录"}；最大持仓 ${portfolioContext.summary.topHolding ?? "未记录"}。`
      : "组合上下文：无。",
    securityContext
      ? `标的上下文：${securityContext.identity.symbol} · ${securityContext.identity.exchange ?? "exchange?"} · ${securityContext.identity.currency ?? "currency?"}；${securityContext.economicExposure.assetClass}；${securityContext.holdingExposure.isHeld ? `已持有 ${securityContext.holdingExposure.holdingCount} 笔` : "未持有"}；context ${securityContext.contextCompleteness.score}/100。`
      : "标的上下文：无。",
    candidateFitContext
      ? `候选适配：${candidateFitContext.identity.symbol}；${candidateFitContext.analysisMode}；${candidateFitContext.economicExposure.assetClass}；目标 ${formatPct(candidateFitContext.target.targetPct)} / 当前 ${formatPct(candidateFitContext.target.currentSleevePct)} / 缺口 ${formatPct(candidateFitContext.target.gapPct)}；context ${candidateFitContext.contextCompleteness.score}/100。`
      : "候选适配：无。",
    globalUserContext
      ? `${formatGlobalUserContextLine(globalUserContext)} 前几大持仓：${formatGlobalUserTopHoldings(globalUserContext)}；主要配置：${globalUserContext.leadAllocation ? `${globalUserContext.leadAllocation.assetClass} 当前 ${formatPct(globalUserContext.leadAllocation.currentPct)} / 目标 ${formatPct(globalUserContext.leadAllocation.targetPct)} / 缺口 ${formatPct(globalUserContext.leadAllocation.gapPct)}` : "未记录"}；最新推荐：${globalUserContext.recommendation.topItems[0] ?? "未记录"}。`
      : "全局用户背景：无。",
    mentionedSecurityBrief,
    facts ? `关键事实：\n${facts}` : "关键事实：无",
    warnings ? `页面提醒：\n${warnings}` : "页面提醒：无",
    `用户问题：${input.question}`,
    `回答风格：${input.answerStyle}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function sanitizeProviderError(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, (match) => {
      const last4 = match.slice(-4);
      return `sk-...${last4}`;
    })
    .slice(0, 500);
}

function providerUnavailableUserMessage(settings: ResolvedLooMinisterSettings) {
  if (settings.mode === "local") {
    return "当前设置为本地大臣。";
  }
  if (!settings.providerEnabled) {
    return "外部 AI 未启用，请先在设置中开启 AI 大臣外部模型。";
  }
  if (!settings.apiKey) {
    return "AI 大臣缺少可用 API Key，请先在设置中保存 OpenAI 或兼容 Provider 的 API Key。";
  }
  return "外部 AI 暂时不可用。";
}

const answerJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { const: LOO_MINISTER_VERSION },
    generatedAt: { type: "string" },
    role: { const: "loo-minister" },
    page: {
      enum: [
        "overview",
        "portfolio",
        "account-detail",
        "holding-detail",
        "security-detail",
        "portfolio-health",
        "recommendations",
        "import",
        "settings",
        "spending",
      ],
    },
    title: { type: "string" },
    answer: { type: "string" },
    structured: {
      type: "object",
      additionalProperties: false,
      properties: {
        directAnswer: { type: "string" },
        reasoning: {
          type: "array",
          items: { type: "string" },
          maxItems: 6,
        },
        decisionGates: {
          type: "array",
          items: { type: "string" },
          maxItems: 6,
        },
        boundary: { type: ["string", "null"] },
        nextStep: { type: ["string", "null"] },
      },
      required: [
        "directAnswer",
        "reasoning",
        "decisionGates",
        "boundary",
        "nextStep",
      ],
    },
    keyPoints: { type: "array", items: { type: "string" }, maxItems: 8 },
    suggestedActions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {},
        required: [],
      },
      minItems: 0,
      // Product actions stay deterministic and confirmation-gated in app code.
      maxItems: 0,
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          sourceType: {
            enum: [
              "page-context",
              "portfolio-data",
              "quote-cache",
              "fx-cache",
              "analysis-cache",
              "external-intelligence",
              "manual",
            ],
          },
          asOf: { type: ["string", "null"] },
        },
        required: ["title", "sourceType", "asOf"],
      },
      maxItems: 12,
    },
    disclaimer: {
      type: "object",
      additionalProperties: false,
      properties: {
        zh: { type: "string" },
        en: { type: "string" },
      },
      required: ["zh", "en"],
    },
  },
  required: [
    "version",
    "generatedAt",
    "role",
    "page",
    "title",
    "answer",
    "structured",
    "keyPoints",
    "suggestedActions",
    "sources",
    "disclaimer",
  ],
};

function getExternalTextFormat(settings: ResolvedLooMinisterSettings) {
  if (settings.provider === "openrouter-compatible") {
    return { type: "json_object" };
  }

  return {
    type: "json_schema",
    name: "loo_minister_answer",
    strict: true,
    schema: answerJsonSchema,
  };
}

function extractOutputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const output = response.output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") continue;
      const text = (contentItem as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        return text;
      }
    }
  }

  return null;
}

function extractUsage(response: Record<string, unknown>) {
  const usage = response.usage;
  if (!usage || typeof usage !== "object") {
    return {};
  }
  const value = usage as Record<string, unknown>;
  return {
    inputTokens:
      typeof value.input_tokens === "number" ? value.input_tokens : null,
    outputTokens:
      typeof value.output_tokens === "number" ? value.output_tokens : null,
    totalTokens:
      typeof value.total_tokens === "number" ? value.total_tokens : null,
  };
}

function isIsoDateTime(value: unknown) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function sanitizeExternalMinisterAnswerPayload(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const answer = value as Record<string, unknown>;
  const sources = Array.isArray(answer.sources) ? answer.sources : [];

  return {
    ...answer,
    generatedAt: isIsoDateTime(answer.generatedAt)
      ? answer.generatedAt
      : new Date().toISOString(),
    sources: sources.map((source) => {
      if (!source || typeof source !== "object") {
        return source;
      }
      const sourceData = source as Record<string, unknown>;
      return {
        ...sourceData,
        asOf: isIsoDateTime(sourceData.asOf) ? sourceData.asOf : null,
      };
    }),
  };
}

function classifyMinisterProviderFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/status 5\d\d/.test(message)) return "provider_5xx";
  if (/status 4\d\d/.test(message)) return "provider_4xx";
  if (/did not include output text/.test(message)) return "empty_output";
  if (/JSON/.test(message)) return "invalid_json";
  if (/ZodError|validation|Invalid/.test(message)) return "contract_invalid";
  return "provider_error";
}

function getRetryCount(error: unknown) {
  const cause = error instanceof Error ? error.cause : null;
  if (!cause || typeof cause !== "object") return 0;
  const retryCount = (cause as { retryCount?: unknown }).retryCount;
  return typeof retryCount === "number" ? retryCount : 0;
}

function getFailureKind(error: unknown) {
  const cause = error instanceof Error ? error.cause : null;
  if (cause && typeof cause === "object") {
    const failureKind = (cause as { failureKind?: unknown }).failureKind;
    if (typeof failureKind === "string" && failureKind) return failureKind;
  }
  return classifyMinisterProviderFailure(error);
}

function buildExternalInput(
  input: LooMinisterQuestionRequest,
  settings: ResolvedLooMinisterSettings,
) {
  if (settings.provider === "openrouter-compatible") {
    return [
      {
        role: "user",
        content: buildRouterCompatiblePrompt(input),
      },
    ];
  }

  return [
    {
      role: "system",
      content:
        "你是 Loo国大臣，是项目内的投资管家型助手，不是数据字段解释器。只用提供的页面 context、用户持仓/偏好背景和缓存资料回答中文问题；先给清晰结论，再说明为什么和用户相关、组合影响、主要风险、下一步可确认事项。不要把 DTO、overlay、deterministic、sourceMode、provider、fallback、run-analysis、context pack 等工程词直接说给用户。如果 context 里有 portfolio-context、security-context、candidate-fit、global-user-context、analysis-cache 或 external-intelligence 结果，优先引用它，但对用户要说“组合上下文、标的上下文、候选适配、用户持仓和偏好背景、缓存分析、外部资料”。上下文优先级必须是：当前页面事实和 security-context/candidate-fit > 用户明确提到的标的 > recentSubjects 补齐资料 > portfolio-context > global-user-context > project knowledge。global-user-context 是用户级背景，只能补足持仓/偏好/推荐背景，不能覆盖当前页面或当前标的事实。没有资料时说明只能基于页面上下文和本地缓存回答。不要编造实时行情、新闻或论坛结论；保留 securityId 以及 symbol + exchange + currency 身份；所有投资相关回答必须包含不构成投资建议的免责声明。若用户要求帮忙分析、运行快扫或生成分析报告，只有当 pageContext.allowedActions 里存在 run-analysis 时，才可以说页面会提供确认式智能快扫按钮；否则必须说明当前聊天只能轻量解释，并引导用户进入标的详情、Health Score、账户 Health 或推荐页运行对应快扫。suggestedActions 必须返回 []，后端会基于 pageContext.allowedActions 附加确认动作。若用户问整体持仓、组合、配置、Health 或推荐，必须优先解释组合上下文；若缺少 portfolio-context 但存在 global-user-context，也必须使用用户持仓和偏好背景回答，不能说完全没有组合 context。若用户问标的/持仓详情，必须优先解释标的上下文；若用户问某标的是否适合买入/适配，必须进一步解释候选适配资料，并把标的本身、底层经济暴露、现有持仓重复度、目标配置缺口、Preference Factors、账户/税务/FX、数据新鲜度都纳入；currentExposure=0 只代表未持有，不得阻止 candidate-new-buy 分析。若用户问 Health Score，要区分全组合评分与账户级评分。若用户问推荐，要区分 V2.1 规则核心、偏好因素、推荐约束和 V3 外部情报层。若用户问偏好，要说明新手引导与手动进阶两条线。只返回合法 JSON object，不要 markdown。JSON 必须符合 LooMinisterAnswerResult：version、generatedAt、role、page、title、answer、structured、keyPoints、suggestedActions、sources、disclaimer。structured 必须包含 directAnswer, reasoning, decisionGates, boundary, nextStep；answer 可作为 structured 的简洁拼接文本。role 必须是 loo-minister，产品动作由本地应用控制。",
    },
    {
      role: "user",
      content: JSON.stringify({
        question: input.question,
        answerStyle: input.answerStyle,
        pageContext: input.pageContext,
        outputContract: "LooMinisterAnswerResult",
      }),
    },
  ];
}

function getMinisterSecurityListingKey(
  security: LooMinisterQuestionRequest["pageContext"]["subject"]["security"],
) {
  if (!security?.symbol || !security.exchange || !security.currency) {
    return null;
  }
  return [security.symbol, security.exchange, security.currency]
    .map((item) => item.trim().toUpperCase())
    .join("|");
}

function getDailyIntelligenceListingKey(
  item: Awaited<ReturnType<typeof getDailyIntelligenceItemsForUser>>[number],
) {
  const identity = item.identity;
  if (!identity.symbol || !identity.exchange || !identity.currency) {
    return null;
  }
  return [identity.symbol, identity.exchange, identity.currency]
    .map((value) => value.trim().toUpperCase())
    .join("|");
}

function mapDailyIntelligenceFact(
  item: Awaited<ReturnType<typeof getDailyIntelligenceItemsForUser>>[number],
  index: number,
): LooMinisterFact {
  const detail = [
    item.reason,
    item.freshnessLabel,
    item.confidenceLabel,
    item.relevanceLabel,
    ...item.keyPoints.slice(0, 1),
    ...item.riskFlags.slice(0, 1).map((flag) => `风险：${flag}`),
  ]
    .filter(Boolean)
    .join("；")
    .slice(0, 240);
  return {
    id: `daily-intelligence-${index + 1}`,
    label: `今日秘闻：${item.title}`.slice(0, 120),
    value: item.summary.slice(0, 240),
    detail,
    source: "external-intelligence",
  };
}

async function enrichMinisterInputWithDailyIntelligence(
  userId: string,
  input: LooMinisterQuestionRequest,
): Promise<LooMinisterQuestionRequest> {
  try {
    const items = (
      await getOrBuildContextPack({
        key: securityContextPackKey({
          userId,
          identity: [
            "daily-intelligence",
            input.pageContext.subject.security?.securityId,
            input.pageContext.subject.security?.symbol,
            input.pageContext.subject.security?.exchange,
            input.pageContext.subject.security?.currency,
          ]
            .filter(Boolean)
            .join("|"),
          quoteUpdatedAt: "latest",
        }),
        kind: "external-intelligence",
        ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.externalIntelligence,
        build: () => getDailyIntelligenceItemsForUser(userId, 5),
      })
    ).data;
    if (items.length === 0) {
      return input;
    }

    const subjectListingKey = getMinisterSecurityListingKey(
      input.pageContext.subject.security,
    );
    const matchedItems = subjectListingKey
      ? items.filter(
          (item) => getDailyIntelligenceListingKey(item) === subjectListingKey,
        )
      : [];
    const selectedItems = (matchedItems.length > 0 ? matchedItems : items)
      .slice(0, 3);

    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        facts: [
          ...input.pageContext.facts,
          ...selectedItems.map(mapDailyIntelligenceFact),
        ].slice(0, 40),
      },
    };
  } catch {
    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        warnings: [
          ...input.pageContext.warnings,
          "今日秘闻缓存读取失败；大臣本次只基于当前页面上下文回答。",
        ].slice(0, 20),
      },
    };
  }
}

async function enrichMinisterInputWithProjectKnowledge(
  input: LooMinisterQuestionRequest,
): Promise<LooMinisterQuestionRequest> {
  const knowledgeFacts = await buildProjectKnowledgeFacts(input);
  if (knowledgeFacts.length === 0) {
    return input;
  }

  const existingIds = new Set(input.pageContext.facts.map((fact) => fact.id));
  const newFacts = knowledgeFacts.filter((fact) => !existingIds.has(fact.id));

  return {
    ...input,
    pageContext: {
      ...input.pageContext,
      facts: [...newFacts, ...input.pageContext.facts].slice(0, 40),
    },
  };
}

async function enrichMinisterInputWithGlobalUserContext(
  userId: string,
  input: LooMinisterQuestionRequest,
): Promise<LooMinisterQuestionRequest> {
  try {
    const dataPack = await getOrBuildContextPack({
      key: globalUserContextPackKey({
        userId,
        asOf:
          input.pageContext.dataFreshness.portfolioAsOf ??
          input.pageContext.dataFreshness.quotesAsOf ??
          input.pageContext.asOf,
      }),
      kind: "global-user",
      ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.globalUser,
      build: () => buildPortfolioContextDataPack(userId),
    });
    const portfolioContext = buildPortfolioContext({
      input,
      ...dataPack.data,
    });
    const globalContext = buildGlobalUserContext(
      portfolioContext,
      dataPack.asOf,
    );
    const existingIds = new Set(input.pageContext.facts.map((fact) => fact.id));
    const addedFacts = mapGlobalUserContextFacts(globalContext).filter(
      (fact) => !existingIds.has(fact.id),
    );

    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        facts: [...addedFacts, ...input.pageContext.facts].slice(0, 40),
      },
    };
  } catch {
    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        warnings: [
          ...input.pageContext.warnings,
          "全局组合/偏好上下文暂时不可用；大臣本次会优先使用当前页面事实保守回答。",
        ].slice(0, 20),
      },
    };
  }
}

async function enrichMinisterInputWithPortfolioContext(
  userId: string,
  input: LooMinisterQuestionRequest,
): Promise<LooMinisterQuestionRequest> {
  if (!isPortfolioContextPage(input.pageContext.page)) {
    return input;
  }

  try {
    const dataPack = await getOrBuildContextPack({
      key: securityContextPackKey({
        userId,
        identity: [
          "portfolio-context",
          input.pageContext.page,
          input.pageContext.subject.recommendationRunId,
        ]
          .filter(Boolean)
          .join("|"),
        quoteUpdatedAt:
          input.pageContext.dataFreshness.portfolioAsOf ??
          input.pageContext.dataFreshness.quotesAsOf ??
          input.pageContext.asOf,
      }),
      kind: "portfolio",
      ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.portfolio,
      build: () => buildPortfolioContextDataPack(userId),
    });
    const portfolioContext = buildPortfolioContext({
      input,
      ...dataPack.data,
    });
    const existingIds = new Set(input.pageContext.facts.map((fact) => fact.id));
    const addedFacts = mapPortfolioContextFacts(portfolioContext).filter(
      (fact) => !existingIds.has(fact.id),
    );
    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        facts: [...addedFacts, ...input.pageContext.facts].slice(0, 40),
      },
    };
  } catch {
    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        warnings: [
          ...input.pageContext.warnings,
          "组合上下文构建失败；大臣本次只能使用页面事实保守回答，并必须说明数据边界。",
        ].slice(0, 20),
      },
    };
  }
}

async function enrichMinisterInputWithSecurityContext(
  userId: string,
  input: LooMinisterQuestionRequest,
): Promise<LooMinisterQuestionRequest> {
  if (
    input.pageContext.page !== "security-detail" &&
    input.pageContext.page !== "holding-detail"
  ) {
    return input;
  }

  try {
    const repositories = getRepositories();
    const holdings = await getOrBuildContextPack({
      key: securityContextPackKey({
        userId,
        identity: [
          "security-context",
          input.pageContext.subject.security?.securityId,
          input.pageContext.subject.security?.symbol,
          input.pageContext.subject.security?.exchange,
          input.pageContext.subject.security?.currency,
          input.pageContext.subject.holdingId,
        ]
          .filter(Boolean)
          .join("|"),
        quoteUpdatedAt:
          input.pageContext.dataFreshness.quotesAsOf ??
          input.pageContext.asOf,
      }),
      kind: "security",
      ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.security,
      build: () => repositories.holdings.listByUserId(userId),
    });
    const securityContext = buildSecurityContext({
      input,
      holdings: holdings.data,
    });
    const existingIds = new Set(input.pageContext.facts.map((fact) => fact.id));
    const addedFacts = mapSecurityContextFacts(securityContext).filter(
      (fact) => !existingIds.has(fact.id),
    );
    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        facts: [...addedFacts, ...input.pageContext.facts].slice(0, 40),
      },
    };
  } catch {
    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        warnings: [
          ...input.pageContext.warnings,
          "标的上下文构建失败；大臣本次只能使用页面事实保守回答，并必须保留 listing 身份边界。",
        ].slice(0, 20),
      },
    };
  }
}

async function enrichMinisterInputWithCandidateFit(
  userId: string,
  input: LooMinisterQuestionRequest,
): Promise<LooMinisterQuestionRequest> {
  const security = input.pageContext.subject.security;
  if (
    input.pageContext.page !== "security-detail" ||
    !security ||
    !isCandidateFitQuestion(input.question)
  ) {
    return input;
  }

  try {
    const repositories = getRepositories();
    const [profilePack, holdings, recommendationRunPack] = await Promise.all([
      getOrBuildContextPack({
        key: userPreferencePackKey(userId, "latest"),
        kind: "preference",
        ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.preference,
        build: () => repositories.preferences.getByUserId(userId),
      }),
      repositories.holdings.listByUserId(userId),
      getOrBuildContextPack({
        key: latestRecommendationPackKey(userId, "latest"),
        kind: "recommendation",
        ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.recommendation,
        build: () =>
          repositories.recommendations
            .getLatestByUserId(userId)
            .catch(() => null),
      }),
    ]);
    const candidateFitContext = buildCandidateFitContext({
      input,
      securityContext: getSecurityContext(input),
      profile: profilePack.data,
      holdings,
      recommendationRun: recommendationRunPack.data,
    });
    const addedFacts = mapCandidateFitContextFacts(candidateFitContext);

    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        facts: [...addedFacts, ...input.pageContext.facts].slice(0, 40),
      },
    };
  } catch {
    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        warnings: [
          ...input.pageContext.warnings,
          "候选适配资料构建失败；大臣本次只能用页面上下文做保守候选分析，当前未持有不会被当作阻塞项。",
        ].slice(0, 20),
      },
    };
  }
}

async function callExternalMinister(
  input: LooMinisterQuestionRequest,
  settings: ResolvedLooMinisterSettings,
) {
  if (!settings.apiKey) {
    throw new Error("OpenAI API key is not configured.");
  }

  const maxAttempts = settings.provider === "openrouter-compatible" ? 2 : 1;
  let lastError: unknown;
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attemptsUsed = attempt;
    try {
      const result = await callExternalMinisterOnce(input, settings);
      return {
        ...result,
        retryCount: attemptsUsed - 1,
      };
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        const finalError =
          error instanceof Error ? error : new Error(String(error));
        finalError.cause = {
          retryCount: attemptsUsed - 1,
          failureKind: classifyMinisterProviderFailure(error),
        };
        throw finalError;
      }
    }
  }

  const finalError =
    lastError instanceof Error ? lastError : new Error("OpenAI request failed.");
  finalError.cause = {
    retryCount: Math.max(0, attemptsUsed - 1),
    failureKind: classifyMinisterProviderFailure(lastError),
  };
  throw finalError;
}

async function callExternalMinisterOnce(
  input: LooMinisterQuestionRequest,
  settings: ResolvedLooMinisterSettings,
) {
  const response = await fetch(settings.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Loo Portfolio Manager",
    },
    body: JSON.stringify({
      model: settings.model,
      store:
        process.env.LOO_MINISTER_DISABLE_RESPONSE_STORAGE === "true"
          ? false
          : undefined,
      reasoning: {
        effort: settings.reasoningEffort,
      },
      text:
        settings.provider === "openrouter-compatible"
          ? { format: getExternalTextFormat(settings) }
          : {
              verbosity: "low",
              format: getExternalTextFormat(settings),
            },
      input: buildExternalInput(input, settings),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const error = payload.error;
    const providerName =
      settings.provider === "openrouter-compatible"
        ? "OpenRouter-compatible"
        : "OpenAI";
    const detail =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : "No provider error body.";
    throw new Error(
      `${providerName} request failed with status ${response.status} for ${settings.endpoint} using model ${settings.model}: ${detail}`,
    );
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI response did not include output text.");
  }

  const parsed = looMinisterAnswerResultSchema.parse(
    sanitizeExternalMinisterAnswerPayload(JSON.parse(outputText)),
  );
    return {
      answer: attachDeterministicSuggestedActions(input, parsed),
      usage: extractUsage(payload),
    };
}

export async function getLooMinisterAnswer(
  userId: string,
  input: LooMinisterQuestionRequestInput,
  options: {
    settings?: ResolvedLooMinisterSettings;
    persistUsage?: boolean;
    skipContextResolver?: boolean;
    forceLocal?: boolean;
    allowProviderFallback?: boolean;
  } = {},
) {
  const normalizedInput = looMinisterQuestionRequestSchema.parse(input);
  const settingsPromise =
    options.settings ?? resolveLooMinisterSettings(userId);
  const resolvedContext = options.skipContextResolver
    ? { request: normalizedInput }
    : await resolveLooMinisterContext({ userId, request: normalizedInput });
  const projectKnowledgeInput = await enrichMinisterInputWithProjectKnowledge(
    resolvedContext.request,
  );
  const [
    dailyIntelligenceInput,
    globalUserContextInput,
    portfolioContextInput,
    securityContextInput,
  ] =
    await Promise.all([
      enrichMinisterInputWithDailyIntelligence(
        userId,
        projectKnowledgeInput,
      ),
      enrichMinisterInputWithGlobalUserContext(userId, projectKnowledgeInput),
      enrichMinisterInputWithPortfolioContext(userId, projectKnowledgeInput),
      enrichMinisterInputWithSecurityContext(userId, projectKnowledgeInput),
    ]);
  const [candidateFitInput, settings] = await Promise.all([
    enrichMinisterInputWithCandidateFit(userId, securityContextInput),
    settingsPromise,
  ]);
  const enrichedInput = mergeMinisterRequests(
    projectKnowledgeInput,
    dailyIntelligenceInput,
    globalUserContextInput,
    portfolioContextInput,
    securityContextInput,
    candidateFitInput,
  );
  const persistUsage = options.persistUsage ?? true;
  const allowProviderFallback = options.allowProviderFallback ?? true;
  const localAnswer = (fallbackReason?: string) =>
    buildLocalAnswer(enrichedInput, fallbackReason);

  if (options.forceLocal) {
    const answer = localAnswer();
    if (persistUsage) {
      await recordLooMinisterUsage(userId, {
        page: enrichedInput.pageContext.page,
        mode: "local",
        provider: "local",
        model: settings.model,
        status: "success",
      });
    }
    return apiSuccess(answer, "service");
  }

  if (
    settings.mode !== "gpt-5.5" ||
    !settings.providerEnabled ||
    !settings.apiKey
  ) {
    const fallbackReason = providerUnavailableUserMessage(settings);
    if (!allowProviderFallback) {
      if (persistUsage) {
        await recordLooMinisterUsage(userId, {
          page: enrichedInput.pageContext.page,
          mode: settings.mode,
          provider: settings.mode === "local" ? "local" : settings.provider,
          model: settings.model,
          status: "failed",
          errorMessage: fallbackReason,
        });
      }
      throw new Error(fallbackReason);
    }
    const answer = localAnswer(fallbackReason);
    if (persistUsage) {
      await recordLooMinisterUsage(userId, {
        page: enrichedInput.pageContext.page,
        mode: settings.mode,
        provider: settings.mode === "local" ? "local" : settings.provider,
        model: settings.model,
        status: settings.mode === "local" ? "success" : "fallback",
        errorMessage: settings.mode === "local" ? null : fallbackReason,
      });
    }
    return apiSuccess(answer, "service");
  }

  try {
    const result = await callExternalMinister(enrichedInput, settings);
    const qualityGuardReason = shouldReplaceMisleadingCandidateFitAnswer(
      enrichedInput,
      result.answer,
    )
      ? "候选适配回答没有正确使用页面上下文。"
      : null;
    const replacedByQualityGuard = Boolean(qualityGuardReason);
    if (replacedByQualityGuard && !allowProviderFallback) {
      if (persistUsage) {
        await recordLooMinisterUsage(userId, {
          page: enrichedInput.pageContext.page,
          mode: settings.mode,
          provider: `${settings.provider}-${settings.apiKeySource}`,
          model: settings.model,
          status: "failed",
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          retryCount: result.retryCount,
          failureKind: "candidate_fit_quality_guard",
          errorMessage: qualityGuardReason,
        });
      }
      throw new Error(
        "外部 GPT 回答没有正确使用当前页面上下文。请重试，或在超时/失败时手动选择本地大臣。",
      );
    }
    const answer = replacedByQualityGuard
      ? localAnswer(`quality_guard:${qualityGuardReason}`)
      : sanitizeUnavailableRunAnalysisPromise(enrichedInput, result.answer);
    if (persistUsage) {
      await recordLooMinisterUsage(userId, {
        page: enrichedInput.pageContext.page,
        mode: settings.mode,
        provider: `${settings.provider}-${settings.apiKeySource}`,
        model: settings.model,
        status: replacedByQualityGuard ? "fallback" : "success",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        retryCount: result.retryCount,
        failureKind: replacedByQualityGuard
          ? "candidate_fit_quality_guard"
          : undefined,
        errorMessage: replacedByQualityGuard ? qualityGuardReason : undefined,
      });
    }
    return apiSuccess(answer, "service");
  } catch (error) {
    const errorMessage = sanitizeProviderError(
      error instanceof Error ? error.message : "OpenAI provider failed.",
    );
    if (!allowProviderFallback) {
      if (persistUsage) {
        await recordLooMinisterUsage(userId, {
          page: enrichedInput.pageContext.page,
          mode: settings.mode,
          provider: `${settings.provider}-${settings.apiKeySource}`,
          model: settings.model,
          status: "failed",
          retryCount: getRetryCount(error),
          failureKind: getFailureKind(error),
          errorMessage,
        });
      }
      throw new Error(
        `外部 GPT 暂时不可用：${errorMessage}。你可以重试，或在等待超时时手动选择本地大臣。`,
      );
    }
    const answer = localAnswer("external_model_unavailable");
    if (persistUsage) {
      await recordLooMinisterUsage(userId, {
        page: enrichedInput.pageContext.page,
        mode: settings.mode,
        provider: `${settings.provider}-${settings.apiKeySource}`,
        model: settings.model,
        status: "fallback",
        retryCount: getRetryCount(error),
        failureKind: getFailureKind(error),
        errorMessage,
      });
    }
    return apiSuccess(answer, "service");
  }
}
