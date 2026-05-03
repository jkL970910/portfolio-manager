import assert from "node:assert/strict";
import test from "node:test";
import { getLooMinisterAnswer } from "@/lib/backend/loo-minister";
import { LOO_MINISTER_VERSION } from "@/lib/backend/loo-minister-contracts";
import { mockRepositories } from "@/lib/backend/repositories/mock-repositories";

const now = "2026-04-30T04:00:00.000Z";

test("Loo Minister deterministic answer uses page context and keeps disclaimer", async () => {
  const response = await getLooMinisterAnswer(
    "user_1",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "overview",
        locale: "zh",
        title: "Loo国总览",
        asOf: now,
        displayCurrency: "CAD",
        subject: {},
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "local",
        },
        facts: [
          {
            id: "net-worth",
            label: "总资产",
            value: "CAD 100,000",
            source: "portfolio-data",
          },
        ],
        warnings: ["US Equity 高于目标。"],
        allowedActions: [
          {
            id: "open-health-score",
            label: "查看健康分",
            actionType: "navigate",
            target: { page: "portfolio-health" },
            requiresConfirmation: false,
          },
          {
            id: "run-portfolio-analysis",
            label: "运行 AI 组合快扫",
            actionType: "run-analysis",
            target: { page: "portfolio-health" },
            requiresConfirmation: true,
          },
        ],
      },
      question: "为什么总资产曲线和卡片数字不同？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.equal(response.meta.source, "service");
  assert.equal(response.data.role, "loo-minister");
  assert.equal(response.data.page, "overview");
  assert.match(response.data.answer, /总资产/);
  assert.match(response.data.disclaimer.zh, /不构成投资建议/);
  assert.equal(response.data.suggestedActions.length, 2);
});

test("Loo Minister GPT mode falls back safely when provider is not enabled", async () => {
  const response = await getLooMinisterAnswer(
    "user_1",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "security-detail",
        locale: "zh",
        title: "NVDA 标的详情",
        asOf: now,
        displayCurrency: "CAD",
        subject: {
          security: {
            symbol: "NVDA",
            exchange: "NASDAQ",
            currency: "USD",
          },
        },
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [
          {
            id: "security",
            label: "标的身份",
            value: "NVDA · NASDAQ · USD",
            source: "portfolio-data",
          },
        ],
        warnings: [],
        allowedActions: [],
      },
      question: "这个标的和我的组合适配吗？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "gpt-5.5",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.equal(response.meta.source, "service");
  assert.equal(response.data.page, "security-detail");
  assert.match(response.data.title, /本地答复/);
  assert.match(response.data.answer, /GPT-5.5 provider 未启用/);
  assert.match(response.data.answer, /候选适配资料/);
  assert.match(response.data.answer, /NVDA/);
  assert.match(response.data.disclaimer.zh, /不构成投资建议/);
});

test("Loo Minister answers product feature questions with project context", async () => {
  const response = await getLooMinisterAnswer(
    "user_1",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "settings",
        locale: "zh",
        title: "Loo国设置",
        asOf: now,
        displayCurrency: "CAD",
        subject: {},
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "unknown",
          sourceMode: "local",
        },
        facts: [
          {
            id: "preference-mode",
            label: "偏好设置模式",
            value: "新手引导 + 手动进阶",
            source: "user-input",
          },
        ],
        warnings: [],
        allowedActions: [],
      },
      question: "新手应该如何设置投资偏好？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /新手引导式问答/);
  assert.match(response.data.answer, /进阶用户直接手动编辑/);
  assert.match(response.data.answer, /先展示给你确认/);
  assert.ok(
    response.data.sources.some((source) => source.sourceType === "manual"),
  );
});

test("Loo Minister enriches answers with cached daily intelligence", async () => {
  await mockRepositories.externalResearchDocuments.create({
    userId: "minister_daily_user",
    providerDocumentId: "doc_vfv_minister_1",
    sourceType: "market-data",
    providerId: "market-data",
    sourceName: "本地缓存行情",
    title: "VFV listing 缓存行情快照",
    summary: "VFV TSX CAD 缓存行情可用，但仍需要人工复核。",
    url: null,
    publishedAt: "2026-04-30T00:00:00.000Z",
    capturedAt: now,
    expiresAt: "2099-05-01T04:00:00.000Z",
    language: "zh",
    security: {
      securityId: "sec_vfv_cad",
      symbol: "VFV",
      exchange: "TSX",
      currency: "CAD",
    },
    underlyingId: null,
    confidence: "high",
    sentiment: "neutral",
    relevanceScore: 78,
    sourceReliability: 82,
    keyPoints: ["最近缓存收盘价可用。"],
    riskFlags: ["缓存行情仍需人工复核。"],
    tags: ["market-data", "listing-identity"],
    rawPayload: {},
  });

  const response = await getLooMinisterAnswer(
    "minister_daily_user",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "security-detail",
        locale: "zh",
        title: "VFV 标的详情",
        asOf: now,
        displayCurrency: "CAD",
        subject: {
          security: {
            symbol: "VFV",
            exchange: "TSX",
            currency: "CAD",
          },
        },
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [
          {
            id: "security",
            label: "标的身份",
            value: "VFV · TSX · CAD",
            source: "portfolio-data",
          },
        ],
        warnings: [],
        allowedActions: [],
      },
      question: "这个标的当前有什么需要注意？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /VFV listing 缓存行情快照/);
  assert.ok(
    response.data.sources.some(
      (source) => source.sourceType === "external-intelligence",
    ),
  );
  assert.ok(
    response.data.keyPoints.some((point) => point.includes("今日秘闻")),
  );
});

test("Loo Minister answers candidate buy-fit questions without treating zero holding as no analysis", async () => {
  const response = await getLooMinisterAnswer(
    "user_casey",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "security-detail",
        locale: "zh",
        title: "ZQQ 标的详情",
        asOf: now,
        displayCurrency: "CAD",
        subject: {
          security: {
            securityId: "security_zqq_cad",
            symbol: "ZQQ",
            exchange: "TSX",
            currency: "CAD",
            name: "BMO Nasdaq 100 Equity Hedged to CAD Index ETF",
          },
        },
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [
          {
            id: "last-price",
            label: "最新价格",
            value: "CAD 187.76",
            source: "quote-cache",
          },
          {
            id: "asset-class",
            label: "资产类别",
            value: "US Equity",
            source: "analysis-cache",
          },
          {
            id: "sector",
            label: "行业",
            value: "Technology",
            source: "portfolio-data",
          },
        ],
        warnings: ["当前没有该标的持仓。"],
        allowedActions: [],
      },
      question: "这个标的适合买入吗？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /候选新增标的/);
  assert.match(response.data.answer, /0% 只代表当前未持有/);
  assert.match(response.data.answer, /偏好适配/);
  assert.match(response.data.answer, /推荐引擎/);
  assert.match(response.data.disclaimer.zh, /不构成投资建议/);
});

test("Loo Minister infers candidate economic exposure when page asset class is unknown", async () => {
  const response = await getLooMinisterAnswer(
    "user_casey",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "security-detail",
        locale: "zh",
        title: "XBB 标的详情",
        asOf: now,
        displayCurrency: "CAD",
        subject: {
          security: {
            securityId: "security_xbb_tsx_cad",
            symbol: "XBB",
            exchange: "TSX",
            currency: "CAD",
            name: "iShares Core Canadian Universe Bond Index ETF",
          },
        },
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "stale",
          sourceMode: "cached-external",
        },
        facts: [
          {
            id: "last-price",
            label: "最新价格",
            value: "CAD 27.97",
            source: "quote-cache",
          },
          {
            id: "asset-class",
            label: "资产类别",
            value: "未知",
            source: "analysis-cache",
          },
        ],
        warnings: ["当前没有该标的持仓。"],
        allowedActions: [],
      },
      question: "这个标的适合买入吗？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /候选新增标的/);
  assert.match(response.data.answer, /底层经济暴露：Fixed Income/);
  assert.match(response.data.answer, /目标 10\.0%/);
  assert.doesNotMatch(response.data.answer, /资产类别未确认/);
  assert.doesNotMatch(response.data.answer, /不能.*判断.*适配/);
});

test("Loo Minister hydrates comparison security context from a ticker mention", async () => {
  const response = await getLooMinisterAnswer(
    "user_casey",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "security-detail",
        locale: "zh",
        title: "ZQQ 标的详情",
        asOf: now,
        displayCurrency: "CAD",
        subject: {
          security: {
            securityId: "security_zqq_cad",
            symbol: "ZQQ",
            exchange: "TSX",
            currency: "CAD",
            name: "BMO Nasdaq 100 Equity Hedged to CAD Index ETF",
          },
        },
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [
          {
            id: "asset-class",
            label: "资产类别",
            value: "US Equity",
            source: "analysis-cache",
          },
        ],
        warnings: [],
        allowedActions: [],
      },
      question: "和 VFV 比呢？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /对比标的 1：VFV · TSX · CAD/);
  assert.match(response.data.answer, /资料补齐状态：hydrated/);
  assert.match(response.data.disclaimer.zh, /不构成投资建议/);
});

test("Loo Minister resolves multiple ticker mentions in one round", async () => {
  const response = await getLooMinisterAnswer(
    "user_casey",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "portfolio",
        locale: "zh",
        title: "Loo国组合",
        asOf: now,
        displayCurrency: "CAD",
        subject: {},
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [
          {
            id: "portfolio-context",
            label: "组合上下文",
            value: "CAD 100,000",
            detail: JSON.stringify({
              version: "portfolio-context.v1",
              page: "portfolio",
              summary: {
                totalNetWorthCad: 100000,
                totalMarketValueCad: 80000,
                cashBalanceCad: 20000,
                accountCount: 2,
                holdingCount: 4,
                topHolding: "VFV 12.5%",
              },
              accounts: [],
              assetAllocation: [],
              concentration: {
                topHoldings: [],
                topFiveWeightPct: 0,
                largestHoldingWeightPct: 0,
              },
              health: {
                score: 72,
                status: "ok",
                weakestDimension: null,
                strongestDimension: null,
                actionQueue: [],
              },
              preference: {
                summary: "test",
                riskProfile: "balanced",
                cashBufferTargetCad: 0,
                source: null,
              },
              recommendation: {
                runId: null,
                engineVersion: null,
                topItems: [],
                assumptions: [],
              },
              dataFreshness: {
                portfolioAsOf: now,
                quotesAsOf: now,
                fxAsOf: now,
                chartFreshness: "fresh",
                sourceMode: "cached-external",
              },
              cachedIntelligence: { count: 0, summaries: [] },
              analysisCache: { count: 0, summaries: [] },
              contextCompleteness: { score: 100, missing: [], blocking: [] },
              rules: [],
            }),
            source: "analysis-cache",
          },
        ],
        warnings: [],
        allowedActions: [],
      },
      question: "VFV 和 XEQT 比呢？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /对比标的 1/);
  assert.match(response.data.answer, /VFV/);
  assert.match(response.data.answer, /XEQT/);
  assert.match(response.data.disclaimer.zh, /不构成投资建议/);
});

test("Loo Minister explains Health Score with portfolio and account lenses", async () => {
  const response = await getLooMinisterAnswer(
    "user_1",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "portfolio-health",
        locale: "zh",
        title: "Loo国健康巡查",
        asOf: now,
        displayCurrency: "CAD",
        subject: {},
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "local",
        },
        facts: [
          {
            id: "health-score",
            label: "健康分",
            value: "74",
            detail: "US Equity 高于目标。",
            source: "analysis-cache",
          },
          {
            id: "asset-class-drift",
            label: "资产配置偏离",
            value: "US Equity 高于目标",
            source: "analysis-cache",
          },
        ],
        warnings: [],
        allowedActions: [],
      },
      question: "健康分里最应该先修正什么？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /Health Score/);
  assert.match(response.data.answer, /全组合 Health/);
  assert.match(response.data.answer, /账户级 Health/);
  assert.match(response.data.answer, /配置偏离/);
});

test("Loo Minister uses portfolio context DTO for whole-portfolio holding questions", async () => {
  const response = await getLooMinisterAnswer(
    "user_casey",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "portfolio",
        locale: "zh",
        title: "Loo国组合",
        asOf: now,
        displayCurrency: "CAD",
        subject: {},
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [
          {
            id: "portfolio-total",
            label: "组合总值",
            value: "CAD 106,900",
            source: "portfolio-data",
          },
        ],
        warnings: [],
        allowedActions: [],
      },
      question: "整体持仓最大风险是什么？下一步怎么调整？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /组合上下文/);
  assert.match(response.data.answer, /投资资产/);
  assert.match(response.data.answer, /前五大持仓/);
  assert.match(response.data.answer, /Health/);
  assert.match(response.data.answer, /偏好/);
  assert.doesNotMatch(response.data.answer, /投资偏好现在应理解/);
});

test("Loo Minister hydrates mentioned ticker context on portfolio pages", async () => {
  const response = await getLooMinisterAnswer(
    "user_demo",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "portfolio",
        locale: "zh",
        title: "Loo国组合",
        asOf: now,
        displayCurrency: "CAD",
        subject: {},
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [],
        warnings: [],
        allowedActions: [],
      },
      question: "XBB 现在是否适合买入？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /候选买入\/适配/);
  assert.match(response.data.answer, /已识别标的/);
  assert.match(response.data.answer, /XBB/);
  assert.match(response.data.answer, /当前未持有不代表不能分析/);
  assert.doesNotMatch(response.data.answer, /当前页面没有足够.*context/);
});

test("Loo Minister explains recommendation constraints and V3 overlay boundaries", async () => {
  const response = await getLooMinisterAnswer(
    "user_1",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "recommendations",
        locale: "zh",
        title: "Loo国推荐",
        asOf: now,
        displayCurrency: "CAD",
        subject: {
          recommendationRunId: "run_1",
        },
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [
          {
            id: "recommendation-run",
            label: "推荐批次",
            value: "V2.1 Core + V3 Overlay",
            source: "analysis-cache",
          },
          {
            id: "recommendation-constraints",
            label: "推荐约束",
            value: "排除高波动单股，偏好 ETF",
            source: "user-input",
          },
        ],
        warnings: [],
        allowedActions: [],
      },
      question: "为什么推荐这个，约束和 V3 overlay 有什么影响？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /V2\.1 Core/);
  assert.match(response.data.answer, /V3 Overlay/);
  assert.match(response.data.answer, /排除规则优先于偏好规则/);
  assert.match(response.data.answer, /不会在页面加载时实时抓新闻/);
});

test("Loo Minister treats V2 as deprecated and points users to V2.1 Core", async () => {
  const response = await getLooMinisterAnswer(
    "user_1",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "recommendations",
        locale: "zh",
        title: "Loo国推荐",
        asOf: now,
        displayCurrency: "CAD",
        subject: {},
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "local",
        },
        facts: [],
        warnings: [],
        allowedActions: [],
      },
      question: "V2 还需要继续用吗？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /V2 已经是历史\/deprecated/);
  assert.match(response.data.answer, /V2\.1 Core/);
  assert.match(response.data.answer, /V3 Overlay/);
});

test("legacy empty recommendation run defaults to V2.1 engine version", async () => {
  const { getRecommendationView } = await import(
    "@/lib/backend/services"
  );
  const response = await getRecommendationView("user_demo");

  assert.equal(response.data.engine.version, "V2.1 Core");
});

test("Loo Minister explains security detail without ticker-only merging", async () => {
  const response = await getLooMinisterAnswer(
    "user_1",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "security-detail",
        locale: "zh",
        title: "VFV 标的详情",
        asOf: now,
        displayCurrency: "CAD",
        subject: {
          security: {
            securityId: "security_vfv_cad",
            symbol: "VFV",
            exchange: "TSX",
            currency: "CAD",
            name: "Vanguard S&P 500 Index ETF",
          },
        },
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [
          {
            id: "security-identity",
            label: "标的身份",
            value: "VFV · TSX · CAD",
            source: "portfolio-data",
          },
          {
            id: "price-trend",
            label: "价格走势",
            value: "本地历史可用",
            source: "quote-cache",
          },
        ],
        warnings: [],
        allowedActions: [],
      },
      question: "这个标的详情应该怎么看？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /VFV · TSX · CAD/);
  assert.match(response.data.answer, /不会只按 ticker 合并/);
  assert.match(response.data.answer, /数据新鲜度/);
  assert.match(response.data.answer, /偏好和数据新鲜度/);
});

test("Loo Minister uses security context DTO for non-buy security questions", async () => {
  const response = await getLooMinisterAnswer(
    "user_casey",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "security-detail",
        locale: "zh",
        title: "VFV 标的详情",
        asOf: now,
        displayCurrency: "CAD",
        subject: {
          security: {
            securityId: "security_vfv_cad",
            symbol: "VFV",
            exchange: "TSX",
            currency: "CAD",
            name: "Vanguard S&P 500 Index ETF",
          },
        },
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [
          {
            id: "asset-class",
            label: "资产类别",
            value: "US Equity",
            source: "analysis-cache",
          },
          {
            id: "last-price",
            label: "最新价格",
            value: "CAD 132.80",
            source: "quote-cache",
          },
        ],
        warnings: [],
        allowedActions: [],
      },
      question: "这个标的最大的风险和作用是什么？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /标的上下文/);
  assert.match(response.data.answer, /VFV · TSX · CAD/);
  assert.match(response.data.answer, /底层经济暴露 US Equity/);
  assert.match(response.data.answer, /持仓上下文/);
  assert.match(response.data.answer, /15\.8%/);
  assert.doesNotMatch(response.data.answer, /候选新增标的/);
});

test("Loo Minister builds security context from holding detail without explicit security subject", async () => {
  const response = await getLooMinisterAnswer(
    "user_casey",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "holding-detail",
        locale: "zh",
        title: "VFV 持仓详情",
        asOf: now,
        displayCurrency: "CAD",
        subject: {
          holdingId: "hold_vfv_casey",
        },
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [],
        warnings: [],
        allowedActions: [],
      },
      question: "这个持仓需要注意什么风险？",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /标的上下文/);
  assert.match(response.data.answer, /VFV · TSX · CAD/);
  assert.match(response.data.answer, /已持有 listing/);
  assert.match(response.data.answer, /US Equity/);
});

test("Loo Minister hands analysis requests off to confirmed run-analysis actions", async () => {
  const response = await getLooMinisterAnswer(
    "user_1",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "security-detail",
        locale: "zh",
        title: "VFV 标的详情",
        asOf: now,
        displayCurrency: "CAD",
        subject: {
          security: {
            securityId: "security_vfv_cad",
            symbol: "VFV",
            exchange: "TSX",
            currency: "CAD",
            name: "Vanguard S&P 500 Index ETF",
          },
        },
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "fresh",
          sourceMode: "cached-external",
        },
        facts: [],
        warnings: [],
        allowedActions: [
          {
            id: "run-security-analysis",
            label: "运行 AI 标的快扫",
            actionType: "run-analysis",
            target: {
              page: "security-detail",
              security: {
                securityId: "security_vfv_cad",
                symbol: "VFV",
                exchange: "TSX",
                currency: "CAD",
              },
            },
            requiresConfirmation: true,
          },
        ],
      },
      question: "帮我分析一下这个标的",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /AI 快扫\/分析 handoff/);
  assert.match(response.data.answer, /必须由你点击确认/);
  assert.equal(response.data.suggestedActions.length, 1);
  assert.equal(response.data.suggestedActions[0]?.actionType, "run-analysis");
  assert.equal(response.data.suggestedActions[0]?.requiresConfirmation, true);
});

test("Loo Minister explains analysis handoff without actions when page cannot run analysis", async () => {
  const response = await getLooMinisterAnswer(
    "user_1",
    {
      pageContext: {
        version: LOO_MINISTER_VERSION,
        page: "settings",
        locale: "zh",
        title: "设置",
        asOf: now,
        displayCurrency: "CAD",
        subject: {},
        dataFreshness: {
          portfolioAsOf: now,
          quotesAsOf: now,
          fxAsOf: now,
          chartFreshness: "unknown",
          sourceMode: "local",
        },
        facts: [],
        warnings: [],
        allowedActions: [],
      },
      question: "帮我运行一下 AI 快扫",
      answerStyle: "beginner",
      cacheStrategy: "prefer-cache",
      includeExternalResearch: false,
    },
    {
      settings: {
        mode: "local",
        provider: "official-openai",
        model: "gpt-5.5",
        reasoningEffort: "medium",
        endpoint: "https://api.openai.com/v1/responses",
        apiKey: null,
        apiKeySource: "none",
        providerEnabled: false,
      },
      persistUsage: false,
    },
  );

  assert.match(response.data.answer, /当前页面没有提供可直接运行的 AI 快扫动作/);
  assert.equal(response.data.suggestedActions.length, 0);
});

test("Loo Minister provider fallback redacts API keys in user-visible reason", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          message:
            "Incorrect API key provided: sk-test-secret-1234567890abcdef.",
        },
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const response = await getLooMinisterAnswer(
      "user_1",
      {
        pageContext: {
          version: LOO_MINISTER_VERSION,
          page: "overview",
          locale: "zh",
          title: "Loo国总览",
          asOf: now,
          displayCurrency: "CAD",
          subject: {},
          dataFreshness: {
            portfolioAsOf: now,
            quotesAsOf: now,
            fxAsOf: now,
            chartFreshness: "fresh",
            sourceMode: "local",
          },
          facts: [
            {
              id: "net-worth",
              label: "总资产",
              value: "CAD 100,000",
              source: "portfolio-data",
            },
            {
              id: "latest-analysis",
              label: "最近 AI 分析",
              value: "缓存外部研究指出 VFV 价格历史不足",
              detail: "sourceMode=cached-external",
              source: "analysis-cache",
            },
          ],
          warnings: [],
          allowedActions: [],
        },
        question: "为什么还是本地答案？",
        answerStyle: "beginner",
        cacheStrategy: "prefer-cache",
        includeExternalResearch: false,
      },
      {
        settings: {
          mode: "gpt-5.5",
          provider: "official-openai",
          model: "gpt-5.5",
          reasoningEffort: "medium",
          endpoint: "https://api.openai.com/v1/responses",
          apiKey: "sk-test-secret-1234567890abcdef",
          apiKeySource: "user",
          providerEnabled: true,
        },
        persistUsage: false,
      },
    );

  assert.match(response.data.title, /本地答复/);
    assert.match(response.data.answer, /sk-\.\.\.cdef/);
    assert.doesNotMatch(response.data.answer, /sk-test-secret/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Loo Minister can call an OpenRouter-compatible Responses endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const originalReasoningEffort = process.env.LOO_MINISTER_REASONING_EFFORT;
  const originalDisableStorage =
    process.env.LOO_MINISTER_DISABLE_RESPONSE_STORAGE;
  let requestedUrl = "";
  let requestedModel = "";
  let requestedStore: unknown;
  let requestedReasoningEffort = "";
  let requestedFormatType = "";
  let requestedInput: unknown;

  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      model?: string;
      store?: unknown;
      reasoning?: { effort?: string };
      text?: { format?: { type?: string } };
      input?: unknown;
    };
    requestedModel = body.model ?? "";
    requestedStore = body.store;
    requestedReasoningEffort = body.reasoning?.effort ?? "";
    requestedFormatType = body.text?.format?.type ?? "";
    requestedInput = body.input;

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          version: LOO_MINISTER_VERSION,
          generatedAt: now,
          role: "loo-minister",
          page: "overview",
          title: "总览大臣答复",
          answer: "大臣按当前页面 context 给出真实模型答复。",
          keyPoints: ["总资产: CAD 100,000"],
          suggestedActions: [],
          sources: [
            {
              title: "Loo国总览 页面上下文",
              sourceType: "page-context",
              asOf: now,
            },
          ],
          disclaimer: {
            zh: "仅用于研究学习，不构成投资建议。",
            en: "For research and education only. This is not investment advice.",
          },
        }),
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    process.env.LOO_MINISTER_DISABLE_RESPONSE_STORAGE = "true";
    const response = await getLooMinisterAnswer(
      "user_1",
      {
        pageContext: {
          version: LOO_MINISTER_VERSION,
          page: "overview",
          locale: "zh",
          title: "Loo国总览",
          asOf: now,
          displayCurrency: "CAD",
          subject: {},
          dataFreshness: {
            portfolioAsOf: now,
            quotesAsOf: now,
            fxAsOf: now,
            chartFreshness: "fresh",
            sourceMode: "local",
          },
          facts: [
            {
              id: "net-worth",
              label: "总资产",
              value: "CAD 100,000",
              source: "portfolio-data",
            },
            {
              id: "latest-analysis",
              label: "最近 AI 分析",
              value: "缓存外部研究指出 VFV 价格历史不足",
              detail: "sourceMode=cached-external",
              source: "analysis-cache",
            },
          ],
          warnings: [],
          allowedActions: [
            {
              id: "run-portfolio-analysis",
              label: "运行 AI 组合快扫",
              actionType: "run-analysis",
              target: { page: "portfolio-health" },
              requiresConfirmation: true,
            },
          ],
        },
        question: "帮我分析当前组合",
        answerStyle: "beginner",
        cacheStrategy: "prefer-cache",
        includeExternalResearch: false,
      },
      {
        settings: {
          mode: "gpt-5.5",
          provider: "openrouter-compatible",
          model: "gpt-5.5",
          reasoningEffort: "medium",
          endpoint: "https://openrouter.icu/v1/responses",
          apiKey: "sk-router-test",
          apiKeySource: "user",
          providerEnabled: true,
        },
        persistUsage: false,
      },
    );

    assert.equal(requestedUrl, "https://openrouter.icu/v1/responses");
    assert.equal(requestedModel, "gpt-5.5");
    assert.equal(requestedStore, false);
    assert.equal(requestedReasoningEffort, "medium");
    assert.equal(requestedFormatType, "json_object");
    assert.equal(Array.isArray(requestedInput), true);
    assert.equal((requestedInput as Array<unknown>).length, 1);
    assert.match(
      ((requestedInput as Array<{ content?: string }>)[0]?.content ?? ""),
      /关键事实/,
    );
    assert.match(
      ((requestedInput as Array<{ content?: string }>)[0]?.content ?? ""),
      /source=analysis-cache/,
    );
    assert.match(
      ((requestedInput as Array<{ content?: string }>)[0]?.content ?? ""),
      /优先引用它/,
    );
    assert.equal(response.data.title, "总览大臣答复");
    assert.equal(response.data.suggestedActions.length, 1);
    assert.equal(response.data.suggestedActions[0]?.id, "run-portfolio-analysis");
    assert.doesNotMatch(response.data.answer, /本地 deterministic 回答/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.LOO_MINISTER_REASONING_EFFORT = originalReasoningEffort;
    process.env.LOO_MINISTER_DISABLE_RESPONSE_STORAGE = originalDisableStorage;
  }
});

test("Loo Minister OpenRouter prompt prioritizes candidate fit context", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPrompt = "";

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      input?: Array<{ content?: string }>;
    };
    requestedPrompt = body.input?.[0]?.content ?? "";

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          version: LOO_MINISTER_VERSION,
          generatedAt: now,
          role: "loo-minister",
          page: "security-detail",
          title: "标的大臣答复",
          answer: "我会按候选买入问题处理，0% 只代表当前未持有，不代表无法分析。",
          keyPoints: ["候选标的适配口径: 0% 不是无法分析"],
          suggestedActions: [],
          sources: [
            {
              title: "XBB 标的详情 页面上下文",
              sourceType: "page-context",
              asOf: now,
            },
          ],
          disclaimer: {
            zh: "仅用于研究学习，不构成投资建议。",
            en: "For research and education only. This is not investment advice.",
          },
        }),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    await getLooMinisterAnswer(
      "user_casey",
      {
        pageContext: {
          version: LOO_MINISTER_VERSION,
          page: "security-detail",
          locale: "zh",
          title: "XBB 标的详情",
          asOf: now,
          displayCurrency: "CAD",
          subject: {
            security: {
              securityId: "security_xbb_tsx_cad",
              symbol: "XBB",
              exchange: "TSX",
              currency: "CAD",
              name: "iShares Core Canadian Universe Bond Index ETF",
            },
          },
          dataFreshness: {
            portfolioAsOf: now,
            quotesAsOf: now,
            fxAsOf: now,
            chartFreshness: "stale",
            sourceMode: "cached-external",
          },
          facts: [
            ...Array.from({ length: 16 }, (_, index) => ({
              id: `filler-${index}`,
              label: `低优先级事实 ${index}`,
              value: "不应挤掉候选适配上下文",
              source: "portfolio-data" as const,
            })),
            {
              id: "asset-class",
              label: "资产类别",
              value: "未知",
              source: "analysis-cache" as const,
            },
          ],
          warnings: [],
          allowedActions: [],
        },
        question: "这个标的适合买入吗？",
        answerStyle: "beginner",
        cacheStrategy: "prefer-cache",
        includeExternalResearch: false,
      },
      {
        settings: {
          mode: "gpt-5.5",
          provider: "openrouter-compatible",
          model: "gpt-5.5",
          reasoningEffort: "medium",
          endpoint: "https://openrouter.icu/v1/responses",
          apiKey: "sk-router-test",
          apiKeySource: "user",
          providerEnabled: true,
        },
        persistUsage: false,
      },
    );

    assert.match(requestedPrompt, /候选适配/);
    assert.match(requestedPrompt, /"analysisMode":"candidate-new-buy"/);
    assert.match(requestedPrompt, /"assetClass":"Fixed Income"/);
    assert.match(requestedPrompt, /currentExposurePct=0 never blocks/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Loo Minister replaces misleading candidate fit provider answers", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          version: LOO_MINISTER_VERSION,
          generatedAt: now,
          role: "loo-minister",
          page: "security-detail",
          title: "标的大臣答复",
          answer:
            "当前页面没有足够组合上下文判断这个标的是否适配，因此 XBB 当前组合占比 0% 就不能继续分析。",
          keyPoints: ["上下文不足"],
          suggestedActions: [],
          sources: [
            {
              title: "XBB 标的详情 页面上下文",
              sourceType: "page-context",
              asOf: now,
            },
          ],
          disclaimer: {
            zh: "仅用于研究学习，不构成投资建议。",
            en: "For research and education only. This is not investment advice.",
          },
        }),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const response = await getLooMinisterAnswer(
      "user_casey",
      {
        pageContext: {
          version: LOO_MINISTER_VERSION,
          page: "security-detail",
          locale: "zh",
          title: "XBB 标的详情",
          asOf: now,
          displayCurrency: "CAD",
          subject: {
            security: {
              securityId: "security_xbb_tsx_cad",
              symbol: "XBB",
              exchange: "TSX",
              currency: "CAD",
              name: "iShares Core Canadian Universe Bond Index ETF",
            },
          },
          dataFreshness: {
            portfolioAsOf: now,
            quotesAsOf: now,
            fxAsOf: now,
            chartFreshness: "stale",
            sourceMode: "cached-external",
          },
          facts: [],
          warnings: [],
          allowedActions: [],
        },
        question: "这个标的适合买入吗？",
        answerStyle: "beginner",
        cacheStrategy: "prefer-cache",
        includeExternalResearch: false,
      },
      {
        settings: {
          mode: "gpt-5.5",
          provider: "openrouter-compatible",
          model: "gpt-5.5",
          reasoningEffort: "medium",
          endpoint: "https://openrouter.icu/v1/responses",
          apiKey: "sk-router-test",
          apiKeySource: "user",
          providerEnabled: true,
        },
        persistUsage: false,
      },
    );

    assert.match(response.data.answer, /没有正确使用候选适配资料/);
    assert.match(response.data.answer, /0% 只代表当前未持有/);
    assert.doesNotMatch(response.data.answer, /就不能继续分析/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Loo Minister sanitizes provider answers that promise unavailable quick scan confirmation", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          version: LOO_MINISTER_VERSION,
          generatedAt: now,
          role: "loo-minister",
          page: "portfolio",
          title: "组合大臣答复",
          answer:
            "如果要真正比较 RKLB 和 NASA 是否适合买入，会交给应用里的确认式 AI 快扫流程，由你确认后再运行。",
          keyPoints: ["需要快扫"],
          suggestedActions: [],
          sources: [
            {
              title: "组合页面上下文",
              sourceType: "page-context",
              asOf: now,
            },
          ],
          disclaimer: {
            zh: "仅用于研究学习，不构成投资建议。",
            en: "For research and education only. This is not investment advice.",
          },
        }),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const response = await getLooMinisterAnswer(
      "user_demo",
      {
        pageContext: {
          version: LOO_MINISTER_VERSION,
          page: "portfolio",
          locale: "zh",
          title: "Loo国组合",
          asOf: now,
          displayCurrency: "CAD",
          subject: {},
          dataFreshness: {
            portfolioAsOf: now,
            quotesAsOf: now,
            fxAsOf: now,
            chartFreshness: "fresh",
            sourceMode: "cached-external",
          },
          facts: [],
          warnings: [],
          allowedActions: [],
        },
        question: "RKLB 或 NASA 现在是否适合买入？",
        answerStyle: "beginner",
        cacheStrategy: "prefer-cache",
        includeExternalResearch: false,
      },
      {
        settings: {
          mode: "gpt-5.5",
          provider: "openrouter-compatible",
          model: "gpt-5.5",
          reasoningEffort: "medium",
          endpoint: "https://openrouter.icu/v1/responses",
          apiKey: "sk-router-test",
          apiKeySource: "user",
          providerEnabled: true,
        },
        persistUsage: false,
      },
    );

    assert.match(response.data.answer, /动作边界修正/);
    assert.match(response.data.answer, /没有可确认的 AI 快扫按钮/);
    assert.match(response.data.keyPoints[0] ?? "", /保留 GPT 主回答并修正动作边界/);
    assert.doesNotMatch(response.data.answer, /由你确认后再运行/);
    assert.equal(response.data.suggestedActions.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Loo Minister retries an empty OpenRouter-compatible response once", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return new Response(JSON.stringify({ status: "completed", output: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          version: LOO_MINISTER_VERSION,
          generatedAt: now,
          role: "loo-minister",
          page: "overview",
          title: "总览大臣答复",
          answer: "第二次调用返回了可解析的大臣答复。",
          keyPoints: ["总资产: CAD 100,000"],
          suggestedActions: [],
          sources: [
            {
              title: "Loo国总览 页面上下文",
              sourceType: "page-context",
              asOf: now,
            },
          ],
          disclaimer: {
            zh: "仅用于研究学习，不构成投资建议。",
            en: "For research and education only. This is not investment advice.",
          },
        }),
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const response = await getLooMinisterAnswer(
      "user_1",
      {
        pageContext: {
          version: LOO_MINISTER_VERSION,
          page: "overview",
          locale: "zh",
          title: "Loo国总览",
          asOf: now,
          displayCurrency: "CAD",
          subject: {},
          dataFreshness: {
            portfolioAsOf: now,
            quotesAsOf: now,
            fxAsOf: now,
            chartFreshness: "fresh",
            sourceMode: "local",
          },
          facts: [
            {
              id: "net-worth",
              label: "总资产",
              value: "CAD 100,000",
              source: "portfolio-data",
            },
          ],
          warnings: [],
          allowedActions: [],
        },
        question: "当前页面重点是什么？",
        answerStyle: "beginner",
        cacheStrategy: "prefer-cache",
        includeExternalResearch: false,
      },
      {
        settings: {
          mode: "gpt-5.5",
          provider: "openrouter-compatible",
          model: "gpt-5.5",
          reasoningEffort: "medium",
          endpoint: "https://openrouter.icu/v1/responses",
          apiKey: "sk-router-test",
          apiKeySource: "user",
          providerEnabled: true,
        },
        persistUsage: false,
      },
    );

    assert.equal(callCount, 2);
    assert.equal(response.data.title, "总览大臣答复");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Loo Minister tolerates provider source dates that are display strings", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          version: LOO_MINISTER_VERSION,
          generatedAt: now,
          role: "loo-minister",
          page: "security-detail",
          title: "标的大臣答复",
          answer: "大臣按当前标的页面 context 给出真实模型答复。",
          keyPoints: ["最新价格: CAD 54.58"],
          suggestedActions: [],
          sources: [
            {
              title: "XAW 页面上下文",
              sourceType: "page-context",
              asOf: now,
            },
            {
              title: "Yahoo Finance 缓存报价",
              sourceType: "quote-cache",
              asOf: "5月1日 12:43",
            },
          ],
          disclaimer: {
            zh: "仅用于研究学习，不构成投资建议。",
            en: "For research and education only. This is not investment advice.",
          },
        }),
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const response = await getLooMinisterAnswer(
      "user_1",
      {
        pageContext: {
          version: LOO_MINISTER_VERSION,
          page: "security-detail",
          locale: "zh",
          title: "XAW 标的详情",
          asOf: now,
          displayCurrency: "CAD",
          subject: {
            security: {
              symbol: "XAW",
              exchange: "TSX",
              currency: "CAD",
            },
          },
          dataFreshness: {
            portfolioAsOf: now,
            quotesAsOf: now,
            fxAsOf: now,
            chartFreshness: "fresh",
            sourceMode: "cached-external",
          },
          facts: [
            {
              id: "last-price",
              label: "最新价格",
              value: "CAD 54.58",
              source: "quote-cache",
            },
          ],
          warnings: [],
          allowedActions: [],
        },
        question: "这个标的和我的组合适配吗？",
        answerStyle: "beginner",
        cacheStrategy: "prefer-cache",
        includeExternalResearch: false,
      },
      {
        settings: {
          mode: "gpt-5.5",
          provider: "openrouter-compatible",
          model: "gpt-5.5",
          reasoningEffort: "medium",
          endpoint: "https://openrouter.icu/v1/responses",
          apiKey: "sk-router-test",
          apiKeySource: "user",
          providerEnabled: true,
        },
        persistUsage: false,
      },
    );

    assert.equal(response.data.title, "标的大臣答复");
    assert.doesNotMatch(response.data.answer, /本地降级/);
    assert.equal(response.data.sources[1]?.asOf, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
