import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getSecurityQuote } from "@/lib/market-data/service";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  const exchange = request.nextUrl.searchParams.get("exchange")?.trim() || null;
  const currency = request.nextUrl.searchParams.get("currency")?.trim() || null;
  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
  }

  try {
    const data = await getSecurityQuote(symbol, { exchange, currency });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quote lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
