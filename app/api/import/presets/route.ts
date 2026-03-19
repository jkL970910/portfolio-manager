import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { importMappingPresetCreateSchema } from "@/lib/backend/payload-schemas";
import { listImportMappingPresets, saveImportMappingPreset } from "@/lib/backend/services";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const presets = await listImportMappingPresets(userId);
    return NextResponse.json({ data: presets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load presets." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = importMappingPresetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid preset payload." }, { status: 400 });
  }

  try {
    const preset = await saveImportMappingPreset(userId, parsed.data);
    return NextResponse.json({ data: preset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save preset." }, { status: 500 });
  }
}
