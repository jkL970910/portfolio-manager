import { NextRequest, NextResponse } from "next/server";

import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import {
  getMobileLooMinisterSettings,
  updateMobileLooMinisterSettings,
} from "@/lib/backend/loo-minister-settings";
import { looMinisterSettingsInputSchema } from "@/lib/backend/payload-schemas";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await getMobileLooMinisterSettings(viewer.id));
}

export async function PATCH(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const parsed = looMinisterSettingsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid AI Minister settings payload.",
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await updateMobileLooMinisterSettings(viewer.id, parsed.data),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update AI Minister settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
