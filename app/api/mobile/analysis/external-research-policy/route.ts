import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { apiSuccess } from "@/lib/backend/contracts";
import { mapExternalResearchPolicyForMobile } from "@/lib/backend/portfolio-external-research";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(
    apiSuccess(mapExternalResearchPolicyForMobile(), "service"),
  );
}
