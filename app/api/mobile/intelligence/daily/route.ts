import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getMobileDailyIntelligenceView } from "@/lib/backend/mobile-daily-intelligence";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 8);
  return NextResponse.json(
    await getMobileDailyIntelligenceView(viewer.id, limit),
  );
}
