import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getPortfolioSecurityDetailView } from "@/lib/backend/services";

export async function GET(request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { symbol } = await params;
  const result = await getPortfolioSecurityDetailView(viewer.id, symbol);
  return NextResponse.json(result);
}
