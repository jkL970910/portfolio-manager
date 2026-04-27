import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getPreferenceView, updatePreferenceProfile } from "@/lib/backend/services";
import { preferenceProfileInputSchema } from "@/lib/backend/payload-schemas";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getPreferenceView(userId));
}

export async function PATCH(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = preferenceProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid preference payload." }, { status: 400 });
  }

  try {
    const profile = await updatePreferenceProfile(userId, parsed.data);
    return NextResponse.json({ data: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update preferences.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Recommendation constraint symbol") ? 400 : 500 }
    );
  }
}
