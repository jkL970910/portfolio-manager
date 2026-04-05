import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { refreshPortfolioSecurityQuote } from "@/lib/backend/services";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol } = await params;

  try {
    const data = await refreshPortfolioSecurityQuote(userId, decodeURIComponent(symbol));
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Security quote refresh failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
