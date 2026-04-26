import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getMobilePortfolioOverviewView } from "@/lib/backend/mobile-views";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await getMobilePortfolioOverviewView(viewer.id, viewer));
}
