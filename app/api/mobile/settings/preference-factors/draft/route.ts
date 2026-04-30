import { NextRequest, NextResponse } from "next/server";

import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { preferenceFactorsDraftRequestSchema } from "@/lib/backend/payload-schemas";
import { createPreferenceFactorsDraft } from "@/lib/backend/preference-factor-draft";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = preferenceFactorsDraftRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid preference factor draft payload.",
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await createPreferenceFactorsDraft(viewer.id, parsed.data),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create preference factor draft.",
      },
      { status: 500 },
    );
  }
}
