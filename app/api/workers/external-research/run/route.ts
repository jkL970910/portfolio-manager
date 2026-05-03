import { NextRequest, NextResponse } from "next/server";
import { runExternalResearchWorkerOnce } from "@/lib/backend/external-research-jobs";
import { verifyWorkerApiRequest } from "@/lib/backend/worker-api-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = verifyWorkerApiRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await runExternalResearchWorkerOnce({
      workerId:
        request.nextUrl.searchParams.get("workerId")?.trim() ||
        process.env.EXTERNAL_RESEARCH_WORKER_ID ||
        "external-research-api-worker",
    });

    return NextResponse.json(
      { data: result, meta: { source: "worker-api" } },
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
