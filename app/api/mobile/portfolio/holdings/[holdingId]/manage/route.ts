import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { holdingEditSchema } from "@/lib/backend/payload-schemas";
import { deleteHoldingPosition, updateHoldingPosition } from "@/lib/backend/services";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ holdingId: string }> }
) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = holdingEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid holding update payload." },
      { status: 400 }
    );
  }

  try {
    const { holdingId } = await params;
    await updateHoldingPosition(viewer.id, holdingId, parsed.data);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update holding.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ holdingId: string }> }
) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { holdingId } = await params;
    await deleteHoldingPosition(viewer.id, holdingId);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete holding.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
