import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { resolveSecurity } from "@/lib/market-data/service";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await resolveSecurity(symbol) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Security resolution failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
