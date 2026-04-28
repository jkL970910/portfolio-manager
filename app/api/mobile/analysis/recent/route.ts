import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getMobileAnalysisHistory } from "@/lib/backend/portfolio-analysis-history";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 5);
  return NextResponse.json(await getMobileAnalysisHistory(viewer.id, limit));
}
