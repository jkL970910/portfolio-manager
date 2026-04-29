import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { refreshPortfolioQuotes } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const data = await refreshPortfolioQuotes(viewer.id);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const rawMessage =
      error instanceof Error
        ? error.message
        : "Portfolio quote refresh failed.";
    const message =
      rawMessage.toLowerCase().includes("api credits") ||
      rawMessage.toLowerCase().includes("rate limit")
        ? "行情服务暂时限流。已保留现有价格，请稍后再试。"
        : "组合行情刷新失败。请稍后再试，现有价格不会被清空。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
