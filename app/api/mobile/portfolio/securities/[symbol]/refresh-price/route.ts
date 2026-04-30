import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { refreshPortfolioSecurityQuote } from "@/lib/backend/services";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { symbol } = await params;
  const currencyParam = request.nextUrl.searchParams
    .get("currency")
    ?.trim()
    .toUpperCase();

  try {
    const data = await refreshPortfolioSecurityQuote(
      viewer.id,
      decodeURIComponent(symbol),
      {
        securityId: request.nextUrl.searchParams.get("securityId"),
        exchange: request.nextUrl.searchParams.get("exchange"),
        currency:
          currencyParam === "USD"
            ? "USD"
            : currencyParam === "CAD"
              ? "CAD"
              : null,
      },
    );
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Security quote refresh failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
