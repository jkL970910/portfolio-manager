import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getMobilePortfolioSecurityDetailView } from "@/lib/backend/mobile-views";

export async function GET(request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { symbol } = await params;
  const result = await getMobilePortfolioSecurityDetailView(viewer.id, symbol);
  return NextResponse.json(result);
}
