import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { searchSecurities } from "@/lib/market-data/service";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (query.length < 1) {
    return NextResponse.json({ error: "Query is required." }, { status: 400 });
  }

  try {
    const data = await searchSecurities(query);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Security search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
