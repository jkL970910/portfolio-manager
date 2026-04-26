import { NextRequest, NextResponse } from "next/server";
import { mobileAuthRefreshSchema } from "@/lib/backend/payload-schemas";
import { getViewerByUserId } from "@/lib/auth/session";
import { issueMobileAuthTokens, verifyMobileToken } from "@/lib/auth/mobile-tokens";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = mobileAuthRefreshSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid refresh payload." }, { status: 400 });
  }

  try {
    const payload = await verifyMobileToken(parsed.data.refreshToken, "refresh");
    if (!payload.sub) {
      return NextResponse.json({ error: "Refresh token is missing a subject." }, { status: 401 });
    }

    const viewer = await getViewerByUserId(payload.sub);
    const tokens = await issueMobileAuthTokens(viewer);

    return NextResponse.json({
      data: {
        viewer,
        auth: tokens
      }
    });
  } catch {
    return NextResponse.json({ error: "Refresh token is invalid or expired." }, { status: 401 });
  }
}
