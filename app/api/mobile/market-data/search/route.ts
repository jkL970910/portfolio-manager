import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { searchSecurities } from "@/lib/market-data/service";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (query.length < 1) {
    return NextResponse.json({ error: "Query is required." }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await searchSecurities(query) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Security search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
