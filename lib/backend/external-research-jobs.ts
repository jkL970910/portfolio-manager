import { apiSuccess } from "@/lib/backend/contracts";
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

export function mapExternalResearchJobForMobile(job: ExternalResearchJob) {
  const statusLabels: Record<ExternalResearchJob["status"], string> = {
    queued: "排队中",
    running: "运行中",
    succeeded: "已完成",
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

  return apiSuccess(
    {
      items: jobs.map(mapExternalResearchJobForMobile),
    },
    "database",
  );
}

export async function enqueueExternalResearchJob(
  userId: string,
  input: PortfolioAnalyzerRequest,
  now = new Date(),
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

  const job = await repositories.externalResearchJobs.create({
    userId,
    scope: input.scope,
    targetKey: buildPortfolioAnalyzerCacheKey(input),
    request: input,
    status: "queued",
    sourceMode: "cached-external",
    sourceAllowlist: policy.allowedSources
      .filter((source) => source.enabled)
      .map((source) => ({ ...source })),
    priority: input.scope === "security" ? 10 : 0,
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
    },
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

export interface ExternalResearchWorkerResult {
  status: "idle" | "succeeded" | "failed-safe";
  workerId: string;
  job: ExternalResearchJob | null;
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
        id: source.id as "market-data" | "institutional" | "news" | "community",
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
        "External research job completed from cached market-data provider.",
    };
  } catch (error) {
    if (error instanceof ExternalResearchProviderDisabledError) {
      message = `${error.message} Job failed safely without external API calls.`;
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
