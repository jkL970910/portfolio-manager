import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getPortfolioHoldingDetailView } from "@/lib/backend/services";

export async function GET(request: NextRequest, { params }: { params: Promise<{ holdingId: string }> }) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { holdingId } = await params;
  const result = await getPortfolioHoldingDetailView(viewer.id, holdingId);
  return NextResponse.json(result);
}
