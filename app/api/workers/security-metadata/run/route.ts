import { NextRequest, NextResponse } from "next/server";
import { runSecurityMetadataRefreshWorkerOnce } from "@/lib/backend/security-metadata-worker";
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
    const result = await runSecurityMetadataRefreshWorkerOnce({
      workerId:
        request.nextUrl.searchParams.get("workerId")?.trim() ||
        process.env.SECURITY_METADATA_WORKER_ID ||
        "security-metadata-api-worker",
      maxSecurities: readPositiveWorkerLimit(
        request.nextUrl.searchParams.get("maxSecurities"),
        "SECURITY_METADATA_REFRESH_MAX_SECURITIES",
      ),
      maxAgeDays: readPositiveWorkerLimit(
        request.nextUrl.searchParams.get("maxAgeDays"),
        "SECURITY_METADATA_REFRESH_MAX_AGE_DAYS",
      ),
      symbols:
        request.nextUrl.searchParams.get("symbols")?.trim() ||
        process.env.SECURITY_METADATA_REFRESH_SYMBOLS,
      force:
        request.nextUrl.searchParams.get("force")?.trim().toLowerCase() ===
        "true",
    });

    return NextResponse.json(
      { data: result, meta: { source: "worker-api" } },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Security-metadata worker endpoint failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
