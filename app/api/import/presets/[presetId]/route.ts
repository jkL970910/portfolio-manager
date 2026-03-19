import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { importMappingPresetUpdateSchema } from "@/lib/backend/payload-schemas";
import { deleteImportMappingPreset, updateImportMappingPreset } from "@/lib/backend/services";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ presetId: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { presetId } = await params;
  const body = await request.json();
  const parsed = importMappingPresetUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid preset update payload." }, { status: 400 });
  }

  try {
    const preset = await updateImportMappingPreset(userId, presetId, parsed.data);
    return NextResponse.json({ data: preset });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update preset." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ presetId: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { presetId } = await params;

  try {
    await deleteImportMappingPreset(userId, presetId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete preset." }, { status: 500 });
  }
}
