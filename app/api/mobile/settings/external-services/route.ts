import { NextRequest, NextResponse } from "next/server";

import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import {
  getMobileExternalServiceCredentials,
  updateMobileExternalServiceCredentials,
} from "@/lib/backend/external-service-credentials";
import { externalServiceCredentialsInputSchema } from "@/lib/backend/payload-schemas";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await getMobileExternalServiceCredentials(viewer.id));
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

  const parsed = externalServiceCredentialsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid external service settings payload.",
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await updateMobileExternalServiceCredentials(viewer.id, parsed.data),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update external service settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
