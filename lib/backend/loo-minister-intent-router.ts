import type {
  LooMinisterFact,
  LooMinisterPageContext,
  LooMinisterQuestionRequest,
} from "@/lib/backend/loo-minister-contracts";

export type LooMinisterIntent =
  | "import_workflow"
  | "how_to_action"
  | "page_explanation"
  | "portfolio_analysis"
  | "security_research"
  | "candidate_fit"
  | "recommendation_explain"
  | "freshness_debug"
  | "preference_settings"
  | "daily_intelligence"
  | "general_chat";

export type ClassifiedMinisterIntent = {
  primary: LooMinisterIntent;
  secondary: LooMinisterIntent[];
  confidence: "high" | "medium" | "low";
  scores: Record<LooMinisterIntent, number>;
  reasons: string[];
};

export type MinisterContextSelectionPolicy = {
  includeDailyIntelligence: boolean;
  includeGlobalUserContext: boolean;
  includePortfolioContext: boolean;
  includeSecurityContext: boolean;
  includeCandidateFit: boolean;
  factLimit: number;
};

const INTENTS: LooMinisterIntent[] = [
  "import_workflow",
  "how_to_action",
  "page_explanation",
  "portfolio_analysis",
  "security_research",
  "candidate_fit",
  "recommendation_explain",
  "freshness_debug",
  "preference_settings",
  "daily_intelligence",
  "general_chat",
];

function emptyScores(): Record<LooMinisterIntent, number> {
  return Object.fromEntries(INTENTS.map((intent) => [intent, 0])) as Record<
    LooMinisterIntent,
    number
  >;
}

function addScore(
  scores: Record<LooMinisterIntent, number>,
  reasons: string[],
  intent: LooMinisterIntent,
  points: number,
  reason: string,
) {
  scores[intent] += points;
  reasons.push(`${intent}+${points}:${reason}`);
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

export function classifyLooMinisterIntent(
  input: Pick<LooMinisterQuestionRequest, "pageContext" | "question">,
): ClassifiedMinisterIntent {
  const page = input.pageContext.page;
  const text = input.question.trim().toLowerCase();
  const scores = emptyScores();
  const reasons: string[] = [];

  addScore(scores, reasons, "general_chat", 1, "default");

  if (page === "import") {
    addScore(scores, reasons, "import_workflow", 4, "import page prior");
  }
  if (page === "portfolio" || page === "overview") {
    addScore(scores, reasons, "portfolio_analysis", 2, "portfolio page prior");
  }
  if (page === "portfolio-health") {
    addScore(scores, reasons, "portfolio_analysis", 3, "health page prior");
  }
  if (page === "security-detail" || page === "holding-detail") {
    addScore(scores, reasons, "security_research", 3, "security page prior");
  }
  if (page === "recommendations") {
    addScore(
      scores,
      reasons,
      "recommendation_explain",
      3,
      "recommendation page prior",
    );
  }
  if (page === "settings") {
    addScore(scores, reasons, "preference_settings", 2, "settings page prior");
  }

  if (
    has(
      text,
      /ibkr|inkr|interactive brokers|flex|token|授权口令|query\s*id|查询编号|券商|上贡|导入|同步|草稿|写入/,
    )
  ) {
    addScore(scores, reasons, "import_workflow", 7, "import domain terms");
  }
  if (
    has(
      text,
      /怎么|如何|怎样|哪里|入口|设置|配置|使用|操作|下一步|拿到|获取|填写|填/,
    )
  ) {
    addScore(scores, reasons, "how_to_action", 4, "how-to action terms");
  }
  if (has(text, /是什么|为什么|含义|意思|解释|作用|区别|页面|按钮|标签|tab/)) {
    addScore(scores, reasons, "page_explanation", 3, "explanation terms");
  }
  if (
    has(
      text,
      /组合|总资产|净资产|配置|占比|集中度|账户分布|超配|低配|再平衡|portfolio|allocation/,
    )
  ) {
    addScore(scores, reasons, "portfolio_analysis", 5, "portfolio terms");
  }
  if (has(text, /health|健康|评分|雷达|风险护栏|分数|巡查/)) {
    addScore(scores, reasons, "portfolio_analysis", 5, "health terms");
  }
  if (
    has(
      text,
      /标的|股票|etf|基金|走势|价格|估值|关键价位|研究台|财报|基本资料|ticker/,
    )
  ) {
    addScore(scores, reasons, "security_research", 5, "security terms");
  }
  if (has(text, /适合买|适合加|值得买|买入|加入|候选|适配|加仓|减仓/)) {
    addScore(scores, reasons, "candidate_fit", 9, "candidate-fit terms");
  }
  if (
    has(
      text,
      /推荐|进货|扫货|囤货|推荐池|候选池|优先级|为什么推荐|约束|排除|preferred|excluded/,
    )
  ) {
    addScore(
      scores,
      reasons,
      "recommendation_explain",
      6,
      "recommendation terms",
    );
  }
  if (
    has(
      text,
      /刷新|缓存|过期|真实|provider|api|来源|报价|资料待补|待确认|stale|freshness/,
    )
  ) {
    addScore(scores, reasons, "freshness_debug", 6, "freshness terms");
  }
  if (
    has(text, /偏好|preference|factor|风险偏好|买房|税务|现金|行业|风格|设置/)
  ) {
    addScore(scores, reasons, "preference_settings", 5, "preference terms");
  }
  if (has(text, /秘闻|新闻|论坛|外部信息|情报|晨报|brief|news/)) {
    addScore(scores, reasons, "daily_intelligence", 6, "intelligence terms");
  }

  const asksPortfolioImpact =
    has(text, /影响|导致|会不会|是否会|变化|改变/) &&
    has(text, /组合|配置|health|健康|超配|低配|占比/);
  if (asksPortfolioImpact) {
    addScore(
      scores,
      reasons,
      "portfolio_analysis",
      3,
      "portfolio impact question",
    );
  }
  if (
    page === "import" &&
    scores.import_workflow > 0 &&
    scores.portfolio_analysis > 0 &&
    !asksPortfolioImpact
  ) {
    scores.portfolio_analysis -= 5;
    reasons.push("portfolio_analysis-5: import page account/config conflict");
  }

  const sorted = INTENTS.map((intent) => ({
    intent,
    score: scores[intent],
  })).sort((a, b) => b.score - a.score);
  const primary =
    sorted[0]?.score && sorted[0].score > 1 ? sorted[0].intent : "general_chat";
  const primaryScore = scores[primary];
  const secondary = sorted
    .filter(
      (entry) =>
        entry.intent !== primary &&
        entry.intent !== "general_chat" &&
        entry.score >= Math.max(4, primaryScore - 4),
    )
    .slice(0, 2)
    .map((entry) => entry.intent);
  const runnerUp = sorted.find((entry) => entry.intent !== primary)?.score ?? 0;
  const confidence =
    primaryScore >= 8 && primaryScore - runnerUp >= 3
      ? "high"
      : primaryScore >= 5
        ? "medium"
        : "low";

  return {
    primary,
    secondary,
    confidence,
    scores,
    reasons: reasons.slice(0, 12),
  };
}

function includesIntent(
  classified: ClassifiedMinisterIntent,
  intent: LooMinisterIntent,
) {
  return classified.primary === intent || classified.secondary.includes(intent);
}

export function getMinisterContextSelectionPolicy(
  classified: ClassifiedMinisterIntent,
): MinisterContextSelectionPolicy {
  const portfolio =
    includesIntent(classified, "portfolio_analysis") ||
    includesIntent(classified, "recommendation_explain") ||
    includesIntent(classified, "candidate_fit");
  const security =
    includesIntent(classified, "security_research") ||
    includesIntent(classified, "candidate_fit");

  return {
    includeDailyIntelligence:
      includesIntent(classified, "daily_intelligence") ||
      includesIntent(classified, "security_research") ||
      includesIntent(classified, "recommendation_explain"),
    includeGlobalUserContext:
      portfolio || includesIntent(classified, "import_workflow"),
    includePortfolioContext: portfolio,
    includeSecurityContext: security,
    includeCandidateFit: includesIntent(classified, "candidate_fit"),
    factLimit: classified.confidence === "low" ? 8 : 12,
  };
}

const INTENT_CONTEXT_FACTS: Partial<Record<LooMinisterIntent, Set<string>>> = {
  import_workflow: new Set(["project-feature-import"]),
  how_to_action: new Set(["project-feature-import"]),
  page_explanation: new Set(["project-feature-import"]),
  recommendation_explain: new Set([
    "project-feature-recommendations",
    "project-feature-recommendation-constraints",
  ]),
  preference_settings: new Set(["project-feature-preferences"]),
  portfolio_analysis: new Set([
    "net-worth",
    "portfolio-context",
    "portfolio-context-summary",
    "portfolio-context-allocation",
    "portfolio-context-health",
    "global-user-context",
    "project-feature-portfolio",
    "project-feature-health",
  ]),
  security_research: new Set(["security-context", "project-feature-security"]),
  candidate_fit: new Set([
    "candidate-fit-context",
    "security-context",
    "portfolio-context",
    "global-user-context",
    "project-feature-security",
  ]),
  freshness_debug: new Set(["project-feature-data-freshness"]),
  daily_intelligence: new Set(["project-feature-daily-intelligence"]),
};

export function selectMinisterFactsForIntent(
  facts: LooMinisterFact[],
  classified: ClassifiedMinisterIntent,
  limit: number,
) {
  const allowedIds = new Set<string>();
  for (const intent of [classified.primary, ...classified.secondary]) {
    const ids = INTENT_CONTEXT_FACTS[intent];
    ids?.forEach((id) => allowedIds.add(id));
  }

  if (allowedIds.size === 0) {
    return facts.slice(0, limit);
  }

  const filtered = facts.filter((fact) => {
    if (allowedIds.has(fact.id)) {
      return true;
    }
    if (fact.source === "user-input") {
      return true;
    }
    if (
      fact.id.startsWith("comparison-subject-") ||
      fact.id.startsWith("security-mention-") ||
      fact.id.startsWith("context-resolver-status-")
    ) {
      return true;
    }
    if (
      fact.source === "external-intelligence" &&
      classified.primary !== "import_workflow" &&
      (includesIntent(classified, "daily_intelligence") ||
        includesIntent(classified, "security_research") ||
        includesIntent(classified, "candidate_fit") ||
        includesIntent(classified, "recommendation_explain"))
    ) {
      return true;
    }
    if (
      fact.id.startsWith("global-user-context") &&
      includesIntent(classified, "import_workflow")
    ) {
      return true;
    }
    if (
      classified.primary === "import_workflow" &&
      fact.id.startsWith("project-feature-import")
    ) {
      return true;
    }
    if (
      includesIntent(classified, "freshness_debug") &&
      ["quote-cache", "fx-cache", "analysis-cache"].includes(fact.source)
    ) {
      return true;
    }
    return false;
  });

  return (filtered.length > 0 ? filtered : facts).slice(0, limit);
}

export function compactPageContextForMinisterIntent(
  pageContext: LooMinisterPageContext,
  classified: ClassifiedMinisterIntent,
): LooMinisterPageContext {
  const policy = getMinisterContextSelectionPolicy(classified);
  return {
    ...pageContext,
    facts: selectMinisterFactsForIntent(
      pageContext.facts,
      classified,
      policy.factLimit,
    ),
  };
}
