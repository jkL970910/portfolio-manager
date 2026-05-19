import { NextRequest, NextResponse } from "next/server";
import { runRecommendationDynamicPoolWorkerOnce } from "@/lib/backend/recommendation-v4/dynamic-pool-worker";
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
    const result = await runRecommendationDynamicPoolWorkerOnce({
      workerId:
        request.nextUrl.searchParams.get("workerId")?.trim() ||
        process.env.RECOMMENDATION_DYNAMIC_POOL_WORKER_ID ||
        "recommendation-dynamic-pool-api-worker",
      userId: request.nextUrl.searchParams.get("userId")?.trim() || null,
      maxUsers: readPositiveWorkerLimit(
        request.nextUrl.searchParams.get("maxUsers"),
        "RECOMMENDATION_DYNAMIC_POOL_MAX_USERS",
      ),
    });

    return NextResponse.json(
      { data: result, meta: { source: "worker-api" } },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Recommendation dynamic-pool worker endpoint failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
