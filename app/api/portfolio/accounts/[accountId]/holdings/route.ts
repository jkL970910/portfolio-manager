import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { holdingCreateSchema } from "@/lib/backend/payload-schemas";
import { createHoldingPosition } from "@/lib/backend/services";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = holdingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid holding payload." }, { status: 400 });
  }

  try {
    const { accountId } = await params;
    const holdingId = await createHoldingPosition(userId, accountId, parsed.data);
    revalidatePath("/portfolio", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/recommendations");
    return NextResponse.json({ ok: true, holdingId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create holding.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
