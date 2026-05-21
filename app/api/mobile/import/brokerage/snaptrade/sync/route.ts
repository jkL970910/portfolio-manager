import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { syncSnapTradeBrokerageConnection } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await syncSnapTradeBrokerageConnection(viewer.id);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "SnapTrade connection sync failed.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
