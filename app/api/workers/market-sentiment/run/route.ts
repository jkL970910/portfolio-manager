import { NextRequest, NextResponse } from "next/server";
import { refreshMarketSentimentSnapshot } from "@/lib/backend/market-sentiment";
import { verifyWorkerApiRequest } from "@/lib/backend/worker-api-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = verifyWorkerApiRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const snapshot = await refreshMarketSentimentSnapshot();
    return NextResponse.json(
      {
        data: {
          id: snapshot.id,
          provider: snapshot.provider,
          sourceMode: snapshot.sourceMode,
          score: snapshot.score,
          fgiScore: snapshot.fgiScore,
          vixValue: snapshot.vixValue,
          asOf: snapshot.asOf,
          expiresAt: snapshot.expiresAt,
          rawPayload: snapshot.rawPayload,
        },
        meta: { source: "worker-api" },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Market-sentiment worker endpoint failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
