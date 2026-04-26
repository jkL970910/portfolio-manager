import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest, issueMobileAuthTokens } from "@/lib/auth/mobile-tokens";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ data: { viewer } });
}

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tokens = await issueMobileAuthTokens(viewer);

  return NextResponse.json({
    data: {
      viewer,
      auth: tokens
    }
  });
}
