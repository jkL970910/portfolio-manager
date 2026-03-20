import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { refreshPortfolioQuotes } from "@/lib/backend/services";

export async function POST() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await refreshPortfolioQuotes(userId);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portfolio quote refresh failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
