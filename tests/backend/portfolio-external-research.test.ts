import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExternalResearchAllowed,
  DEFAULT_EXTERNAL_RESEARCH_POLICY,
  getExternalResearchPolicy,
  mapExternalResearchPolicyForMobile,
} from "@/lib/backend/portfolio-external-research";
import {
  ExternalResearchProviderDisabledError,
  fetchCachedExternalResearch,
  getEnabledExternalResearchProviders,
  getEnabledExternalResearchSources,
} from "@/lib/backend/portfolio-external-research-providers";

function clearExternalResearchEnv() {
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE;
  delete process.env.ALPHA_VANTAGE_API_KEY;
}

test("external research is disabled unless explicitly enabled", () => {
  clearExternalResearchEnv();

  assert.equal(getExternalResearchPolicy().enabled, false);
  assert.equal(DEFAULT_EXTERNAL_RESEARCH_POLICY.requiresWorker, true);
  assert.equal(DEFAULT_EXTERNAL_RESEARCH_POLICY.manualTriggerOnly, true);
  assert.equal(
    DEFAULT_EXTERNAL_RESEARCH_POLICY.allowedSources.every(
      (source) => !source.enabled,
    ),
    true,
  );
});

test("external research policy summary is safe for mobile display", () => {
  const summary = mapExternalResearchPolicyForMobile();

  assert.equal(summary.statusLabel, "未启用");
  assert.equal(summary.canRunLiveResearch, false);
  assert.equal(summary.manualTriggerOnly, true);
  assert.ok(summary.guardrails.some((item) => item.includes("手动触发")));
  assert.ok(summary.sources.some((source) => source.id === "market-data"));
});

test("external research provider registry is disabled by default", async () => {
  const policy = getExternalResearchPolicy();

  assert.equal(getEnabledExternalResearchSources(policy).length, 0);
  assert.equal(getEnabledExternalResearchProviders(policy).length, 0);
  await assert.rejects(
    () =>
      fetchCachedExternalResearch({
        userId: "user_casey",
        request: {
          scope: "security",
          mode: "quick",
          security: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" },
          cacheStrategy: "prefer-cache",
          maxCacheAgeSeconds: 21600,
          includeExternalResearch: true,
        },
        targetKey: "security:AMZN:NASDAQ:USD",
        allowedSources: [],
        now: new Date("2026-04-28T12:00:00.000Z"),
      }),
    ExternalResearchProviderDisabledError,
  );
});

test("cached market-data provider reads local cache only when explicitly enabled", async () => {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA = "enabled";

  const policy = getExternalResearchPolicy();
  const enabledSources = getEnabledExternalResearchSources(policy);
  assert.equal(
    enabledSources.some((source) => source.id === "market-data"),
    true,
  );
  assert.equal(getEnabledExternalResearchProviders(policy).length, 1);

  const result = await fetchCachedExternalResearch({
    userId: "user_casey",
    request: {
      scope: "security",
      mode: "quick",
      security: { symbol: "VFV", exchange: "TSX", currency: "CAD" },
      cacheStrategy: "prefer-cache",
      maxCacheAgeSeconds: 21600,
      includeExternalResearch: true,
    },
    targetKey: "security:VFV:TSX:CAD",
    allowedSources: enabledSources,
    now: new Date("2026-04-28T12:00:00.000Z"),
  });

  assert.equal(result.sourceMode, "cached-external");
  assert.equal(result.security?.symbol, "VFV");
  assert.ok(result.summaryPoints.some((point) => point.includes("缓存行情")));
  assert.equal(result.sources[0]?.sourceType, "market-data");
  assert.equal(result.documents?.[0]?.sourceType, "market-data");
  assert.equal(result.documents?.[0]?.security?.symbol, "VFV");
  assert.equal(result.documents?.[0]?.security?.exchange, "TSX");
  assert.equal(result.documents?.[0]?.security?.currency, "CAD");

  clearExternalResearchEnv();
});

test("cached market-data provider keeps exchange and currency identity separate", async () => {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA = "enabled";

  const enabledSources = getEnabledExternalResearchSources(
    getExternalResearchPolicy(),
  );
  const result = await fetchCachedExternalResearch({
    userId: "user_casey",
    request: {
      scope: "security",
      mode: "quick",
      security: { symbol: "VFV", exchange: "NASDAQ", currency: "USD" },
      cacheStrategy: "prefer-cache",
      maxCacheAgeSeconds: 21600,
      includeExternalResearch: true,
    },
    targetKey: "security:VFV:NASDAQ:USD",
    allowedSources: enabledSources,
    now: new Date("2026-04-28T12:00:00.000Z"),
  });

  assert.ok(
    result.summaryPoints.some((point) =>
      point.includes("缓存行情覆盖 0 条 VFV 价格历史"),
    ),
  );
  assert.ok(
    result.risks.some((risk) =>
      risk.includes("组合内没有找到完全匹配的持仓"),
    ),
  );
  assert.ok(
    result.summaryPoints.some((point) =>
      point.includes("securityId=未指定, symbol=VFV, exchange=NASDAQ, currency=USD"),
    ),
  );

  clearExternalResearchEnv();
});

test("profile provider is disabled unless source and api key are configured", () => {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE = "enabled";
  delete process.env.ALPHA_VANTAGE_API_KEY;

  const policy = getExternalResearchPolicy();
  assert.equal(
    getEnabledExternalResearchSources(policy).some(
      (source) => source.id === "profile",
    ),
    true,
  );
  assert.equal(getEnabledExternalResearchProviders(policy).length, 0);

  clearExternalResearchEnv();
});

test("external research request is rejected before live adapters exist", () => {
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH;

  assert.throws(
    () =>
      assertExternalResearchAllowed({
        scope: "security",
        mode: "quick",
        security: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" },
        cacheStrategy: "prefer-cache",
        maxCacheAgeSeconds: 21600,
        includeExternalResearch: true,
      }),
    /External research is not enabled/,
  );
});

test("external research policy requires a long enough cache ttl when enabled", () => {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";

  assert.throws(
    () =>
      assertExternalResearchAllowed({
        scope: "portfolio",
        mode: "quick",
        cacheStrategy: "prefer-cache",
        maxCacheAgeSeconds: 900,
        includeExternalResearch: true,
      }),
    /cache TTL/,
  );

  clearExternalResearchEnv();
});

test("external research still rejects when env is enabled but providers are not connected", () => {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER = "enabled";

  assert.throws(
    () =>
      assertExternalResearchAllowed({
        scope: "portfolio",
        mode: "quick",
        cacheStrategy: "prefer-cache",
        maxCacheAgeSeconds: 21600,
        includeExternalResearch: true,
      }),
    /providers are not connected/,
  );

  clearExternalResearchEnv();
});
