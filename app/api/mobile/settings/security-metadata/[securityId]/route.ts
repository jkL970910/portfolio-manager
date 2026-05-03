import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import {
  SecurityMetadataAccessError,
  updateMobileSecurityMetadata,
} from "@/lib/backend/mobile-worker-status";
import { securityMetadataManualUpdateSchema } from "@/lib/backend/payload-schemas";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ securityId: string }> },
) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { securityId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = securityMetadataManualUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid security metadata payload.",
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await updateMobileSecurityMetadata(viewer.id, securityId, parsed.data),
    );
  } catch (error) {
    if (error instanceof SecurityMetadataAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update security metadata.",
      },
      { status: 400 },
    );
  }
}
