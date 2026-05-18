import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { mobileSecurityObservationInputSchema } from "@/lib/backend/payload-schemas";
import { recordMobileSecurityObservation } from "@/lib/backend/services";
import { getRepositories } from "@/lib/backend/repositories/factory";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), 30)
    : 12;
  const observations =
    await getRepositories().mobileSecurityObservations.listRecentByUserId(
      viewer.id,
      limit,
    );
  return NextResponse.json({ data: { observations } });
}

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = mobileSecurityObservationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid observation payload." },
      { status: 400 },
    );
  }

  try {
    const observation = await recordMobileSecurityObservation(
      viewer.id,
      parsed.data,
    );
    return NextResponse.json({ data: { observation } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to record security observation.",
      },
      { status: 500 },
    );
  }
}
