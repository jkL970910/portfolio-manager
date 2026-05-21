import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyLooMinisterIntent,
  getMinisterContextSelectionPolicy,
} from "@/lib/backend/loo-minister-intent-router";
import { LOO_MINISTER_VERSION } from "@/lib/backend/loo-minister-contracts";
import type { LooMinisterPageContext } from "@/lib/backend/loo-minister-contracts";

const basePageContext: LooMinisterPageContext = {
  version: LOO_MINISTER_VERSION,
  page: "import",
  locale: "zh",
  title: "上贡",
  asOf: "2026-05-21T00:00:00.000Z",
  displayCurrency: "CAD",
  subject: {},
  dataFreshness: {
    portfolioAsOf: null,
    quotesAsOf: null,
    fxAsOf: null,
    chartFreshness: "unknown",
    sourceMode: "local",
  },
  facts: [],
  warnings: [],
  allowedActions: [],
};

function classify(question: string, page: LooMinisterPageContext["page"]) {
  return classifyLooMinisterIntent({
    question,
    pageContext: {
      ...basePageContext,
      page,
    },
  });
}

test("classifies IBKR setup as import workflow without portfolio context", () => {
  const intent = classify(
    "我想从IBKR导入一个新的账户，需要怎样设置？我目前已经拿到token了",
    "import",
  );
  const policy = getMinisterContextSelectionPolicy(intent);

  assert.equal(intent.primary, "import_workflow");
  assert.equal(policy.includePortfolioContext, false);
  assert.equal(policy.includeGlobalUserContext, false);
});

test("allows compound import impact questions to include portfolio context", () => {
  const intent = classify(
    "导入 IBKR 新账户后会不会导致我的美股配置超配？",
    "import",
  );
  const policy = getMinisterContextSelectionPolicy(intent);

  assert.equal(intent.primary, "import_workflow");
  assert.ok(intent.secondary.includes("portfolio_analysis"));
  assert.equal(policy.includePortfolioContext, true);
});

test("classifies security buy questions as candidate fit", () => {
  const intent = classify("这个标的适合买入吗？", "security-detail");
  const policy = getMinisterContextSelectionPolicy(intent);

  assert.equal(intent.primary, "candidate_fit");
  assert.equal(policy.includeSecurityContext, true);
  assert.equal(policy.includePortfolioContext, true);
  assert.equal(policy.includeCandidateFit, true);
});

test("classifies refresh questions as freshness debug", () => {
  const intent = classify("为什么刷新后还是资料待补全？", "security-detail");
  const policy = getMinisterContextSelectionPolicy(intent);

  assert.equal(intent.primary, "freshness_debug");
  assert.equal(policy.includePortfolioContext, false);
});
