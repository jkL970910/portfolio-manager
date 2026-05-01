import assert from "node:assert/strict";
import test from "node:test";
import {
  LOO_MINISTER_VERSION,
  looMinisterAnswerResultSchema,
  looMinisterChatRequestSchema,
  looMinisterPageContextSchema,
  looMinisterQuestionRequestSchema,
  looMinisterSuggestedActionSchema
} from "@/lib/backend/loo-minister-contracts";
import { PORTFOLIO_ANALYZER_DISCLAIMER } from "@/lib/backend/portfolio-analyzer-contracts";

const now = "2026-04-30T04:00:00.000Z";

function makeOverviewContext(overrides: Record<string, unknown> = {}) {
  return {
    version: LOO_MINISTER_VERSION,
    page: "overview",
    title: "Loo国总览",
    asOf: now,
    displayCurrency: "CAD",
    dataFreshness: {
      portfolioAsOf: now,
      quotesAsOf: now,
      fxAsOf: now,
      chartFreshness: "fresh",
      sourceMode: "local"
    },
    facts: [
      {
        id: "net-worth",
        label: "总资产",
        value: "CAD 100,000",
        source: "portfolio-data"
      }
    ],
    ...overrides
  };
}

test("Loo Minister page context accepts overview facts for cross-page Q&A", () => {
  const parsed = looMinisterPageContextSchema.parse(makeOverviewContext({
    facts: [
      {
        id: "net-worth",
        label: "总资产",
        value: "CAD 100,000",
        source: "portfolio-data"
      },
      {
        id: "daily-intelligence-1",
        label: "今日秘闻：VFV listing 缓存行情快照",
        value: "VFV TSX CAD 缓存行情可用。",
        source: "external-intelligence"
      }
    ]
  }));

  assert.equal(parsed.page, "overview");
  assert.equal(parsed.locale, "zh");
  assert.equal(parsed.facts[0].id, "net-worth");
  assert.equal(parsed.facts[1].source, "external-intelligence");
});

test("Loo Minister security context preserves symbol, exchange, and currency identity", () => {
  const usdCommon = looMinisterPageContextSchema.parse(makeOverviewContext({
    page: "security-detail",
    title: "AMZN",
    subject: {
      security: {
        symbol: "AMZN",
        securityId: "security_amzn_us",
        exchange: "NASDAQ",
        currency: "USD",
        name: "Amazon.com"
      }
    }
  }));
  const cadListed = looMinisterPageContextSchema.parse(makeOverviewContext({
    page: "security-detail",
    title: "AMZN",
    subject: {
      security: {
        symbol: "AMZN",
        exchange: "NEO",
        currency: "CAD",
        name: "Amazon CDR"
      }
    }
  }));

  assert.equal(usdCommon.subject.security?.symbol, cadListed.subject.security?.symbol);
  assert.equal(usdCommon.subject.security?.securityId, "security_amzn_us");
  assert.notDeepEqual(usdCommon.subject.security, cadListed.subject.security);
});

test("Loo Minister rejects partial security identity when exchange or currency is missing", () => {
  const parsed = looMinisterPageContextSchema.safeParse(makeOverviewContext({
    page: "security-detail",
    title: "VFV",
    subject: {
      security: {
        symbol: "VFV",
        exchange: "TSX"
      }
    }
  }));

  assert.equal(parsed.success, false);
});

test("Loo Minister detail contexts require stable subject ids", () => {
  assert.equal(looMinisterPageContextSchema.safeParse(makeOverviewContext({
    page: "account-detail",
    title: "TFSA"
  })).success, false);

  assert.equal(looMinisterPageContextSchema.safeParse(makeOverviewContext({
    page: "holding-detail",
    title: "VFV"
  })).success, false);
});

test("Loo Minister actions that mutate or run work require explicit confirmation", () => {
  assert.equal(looMinisterSuggestedActionSchema.safeParse({
    id: "apply-preferences",
    label: "应用新的投资偏好",
    actionType: "update-preferences",
    requiresConfirmation: false
  }).success, false);

  assert.equal(looMinisterSuggestedActionSchema.safeParse({
    id: "open-health",
    label: "查看健康分",
    actionType: "navigate",
    target: { page: "portfolio-health" }
  }).success, true);
});

test("Loo Minister question request keeps external research disabled by default", () => {
  const parsed = looMinisterQuestionRequestSchema.parse({
    pageContext: makeOverviewContext(),
    question: "为什么总资产曲线和卡片数字不同？"
  });

  assert.equal(parsed.answerStyle, "beginner");
  assert.equal(parsed.includeExternalResearch, false);
});

test("Loo Minister chat request keeps session id optional for multi-turn Q&A", () => {
  const firstTurn = looMinisterChatRequestSchema.parse({
    pageContext: makeOverviewContext(),
    question: "大臣先解释一下总资产。"
  });
  const followUp = looMinisterChatRequestSchema.parse({
    pageContext: makeOverviewContext(),
    question: "那这个和组合页有什么不同？",
    sessionId: "minister-session-1"
  });

  assert.equal(firstTurn.sessionId, undefined);
  assert.equal(firstTurn.answerMode, "auto");
  assert.equal(followUp.sessionId, "minister-session-1");
  assert.equal(followUp.includeExternalResearch, false);
});

test("Loo Minister question request rejects live external research for now", () => {
  const parsed = looMinisterQuestionRequestSchema.safeParse({
    pageContext: makeOverviewContext(),
    question: "结合最新新闻解释一下。",
    includeExternalResearch: true
  });

  assert.equal(parsed.success, false);
});

test("Loo Minister answer requires non-advice disclaimer", () => {
  const parsed = looMinisterAnswerResultSchema.safeParse({
    version: LOO_MINISTER_VERSION,
    generatedAt: now,
    role: "loo-minister",
    page: "overview",
    title: "总资产解释",
    answer: "总资产卡片使用当前持仓和 FX 折算，走势图使用同一口径的历史点。",
    keyPoints: ["先看 freshness，再看 FX as-of。"],
    sources: [
      {
        title: "Overview page context",
        sourceType: "page-context",
        asOf: now
      },
      {
        title: "Loo国今日秘闻",
        sourceType: "external-intelligence",
        asOf: now
      }
    ],
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER
  });

  assert.equal(parsed.success, true);
});

test("Loo Minister rejects reference curves marked as local real data", () => {
  const parsed = looMinisterPageContextSchema.safeParse(makeOverviewContext({
    dataFreshness: {
      portfolioAsOf: now,
      quotesAsOf: now,
      fxAsOf: now,
      chartFreshness: "reference",
      sourceMode: "local"
    }
  }));

  assert.equal(parsed.success, false);
});
