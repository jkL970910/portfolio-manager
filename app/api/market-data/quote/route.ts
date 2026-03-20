import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getSecurityQuote } from "@/lib/market-data/service";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
  }

  try {
    const data = await getSecurityQuote(symbol);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quote lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
