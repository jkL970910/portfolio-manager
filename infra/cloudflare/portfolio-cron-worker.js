const DEFAULT_TIMEOUT_MS = 25_000;

function envFlag(value, fallback = true) {
  if (value == null || value === "") {
    return fallback;
  }
  return String(value).toLowerCase() === "true";
}

function requireEnv(env, key) {
  const value = env[key];
  if (!value || !String(value).trim()) {
    throw new Error(`${key} is required.`);
  }
  return String(value).trim();
}

function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(path, baseUrl);
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && String(value).trim()) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function postWorkerEndpoint(env, job) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const response = await fetch(buildUrl(requireEnv(env, "APP_BASE_URL"), job.path, job.query), {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireEnv(env, "PORTFOLIO_WORKER_SECRET")}`,
      "content-type": "application/json",
      "user-agent": "portfolio-manager-cloudflare-cron/1.0"
    },
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  const text = await response.text();
  return {
    name: job.name,
    ok: response.ok,
    status: response.status,
    body: text.slice(0, 1000)
  };
}

function scheduledJobs(env) {
  return [
    envFlag(env.ENABLE_SECURITY_METADATA_WORKER, true) && {
      name: "security-metadata",
      path: "/api/workers/security-metadata/run",
      query: {
        maxSecurities: env.SECURITY_METADATA_REFRESH_MAX_SECURITIES || "50",
        maxAgeDays: env.SECURITY_METADATA_REFRESH_MAX_AGE_DAYS || "30"
      }
    },
    envFlag(env.ENABLE_MARKET_DATA_WORKER, true) && {
      name: "market-data",
      path: "/api/workers/market-data/run",
      query: {
        maxUsers: env.MARKET_DATA_REFRESH_MAX_USERS || "1",
        maxSymbols: env.MARKET_DATA_REFRESH_MAX_SYMBOLS || "20",
        batchSize: env.MARKET_DATA_REFRESH_BATCH_SIZE || "20",
        maxBatchesPerRun:
          env.MARKET_DATA_REFRESH_MAX_BATCHES_PER_RUN || "3",
        maxRuntimeSeconds: env.MARKET_DATA_REFRESH_MAX_RUNTIME_SECONDS || "45"
      }
    },
    envFlag(env.ENABLE_EXTERNAL_RESEARCH_WORKER, false) && {
      name: "external-research",
      path: "/api/workers/external-research/run",
      query: {
        mode: env.EXTERNAL_RESEARCH_WORKER_MODE || "daily-overview",
        source: env.EXTERNAL_RESEARCH_DAILY_SOURCE || "profile",
        maxUsers: env.EXTERNAL_RESEARCH_DAILY_MAX_USERS || "1",
        maxSymbolsPerUser:
          env.EXTERNAL_RESEARCH_DAILY_MAX_SYMBOLS_PER_USER || "3",
        maxJobs: env.EXTERNAL_RESEARCH_WORKER_MAX_JOBS || "3",
        maxRuntimeMs: env.EXTERNAL_RESEARCH_WORKER_MAX_RUNTIME_MS || "20000"
      }
    }
  ].filter(Boolean);
}

async function runJobs(env) {
  const results = [];
  for (const job of scheduledJobs(env)) {
    results.push(await postWorkerEndpoint(env, job));
  }
  return results;
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runJobs(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/run-once") {
      return new Response("Not found", { status: 404 });
    }
    const requestSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!requestSecret || requestSecret !== requireEnv(env, "PORTFOLIO_WORKER_SECRET")) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
    const results = await runJobs(env);
    return Response.json({ data: results });
  }
};
