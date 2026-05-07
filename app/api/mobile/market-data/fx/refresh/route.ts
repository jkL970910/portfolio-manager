import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { formatFxRateLabel, refreshFxRate } from "@/lib/market-data/fx";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await refreshFxRate("USD", "CAD", { force: true });

  return NextResponse.json(
    {
      data: {
        from: result.from,
        to: result.to,
        rate: result.rate,
        rateDate: result.rateDate,
        source: result.source,
        freshness: result.freshness,
        refreshed: result.refreshed,
        fxRateLabel: formatFxRateLabel(result),
        message: result.refreshed
          ? "FX 汇率已更新。"
          : (result.errorMessage ?? "FX 汇率暂未更新，已沿用最近可用汇率。"),
      },
    },
    { status: 200 },
  );
}
