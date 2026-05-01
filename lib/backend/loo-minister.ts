import { apiSuccess } from "@/lib/backend/contracts";
import {
  LOO_MINISTER_VERSION,
  type LooMinisterAnswerResult,
  type LooMinisterFact,
  type LooMinisterQuestionRequest,
  looMinisterAnswerResultSchema,
} from "@/lib/backend/loo-minister-contracts";
import {
  recordLooMinisterUsage,
  resolveLooMinisterSettings,
  type ResolvedLooMinisterSettings,
} from "@/lib/backend/loo-minister-settings";
import type {
  HoldingPosition,
  PreferenceProfile,
  RecommendationRun,
} from "@/lib/backend/models";
import { getDailyIntelligenceItemsForUser } from "@/lib/backend/mobile-daily-intelligence";
import { PORTFOLIO_ANALYZER_DISCLAIMER } from "@/lib/backend/portfolio-analyzer-contracts";
import { getRepositories } from "@/lib/backend/repositories/factory";

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

function summarizeFacts(facts: LooMinisterFact[]) {
  return facts
    .slice(0, 5)
    .map(
      (fact) =>
        `${fact.label}: ${fact.value}${fact.detail ? `（${fact.detail}）` : ""}`,
    );
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function isCandidateFitQuestion(question: string) {
  return /适合|适配|买入|能买吗|值得|加仓|建仓|candidate|buy|fit/i.test(
    question,
  );
}

function findFact(facts: LooMinisterFact[], id: string) {
  return facts.find((fact) => fact.id === id);
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

function buildCandidateFitAnswer(input: LooMinisterQuestionRequest) {
  const security = input.pageContext.subject.security;
  const securityName = getSecurityDisplayName(security);
  const facts = input.pageContext.facts;
  const recommendationFact = findFact(facts, "candidate-recommendation-fit");
  const exposureFact = findFact(facts, "candidate-current-exposure");
  const preferenceFact = findFact(facts, "candidate-preference-fit");
  const targetFact = findFact(facts, "candidate-target-fit");
  const intelligenceFacts = facts.filter(
    (fact) => fact.source === "external-intelligence",
  );
  const freshness = input.pageContext.dataFreshness;
  const freshnessNote = [
    freshness.quotesAsOf ? `报价 ${freshness.quotesAsOf}` : null,
    `图表 ${freshness.chartFreshness}`,
    `来源 ${freshness.sourceMode}`,
  ].filter(Boolean).join("；");

  return [
    `大臣会把「${securityName} 是否适合买入」当作候选标的适配问题，而不是只看当前持仓占比。`,
    exposureFact
      ? `当前暴露：${exposureFact.value}${exposureFact.detail ? `（${exposureFact.detail}）` : ""}。0% 只代表现在没持有，不代表不能分析。`
      : "当前页面没有给出持仓暴露；如果是未持有标的，会按候选标的继续评估。",
    targetFact
      ? `配置目标：${targetFact.value}${targetFact.detail ? `（${targetFact.detail}）` : ""}。`
      : "配置目标没有精确匹配到该资产类别，所以结论需要更保守。",
    preferenceFact
      ? `偏好适配：${preferenceFact.value}${preferenceFact.detail ? `（${preferenceFact.detail}）` : ""}。`
      : "偏好适配资料不足，建议先确认风险、行业/风格倾向、买房/现金目标和 USD 路径。",
    recommendationFact
      ? `推荐引擎：${recommendationFact.value}${recommendationFact.detail ? `（${recommendationFact.detail}）` : ""}。`
      : "最新推荐没有把这个 listing 明确列为首选；这不是否定买入，只表示它还没有成为当前资金路径的最高优先级。",
    intelligenceFacts.length > 0
      ? `缓存情报：${intelligenceFacts.slice(0, 2).map((fact) => `${fact.label}：${fact.value}`).join("；")}。`
      : "当前没有匹配到该 listing 的缓存秘闻/外部研究；不要把这理解成利好或利空。",
    freshnessNote
      ? `数据边界：${freshnessNote}。如果报价或图表不是 fresh，只适合做方向判断，不适合下单前定价。`
      : "数据边界不完整，实际交易前需要刷新报价和检查来源。",
    "结论口径：如果它命中你的目标资产类别、偏好因子和推荐路径，可以进入观察/小额配置；如果只是因为价格涨跌或主题热度吸引你，应先看目标配置缺口、账户位置、税务/FX 摩擦和集中度。",
  ].join("\n");
}

function buildAnswer(input: LooMinisterQuestionRequest) {
  const { pageContext, question } = input;
  if (
    pageContext.page === "security-detail" &&
    pageContext.subject.security &&
    isCandidateFitQuestion(question)
  ) {
    return buildCandidateFitAnswer(input);
  }

  const facts = summarizeFacts(pageContext.facts);
  const freshness = pageContext.dataFreshness;
  const freshnessNotes = [
    freshness.chartFreshness !== "unknown"
      ? `图表状态：${freshness.chartFreshness}`
      : "",
    freshness.sourceMode !== "local"
      ? `数据来源模式：${freshness.sourceMode}`
      : "",
    freshness.quotesAsOf ? `报价时间：${freshness.quotesAsOf}` : "",
    freshness.fxAsOf ? `FX 时间：${freshness.fxAsOf}` : "",
  ].filter(Boolean);
  const warnings = pageContext.warnings.slice(0, 4);

  return [
    `大臣收到你在「${pageLabels[pageContext.page]}」页面的问题：「${question}」。`,
    facts.length > 0
      ? `当前页面最关键的数据是：${facts.join("；")}。`
      : "当前页面没有提供足够的结构化事实，大臣只能先给出保守解释。",
    freshnessNotes.length > 0
      ? `需要先看数据新鲜度：${freshnessNotes.join("；")}。`
      : "当前上下文没有明确的数据新鲜度标记，建议先确认行情、FX 和图表来源。",
    warnings.length > 0
      ? `页面已经提示的风险/备注包括：${warnings.join("；")}。`
      : "页面没有提供额外风险提示。",
    "这是一版本地 deterministic 回答，用来先跑通 Loo国大臣的安全接口；GPT-5.5 模式会继续使用同一套页面 context、今日秘闻和确认边界。",
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
  const fallbackNote = fallbackReason
    ? `GPT-5.5 调用未成功，已降级为本地大臣答复。原因：${fallbackReason}\n`
    : "";
  const answer: LooMinisterAnswerResult = {
    version: LOO_MINISTER_VERSION,
    generatedAt: new Date().toISOString(),
    role: "loo-minister",
    page: pageContext.page,
    title: fallbackReason
      ? `${pageLabels[pageContext.page]}大臣本地降级答复`
      : `${pageLabels[pageContext.page]}大臣答复`,
    answer: `${fallbackNote}${buildAnswer(input)}`,
    keyPoints: [
      ...pageContext.facts
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
      ...pageContext.facts.slice(0, 5).map((fact) => ({
        title: fact.label,
        sourceType: toAnswerSourceType(fact.source),
        asOf: pageContext.asOf,
      })),
    ],
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER,
  };

  return looMinisterAnswerResultSchema.parse(answer);
}

function buildRouterCompatiblePrompt(input: LooMinisterQuestionRequest) {
  const pageContext = input.pageContext;
  const freshness = pageContext.dataFreshness;
  const facts = pageContext.facts
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
    "你是 Loo国大臣。只使用下面的页面摘要回答中文问题。",
    "不要编造实时行情、新闻或论坛结论；投资相关回答必须包含不构成投资建议的免责声明。",
    "如果用户问某个标的是否适合买入/是否适配，不要因为当前组合占比是 0% 就停止分析；要按候选标的视角结合偏好、推荐引擎、资产类别、账户/税务/FX、缓存情报和数据新鲜度回答。",
    "如果关键事实里有 analysis-cache 或 external-intelligence 结果，优先引用它；没有时说明当前只能基于页面上下文和本地缓存回答。",
    "只返回合法 JSON object，不要 markdown，不要额外解释。",
    "JSON 字段必须是：version, generatedAt, role, page, title, answer, keyPoints, suggestedActions, sources, disclaimer。",
    `固定字段：version=${LOO_MINISTER_VERSION}; role=loo-minister; page=${pageContext.page}; suggestedActions=[]。`,
    "sources 至少包含一个 {title, sourceType, asOf}，sourceType 可用 page-context、portfolio-data、quote-cache、fx-cache、analysis-cache、external-intelligence、manual。",
    `disclaimer 必须是 {"zh":"仅用于研究学习，不构成投资建议。","en":"For research and education only. This is not investment advice."}`,
    "",
    `页面：${pageContext.title}`,
    `币种：${pageContext.displayCurrency}`,
    `页面时间：${pageContext.asOf}`,
    `标的身份：${subjectSecurity}`,
    `数据新鲜度：portfolio=${freshness.portfolioAsOf ?? "未知"}; quotes=${freshness.quotesAsOf ?? "未知"}; fx=${freshness.fxAsOf ?? "未知"}; chart=${freshness.chartFreshness}; source=${freshness.sourceMode}`,
    facts ? `关键事实：\n${facts}` : "关键事实：无",
    warnings ? `页面提醒：\n${warnings}` : "页面提醒：无",
    `用户问题：${input.question}`,
    `回答风格：${input.answerStyle}`,
  ].join("\n");
}

function sanitizeProviderError(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, (match) => {
      const last4 = match.slice(-4);
      return `sk-...${last4}`;
    })
    .slice(0, 500);
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
        "你是 Loo国大臣。只用提供的页面 context 回答中文问题；如果 context 里有 analysis-cache 或 external-intelligence 结果，优先引用它；没有时说明只能基于页面上下文和本地缓存回答。不要编造实时行情、新闻或论坛结论；保留 securityId 以及 symbol + exchange + currency 身份；所有投资相关回答必须包含不构成投资建议的免责声明。若用户问某标的是否适合买入/适配，不要因为当前持仓占比是 0% 就拒绝分析，要按候选标的视角结合偏好、推荐引擎、资产类别、账户/税务/FX、缓存情报和数据新鲜度回答。只返回合法 JSON object，不要 markdown。JSON 必须符合 LooMinisterAnswerResult：version、generatedAt、role、page、title、answer、keyPoints、suggestedActions、sources、disclaimer。role 必须是 loo-minister，suggestedActions 必须返回空数组，产品动作由本地应用控制。",
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
  return {
    id: `daily-intelligence-${index + 1}`,
    label: `今日秘闻：${item.title}`.slice(0, 120),
    value: item.summary.slice(0, 240),
    detail: [
      item.reason,
      item.freshnessLabel,
      item.confidenceLabel,
      item.relevanceLabel,
      ...item.keyPoints.slice(0, 2),
      ...item.riskFlags.slice(0, 2).map((flag) => `风险：${flag}`),
    ]
      .filter(Boolean)
      .join("；")
      .slice(0, 600),
    source: "external-intelligence",
  };
}

async function enrichMinisterInputWithDailyIntelligence(
  userId: string,
  input: LooMinisterQuestionRequest,
): Promise<LooMinisterQuestionRequest> {
  try {
    const items = await getDailyIntelligenceItemsForUser(userId, 5);
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
    const [profile, holdings, recommendationRun] = await Promise.all([
      repositories.preferences.getByUserId(userId),
      repositories.holdings.listByUserId(userId),
      repositories.recommendations
        .getLatestByUserId(userId)
        .catch(() => null),
    ]);
    const matchingHoldings = getMatchingHoldings(security, holdings);
    const totalMarketValueCad = matchingHoldings.reduce(
      (sum, holding) => sum + holding.marketValueCad,
      0,
    );
    const totalWeightPct = matchingHoldings.reduce(
      (sum, holding) => sum + (holding.weightPct ?? 0),
      0,
    );
    const assetClass =
      findFact(input.pageContext.facts, "asset-class")?.value ??
      matchingHoldings[0]?.assetClass ??
      null;
    const targetPct = assetClass
      ? getTargetAllocationForAssetClass(profile, assetClass)
      : null;
    const recommendationMatch = recommendationRun
      ? findRecommendationMatch(security, recommendationRun)
      : null;

    const addedFacts: LooMinisterFact[] = [
      {
        id: "candidate-current-exposure",
        label: "候选标的当前暴露",
        value:
          matchingHoldings.length > 0
            ? `${formatPct(totalWeightPct)} · ${totalMarketValueCad.toLocaleString("en-CA", { style: "currency", currency: "CAD" })}`
            : "0% · 当前未持有该 listing",
        detail:
          matchingHoldings.length > 0
            ? `匹配 ${matchingHoldings.length} 笔持仓；使用 securityId 或完整 symbol/exchange/currency 匹配。`
            : "0% 是当前暴露，不是候选分析结论；仍应继续看偏好、推荐路径和数据质量。",
        source: "portfolio-data",
      },
      {
        id: "candidate-preference-fit",
        label: "候选标的偏好上下文",
        value: summarizePreferenceProfile(profile),
        detail:
          "买入适配必须同时看风险容量、行业/风格倾向、现金/买房目标、税务和 USD 路径。",
        source: "user-input",
      },
      {
        id: "candidate-target-fit",
        label: "候选标的资产类别目标",
        value: assetClass
          ? `${assetClass} 目标 ${formatPct(targetPct)}`
          : "资产类别未确认",
        detail:
          assetClass && targetPct != null
            ? "这表示该标的应先服务于资产类别缺口，而不是单独看价格走势。"
            : "资产类别或目标缺失时，候选买入结论必须降级为观察。",
        source: "analysis-cache",
      },
      recommendationMatch
        ? {
            id: "candidate-recommendation-fit",
            label: "候选标的推荐引擎匹配",
            value: `最新推荐包含该 listing：${recommendationMatch.amountCad.toLocaleString("en-CA", { style: "currency", currency: "CAD" })} → ${recommendationMatch.targetAccountType}`,
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
              .slice(0, 600),
            source: "analysis-cache",
          }
        : {
            id: "candidate-recommendation-fit",
            label: "候选标的推荐引擎匹配",
            value: recommendationRun
              ? "最新推荐未把该 listing 列为首选"
              : "尚无最新推荐结果",
            detail: recommendationRun
              ? "这不是否定买入；只是说明当前推荐资金路径没有优先选择它。"
              : "请先生成推荐，再让大臣结合推荐路径判断候选买入优先级。",
            source: "analysis-cache",
          },
    ];

    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        facts: [...input.pageContext.facts, ...addedFacts].slice(0, 40),
      },
    };
  } catch {
    return {
      ...input,
      pageContext: {
        ...input.pageContext,
        warnings: [
          ...input.pageContext.warnings,
          "候选标的偏好/推荐上下文读取失败；大臣本次不会把 0% 持仓当作无法分析，但结论会更保守。",
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
    answer: parsed,
    usage: extractUsage(payload),
  };
}

export async function getLooMinisterAnswer(
  userId: string,
  input: LooMinisterQuestionRequest,
  options: {
    settings?: ResolvedLooMinisterSettings;
    persistUsage?: boolean;
  } = {},
) {
  const enrichedInput = await enrichMinisterInputWithDailyIntelligence(
    userId,
    await enrichMinisterInputWithCandidateFit(userId, input),
  );
  const settings =
    options.settings ?? (await resolveLooMinisterSettings(userId));
  const persistUsage = options.persistUsage ?? true;
  const localAnswer = (fallbackReason?: string) =>
    buildLocalAnswer(enrichedInput, fallbackReason);

  if (
    settings.mode !== "gpt-5.5" ||
    !settings.providerEnabled ||
    !settings.apiKey
  ) {
    const fallbackReason =
      settings.mode === "local"
        ? undefined
        : "GPT-5.5 provider 未启用或 API Key 未配置。";
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
    if (persistUsage) {
      await recordLooMinisterUsage(userId, {
        page: enrichedInput.pageContext.page,
        mode: settings.mode,
        provider: `${settings.provider}-${settings.apiKeySource}`,
        model: settings.model,
        status: "success",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        retryCount: result.retryCount,
      });
    }
    return apiSuccess(result.answer, "service");
  } catch (error) {
    const errorMessage = sanitizeProviderError(
      error instanceof Error ? error.message : "OpenAI provider failed.",
    );
    const answer = localAnswer(errorMessage);
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
