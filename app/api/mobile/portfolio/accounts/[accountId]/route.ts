import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getPortfolioAccountDetailView } from "@/lib/backend/services";

export async function GET(request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { accountId } = await params;
  const result = await getPortfolioAccountDetailView(viewer.id, accountId);
  return NextResponse.json(result);
}
