import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getPreferenceView, updatePreferenceProfile } from "@/lib/backend/services";
import { preferenceProfileInputSchema } from "@/lib/backend/payload-schemas";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await getPreferenceView(viewer.id));
}

export async function PATCH(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = preferenceProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid preference payload." },
      { status: 400 }
    );
  }

  try {
    const profile = await updatePreferenceProfile(viewer.id, parsed.data);
    return NextResponse.json({ data: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update preferences.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Recommendation constraint symbol") ? 400 : 500 }
    );
  }
}
