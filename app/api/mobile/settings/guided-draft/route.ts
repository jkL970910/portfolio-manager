import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { guidedAllocationDraftSchema } from "@/lib/backend/payload-schemas";
import { getPreferenceView, saveGuidedAllocationDraft } from "@/lib/backend/services";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await getPreferenceView(viewer.id);
  return NextResponse.json({ data: result.data.guidedDraft });
}

export async function PATCH(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = guidedAllocationDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid guided allocation draft payload." },
      { status: 400 }
    );
  }

  try {
    const draft = await saveGuidedAllocationDraft(viewer.id, parsed.data);
    return NextResponse.json({ data: draft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save guided allocation draft." },
      { status: 500 }
    );
  }
}
