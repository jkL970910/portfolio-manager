import { NextRequest, NextResponse } from "next/server";
import {
  enqueueDailyOverviewExternalResearchJobs,
  runExternalResearchWorkerBatch,
} from "@/lib/backend/external-research-jobs";
import {
  readPositiveWorkerLimit,
  verifyWorkerApiRequest,
} from "@/lib/backend/worker-api-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = verifyWorkerApiRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const workerId =
      request.nextUrl.searchParams.get("workerId")?.trim() ||
      process.env.EXTERNAL_RESEARCH_WORKER_ID ||
      "external-research-api-worker";
    const mode = request.nextUrl.searchParams.get("mode")?.trim() || "drain";
    const enqueueDaily =
      mode === "daily-overview" ||
      request.nextUrl.searchParams.get("enqueueDaily") === "true";
    const enqueueResult = enqueueDaily
      ? await enqueueDailyOverviewExternalResearchJobs({
          maxUsers: readPositiveWorkerLimit(
            request.nextUrl.searchParams.get("maxUsers"),
            "EXTERNAL_RESEARCH_DAILY_MAX_USERS",
          ),
          maxSymbolsPerUser: readPositiveWorkerLimit(
            request.nextUrl.searchParams.get("maxSymbolsPerUser"),
            "EXTERNAL_RESEARCH_DAILY_MAX_SYMBOLS_PER_USER",
          ),
          sourceId:
            request.nextUrl.searchParams.get("source") ??
            process.env.EXTERNAL_RESEARCH_DAILY_SOURCE,
          maxCacheAgeSeconds: readPositiveWorkerLimit(
            request.nextUrl.searchParams.get("maxCacheAgeSeconds"),
            "EXTERNAL_RESEARCH_DAILY_CACHE_TTL_SECONDS",
          ),
        })
      : null;
    const result = await runExternalResearchWorkerBatch({
      workerId,
      maxJobs: readPositiveWorkerLimit(
        request.nextUrl.searchParams.get("maxJobs"),
        "EXTERNAL_RESEARCH_WORKER_MAX_JOBS",
      ),
      maxRuntimeMs: readPositiveWorkerLimit(
        request.nextUrl.searchParams.get("maxRuntimeMs"),
        "EXTERNAL_RESEARCH_WORKER_MAX_RUNTIME_MS",
      ),
    });

    return NextResponse.json(
      { data: { enqueue: enqueueResult, worker: result }, meta: { source: "worker-api" } },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "External-research worker endpoint failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
