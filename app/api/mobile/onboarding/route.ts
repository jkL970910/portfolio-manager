import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import {
  getMobileOnboardingView,
  updateMobileOnboardingState,
} from "@/lib/backend/services";
import { mobileOnboardingUpdateSchema } from "@/lib/backend/payload-schemas";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await getMobileOnboardingView(viewer.id));
}

export async function PATCH(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = mobileOnboardingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid onboarding payload.",
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await updateMobileOnboardingState(viewer.id, parsed.data),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update onboarding state.",
      },
      { status: 500 },
    );
  }
}
