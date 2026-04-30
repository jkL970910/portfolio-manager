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

function buildLocalAnswer(input: LooMinisterQuestionRequest) {
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

  return looMinisterAnswerResultSchema.parse(answer);
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
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          detail: { type: "string" },
          actionType: {
            enum: [
              "explain",
              "navigate",
              "open-form",
              "create-draft",
              "update-preferences",
              "refresh-data",
              "run-analysis",
            ],
          },
          target: {
            type: "object",
            additionalProperties: false,
            properties: {
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
              route: { type: "string" },
              accountId: { type: "string" },
              holdingId: { type: "string" },
              security: {
                type: "object",
                additionalProperties: false,
                properties: {
                  symbol: { type: "string" },
                  exchange: { type: "string" },
                  currency: { enum: ["CAD", "USD"] },
                  name: { type: "string" },
                  provider: { type: "string" },
                  securityType: { type: "string" },
                },
                required: ["symbol"],
              },
            },
          },
          requiresConfirmation: { type: "boolean" },
        },
        required: [
          "id",
          "label",
          "actionType",
          "target",
          "requiresConfirmation",
        ],
      },
      maxItems: 8,
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

async function callOpenAiMinister(
  input: LooMinisterQuestionRequest,
  settings: ResolvedLooMinisterSettings,
) {
  if (!settings.apiKey) {
    throw new Error("OpenAI API key is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      reasoning: {
        effort: process.env.LOO_MINISTER_REASONING_EFFORT || "low",
      },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "loo_minister_answer",
          strict: true,
          schema: answerJsonSchema,
        },
      },
      input: [
        {
          role: "system",
          content:
            "你是 Loo国大臣。只用提供的页面 context 回答中文问题；不要编造实时行情、新闻或论坛结论；保留 symbol + exchange + currency 身份；所有投资相关回答必须包含不构成投资建议的免责声明。suggestedActions 只能从 pageContext.allowedActions 复制安全动作；不确定时返回空数组。",
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
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const error = payload.error;
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : `OpenAI request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI response did not include output text.");
  }

  const parsed = looMinisterAnswerResultSchema.parse(JSON.parse(outputText));
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
  const settings =
    options.settings ?? (await resolveLooMinisterSettings(userId));
  const persistUsage = options.persistUsage ?? true;
  const localAnswer = () => buildLocalAnswer(input);

  if (
    settings.mode !== "gpt-5.5" ||
    !settings.providerEnabled ||
    !settings.apiKey
  ) {
    const answer = localAnswer();
    if (persistUsage) {
      await recordLooMinisterUsage(userId, {
        page: input.pageContext.page,
        mode: settings.mode,
        provider: "local",
        model: settings.model,
        status: settings.mode === "local" ? "success" : "fallback",
        errorMessage:
          settings.mode === "local"
            ? null
            : "GPT-5.5 mode is pending provider enablement or API key.",
      });
    }
    return apiSuccess(answer, "service");
  }

  try {
    const result = await callOpenAiMinister(input, settings);
    if (persistUsage) {
      await recordLooMinisterUsage(userId, {
        page: input.pageContext.page,
        mode: settings.mode,
        provider: `openai-${settings.apiKeySource}`,
        model: settings.model,
        status: "success",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      });
    }
    return apiSuccess(result.answer, "service");
  } catch (error) {
    const answer = localAnswer();
    if (persistUsage) {
      await recordLooMinisterUsage(userId, {
        page: input.pageContext.page,
        mode: settings.mode,
        provider: `openai-${settings.apiKeySource}`,
        model: settings.model,
        status: "fallback",
        errorMessage:
          error instanceof Error ? error.message : "OpenAI provider failed.",
      });
    }
    return apiSuccess(answer, "service");
  }
}
