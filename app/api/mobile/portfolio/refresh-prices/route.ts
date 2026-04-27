import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { refreshPortfolioQuotes } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const data = await refreshPortfolioQuotes(viewer.id);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portfolio quote refresh failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
