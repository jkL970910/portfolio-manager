import { z } from "zod";

import { apiSuccess } from "@/lib/backend/contracts";
import {
  getOrBuildContextPack,
  LOO_MINISTER_CONTEXT_PACK_TTL_MS,
} from "@/lib/backend/loo-minister-context-pack-cache";
import {
  recordLooMinisterUsage,
  resolveLooMinisterSettings,
} from "@/lib/backend/loo-minister-settings";
import type { HoldingPosition } from "@/lib/backend/models";
import { getDailyIntelligenceItemsForUser } from "@/lib/backend/mobile-daily-intelligence";
import { getRepositories } from "@/lib/backend/repositories/factory";

const PROMPT_VERSION = "daily-intelligence-ai-summary-v1";
const SUMMARY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const dailyIntelligenceAiSummarySchema = z.object({
  generatedAt: z.string(),
  headline: z.string().min(1).max(80),
  coreSummary: z.string().min(1).max(420),
  relatedFields: z.array(z.string().min(1).max(30)).max(5),
  affectedHoldings: z
    .array(
      z.object({
        symbol: z.string().min(1).max(20),
        reason: z.string().min(1).max(140),
      }),
    )
    .max(8),
  portfolioImpact: z.string().min(1).max(360),
  watchPoints: z.array(z.string().min(1).max(120)).max(5),
});

export type DailyIntelligenceAiSummary = z.infer<
  typeof dailyIntelligenceAiSummarySchema
> & {
  itemId: string;
  cached: boolean;
  expiresAt: string;
};

function sanitizeProviderError(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, (match) => `sk-...${match.slice(-4)}`)
    .slice(0, 500);
}

function extractTextFromContent(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = extractTextFromContent(item);
      if (text) return text;
    }
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of [
    "output_text",
    "text",
    "content",
    "value",
    "arguments",
    "json",
  ]) {
    const text = extractTextFromContent(record[key]);
    if (text) return text;
  }
  if (typeof record.parsed === "object" && record.parsed) {
    return JSON.stringify(record.parsed);
  }
  return (
    extractTextFromContent(record.message) ??
    extractTextFromContent(record.delta) ??
    extractTextFromContent(record.function_call) ??
    extractTextFromContent(record.tool_calls)
  );
}

function extractOutputText(response: Record<string, unknown>) {
  const direct = extractTextFromContent(response.output_text);
  if (direct) return direct;

  const output = response.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const text = extractTextFromContent(item);
      if (text) return text;
    }
  }

  const choices = response.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const text = extractTextFromContent(choice);
      if (text) return text;
    }
  }

  return extractTextFromContent(response);
}

function parseProviderJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("Loo皇总结返回格式不是可解析 JSON。");
  }
}

function extractUsage(response: Record<string, unknown>) {
  const usage = response.usage;
  if (!usage || typeof usage !== "object") {
    return {};
  }
  const value = usage as Record<string, unknown>;
  return {
    inputTokens:
      typeof value.input_tokens === "number"
        ? value.input_tokens
        : typeof value.prompt_tokens === "number"
          ? value.prompt_tokens
          : null,
    outputTokens:
      typeof value.output_tokens === "number"
        ? value.output_tokens
        : typeof value.completion_tokens === "number"
          ? value.completion_tokens
          : null,
    totalTokens:
      typeof value.total_tokens === "number" ? value.total_tokens : null,
  };
}

function getOpenRouterChatCompletionsEndpoint(endpoint: string) {
  const withoutTrailingSlash = endpoint.trim().replace(/\/+$/, "");
  if (withoutTrailingSlash.endsWith("/chat/completions")) {
    return withoutTrailingSlash;
  }
  if (withoutTrailingSlash.endsWith("/responses")) {
    return withoutTrailingSlash.replace(/\/responses$/, "/chat/completions");
  }
  if (withoutTrailingSlash.endsWith("/api/v1")) {
    return `${withoutTrailingSlash}/chat/completions`;
  }
  if (withoutTrailingSlash.endsWith("/v1")) {
    return `${withoutTrailingSlash}/chat/completions`;
  }
  return `${withoutTrailingSlash}/v1/chat/completions`;
}

function buildLocalSummaryFallback(args: {
  item: Awaited<ReturnType<typeof getDailyIntelligenceItemsForUser>>[number];
  holdings: HoldingPosition[];
}): z.infer<typeof dailyIntelligenceAiSummarySchema> {
  const item = args.item;
  const text = [
    item.title,
    item.summary,
    ...item.keyPoints,
    item.reason,
  ]
    .join(" ")
    .toLowerCase();
  const matchedHoldings = args.holdings
    .filter((holding) => {
      const symbol = holding.symbol.toLowerCase();
      const name = holding.name.toLowerCase();
      return text.includes(symbol) || (name.length > 3 && text.includes(name));
    })
    .slice(0, 6);
  const fields = [
    item.sourceType === "news" ? "新闻公告" : item.sourceLabel,
    ...item.keyPoints
      .map((point) => point.split(/[：:，,。.;；]/)[0]?.trim() ?? "")
      .filter(Boolean),
  ].slice(0, 5);
  const title = item.title || "今日秘闻";
  const summary = item.summary || item.keyPoints[0] || "";
  return {
    generatedAt: new Date().toISOString(),
    headline: title.slice(0, 80),
    coreSummary: summary
      ? `这条新闻主要围绕「${title}」。原始摘要显示：${summary}`
      : `这条秘闻目前只有标题「${title}」，暂时不能形成更深入的解读。`,
    relatedFields: [...new Set(fields)],
    affectedHoldings: matchedHoldings.map((holding) => ({
      symbol: holding.symbol,
      reason: "新闻内容与该持仓的 symbol 或名称直接匹配，需要结合仓位大小和组合目标判断影响。",
    })),
    portfolioImpact:
      matchedHoldings.length > 0
        ? `这条新闻直接关联 ${matchedHoldings.map((holding) => holding.symbol).join("、")}。它应作为持仓复核背景，而不是单独的买卖依据。`
        : "这条新闻目前没有直接匹配到账户内持仓，可作为相关行业或市场情绪背景观察。",
    watchPoints: [
      "确认新闻是否影响公司基本面，而不是短期情绪。",
      "结合当前仓位占比、目标配置和风险护栏判断是否需要行动。",
      "如果只是单日消息，优先等待更多数据确认。",
    ],
  };
}

function textFormat(provider: "official-openai" | "openrouter-compatible") {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      generatedAt: { type: "string" },
      headline: { type: "string" },
      coreSummary: { type: "string" },
      relatedFields: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
      },
      affectedHoldings: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            symbol: { type: "string" },
            reason: { type: "string" },
          },
          required: ["symbol", "reason"],
        },
      },
      portfolioImpact: { type: "string" },
      watchPoints: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
      },
    },
    required: [
      "generatedAt",
      "headline",
      "coreSummary",
      "relatedFields",
      "affectedHoldings",
      "portfolioImpact",
      "watchPoints",
    ],
  };

  return provider === "openrouter-compatible"
    ? {
        type: "json_schema",
        name: "daily_intelligence_ai_summary",
        schema,
      }
    : {
        type: "json_schema",
        name: "daily_intelligence_ai_summary",
        strict: true,
        schema,
      };
}

function compactHoldingForPrompt(holding: HoldingPosition) {
  return {
    symbol: holding.symbol,
    name: holding.name,
    assetClass: holding.assetClass,
    sector: holding.sector,
    exchange: holding.exchangeOverride ?? holding.quoteExchange ?? null,
    currency: holding.currency ?? null,
    marketValueCad: Math.round(holding.marketValueCad),
  };
}

async function buildPrompt(userId: string, itemId: string) {
  const [items, holdings] = await Promise.all([
    getDailyIntelligenceItemsForUser(userId, 20),
    getRepositories().holdings.listByUserId(userId),
  ]);
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error("找不到这条今日秘闻，可能已经过期或被刷新替换。");
  }

  const promptPayload = {
    item: {
      id: item.id,
      title: item.title,
      summary: item.summary,
      sourceType: item.sourceType,
      sourceLabel: item.sourceLabel,
      generatedAt: item.generatedAt,
      identity: item.identity,
      keyPoints: item.keyPoints,
      riskFlags: item.riskFlags,
      sources: item.sources,
    },
    userHoldings: holdings
      .sort((left, right) => right.marketValueCad - left.marketValueCad)
      .slice(0, 60)
      .map(compactHoldingForPrompt),
  };

  return {
    item,
    holdings,
    content: [
      "请用中文总结这条 Loo国今日秘闻。",
      "目标用户是中长期个人投资者，不要给直接买卖指令。",
      "只基于下方已缓存新闻/资料和用户持仓列表判断相关领域、可能影响的持仓；不要编造实时行情、未给出的新闻事实或未在持仓列表里的持仓。",
      "affectedHoldings 只能包含 userHoldings 里出现的 symbol；如果没有直接影响，返回空数组。",
      "portfolioImpact 要解释它对组合关注点的影响，例如行业、主题、风险偏好、现金流、利率、科技/能源/金融/金属等，不要只复述新闻。",
      JSON.stringify(promptPayload),
    ].join("\n\n"),
  };
}

async function callProvider(input: {
  userId: string;
  itemId: string;
  prompt: string;
}) {
  const settings = await resolveLooMinisterSettings(input.userId);
  if (!settings.providerEnabled || settings.mode !== "gpt-5.5") {
    throw new Error("外部 GPT 尚未启用。请先在设置里开启外部大臣/GPT。");
  }
  if (!settings.apiKey) {
    throw new Error("缺少可用 API Key。请先在设置里配置外部 GPT token。");
  }

  const isOpenRouterCompatible = settings.provider === "openrouter-compatible";
  const endpoint = isOpenRouterCompatible
    ? getOpenRouterChatCompletionsEndpoint(settings.endpoint)
    : settings.endpoint;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Loo Portfolio Manager",
    },
    body: JSON.stringify(
      isOpenRouterCompatible
        ? {
            model: settings.model,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "你是 Loo国新闻研究助理。只输出合法 JSON object，中文、简洁、面向普通个人投资者。不要 markdown，不要解释 JSON 外的内容。",
              },
              {
                role: "user",
                content: [
                  input.prompt,
                  "必须返回 JSON object，字段为 generatedAt, headline, coreSummary, relatedFields, affectedHoldings, portfolioImpact, watchPoints。",
                  "affectedHoldings 是数组，每项包含 symbol 和 reason。",
                ].join("\n\n"),
              },
            ],
          }
        : {
            model: settings.model,
            instructions:
              "你是 Loo国新闻研究助理。只输出合法 JSON object，中文、简洁、面向普通个人投资者。不要输出 markdown。",
            store:
              process.env.LOO_MINISTER_DISABLE_RESPONSE_STORAGE === "true"
                ? false
                : undefined,
            reasoning: { effort: settings.reasoningEffort },
            text: {
              verbosity: "low",
              format: textFormat(settings.provider),
            },
            input: [
              {
                role: "user",
                content: input.prompt,
              },
            ],
          },
    ),
  });

  const responseText = await response.text().catch(() => "");
  let payload: Record<string, unknown> = {};
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }
  if (!response.ok) {
    const error = payload.error;
    const detail =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : responseText.trim()
          ? responseText.trim().slice(0, 500)
          : "No provider error body.";
    throw new Error(`Daily intelligence AI summary failed: ${detail}`);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error(
      `Loo皇总结没有返回可读内容。Provider 返回字段：${Object.keys(payload).slice(0, 12).join(", ") || "empty"}`,
    );
  }

  const parsed = dailyIntelligenceAiSummarySchema.parse(
    parseProviderJsonObject(outputText),
  );
  const usage = extractUsage(payload);
  await recordLooMinisterUsage(input.userId, {
    page: "overview",
    mode: settings.mode,
    provider: `${settings.provider}-${settings.apiKeySource}`,
    model: settings.model,
    status: "success",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  });
  return parsed;
}

export async function getDailyIntelligenceAiSummary(
  userId: string,
  input: { itemId: string },
) {
  const settings = await resolveLooMinisterSettings(userId);
  const { item, holdings, content } = await buildPrompt(userId, input.itemId);
  const key = [
    "dailyIntelligenceAiSummary",
    PROMPT_VERSION,
    userId,
    input.itemId,
    item.generatedAt,
    settings.model,
    settings.reasoningEffort,
  ]
    .join(":")
    .replace(/\s+/g, "-");

  try {
    const pack = await getOrBuildContextPack({
      key,
      kind: "external-intelligence",
      ttlMs: Math.max(
        SUMMARY_TTL_MS,
        LOO_MINISTER_CONTEXT_PACK_TTL_MS.externalIntelligence,
      ),
      asOf: item.generatedAt,
      build: () =>
        callProvider({
          userId,
          itemId: input.itemId,
          prompt: content,
        }),
    });
    return apiSuccess<DailyIntelligenceAiSummary>(
      {
        ...dailyIntelligenceAiSummarySchema.parse(pack.data),
        itemId: input.itemId,
        cached: pack.source !== "backend",
        expiresAt: pack.expiresAt,
      },
      pack.source === "backend" ? "service" : "database",
    );
  } catch (error) {
    const message = sanitizeProviderError(
      error instanceof Error ? error.message : "Loo皇总结生成失败。",
    );
    const fallback = buildLocalSummaryFallback({ item, holdings });
    try {
      await recordLooMinisterUsage(userId, {
        page: "overview",
        mode: settings.mode,
        provider: `${settings.provider}-${settings.apiKeySource}`,
        model: settings.model,
        status: "fallback",
        failureKind: "daily_intelligence_summary_fallback",
        errorMessage: message,
      });
    } catch {
      // Usage logging must not block a readable fallback summary.
    }
    return apiSuccess<DailyIntelligenceAiSummary>(
      {
        ...fallback,
        itemId: input.itemId,
        cached: false,
        expiresAt: new Date(Date.now() + SUMMARY_TTL_MS).toISOString(),
      },
      "service",
    );
  }
}
