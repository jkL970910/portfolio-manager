import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getMobilePortfolioSecurityDetailView } from "@/lib/backend/mobile-views";

export async function GET(request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { symbol } = await params;
  const currencyParam = request.nextUrl.searchParams.get("currency")?.trim().toUpperCase();
  const result = await getMobilePortfolioSecurityDetailView(viewer.id, symbol, {
    exchange: request.nextUrl.searchParams.get("exchange"),
    currency: currencyParam === "USD" ? "USD" : currencyParam === "CAD" ? "CAD" : null,
  });
  return NextResponse.json(result);
}
