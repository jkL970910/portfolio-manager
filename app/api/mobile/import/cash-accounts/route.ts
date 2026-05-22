import { NextRequest, NextResponse } from "next/server";

import { mobileManualCashAccountCreateSchema } from "@/lib/backend/payload-schemas";
import { createManualCashAccount } from "@/lib/backend/services";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = mobileManualCashAccountCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid cash account payload." },
      { status: 400 },
    );
  }

  try {
    const cashAccount = await createManualCashAccount(viewer.id, parsed.data);
    return NextResponse.json({ data: { cashAccount } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create cash account." },
      { status: 500 },
    );
  }
}
