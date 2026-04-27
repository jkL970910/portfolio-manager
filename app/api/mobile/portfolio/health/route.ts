import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getPortfolioView } from "@/lib/backend/services";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await getPortfolioView(viewer.id);
  const accountId = request.nextUrl.searchParams.get("account");
  const account = accountId
    ? payload.data.accountContexts.find((item) => item.id === accountId) ?? null
    : null;

  return NextResponse.json({
    data: {
      scope: account
        ? {
            type: "account",
            id: account.id,
            name: account.name,
          }
        : {
            type: "portfolio",
            id: null,
            name: "组合健康",
          },
      health: account?.healthDetail ?? payload.data.healthScore,
    },
    meta: payload.meta,
  });
}
