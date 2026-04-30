import assert from "node:assert/strict";
import test from "node:test";
import { getLooMinisterAnswer } from "@/lib/backend/loo-minister";
import { LOO_MINISTER_VERSION } from "@/lib/backend/loo-minister-contracts";

const now = "2026-04-30T04:00:00.000Z";

test("Loo Minister deterministic answer uses page context and keeps disclaimer", () => {
  const response = getLooMinisterAnswer("user_1", {
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
  });

  assert.equal(response.meta.source, "service");
  assert.equal(response.data.role, "loo-minister");
  assert.equal(response.data.page, "overview");
  assert.match(response.data.answer, /总资产/);
  assert.match(response.data.disclaimer.zh, /不构成投资建议/);
  assert.equal(response.data.suggestedActions.length, 2);
});
