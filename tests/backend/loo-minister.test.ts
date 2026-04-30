import assert from "node:assert/strict";
import test from "node:test";
import { getLooMinisterAnswer } from "@/lib/backend/loo-minister";
import { LOO_MINISTER_VERSION } from "@/lib/backend/loo-minister-contracts";

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
  assert.match(response.data.title, /本地降级/);
  assert.match(response.data.answer, /GPT-5.5 provider 未启用/);
  assert.match(response.data.answer, /本地 deterministic 回答/);
  assert.match(response.data.answer, /NVDA/);
  assert.match(response.data.disclaimer.zh, /不构成投资建议/);
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

    assert.match(response.data.title, /本地降级/);
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
    assert.doesNotMatch(response.data.answer, /本地 deterministic 回答/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.LOO_MINISTER_REASONING_EFFORT = originalReasoningEffort;
    process.env.LOO_MINISTER_DISABLE_RESPONSE_STORAGE = originalDisableStorage;
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
