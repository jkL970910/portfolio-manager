import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { refreshPortfolioQuotesWithRunLedger } from "@/lib/backend/market-data-refresh-runs";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await refreshPortfolioQuotesWithRunLedger({
    userId: viewer.id,
    triggeredBy: "manual",
  });

  if (!result.ok) {
    const message =
      result.errorMessage.toLowerCase().includes("api credits") ||
      result.errorMessage.toLowerCase().includes("rate limit") ||
      result.errorMessage.toLowerCase().includes("quota")
        ? "行情服务暂时限流。已保留现有价格，请稍后再试。"
        : "组合行情刷新失败。请稍后再试，现有价格不会被清空。";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json(
    { data: { ...result.data, refreshRunId: result.runId } },
    { status: 200 },
  );
}
