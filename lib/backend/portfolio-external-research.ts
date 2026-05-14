import { PortfolioAnalyzerRequest } from "@/lib/backend/portfolio-analyzer-contracts";

export interface ExternalResearchPolicy {
  enabled: boolean;
  sourceMode: "cached-external";
  minTtlSeconds: number;
  defaultTtlSeconds: number;
  newsTtlSeconds: number;
  requiresWorker: boolean;
  workerEnabled: boolean;
  scheduledOverviewEnabled: boolean;
  securityManualRefreshEnabled: boolean;
  dailyRunLimit: number;
  maxSymbolsPerRun: number;
  liveProvidersEnabled: boolean;
  adaptersImplemented: boolean;
  allowedScopes: PortfolioAnalyzerRequest["scope"][];
  allowedSources: ExternalResearchSource[];
}

export interface ExternalResearchSource {
  id: "market-data" | "profile" | "institutional" | "news" | "community";
  label: string;
  enabled: boolean;
  reason: string;
}

export interface MobileExternalResearchPolicy {
  statusLabel: string;
  enabled: boolean;
  canRunLiveResearch: boolean;
  scheduledOverviewEnabled: boolean;
  securityManualRefreshEnabled: boolean;
  sourceMode: ExternalResearchPolicy["sourceMode"];
  minTtlSeconds: number;
  defaultTtlSeconds: number;
  dailyRunLimit: number;
  maxSymbolsPerRun: number;
  allowedScopes: ExternalResearchPolicy["allowedScopes"];
  guardrails: string[];
  sources: ExternalResearchSource[];
}

export const DEFAULT_EXTERNAL_RESEARCH_POLICY: ExternalResearchPolicy = {
  enabled: false,
  sourceMode: "cached-external",
  minTtlSeconds: 21600,
  defaultTtlSeconds: 21600,
  newsTtlSeconds: 129600,
  requiresWorker: true,
  workerEnabled: false,
  scheduledOverviewEnabled: false,
  securityManualRefreshEnabled: true,
  dailyRunLimit: 25,
  maxSymbolsPerRun: 12,
  liveProvidersEnabled: false,
  adaptersImplemented: false,
  allowedScopes: ["security", "portfolio", "account", "recommendation-run"],
  allowedSources: [
    {
      id: "market-data",
      label: "行情与标的资料",
      enabled: false,
      reason: "等待 worker 缓存层接入，避免手机端直接触发实时请求。",
    },
    {
      id: "profile",
      label: "标的基本资料",
      enabled: false,
      reason: "等待结构化 profile provider、TTL 和额度策略确认。",
    },
    {
      id: "institutional",
      label: "机构资料",
      enabled: false,
      reason: "等待来源白名单和缓存 TTL 策略确认。",
    },
    {
      id: "news",
      label: "新闻与公告",
      enabled: false,
      reason:
        "通过后台 worker 拉取真实新闻并写入缓存；页面加载不直接消耗 provider 额度。",
    },
    {
      id: "community",
      label: "论坛/社区情绪",
      enabled: false,
      reason: "P2 以后再评估；当前不进入投资建议链路。",
    },
  ],
};

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.max(Math.trunc(value), 1);
}

export function getExternalResearchPolicy(): ExternalResearchPolicy {
  const sourceEnv: Record<ExternalResearchSource["id"], string | undefined> = {
    "market-data": process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA,
    profile: process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE,
    institutional: process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_INSTITUTIONAL,
    news: process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_NEWS,
    community: process.env.PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_COMMUNITY,
  };

  return {
    ...DEFAULT_EXTERNAL_RESEARCH_POLICY,
    enabled: process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH === "enabled",
    dailyRunLimit: readPositiveIntegerEnv(
      "PORTFOLIO_ANALYZER_EXTERNAL_DAILY_RUN_LIMIT",
      DEFAULT_EXTERNAL_RESEARCH_POLICY.dailyRunLimit,
    ),
    maxSymbolsPerRun: readPositiveIntegerEnv(
      "PORTFOLIO_ANALYZER_EXTERNAL_MAX_SYMBOLS_PER_RUN",
      DEFAULT_EXTERNAL_RESEARCH_POLICY.maxSymbolsPerRun,
    ),
    newsTtlSeconds: readPositiveIntegerEnv(
      "PORTFOLIO_ANALYZER_EXTERNAL_NEWS_TTL_SECONDS",
      DEFAULT_EXTERNAL_RESEARCH_POLICY.newsTtlSeconds,
    ),
    workerEnabled: process.env.PORTFOLIO_ANALYZER_EXTERNAL_WORKER === "enabled",
    scheduledOverviewEnabled:
      process.env.PORTFOLIO_ANALYZER_EXTERNAL_DAILY_OVERVIEW === "enabled",
    securityManualRefreshEnabled:
      process.env.PORTFOLIO_ANALYZER_EXTERNAL_SECURITY_MANUAL_REFRESH !==
      "disabled",
    liveProvidersEnabled:
      process.env.PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS === "enabled",
    adaptersImplemented:
      process.env.PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS === "enabled",
    allowedSources: DEFAULT_EXTERNAL_RESEARCH_POLICY.allowedSources.map(
      (source) => ({
        ...source,
        enabled: sourceEnv[source.id] === "enabled",
      }),
    ),
  };
}

export function mapExternalResearchPolicyForMobile(
  policy = getExternalResearchPolicy(),
): MobileExternalResearchPolicy {
  const canRunLiveResearch =
    policy.enabled &&
    policy.workerEnabled &&
    policy.liveProvidersEnabled &&
    policy.adaptersImplemented &&
    policy.allowedSources.some((source) => source.enabled);

  return {
    statusLabel: canRunLiveResearch ? "已启用" : "未启用",
    enabled: policy.enabled,
    canRunLiveResearch,
    scheduledOverviewEnabled: policy.scheduledOverviewEnabled,
    securityManualRefreshEnabled: policy.securityManualRefreshEnabled,
    sourceMode: policy.sourceMode,
    minTtlSeconds: policy.minTtlSeconds,
    defaultTtlSeconds: policy.defaultTtlSeconds,
    dailyRunLimit: policy.dailyRunLimit,
    maxSymbolsPerRun: policy.maxSymbolsPerRun,
    allowedScopes: policy.allowedScopes,
    guardrails: [
      "总览级秘闻只允许后台 worker 每日缓存；Flutter 页面加载不能自动运行外部来源。",
      "单个标的允许用户显式触发刷新，但必须受每日次数、TTL 和 worker 队列限制。",
      "新闻 provider 与标的资料共用真实 API key 时，后端需要把每日新闻 worker 视为独立来源并限制频率。",
      `缓存 TTL 不得低于 ${policy.minTtlSeconds} 秒，避免重复付费或重复抓取。`,
      `单次最多分析 ${policy.maxSymbolsPerRun} 个标的；每日默认最多 ${policy.dailyRunLimit} 次。`,
      "未接入 worker、provider 和来源白名单前，移动端不得展示 live research 已启用。",
    ],
    sources: policy.allowedSources,
  };
}

export function assertExternalResearchAllowed(input: PortfolioAnalyzerRequest) {
  if (!input.includeExternalResearch) {
    return;
  }

  const policy = getExternalResearchPolicy();
  if (!policy.enabled) {
    throw new Error(
      "External research is not enabled. Use local quick scan until cache and worker policy are configured.",
    );
  }

  if (!policy.allowedScopes.includes(input.scope)) {
    throw new Error(
      `External research is not enabled for ${input.scope} analysis.`,
    );
  }

  if (input.maxCacheAgeSeconds < policy.minTtlSeconds) {
    throw new Error(
      `External research requires a cache TTL of at least ${policy.minTtlSeconds} seconds.`,
    );
  }

  if (!policy.workerEnabled) {
    throw new Error(
      "External research requires the background worker to be enabled.",
    );
  }

  if (!policy.liveProvidersEnabled || !policy.adaptersImplemented) {
    throw new Error(
      "External research providers are not connected yet. Use local quick scan for now.",
    );
  }

  if (!policy.allowedSources.some((source) => source.enabled)) {
    throw new Error(
      "External research source allowlist has no enabled sources.",
    );
  }
}
