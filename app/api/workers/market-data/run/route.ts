import { NextRequest, NextResponse } from "next/server";
import {
  readPositiveWorkerLimit,
  verifyWorkerApiRequest,
} from "@/lib/backend/worker-api-auth";
import { runMarketDataRefreshWorkerOnce } from "@/lib/backend/market-data-refresh-worker";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = verifyWorkerApiRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await runMarketDataRefreshWorkerOnce({
      workerId:
        request.nextUrl.searchParams.get("workerId")?.trim() ||
        process.env.MARKET_DATA_REFRESH_WORKER_ID ||
        "market-data-api-worker",
      maxUsers: readPositiveWorkerLimit(
        request.nextUrl.searchParams.get("maxUsers"),
        "MARKET_DATA_REFRESH_MAX_USERS",
      ),
      maxSymbols: readPositiveWorkerLimit(
        request.nextUrl.searchParams.get("maxSymbols"),
        "MARKET_DATA_REFRESH_MAX_SYMBOLS",
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
        : "Market-data worker endpoint failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
