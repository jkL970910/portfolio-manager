import { apiSuccess } from "@/lib/backend/contracts";
import { getMobileDataFreshnessPolicy } from "@/lib/backend/data-freshness-policy";
import {
  PORTFOLIO_ANALYZER_DISCLAIMER,
  PORTFOLIO_ANALYZER_VERSION,
  PortfolioAnalyzerRequest,
  PortfolioAnalyzerResult,
} from "@/lib/backend/portfolio-analyzer-contracts";
import { buildPortfolioAnalyzerCacheKey } from "@/lib/backend/portfolio-analyzer-service";
import {
  assertExternalResearchAllowed,
  getExternalResearchPolicy,
  mapExternalResearchPolicyForMobile,
  type ExternalResearchPolicy,
} from "@/lib/backend/portfolio-external-research";
import {
  ExternalResearchProviderDisabledError,
  ExternalResearchProviderResult,
  fetchCachedExternalResearch,
} from "@/lib/backend/portfolio-external-research-providers";
import type { ExternalResearchDocument } from "@/lib/backend/external-research-documents";
import {
  ExternalResearchJob,
  ExternalResearchUsageCounter,
} from "@/lib/backend/models";
import { getRepositories } from "@/lib/backend/repositories/factory";

export function getExternalResearchCounterDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function estimateExternalResearchSymbolCount(
  input: PortfolioAnalyzerRequest,
) {
  return input.scope === "security" ? 1 : 1;
}

export function summarizeExternalResearchUsage(
  counters: ExternalResearchUsageCounter[],
  policy: ExternalResearchPolicy,
) {
  const usedRuns = counters.reduce((sum, counter) => sum + counter.runCount, 0);
  const usedSymbols = counters.reduce(
    (sum, counter) => sum + counter.symbolCount,
    0,
  );

  return {
    usedRuns,
    remainingRuns: Math.max(policy.dailyRunLimit - usedRuns, 0),
    usedSymbols,
    dailyRunLimit: policy.dailyRunLimit,
    maxSymbolsPerRun: policy.maxSymbolsPerRun,
    counters: counters.map((counter) => ({
      scope: counter.scope,
      runCount: counter.runCount,
      symbolCount: counter.symbolCount,
    })),
  };
}

function formatExternalResearchDateTime(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function formatTtlSeconds(seconds: number | undefined) {
  const safeSeconds =
    typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
      ? Math.trunc(seconds)
      : getExternalResearchPolicy().defaultTtlSeconds;
  if (safeSeconds < 3600) {
    return `${Math.round(safeSeconds / 60)} 分钟`;
  }
  if (safeSeconds < 86400) {
    return `${Math.round(safeSeconds / 3600)} 小时`;
  }
  return `${Math.round(safeSeconds / 86400)} 天`;
}

function mapExternalResearchStatusNote(job: ExternalResearchJob) {
  if (job.status === "queued") {
    const runAfter = formatExternalResearchDateTime(job.runAfter);
    return runAfter ? `排队中，计划 ${runAfter} 后运行。` : "排队中，等待 worker。";
  }
  if (job.status === "running") {
    return job.lockedBy
      ? `worker ${job.lockedBy} 正在处理。`
      : "worker 正在处理。";
  }
  if (job.status === "succeeded") {
    return job.finishedAt
      ? `已在 ${formatExternalResearchDateTime(job.finishedAt)} 完成。`
      : "已完成。";
  }
  if (job.status === "skipped") {
    return job.errorMessage || "来源暂无可用资料，本次已安全跳过。";
  }
  if (job.status === "failed") {
    if (job.attemptCount < job.maxAttempts) {
      const runAfter = formatExternalResearchDateTime(job.runAfter);
      return runAfter
        ? `失败后可重试；下次最早 ${runAfter}。`
        : "失败后可重试，等待下一次 worker。";
    }
    return "已达到最大尝试次数，需要检查配置或来源。";
  }
  if (job.status === "cancelled") {
    return "任务已取消。";
  }
  return "状态待确认。";
}

function mapExternalResearchNextRetryLabel(job: ExternalResearchJob) {
  if (job.status === "queued" || job.status === "failed") {
    if (job.attemptCount >= job.maxAttempts) {
      return null;
    }
    const runAfter = formatExternalResearchDateTime(job.runAfter);
    return runAfter ? `下次可运行：${runAfter}` : "等待下一次 worker";
  }
  return null;
}

function mapExternalResearchFreshness(job: ExternalResearchJob) {
  const request = job.request as Partial<PortfolioAnalyzerRequest>;
  const ttlSeconds =
    typeof request.maxCacheAgeSeconds === "number"
      ? request.maxCacheAgeSeconds
      : getExternalResearchPolicy().defaultTtlSeconds;
  const ttlLabel = formatTtlSeconds(ttlSeconds);
  const resultExpiresAt = job.finishedAt
    ? new Date(new Date(job.finishedAt).getTime() + ttlSeconds * 1000)
    : null;
  const resultExpiresAtLabel =
    resultExpiresAt && Number.isFinite(resultExpiresAt.getTime())
      ? formatExternalResearchDateTime(resultExpiresAt.toISOString())
      : null;

  return {
    requestedCacheMaxAgeSeconds: ttlSeconds,
    ttlLabel,
    freshnessLabel:
      job.status === "succeeded"
        ? `缓存有效期约 ${ttlLabel}`
        : `请求缓存窗口 ${ttlLabel}`,
    resultExpiresAt: resultExpiresAt?.toISOString() ?? null,
    resultExpiresAtLabel,
    sourceModeLabel: "缓存外部研究",
  };
}

export function mapExternalResearchJobForMobile(job: ExternalResearchJob) {
  const statusLabels: Record<ExternalResearchJob["status"], string> = {
    queued: "排队中",
    running: "运行中",
    succeeded: "已完成",
    skipped: "已跳过",
    failed: "已失败",
    cancelled: "已取消",
  };
  const scopeLabels: Record<ExternalResearchJob["scope"], string> = {
    security: "标的研究",
    portfolio: "组合研究",
    account: "账户研究",
    "recommendation-run": "推荐研究",
  };
  const request = job.request as Partial<PortfolioAnalyzerRequest>;
  const security = request.security;
  const identity =
    security && typeof security.symbol === "string"
      ? {
          securityId: security.securityId ?? null,
          symbol: security.symbol,
          exchange: security.exchange ?? null,
          currency: security.currency ?? null,
          name: security.name ?? null,
        }
      : null;
  const targetLabel = identity
    ? [identity.symbol, identity.exchange, identity.currency]
        .filter((item): item is string => Boolean(item))
        .join(" · ")
    : job.targetKey;
  const freshness = mapExternalResearchFreshness(job);

  return {
    id: job.id,
    scope: job.scope,
    scopeLabel: scopeLabels[job.scope],
    status: job.status,
    statusLabel: statusLabels[job.status],
    targetKey: job.targetKey,
    targetLabel,
    identity,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    runAfter: job.runAfter,
    nextRetryLabel: mapExternalResearchNextRetryLabel(job),
    statusNote: mapExternalResearchStatusNote(job),
    freshness,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
  };
}

export function assertExternalResearchQuota(args: {
  counters: ExternalResearchUsageCounter[];
  policy: ExternalResearchPolicy;
  requestedSymbolCount: number;
}) {
  const usage = summarizeExternalResearchUsage(args.counters, args.policy);

  if (args.requestedSymbolCount > args.policy.maxSymbolsPerRun) {
    throw new Error(
      `External research can analyze at most ${args.policy.maxSymbolsPerRun} symbols per run.`,
    );
  }

  if (usage.usedRuns >= args.policy.dailyRunLimit) {
    throw new Error(
      `External research daily limit of ${args.policy.dailyRunLimit} runs has been reached.`,
    );
  }
}

export async function getMobileExternalResearchUsage(
  userId: string,
  now = new Date(),
) {
  const repositories = getRepositories();
  const policy = getExternalResearchPolicy();
  const counterDate = getExternalResearchCounterDate(now);
  const counters =
    await repositories.externalResearchUsageCounters.listByUserIdAndDate(
      userId,
      counterDate,
    );

  return apiSuccess(
    {
      counterDate,
      policy: mapExternalResearchPolicyForMobile(policy),
      usage: summarizeExternalResearchUsage(counters, policy),
      freshnessPolicy: getMobileDataFreshnessPolicy(),
    },
    "database",
  );
}

export async function getMobileExternalResearchJobs(userId: string, limit = 5) {
  const repositories = getRepositories();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const jobs = await repositories.externalResearchJobs.listRecentByUserId(
    userId,
    safeLimit,
  );

  const items = jobs.map(mapExternalResearchJobForMobile);
  const latest = items[0] ?? null;
  const runningCount = items.filter((item) => item.status === "running").length;
  const queuedCount = items.filter((item) => item.status === "queued").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const skippedCount = items.filter((item) => item.status === "skipped").length;

  return apiSuccess(
    {
      summary: {
        latestStatus: latest?.status ?? "empty",
        latestStatusLabel: latest?.statusLabel ?? "还没有外部研究任务",
        latestStatusNote:
          latest?.statusNote ?? "最近没有外部研究任务；页面不会自动抓新闻或论坛。",
        latestTargetLabel: latest?.targetLabel ?? null,
        latestFinishedAt: latest?.finishedAt ?? latest?.createdAt ?? null,
        runningCount,
        queuedCount,
        failedCount,
        skippedCount,
        workerBoundaryLabel:
          "外部研究只能由手动入队或后台 worker 执行，页面加载不得自动触发实时来源。",
      },
      items,
    },
    "database",
  );
}

export async function enqueueExternalResearchJob(
  userId: string,
  input: PortfolioAnalyzerRequest,
  now = new Date(),
  options: {
    sourceIds?: ExternalResearchPolicy["allowedSources"][number]["id"][];
    priority?: number;
  } = {},
) {
  assertExternalResearchAllowed(input);

  const repositories = getRepositories();
  const policy = getExternalResearchPolicy();
  const counterDate = getExternalResearchCounterDate(now);
  const counters =
    await repositories.externalResearchUsageCounters.listByUserIdAndDate(
      userId,
      counterDate,
    );
  const requestedSymbolCount = estimateExternalResearchSymbolCount(input);

  assertExternalResearchQuota({ counters, policy, requestedSymbolCount });

  const sourceAllowlist = policy.allowedSources
    .filter((source) => source.enabled)
    .filter(
      (source) => !options.sourceIds || options.sourceIds.includes(source.id),
    )
    .map((source) => ({ ...source }));

  if (sourceAllowlist.length === 0) {
    throw new Error(
      "External research source is not enabled for this request.",
    );
  }

  const job = await repositories.externalResearchJobs.create({
    userId,
    scope: input.scope,
    targetKey: buildPortfolioAnalyzerCacheKey(input),
    request: input,
    status: "queued",
    sourceMode: "cached-external",
    sourceAllowlist,
    priority: options.priority ?? (input.scope === "security" ? 10 : 0),
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

  await repositories.externalResearchUsageCounters.increment({
    userId,
    counterDate,
    scope: input.scope,
    runCount: 1,
    symbolCount: requestedSymbolCount,
  });

  return apiSuccess({ job }, "database");
}

function parseDailyInteger(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || !value) {
    return fallback;
  }
  return Math.max(Math.trunc(value), 1);
}

function normalizeDailySource(
  source?: string | null,
): ExternalResearchPolicy["allowedSources"][number]["id"] {
  const normalized = source?.trim().toLowerCase();
  if (
    normalized === "market-data" ||
    normalized === "profile" ||
    normalized === "institutional" ||
    normalized === "news" ||
    normalized === "community"
  ) {
    return normalized;
  }
  return "profile";
}

export interface DailyOverviewExternalResearchEnqueueResult {
  status: "queued" | "skipped" | "partial";
  sourceId: ExternalResearchPolicy["allowedSources"][number]["id"];
  usersChecked: number;
  candidatesChecked: number;
  queuedJobs: number;
  skippedFresh: number;
  skippedInvalidIdentity: number;
  errors: string[];
}

export async function enqueueDailyOverviewExternalResearchJobs(args: {
  now?: Date;
  maxUsers?: number;
  maxSymbolsPerUser?: number;
  sourceId?: string | null;
  maxCacheAgeSeconds?: number;
} = {}): Promise<DailyOverviewExternalResearchEnqueueResult> {
  const now = args.now ?? new Date();
  const sourceId = normalizeDailySource(args.sourceId);
  const policy = getExternalResearchPolicy();
  const maxUsers = Math.min(parseDailyInteger(args.maxUsers, 1), 10);
  const maxSymbolsPerUser = Math.min(
    parseDailyInteger(args.maxSymbolsPerUser, 3),
    12,
  );
  const maxCacheAgeSeconds =
    args.maxCacheAgeSeconds ?? getExternalResearchPolicy().defaultTtlSeconds;
  const repositories = getRepositories();
  const result: DailyOverviewExternalResearchEnqueueResult = {
    status: "skipped",
    sourceId,
    usersChecked: 0,
    candidatesChecked: 0,
    queuedJobs: 0,
    skippedFresh: 0,
    skippedInvalidIdentity: 0,
    errors: [],
  };

  if (!policy.scheduledOverviewEnabled) {
    result.errors.push(
      "Daily overview external research is not enabled on the API host.",
    );
    return result;
  }

  const { getDb } = await import("@/lib/db/client");
  const { holdingPositions, users } = await import("@/lib/db/schema");
  const { desc, eq } = await import("drizzle-orm");
  const db = getDb();
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(maxUsers);
  result.usersChecked = userRows.length;

  for (const user of userRows) {
    const holdings = await db
      .select({
        securityId: holdingPositions.securityId,
        symbol: holdingPositions.symbol,
        name: holdingPositions.name,
        exchange: holdingPositions.exchangeOverride,
        currency: holdingPositions.currency,
        securityType: holdingPositions.securityTypeOverride,
        marketValueCad: holdingPositions.marketValueCad,
      })
      .from(holdingPositions)
      .where(eq(holdingPositions.userId, user.id))
      .orderBy(desc(holdingPositions.marketValueCad))
      .limit(maxSymbolsPerUser * 3);

    let queuedForUser = 0;
    for (const holding of holdings) {
      if (queuedForUser >= maxSymbolsPerUser) {
        break;
      }
      result.candidatesChecked += 1;

      const symbol = holding.symbol?.trim().toUpperCase();
      const currency = holding.currency?.trim().toUpperCase();
      const exchange = holding.exchange?.trim().toUpperCase();
      const securityId = holding.securityId?.trim();
      if (!symbol || !securityId || !currency || (currency !== "CAD" && currency !== "USD")) {
        result.skippedInvalidIdentity += 1;
        continue;
      }

      const freshDocuments =
        await repositories.externalResearchDocuments.listFreshByUserId(
          user.id,
          {
            now,
            limit: 1,
            securityId,
          },
        );
      if (freshDocuments.length > 0) {
        result.skippedFresh += 1;
        continue;
      }

      try {
        await enqueueExternalResearchJob(
          user.id,
          {
            scope: "security",
            mode: "quick",
            security: {
              securityId,
              symbol,
              exchange: exchange || undefined,
              currency,
              name: holding.name?.trim() || undefined,
              securityType: holding.securityType?.trim() || undefined,
            },
            cacheStrategy: "prefer-cache",
            maxCacheAgeSeconds,
            includeExternalResearch: true,
          },
          now,
          { sourceIds: [sourceId], priority: 5 },
        );
        queuedForUser += 1;
        result.queuedJobs += 1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to enqueue daily overview external research.";
        result.errors.push(`${symbol}: ${message}`);
        if (/daily limit/i.test(message)) {
          break;
        }
      }
    }
  }

  result.status =
    result.errors.length > 0 && result.queuedJobs > 0
      ? "partial"
      : result.queuedJobs > 0
      ? "queued"
      : "skipped";
  return result;
}

export function buildAnalyzerResultFromExternalResearch(args: {
  job: ExternalResearchJob;
  providerResult: ExternalResearchProviderResult;
  now: Date;
}): PortfolioAnalyzerResult {
  const request = args.job.request as PortfolioAnalyzerRequest;
  return {
    version: PORTFOLIO_ANALYZER_VERSION,
    scope: request.scope,
    mode: request.mode ?? "quick",
    generatedAt: args.now.toISOString(),
    identity: args.providerResult.security,
    dataFreshness: {
      portfolioAsOf: args.now.toISOString(),
      quotesAsOf: null,
      externalResearchAsOf: args.providerResult.externalResearchAsOf,
      sourceMode: "cached-external",
      freshnessLabel: "缓存外部研究",
      reliabilityScore: args.providerResult.sources.length > 0 ? 60 : 35,
      limitationSummary:
        "该结果来自缓存外部研究资料，只说明资料覆盖和风险点，不代表实时市场判断。",
    },
    evidenceTrail: [
      {
        id: "external-research-cache",
        label: "缓存外部研究",
        sourceType: "institutional",
        sourceMode: "cached-external",
        confidence: args.providerResult.sources.length > 0 ? "medium" : "low",
        freshness: args.providerResult.externalResearchAsOf ? "fresh" : "partial",
        asOf: args.providerResult.externalResearchAsOf,
        detail:
          args.providerResult.sources.length > 0
            ? `已关联 ${args.providerResult.sources.length} 条缓存资料。`
            : "没有可用来源明细，只能低置信展示 provider 摘要。",
      },
    ],
    summary: {
      title: `${args.providerResult.security?.symbol ?? "组合"} 缓存外部研究`,
      thesis:
        args.providerResult.summaryPoints[0] ??
        "本结果来自已缓存的 market-data 研究资料。",
      confidence: "low",
    },
    scorecards: [
      {
        id: "cached-market-data",
        label: "缓存资料覆盖",
        score: args.providerResult.sources.length > 0 ? 60 : 20,
        rationale:
          "该分数只反映本地缓存资料是否存在，不代表投资吸引力或实时市场判断。",
      },
    ],
    risks: args.providerResult.risks.map((risk) => ({
      severity: "medium",
      title: "缓存资料限制",
      detail: risk,
    })),
    taxNotes: [],
    portfolioFit: args.providerResult.summaryPoints,
    actionItems: [
      {
        priority: "P1",
        title: "确认缓存资料是否足够新",
        detail:
          "如果需要实时新闻、机构资料或论坛情绪，必须等对应 provider 和成本策略启用后再运行。",
      },
    ],
    sources: args.providerResult.sources.map((source) => ({
      title: source.title,
      url: source.url,
      date: source.date,
      sourceType: source.sourceType,
    })),
    disclaimer: PORTFOLIO_ANALYZER_DISCLAIMER,
  };
}

function mapExternalResearchDocumentForPersistence(
  userId: string,
  document: ExternalResearchDocument,
) {
  return {
    userId,
    providerDocumentId: document.id,
    sourceType: document.sourceType,
    providerId: document.providerId,
    sourceName: document.sourceName,
    title: document.title,
    summary: document.summary,
    url: document.url ?? null,
    publishedAt: document.publishedAt ?? null,
    capturedAt: document.capturedAt,
    expiresAt: document.expiresAt,
    language: document.language,
    security: document.security ?? null,
    underlyingId: document.underlyingId ?? null,
    confidence: document.confidence,
    sentiment: document.sentiment,
    relevanceScore: document.relevanceScore,
    sourceReliability: document.sourceReliability,
    keyPoints: document.keyPoints,
    riskFlags: document.riskFlags,
    tags: document.tags,
    rawPayload: document,
  };
}

async function persistExternalResearchDocuments(args: {
  userId: string;
  providerResult: ExternalResearchProviderResult;
}) {
  const documents = args.providerResult.documents ?? [];
  if (documents.length === 0) {
    return [];
  }

  const repositories = getRepositories();
  return Promise.all(
    documents.map((document) =>
      repositories.externalResearchDocuments.create(
        mapExternalResearchDocumentForPersistence(args.userId, document),
      )
    ),
  );
}

export async function claimNextExternalResearchJob(
  workerId: string,
  now = new Date(),
) {
  const repositories = getRepositories();
  return repositories.externalResearchJobs.claimNext(workerId, now);
}

export async function markExternalResearchJobSucceeded(
  jobId: string,
  resultRunId: string,
  now = new Date(),
) {
  const repositories = getRepositories();
  return repositories.externalResearchJobs.markSucceeded(
    jobId,
    resultRunId,
    now,
  );
}

export async function markExternalResearchJobFailed(
  jobId: string,
  errorMessage: string,
  now = new Date(),
) {
  const repositories = getRepositories();
  return repositories.externalResearchJobs.markFailed(jobId, errorMessage, now);
}

export async function markExternalResearchJobSkipped(
  jobId: string,
  message: string,
  now = new Date(),
) {
  const repositories = getRepositories();
  return repositories.externalResearchJobs.markSkipped(jobId, message, now);
}

export interface ExternalResearchWorkerResult {
  status: "idle" | "succeeded" | "skipped" | "failed-safe";
  workerId: string;
  job: ExternalResearchJob | null;
  message: string;
}

export interface ExternalResearchWorkerBatchResult {
  status: "idle" | "succeeded" | "partial" | "failed-safe";
  workerId: string;
  results: ExternalResearchWorkerResult[];
  processedJobs: number;
  message: string;
}

export async function runExternalResearchWorkerOnce(args: {
  workerId: string;
  now?: Date;
}): Promise<ExternalResearchWorkerResult> {
  const now = args.now ?? new Date();
  const job = await claimNextExternalResearchJob(args.workerId, now);

  if (!job) {
    return {
      status: "idle",
      workerId: args.workerId,
      job: null,
      message: "No queued external research job is ready.",
    };
  }

  let message =
    "External research worker is wired, but live providers are disabled. Job failed safely without external API calls.";
  try {
    const providerResult = await fetchCachedExternalResearch({
      userId: job.userId,
      request: job.request as PortfolioAnalyzerRequest,
      targetKey: job.targetKey,
      allowedSources: job.sourceAllowlist.map((source) => ({
        id: source.id as
          | "market-data"
          | "profile"
          | "institutional"
          | "news"
          | "community",
        label: String(source.label ?? source.id ?? "External source"),
        enabled: source.enabled === true,
        reason: String(source.reason ?? ""),
      })),
      now,
    });
    const repositories = getRepositories();
    const analyzerResult = buildAnalyzerResultFromExternalResearch({
      job,
      providerResult,
      now,
    });
    await persistExternalResearchDocuments({
      userId: job.userId,
      providerResult,
    });
    const expiresAt = new Date(
      now.getTime() + getExternalResearchPolicy().defaultTtlSeconds * 1000,
    );
    const run = await repositories.analysisRuns.create({
      userId: job.userId,
      scope: analyzerResult.scope,
      mode: analyzerResult.mode,
      targetKey: job.targetKey,
      request: job.request,
      result: analyzerResult,
      sourceMode: "cached-external",
      generatedAt: analyzerResult.generatedAt,
      expiresAt: expiresAt.toISOString(),
    });
    const succeededJob = await markExternalResearchJobSucceeded(
      job.id,
      run.id,
      now,
    );
    return {
      status: "succeeded",
      workerId: args.workerId,
      job: succeededJob,
      message:
        "External research job completed from an enabled cached provider.",
    };
  } catch (error) {
    if (error instanceof ExternalResearchProviderDisabledError) {
      message = `${error.message} 本次已安全跳过，没有写入外部资料。`;
      const skippedJob = await markExternalResearchJobSkipped(
        job.id,
        message,
        now,
      );

      return {
        status: "skipped",
        workerId: args.workerId,
        job: skippedJob,
        message,
      };
    } else {
      message =
        error instanceof Error
          ? error.message
          : "External research worker failed before provider execution.";
    }
  }
  const failedJob = await markExternalResearchJobFailed(job.id, message, now);

  return {
    status: "failed-safe",
    workerId: args.workerId,
    job: failedJob,
    message,
  };
}

export async function runExternalResearchWorkerBatch(args: {
  workerId: string;
  maxJobs?: number;
  maxRuntimeMs?: number;
  now?: Date;
}): Promise<ExternalResearchWorkerBatchResult> {
  const maxJobs = Math.min(parseDailyInteger(args.maxJobs, 3), 12);
  const maxRuntimeMs = Math.min(parseDailyInteger(args.maxRuntimeMs, 20_000), 55_000);
  const startedAt = Date.now();
  const results: ExternalResearchWorkerResult[] = [];

  for (let index = 0; index < maxJobs; index += 1) {
    if (Date.now() - startedAt >= maxRuntimeMs) {
      break;
    }
    const result = await runExternalResearchWorkerOnce({
      workerId: args.workerId,
      now: args.now ?? new Date(),
    });
    if (result.status === "idle") {
      if (results.length === 0) {
        results.push(result);
      }
      break;
    }
    results.push(result);
  }

  const processedJobs = results.filter((result) => result.job).length;
  const succeeded = results.filter((result) => result.status === "succeeded").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  const failed = results.filter((result) => result.status === "failed-safe").length;
  const status =
    processedJobs === 0
      ? "idle"
      : failed > 0 && (succeeded > 0 || skipped > 0)
      ? "partial"
      : failed > 0
      ? "failed-safe"
      : "succeeded";

  return {
    status,
    workerId: args.workerId,
    results,
    processedJobs,
    message:
      processedJobs === 0
        ? "No queued external research job is ready."
        : `Processed ${processedJobs} external research job(s): ${succeeded} succeeded, ${skipped} skipped, ${failed} failed-safe.`,
  };
}
