import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExternalResearchQuota,
  estimateExternalResearchSymbolCount,
  getExternalResearchCounterDate,
  getMobileExternalResearchJobs,
  mapExternalResearchJobForMobile,
  runExternalResearchWorkerOnce,
  summarizeExternalResearchUsage,
} from "@/lib/backend/external-research-jobs";
import {
  buildExternalResearchSmokeRequest,
  enqueueExternalResearchSmokeJob,
  getMissingExternalResearchSmokeFlags,
  getMissingExternalResearchSmokeSecrets,
} from "@/lib/backend/external-research-smoke";
import { DEFAULT_EXTERNAL_RESEARCH_POLICY } from "@/lib/backend/portfolio-external-research";
import { ExternalResearchUsageCounter } from "@/lib/backend/models";
import { mockRepositories } from "@/lib/backend/repositories/mock-repositories";

function enableCachedMarketDataProvider() {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA = "enabled";
}

function enableProfileProvider() {
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS = "enabled";
  process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE = "enabled";
  process.env.ALPHA_VANTAGE_API_KEY = "test-alpha-vantage-key";
}

function clearExternalResearchEnv() {
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA;
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE;
  delete process.env.ALPHA_VANTAGE_API_KEY;
}

function makeCounter(
  overrides: Partial<ExternalResearchUsageCounter> = {},
): ExternalResearchUsageCounter {
  return {
    id: "usage_1",
    userId: "user_1",
    counterDate: "2026-04-28",
    scope: "security",
    runCount: 2,
    symbolCount: 2,
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt: "2026-04-28T00:00:00.000Z",
    ...overrides,
  };
}

test("external research counter date is UTC stable", () => {
  assert.equal(
    getExternalResearchCounterDate(new Date("2026-04-28T23:59:00.000Z")),
    "2026-04-28",
  );
});

test("external research symbol estimate keeps security requests bounded", () => {
  assert.equal(
    estimateExternalResearchSymbolCount({
      scope: "security",
      mode: "quick",
      security: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" },
      cacheStrategy: "prefer-cache",
      maxCacheAgeSeconds: 21600,
      includeExternalResearch: true,
    }),
    1,
  );
});

test("external research usage summary reports remaining daily runs", () => {
  const usage = summarizeExternalResearchUsage(
    [
      makeCounter({ runCount: 3, symbolCount: 5 }),
      makeCounter({
        id: "usage_2",
        scope: "portfolio",
        runCount: 1,
        symbolCount: 0,
      }),
    ],
    DEFAULT_EXTERNAL_RESEARCH_POLICY,
  );

  assert.equal(usage.usedRuns, 4);
  assert.equal(
    usage.remainingRuns,
    DEFAULT_EXTERNAL_RESEARCH_POLICY.dailyRunLimit - 4,
  );
  assert.equal(usage.usedSymbols, 5);
});

test("external research quota rejects exhausted daily runs", () => {
  assert.throws(
    () =>
      assertExternalResearchQuota({
        counters: [
          makeCounter({
            runCount: DEFAULT_EXTERNAL_RESEARCH_POLICY.dailyRunLimit,
          }),
        ],
        policy: DEFAULT_EXTERNAL_RESEARCH_POLICY,
        requestedSymbolCount: 1,
      }),
    /daily limit/,
  );
});

test("external research quota rejects oversized symbol batches", () => {
  assert.throws(
    () =>
      assertExternalResearchQuota({
        counters: [],
        policy: DEFAULT_EXTERNAL_RESEARCH_POLICY,
        requestedSymbolCount:
          DEFAULT_EXTERNAL_RESEARCH_POLICY.maxSymbolsPerRun + 1,
      }),
    /at most/,
  );
});

test("external research job repository can claim and finish queued jobs", async () => {
  const now = new Date("2026-04-28T12:00:00.000Z");
  const job = await mockRepositories.externalResearchJobs.create({
    userId: "user_worker_test",
    scope: "security",
    targetKey: "security:AMZN:NASDAQ:USD",
    request: {
      scope: "security",
      security: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" },
    },
    status: "queued",
    sourceMode: "cached-external",
    sourceAllowlist: [],
    priority: 10,
    attemptCount: 0,
    maxAttempts: 3,
    runAfter: now.toISOString(),
    lockedAt: null,
    lockedBy: null,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    resultRunId: null,
  });

  const claimed = await mockRepositories.externalResearchJobs.claimNext(
    "worker-test",
    now,
  );
  assert.equal(claimed?.id, job.id);
  assert.equal(claimed?.status, "running");
  assert.equal(claimed?.attemptCount, 1);
  assert.equal(claimed?.lockedBy, "worker-test");

  const failed = await mockRepositories.externalResearchJobs.markFailed(
    job.id,
    "provider disabled",
    now,
  );
  assert.equal(failed.status, "failed");
  assert.equal(failed.errorMessage, "provider disabled");
});

test("external research job maps to mobile-safe status labels", async () => {
  const now = new Date("2026-04-28T12:30:00.000Z");
  const job = await mockRepositories.externalResearchJobs.create({
    userId: "user_mobile_job_test",
    scope: "portfolio",
    targetKey: "portfolio:all",
    request: { scope: "portfolio" },
    status: "failed",
    sourceMode: "cached-external",
    sourceAllowlist: [],
    priority: 0,
    attemptCount: 1,
    maxAttempts: 3,
    runAfter: now.toISOString(),
    lockedAt: null,
    lockedBy: null,
    startedAt: null,
    finishedAt: now.toISOString(),
    errorMessage: "provider disabled",
    resultRunId: null,
  });

  const mapped = mapExternalResearchJobForMobile(job);
  assert.equal(mapped.scopeLabel, "组合研究");
  assert.equal(mapped.statusLabel, "已失败");
  assert.equal(mapped.errorMessage, "provider disabled");
  assert.equal(mapped.nextRetryLabel, "下次可运行：2026-04-28 12:30");
  assert.match(mapped.statusNote, /失败后可重试/);
  assert.equal(mapped.freshness.ttlLabel, "6 小时");
  assert.equal(mapped.freshness.freshnessLabel, "请求缓存窗口 6 小时");
});

test("external research job mobile mapping exposes readable security identity", async () => {
  const now = new Date("2026-04-28T12:45:00.000Z");
  const job = await mockRepositories.externalResearchJobs.create({
    userId: "user_mobile_identity_job_test",
    scope: "security",
    targetKey: "security:quick:security:VFV:TSX:CAD:_",
    request: {
      scope: "security",
      mode: "quick",
      security: { symbol: "VFV", exchange: "TSX", currency: "CAD" },
      cacheStrategy: "prefer-cache",
      maxCacheAgeSeconds: 21600,
      includeExternalResearch: true,
    },
    status: "succeeded",
    sourceMode: "cached-external",
    sourceAllowlist: [],
    priority: 10,
    attemptCount: 1,
    maxAttempts: 3,
    runAfter: now.toISOString(),
    lockedAt: null,
    lockedBy: null,
    startedAt: now.toISOString(),
    finishedAt: now.toISOString(),
    errorMessage: null,
    resultRunId: "run_1",
  });

  const mapped = mapExternalResearchJobForMobile(job);
  assert.equal(mapped.targetLabel, "VFV · TSX · CAD");
  assert.deepEqual(mapped.identity, {
    securityId: null,
    symbol: "VFV",
    exchange: "TSX",
    currency: "CAD",
    name: null,
  });
  assert.equal(mapped.freshness.requestedCacheMaxAgeSeconds, 21600);
  assert.equal(mapped.freshness.ttlLabel, "6 小时");
  assert.equal(mapped.freshness.freshnessLabel, "缓存有效期约 6 小时");
  assert.match(mapped.freshness.resultExpiresAtLabel ?? "", /2026-04-28 18:45/);
});

test("external research job mobile mapping treats provider no-data as skipped", async () => {
  const now = new Date("2026-04-28T12:50:00.000Z");
  const job = await mockRepositories.externalResearchJobs.create({
    userId: "user_mobile_skipped_job_test",
    scope: "security",
    targetKey: "security:XBB:TSX:CAD",
    request: {
      scope: "security",
      mode: "quick",
      security: { symbol: "XBB", exchange: "TSX", currency: "CAD" },
      cacheStrategy: "prefer-cache",
      maxCacheAgeSeconds: 21600,
      includeExternalResearch: true,
    },
    status: "skipped",
    sourceMode: "cached-external",
    sourceAllowlist: [],
    priority: 10,
    attemptCount: 1,
    maxAttempts: 3,
    runAfter: now.toISOString(),
    lockedAt: null,
    lockedBy: null,
    startedAt: now.toISOString(),
    finishedAt: now.toISOString(),
    errorMessage: "No Alpha Vantage profile payload was available for this security.",
    resultRunId: null,
  });

  const mapped = mapExternalResearchJobForMobile(job);
  assert.equal(mapped.statusLabel, "已跳过");
  assert.equal(mapped.nextRetryLabel, null);
  assert.match(mapped.statusNote, /Alpha Vantage profile/);
});

test("external research mobile jobs expose summary and retry labels", async () => {
  const now = new Date("2026-04-28T16:00:00.000Z");
  await mockRepositories.externalResearchJobs.create({
    userId: "user_mobile_summary_job_test",
    scope: "security",
    targetKey: "security:ZQQ:TSX:CAD",
    request: {
      scope: "security",
      mode: "quick",
      security: { symbol: "ZQQ", exchange: "TSX", currency: "CAD" },
      cacheStrategy: "prefer-cache",
      maxCacheAgeSeconds: 10800,
      includeExternalResearch: true,
    },
    status: "queued",
    sourceMode: "cached-external",
    sourceAllowlist: [],
    priority: 10,
    attemptCount: 1,
    maxAttempts: 3,
    runAfter: now.toISOString(),
    lockedAt: null,
    lockedBy: null,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    resultRunId: null,
  });

  const response = await getMobileExternalResearchJobs(
    "user_mobile_summary_job_test",
    5,
  );

  assert.equal(response.data.summary.latestStatusLabel, "排队中");
  assert.equal(response.data.summary.queuedCount, 1);
  assert.equal(response.data.summary.failedCount, 0);
  assert.equal(response.data.summary.skippedCount, 0);
  assert.match(response.data.summary.workerBoundaryLabel, /worker/);
  assert.equal(response.data.items[0]?.nextRetryLabel, "下次可运行：2026-04-28 16:00");
  assert.equal(response.data.items[0]?.freshness.ttlLabel, "3 小时");
});

test("external research worker skips claimed jobs safely while providers are unavailable", async () => {
  const now = new Date("2026-04-28T13:00:00.000Z");
  const job = await mockRepositories.externalResearchJobs.create({
    userId: "user_worker_safe_test",
    scope: "security",
    targetKey: "security:VFV:TSX:CAD",
    request: {
      scope: "security",
      security: { symbol: "VFV", exchange: "TSX", currency: "CAD" },
    },
    status: "queued",
    sourceMode: "cached-external",
    sourceAllowlist: [],
    priority: 10,
    attemptCount: 0,
    maxAttempts: 3,
    runAfter: now.toISOString(),
    lockedAt: null,
    lockedBy: null,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    resultRunId: null,
  });

  const result = await runExternalResearchWorkerOnce({
    workerId: "safe-worker-test",
    now,
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.job?.id, job.id);
  assert.equal(result.job?.status, "skipped");
  assert.match(result.message, /安全跳过/);
  assert.match(result.job?.errorMessage ?? "", /allowlist|provider/i);
});

test("external research worker can persist cached market-data results when explicitly enabled", async () => {
  enableCachedMarketDataProvider();
  const now = new Date("2026-04-28T14:00:00.000Z");
  const job = await mockRepositories.externalResearchJobs.create({
    userId: "user_casey",
    scope: "security",
    targetKey: "security:VFV:TSX:CAD",
    request: {
      scope: "security",
      mode: "quick",
      security: { symbol: "VFV", exchange: "TSX", currency: "CAD" },
      cacheStrategy: "prefer-cache",
      maxCacheAgeSeconds: 21600,
      includeExternalResearch: true,
    },
    status: "queued",
    sourceMode: "cached-external",
    sourceAllowlist: [
      {
        id: "market-data",
        label: "行情与标的资料",
        enabled: true,
        reason: "test",
      },
    ],
    priority: 99,
    attemptCount: 0,
    maxAttempts: 3,
    runAfter: now.toISOString(),
    lockedAt: null,
    lockedBy: null,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    resultRunId: null,
  });

  const result = await runExternalResearchWorkerOnce({
    workerId: "cached-worker-test",
    now,
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.job?.id, job.id);
  assert.equal(result.job?.status, "succeeded");
  assert.ok(result.job?.resultRunId);
  assert.match(result.message, /enabled cached provider/);

  const documents =
    await mockRepositories.externalResearchDocuments.listFreshByUserId(
      "user_casey",
      {
        now,
        limit: 20,
        symbol: "VFV",
        exchange: "TSX",
        currency: "CAD",
      },
    );
  const marketDataDocument = documents.find(
    (document) => document.providerId === "market-data",
  );
  assert.ok(marketDataDocument);
  assert.equal(marketDataDocument.sourceType, "market-data");
  assert.equal(marketDataDocument.security?.symbol, "VFV");
  assert.equal(marketDataDocument.security?.exchange, "TSX");
  assert.equal(marketDataDocument.security?.currency, "CAD");
  assert.ok(
    marketDataDocument.keyPoints.some((point) =>
      point.includes("缓存行情覆盖"),
    ),
  );

  clearExternalResearchEnv();
});

test("external research smoke helper reports missing explicit env flags", () => {
  const missing = getMissingExternalResearchSmokeFlags({
    PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH: "enabled",
  });

  assert.deepEqual(missing, [
    "PORTFOLIO_ANALYZER_EXTERNAL_WORKER",
    "PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS",
    "PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS",
    "PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA",
  ]);
});

test("external research smoke helper supports profile source flags", () => {
  clearExternalResearchEnv();
  enableProfileProvider();

  assert.deepEqual(
    getMissingExternalResearchSmokeFlags(process.env, "profile"),
    [],
  );
  assert.deepEqual(
    getMissingExternalResearchSmokeSecrets(process.env, "profile"),
    [],
  );
  assert.ok(
    getMissingExternalResearchSmokeFlags(process.env, "market-data").includes(
      "PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA",
    ),
  );

  clearExternalResearchEnv();
});

test("external research smoke helper requires profile provider secret", () => {
  clearExternalResearchEnv();
  enableProfileProvider();
  delete process.env.ALPHA_VANTAGE_API_KEY;

  assert.deepEqual(
    getMissingExternalResearchSmokeFlags(process.env, "profile"),
    [],
  );
  assert.deepEqual(
    getMissingExternalResearchSmokeSecrets(process.env, "profile"),
    ["ALPHA_VANTAGE_API_KEY"],
  );

  clearExternalResearchEnv();
});

test("external research smoke request preserves security identity", () => {
  const request = buildExternalResearchSmokeRequest({
    userId: "user_casey",
    symbol: "vfv",
    currency: "CAD",
    exchange: "tsx",
    name: "Vanguard S&P 500 Index ETF",
    securityId: "security_vfv_tsx_cad",
    securityType: "ETF",
    maxCacheAgeSeconds: 21600,
  });

  assert.equal(request.scope, "security");
  assert.equal(request.includeExternalResearch, true);
  assert.equal(request.security?.symbol, "VFV");
  assert.equal(request.security?.exchange, "TSX");
  assert.equal(request.security?.currency, "CAD");
  assert.equal(request.security?.name, "Vanguard S&P 500 Index ETF");
  assert.equal(request.security?.securityId, "security_vfv_tsx_cad");
  assert.equal(request.security?.securityType, "ETF");
});

test("external research smoke enqueue creates a queued cached market-data job", async () => {
  enableCachedMarketDataProvider();

  const result = await enqueueExternalResearchSmokeJob(
    {
      userId: "user_casey",
      symbol: "VFV",
      currency: "CAD",
      exchange: "TSX",
      maxCacheAgeSeconds: 21600,
    },
    new Date("2026-04-28T15:00:00.000Z"),
  );

  assert.equal(result.data.job.status, "queued");
  assert.equal(result.data.job.scope, "security");
  assert.equal(result.data.job.sourceMode, "cached-external");
  assert.equal(
    (result.data.job.request.security as { exchange?: string }).exchange,
    "TSX",
  );
  assert.equal(
    result.data.job.sourceAllowlist.some(
      (source) => source.id === "market-data" && source.enabled === true,
    ),
    true,
  );

  clearExternalResearchEnv();
});

test("external research smoke enqueue creates a queued profile job", async () => {
  enableProfileProvider();

  const result = await enqueueExternalResearchSmokeJob(
    {
      userId: "user_casey",
      symbol: "RKLB",
      currency: "USD",
      exchange: "NASDAQ",
      name: "Rocket Lab USA Inc.",
      securityId: "security_rklb_nasdaq_usd",
      securityType: "Common Stock",
      source: "profile",
      maxCacheAgeSeconds: 21600,
    },
    new Date("2026-04-28T15:00:00.000Z"),
  );

  const security = result.data.job.request.security as {
    securityId?: string;
    securityType?: string;
    exchange?: string;
    currency?: string;
  };

  assert.equal(result.data.job.status, "queued");
  assert.equal(result.data.job.scope, "security");
  assert.equal(result.data.job.sourceMode, "cached-external");
  assert.equal(security.securityId, "security_rklb_nasdaq_usd");
  assert.equal(security.securityType, "Common Stock");
  assert.equal(security.exchange, "NASDAQ");
  assert.equal(security.currency, "USD");
  assert.equal(
    result.data.job.sourceAllowlist.some(
      (source) => source.id === "profile" && source.enabled === true,
    ),
    true,
  );
  assert.equal(
    result.data.job.sourceAllowlist.some(
      (source) => source.id === "market-data" && source.enabled === true,
    ),
    false,
  );

  clearExternalResearchEnv();
});

test("daily overview external research enqueue is disabled unless API host flag is enabled", async () => {
  enableProfileProvider();
  delete process.env.PORTFOLIO_ANALYZER_EXTERNAL_DAILY_OVERVIEW;
  const { enqueueDailyOverviewExternalResearchJobs } = await import(
    "@/lib/backend/external-research-jobs"
  );

  const result = await enqueueDailyOverviewExternalResearchJobs({
    now: new Date("2026-04-28T15:30:00.000Z"),
    maxUsers: 1,
    maxSymbolsPerUser: 1,
    sourceId: "profile",
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.queuedJobs, 0);
  assert.match(result.errors[0] ?? "", /not enabled/);

  clearExternalResearchEnv();
});
