import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { displayCurrencyInputSchema } from "@/lib/backend/payload-schemas";
import { updateDisplayCurrency } from "@/lib/backend/services";

export async function PATCH(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = displayCurrencyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid display currency payload." },
      { status: 400 }
    );
  }

  try {
    const profile = await updateDisplayCurrency(viewer.id, parsed.data);
    return NextResponse.json({ data: { profile } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update display currency." },
      { status: 500 }
    );
  }
}
