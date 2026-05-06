import { NextRequest, NextResponse } from "next/server";
import {
  getLooMinisterContextPackCacheStatsAsync,
  pruneExpiredLooMinisterContextPacks,
} from "@/lib/backend/loo-minister-context-pack-cache";
import { verifyWorkerApiRequest } from "@/lib/backend/worker-api-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = verifyWorkerApiRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const before = await getLooMinisterContextPackCacheStatsAsync();
    const deletedCount = await pruneExpiredLooMinisterContextPacks();
    const after = await getLooMinisterContextPackCacheStatsAsync();
    return NextResponse.json(
      {
        data: {
          deletedCount,
          before,
          after,
        },
        meta: { source: "worker-api" },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Loo Minister context-pack prune failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
