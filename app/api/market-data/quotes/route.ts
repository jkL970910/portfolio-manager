import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getBatchSecurityQuotes } from "@/lib/market-data/service";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbolsParam = request.nextUrl.searchParams.get("symbols")?.trim() ?? "";
  if (!symbolsParam) {
    return NextResponse.json({ error: "Symbols are required." }, { status: 400 });
  }

  const symbols = symbolsParam.split(",").map((symbol) => symbol.trim()).filter(Boolean);
  if (symbols.length === 0) {
    return NextResponse.json({ error: "No valid symbols were provided." }, { status: 400 });
  }

  try {
    const data = await getBatchSecurityQuotes(symbols);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch quote lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
