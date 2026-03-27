import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { holdingEditSchema } from "@/lib/backend/payload-schemas";
import { deleteHoldingPosition, updateHoldingPosition } from "@/lib/backend/services";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ holdingId: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = holdingEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid holding update payload." }, { status: 400 });
  }

  try {
    const { holdingId } = await params;
    await updateHoldingPosition(userId, holdingId, parsed.data);
    revalidatePath("/portfolio", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/recommendations");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update holding.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ holdingId: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { holdingId } = await params;
    await deleteHoldingPosition(userId, holdingId);
    revalidatePath("/portfolio", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/recommendations");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete holding.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
