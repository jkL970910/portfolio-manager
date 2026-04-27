import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { holdingCreateSchema } from "@/lib/backend/payload-schemas";
import { createHoldingPosition } from "@/lib/backend/services";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = holdingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid holding payload." },
      { status: 400 }
    );
  }

  try {
    const { accountId } = await params;
    const holdingId = await createHoldingPosition(viewer.id, accountId, parsed.data);
    return NextResponse.json({ data: { holdingId } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create holding.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
