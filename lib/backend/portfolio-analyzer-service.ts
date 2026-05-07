import { apiSuccess } from "@/lib/backend/contracts";
import { getRepositories } from "@/lib/backend/repositories/factory";
import { assertExternalResearchAllowed } from "@/lib/backend/portfolio-external-research";
import {
  PORTFOLIO_ANALYZER_DISCLAIMER,
  PortfolioAnalyzerGptEnhancement,
  PortfolioAnalyzerGptEnhancementRequest,
  PortfolioAnalyzerRequest,
  PortfolioAnalyzerResult,
  portfolioAnalyzerGptEnhancementSchema,
  portfolioAnalyzerResultSchema
} from "@/lib/backend/portfolio-analyzer-contracts";
import {
  AnalyzerMarketDataContext,
  buildAccountAnalyzerQuickScan,
  buildPortfolioAnalyzerQuickScan,
  buildRecommendationRunAnalyzerQuickScan,
  buildSecurityAnalyzerQuickScan
} from "@/lib/backend/portfolio-analyzer";
import type { AnalyzerSecurityIdentity } from "@/lib/backend/portfolio-analyzer-contracts";
import type { HoldingPosition, SecurityPriceHistoryPoint } from "@/lib/backend/models";
import {
  recordLooMinisterUsage,
  resolveLooMinisterSettings,
} from "@/lib/backend/loo-minister-settings";

function normalizePart(value: string | null | undefined) {
  return value?.trim().toUpperCase() || "_";
}

export function buildPortfolioAnalyzerCacheKey(input: PortfolioAnalyzerRequest) {
  const prefix = `${input.scope}:${input.mode}`;

  if (input.scope === "portfolio") {
    return `${prefix}:all`;
  }

  if (input.scope === "account") {
    return `${prefix}:account:${input.accountId}`;
  }

  if (input.scope === "recommendation-run") {
    return `${prefix}:run:${input.recommendationRunId}`;
  }

  if (input.holdingId) {
    return `${prefix}:holding:${input.holdingId}`;
  }

  const identity = input.security;
  if (identity?.securityId) {
    return `${prefix}:security-id:${identity.securityId}`;
  }
  return [
    prefix,
    "security",
    normalizePart(identity?.symbol),
    normalizePart(identity?.exchange ?? null),
    normalizePart(identity?.currency ?? null),
    normalizePart(identity?.provider ?? null)
  ].join(":");
}

function expiresAtFrom(now: Date, maxCacheAgeSeconds: number) {
  return new Date(now.getTime() + maxCacheAgeSeconds * 1000).toISOString();
}

function shouldUseCache(input: PortfolioAnalyzerRequest) {
  return input.cacheStrategy === "prefer-cache" && !input.includeExternalResearch;
}

function sanitizeProviderError(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, (match) => `sk-...${match.slice(-4)}`)
    .slice(0, 500);
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

function clampText(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length > maxLength
    ? `${trimmed.slice(0, Math.max(0, maxLength - 1)).trim()}…`
    : trimmed;
}

function readStringArray(value: unknown, maxItems = 6, maxLength = 500) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => clampText(item, maxLength))
      .filter(Boolean)
      .slice(0, maxItems);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n+|[；;]\s*|(?<=。)\s*/u)
      .map((item) => clampText(item.replace(/^[-•\d.、\s]+/, ""), maxLength))
      .filter(Boolean);
  }

  return [];
}

function readNullableString(value: unknown, maxLength = 700) {
  return typeof value === "string" && value.trim()
    ? clampText(value, maxLength)
    : null;
}

export function sanitizeGptEnhancementPayloadForTest(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const data = value as Record<string, unknown>;
  const disclaimer =
    data.disclaimer && typeof data.disclaimer === "object"
      ? (data.disclaimer as Record<string, unknown>)
      : {};

  return {
    ...data,
    generatedAt: isIsoDateTime(data.generatedAt)
      ? data.generatedAt
      : new Date().toISOString(),
    title: readNullableString(data.title, 120) ?? "GPT 增强解读",
    role: "explanation-only",
    directAnswer:
      readNullableString(data.directAnswer, 800) ??
      readNullableString(data.answer, 800) ??
      "已根据智能快扫结果生成增强解读。",
    reasoning: readStringArray(data.reasoning),
    decisionGates: readStringArray(data.decisionGates),
    boundary: readNullableString(data.boundary, 700),
    nextStep: readNullableString(data.nextStep, 500),
    sourceLabel:
      readNullableString(data.sourceLabel, 120) ?? "GPT 增强解读 · 基于智能快扫",
    authorityBoundary:
      "GPT 只增强解释，不改变智能快扫结论、护栏或行动优先级。",
    disclaimer: {
      zh:
        readNullableString(disclaimer.zh) ??
        PORTFOLIO_ANALYZER_DISCLAIMER.zh,
      en:
        readNullableString(disclaimer.en) ??
        PORTFOLIO_ANALYZER_DISCLAIMER.en,
    },
  };
}

function normalizeIdentityPart(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

async function loadAnalyzerMarketDataContext(args: {
  userId: string;
  holdings: HoldingPosition[];
  identity?: AnalyzerSecurityIdentity | null;
}): Promise<AnalyzerMarketDataContext> {
  const repositories = getRepositories();
  const portfolioSnapshotsPromise = repositories.snapshots.listByUserId(args.userId);

  const identities = args.identity
    ? [args.identity]
    : args.holdings.map((holding) => ({
        securityId: holding.securityId ?? null,
        symbol: holding.symbol,
        exchange: holding.exchangeOverride ?? null,
        currency: holding.currency ?? null,
      }));
  const uniqueIdentities = [
    ...new Map(
      identities
        .map((identity) => ({
          securityId: identity.securityId ?? null,
          symbol: normalizeIdentityPart(identity.symbol),
          exchange: normalizeIdentityPart(identity.exchange),
          currency: normalizeIdentityPart(identity.currency),
        }))
        .filter((identity) => identity.securityId || identity.symbol)
        .map((identity) => [
          identity.securityId
            ? `security-id:${identity.securityId}`
            : `${identity.symbol}:${identity.exchange ?? "_"}:${identity.currency ?? "_"}`,
          identity,
        ]),
    ).values(),
  ];
  const historyLists = await Promise.all(
    uniqueIdentities.map(async (identity) => {
      if (identity.securityId) {
        return repositories.securityPriceHistory.listBySecurityId(
          identity.securityId,
        );
      }

      if (!identity.exchange) {
        return [];
      }

      return repositories.securityPriceHistory.listByIdentity({
        symbol: identity.symbol!,
        exchange: identity.exchange,
        currency: identity.currency,
      });
    }),
  );

  const byHistoryKey = new Map<string, SecurityPriceHistoryPoint>();
  for (const point of historyLists.flat()) {
    byHistoryKey.set(
      `${point.symbol}:${point.exchange ?? ""}:${point.currency}:${point.priceDate}`,
      point,
    );
  }

  return {
    priceHistory: [...byHistoryKey.values()],
    portfolioSnapshots: await portfolioSnapshotsPromise,
  };
}

async function readCachedAnalyzerResult(
  userId: string,
  input: PortfolioAnalyzerRequest,
  targetKey: string,
  freshnessContext?: {
    holdings: HoldingPosition[];
    marketData: AnalyzerMarketDataContext;
  },
) {
  if (!shouldUseCache(input)) {
    return null;
  }

  try {
    const cached = await getRepositories().analysisRuns.getFreshByKey(userId, {
      scope: input.scope,
      mode: input.mode,
      targetKey,
      now: new Date()
    });
    if (
      cached &&
      freshnessContext &&
      isAnalyzerCacheOlderThanMarketData(cached.generatedAt, freshnessContext)
    ) {
      return null;
    }
    return cached ? portfolioAnalyzerResultSchema.parse(cached.result) : null;
  } catch (error) {
    console.warn("Portfolio analyzer cache read skipped.", error);
    return null;
  }
}

export function isAnalyzerCacheOlderThanMarketData(
  generatedAt: string,
  context: {
    holdings: HoldingPosition[];
    marketData: AnalyzerMarketDataContext;
  },
) {
  const cacheTime = new Date(generatedAt).getTime();
  if (!Number.isFinite(cacheTime)) {
    return true;
  }

  const latestMarketDataTime = [
    ...context.holdings.flatMap((holding) => [
      holding.lastQuoteSuccessAt,
      holding.quoteProviderTimestamp,
    ]),
    ...(context.marketData.priceHistory ?? []).map((point) => point.createdAt),
    ...(context.marketData.portfolioSnapshots ?? []).map(
      (snapshot) => snapshot.createdAt,
    ),
  ]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];

  return latestMarketDataTime != null && latestMarketDataTime > cacheTime;
}

async function persistAnalyzerResult(
  userId: string,
  input: PortfolioAnalyzerRequest,
  targetKey: string,
  result: PortfolioAnalyzerResult
) {
  if (input.includeExternalResearch) {
    return;
  }

  try {
    await getRepositories().analysisRuns.create({
      userId,
      scope: result.scope,
      mode: result.mode,
      targetKey,
      request: input as unknown as Record<string, unknown>,
      result: result as unknown as Record<string, unknown>,
      sourceMode: result.dataFreshness.sourceMode,
      generatedAt: result.generatedAt,
      expiresAt: expiresAtFrom(new Date(), input.maxCacheAgeSeconds)
    });
  } catch (error) {
    console.warn("Portfolio analyzer cache write skipped.", error);
  }
}

function sourceModeLabel(value: PortfolioAnalyzerResult["dataFreshness"]["sourceMode"]) {
  return value === "live-external"
    ? "实时外部资料"
    : value === "cached-external"
      ? "本地规则 + 缓存外部资料"
      : "本地规则 + 缓存资料";
}

function buildGptEnhancementPrompt(result: PortfolioAnalyzerResult) {
  const securityDecision = result.securityDecision;
  return [
    "你是 Loo国的投资分析大臣。请把下面的“智能快扫”结果改写成一段更像 ChatGPT 的增强解读。",
    "重要边界：你只能增强解释，不能改变智能快扫的结论、护栏、行动优先级或仓位边界。不要编造实时行情、新闻、论坛或财报内容；只使用给定 JSON 的事实。不要说你已经做了外部研究。所有投资相关内容必须保留不构成投资建议。",
    "回答目标：先给直接结论，再解释为什么和用户组合相关、主要护栏、哪些条件会改变结论、下一步该怎么确认。",
    "只返回 JSON object，不要 markdown。",
    "JSON 字段必须是：generatedAt, title, role, directAnswer, reasoning, decisionGates, boundary, nextStep, sourceLabel, authorityBoundary, disclaimer。",
    "role 必须是 explanation-only。authorityBoundary 必须说明 GPT 只增强解释，不改变智能快扫结论、护栏或行动优先级。",
    `sourceLabel 必须写成：GPT 增强解读 · 基于${sourceModeLabel(result.dataFreshness.sourceMode)}。`,
    `disclaimer 必须是 ${JSON.stringify(PORTFOLIO_ANALYZER_DISCLAIMER)}。`,
    "",
    `快扫范围：${result.scope}`,
    `标的身份：${result.identity ? JSON.stringify(result.identity) : "无"}`,
    `核心判断：${securityDecision?.directAnswer ?? result.summary.thesis}`,
    `为什么现在看：${(securityDecision?.whyNow ?? []).join("；") || "无"}`,
    `主要护栏：${(securityDecision?.keyBlockers ?? []).join("；") || "无"}`,
    `组合适配：${(securityDecision?.portfolioFit ?? result.portfolioFit).join("；") || "无"}`,
    `观察触发点：${(securityDecision?.watchlistTriggers ?? []).join("；") || "无"}`,
    `评分卡：${result.scorecards.map((card) => `${card.label} ${card.score}: ${card.rationale}`).join("；")}`,
    `风险：${result.risks.map((risk) => `${risk.title}: ${risk.detail}`).join("；") || "无"}`,
    `数据边界：source=${result.dataFreshness.sourceMode}; quote=${result.dataFreshness.quoteFreshnessSummary ?? "未知"}; historyPoints=${result.dataFreshness.priceHistoryPointCount ?? 0}`,
  ].join("\n");
}

function getGptEnhancementTextFormat(provider: string) {
  if (provider === "openrouter-compatible") {
    return { type: "json_object" };
  }
  return {
    type: "json_schema",
    name: "PortfolioAnalyzerGptEnhancement",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        generatedAt: { type: "string" },
        title: { type: "string" },
        role: { type: "string", enum: ["explanation-only"] },
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
        sourceLabel: { type: "string" },
        authorityBoundary: { type: "string" },
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
        "generatedAt",
        "title",
        "role",
        "directAnswer",
        "reasoning",
        "decisionGates",
        "boundary",
        "nextStep",
        "sourceLabel",
        "authorityBoundary",
        "disclaimer",
      ],
    },
  };
}

async function callGptEnhancementProvider(
  result: PortfolioAnalyzerResult,
  settings: Awaited<ReturnType<typeof resolveLooMinisterSettings>>,
): Promise<{ enhancement: PortfolioAnalyzerGptEnhancement; usage: ReturnType<typeof extractUsage> }> {
  if (!settings.apiKey) {
    throw new Error("智能快扫 GPT 增强缺少可用 API Key。请先在设置里配置外部 GPT。");
  }

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
      reasoning: { effort: settings.reasoningEffort },
      text:
        settings.provider === "openrouter-compatible"
          ? { format: getGptEnhancementTextFormat(settings.provider) }
          : {
              verbosity: "low",
              format: getGptEnhancementTextFormat(settings.provider),
            },
      input: [
        {
          role: "user",
          content: buildGptEnhancementPrompt(result),
        },
      ],
    }),
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
    throw new Error(
      `GPT enhancement failed with status ${response.status}: ${detail}`,
    );
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("GPT enhancement response did not include output text.");
  }

  const parsed = portfolioAnalyzerGptEnhancementSchema.parse(
    sanitizeGptEnhancementPayloadForTest(JSON.parse(outputText)),
  );
  return {
    enhancement: parsed,
    usage: extractUsage(payload),
  };
}

export async function getPortfolioAnalyzerQuickScan(userId: string, input: PortfolioAnalyzerRequest) {
  const repositories = getRepositories();
  const targetKey = buildPortfolioAnalyzerCacheKey(input);
  assertExternalResearchAllowed(input);

  const [accounts, holdings, profile] = await Promise.all([
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.preferences.getByUserId(userId)
  ]);

  let result: PortfolioAnalyzerResult;
  let cached: PortfolioAnalyzerResult | null = null;

  if (input.scope === "portfolio") {
    const marketData = await loadAnalyzerMarketDataContext({ userId, holdings });
    cached = await readCachedAnalyzerResult(userId, input, targetKey, {
      holdings,
      marketData,
    });
    if (cached) {
      return apiSuccess(cached, "database");
    }
    result = buildPortfolioAnalyzerQuickScan({
      accounts,
      holdings,
      profile,
      marketData,
    });
  } else if (input.scope === "account") {
    const account = accounts.find((item) => item.id === input.accountId);
    if (!account) {
      throw new Error("Requested account is not available for quick analysis.");
    }

    const scopedHoldings = holdings.filter(
      (item) => item.accountId === input.accountId,
    );
    const marketData = await loadAnalyzerMarketDataContext({
      userId,
      holdings: scopedHoldings,
    });
    cached = await readCachedAnalyzerResult(userId, input, targetKey, {
      holdings: scopedHoldings,
      marketData,
    });
    if (cached) {
      return apiSuccess(cached, "database");
    }
    result = buildAccountAnalyzerQuickScan({
      account,
      accounts,
      holdings,
      profile,
      marketData,
    });
  } else if (input.scope === "security") {
    const holding = input.holdingId
      ? holdings.find((item) => item.id === input.holdingId)
      : undefined;
    const identity = input.security ?? (holding
      ? {
          symbol: holding.symbol,
          securityId: holding.securityId ?? null,
          exchange: holding.exchangeOverride ?? null,
          currency: holding.currency ?? null,
          name: holding.name,
          securityType: holding.securityTypeOverride ?? null
        }
      : null);

    if (!identity) {
      throw new Error("Security analysis requires a resolved security identity or holding id.");
    }

    const scopedHoldings = holdings.filter((item) => {
      const sameSymbol =
        item.symbol.trim().toUpperCase() === identity.symbol.trim().toUpperCase();
      const sameSecurity =
        !identity.securityId || item.securityId === identity.securityId;
      const sameExchange =
        !identity.exchange || item.exchangeOverride === identity.exchange;
      const sameCurrency = !identity.currency || item.currency === identity.currency;
      return sameSecurity && sameSymbol && sameExchange && sameCurrency;
    });
    const marketData = await loadAnalyzerMarketDataContext({
      userId,
      holdings,
      identity,
    });
    cached = await readCachedAnalyzerResult(userId, input, targetKey, {
      holdings: scopedHoldings,
      marketData,
    });
    if (cached) {
      return apiSuccess(cached, "database");
    }
    result = buildSecurityAnalyzerQuickScan({
      identity,
      accounts,
      holdings,
      profile,
      marketData,
    });
  } else {
    cached = await readCachedAnalyzerResult(userId, input, targetKey);
    if (cached) {
      return apiSuccess(cached, "database");
    }
    const latestRun = await repositories.recommendations.getLatestByUserId(userId);
    if (latestRun.id !== input.recommendationRunId) {
      throw new Error("Requested recommendation run is not available for quick analysis.");
    }

    result = buildRecommendationRunAnalyzerQuickScan({
      run: latestRun,
      profile
    });
  }

  await persistAnalyzerResult(userId, input, targetKey, result);
  return apiSuccess(result, "database");
}

export async function getPortfolioAnalyzerGptEnhancement(
  userId: string,
  input: PortfolioAnalyzerGptEnhancementRequest,
) {
  const baseInput: PortfolioAnalyzerRequest = {
    ...input,
    cacheStrategy: input.forceFreshBaseAnalysis ? "refresh" : input.cacheStrategy,
  };
  const base = await getPortfolioAnalyzerQuickScan(userId, baseInput);
  const settings = await resolveLooMinisterSettings(userId);

  if (
    settings.mode !== "gpt-5.5" ||
    !settings.providerEnabled ||
    !settings.apiKey
  ) {
    const message =
      settings.mode === "local"
        ? "当前设置为本地大臣。请先在设置里开启外部 GPT。"
        : !settings.providerEnabled
          ? "外部 GPT 未启用，请先在环境配置中开启 provider。"
          : "缺少可用 API Key，请先在设置里保存 OpenAI 或兼容 Provider 的 API Key。";
    await recordLooMinisterUsage(userId, {
      page: "security-detail",
      mode: settings.mode,
      provider: settings.mode === "local" ? "local" : settings.provider,
      model: settings.model,
      status: "failed",
      failureKind: "quick_scan_gpt_unavailable",
      errorMessage: message,
    });
    throw new Error(message);
  }

  try {
    const result = await callGptEnhancementProvider(base.data, settings);
    await recordLooMinisterUsage(userId, {
      page: base.data.scope === "security"
        ? "security-detail"
        : base.data.scope === "account"
          ? "account-detail"
          : base.data.scope === "recommendation-run"
            ? "recommendations"
            : "portfolio-health",
      mode: settings.mode,
      provider: `${settings.provider}-${settings.apiKeySource}`,
      model: settings.model,
      status: "success",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
    });
    return apiSuccess(
      {
        baseAnalysis: base.data,
        enhancement: result.enhancement,
      },
      "service",
    );
  } catch (error) {
    const errorMessage = sanitizeProviderError(
      error instanceof Error ? error.message : "GPT enhancement failed.",
    );
    await recordLooMinisterUsage(userId, {
      page: base.data.scope === "security"
        ? "security-detail"
        : base.data.scope === "account"
          ? "account-detail"
          : base.data.scope === "recommendation-run"
            ? "recommendations"
            : "portfolio-health",
      mode: settings.mode,
      provider: `${settings.provider}-${settings.apiKeySource}`,
      model: settings.model,
      status: "failed",
      failureKind: "quick_scan_gpt_failed",
      errorMessage,
    });
    throw new Error(`GPT 增强解读失败：${errorMessage}`);
  }
}
