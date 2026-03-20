import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { displayCurrencyInputSchema } from "@/lib/backend/payload-schemas";
import { updateDisplayCurrency } from "@/lib/backend/services";

export async function PATCH(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = displayCurrencyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid display currency payload." }, { status: 400 });
  }

  try {
    const profile = await updateDisplayCurrency(userId, parsed.data);
    return NextResponse.json({ data: profile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update display currency." }, { status: 500 });
  }
}
