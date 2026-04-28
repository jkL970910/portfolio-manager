import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExternalResearchAllowed,
  DEFAULT_EXTERNAL_RESEARCH_POLICY,
  getExternalResearchPolicy
} from "@/lib/backend/portfolio-external-research";

test("external research is disabled unless explicitly enabled", () => {
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH;

  assert.equal(getExternalResearchPolicy().enabled, false);
  assert.equal(DEFAULT_EXTERNAL_RESEARCH_POLICY.requiresWorker, true);
});

test("external research request is rejected before live adapters exist", () => {
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH;

  assert.throws(() => assertExternalResearchAllowed({
    scope: "security",
    mode: "quick",
    security: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" },
    cacheStrategy: "prefer-cache",
    maxCacheAgeSeconds: 21600,
    includeExternalResearch: true
  }), /External research is not enabled/);
});

test("external research policy requires a long enough cache ttl when enabled", () => {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";

  assert.throws(() => assertExternalResearchAllowed({
    scope: "portfolio",
    mode: "quick",
    cacheStrategy: "prefer-cache",
    maxCacheAgeSeconds: 900,
    includeExternalResearch: true
  }), /cache TTL/);

  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH;
});
