import { apiSuccess } from "@/lib/backend/contracts";
import {
  LOO_MINISTER_VERSION,
  type LooMinisterAnswerResult,
  type LooMinisterFact,
  type LooMinisterQuestionRequest,
  looMinisterAnswerResultSchema,
} from "@/lib/backend/loo-minister-contracts";
import { PORTFOLIO_ANALYZER_DISCLAIMER } from "@/lib/backend/portfolio-analyzer-contracts";

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

function buildAnswer(input: LooMinisterQuestionRequest) {
  const { pageContext, question } = input;
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
    "这是一版本地 deterministic 回答，用来先跑通 Loo国大臣的安全接口；后续接入 GPT-5.5 时会继续使用同一套上下文 DTO 和确认边界。",
  ].join("\n");
}

type LooMinisterAnswerSourceType =
  | "page-context"
  | "portfolio-data"
  | "quote-cache"
  | "fx-cache"
  | "analysis-cache"
  | "manual";

function toAnswerSourceType(
  sourceType: LooMinisterFact["source"],
): LooMinisterAnswerSourceType {
  return sourceType === "user-input" || sourceType === "system"
    ? "manual"
    : sourceType;
}

export function getLooMinisterAnswer(
  userId: string,
  input: LooMinisterQuestionRequest,
) {
  void userId;

  const pageContext = input.pageContext;
  const answer: LooMinisterAnswerResult = {
    version: LOO_MINISTER_VERSION,
    generatedAt: new Date().toISOString(),
    role: "loo-minister",
    page: pageContext.page,
    title: `${pageLabels[pageContext.page]}大臣答复`,
    answer: buildAnswer(input),
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

  return apiSuccess(looMinisterAnswerResultSchema.parse(answer), "service");
}
