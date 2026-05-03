import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import {
  getMobileSecurityMetadataReview,
  refreshMobileSecurityMetadata,
} from "@/lib/backend/mobile-worker-status";
import { securityMetadataRefreshInputSchema } from "@/lib/backend/payload-schemas";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await getMobileSecurityMetadataReview(viewer.id));
}

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = securityMetadataRefreshInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid security metadata refresh payload.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    await refreshMobileSecurityMetadata({
      maxSecurities: parsed.data.maxSecurities,
    }),
  );
}
