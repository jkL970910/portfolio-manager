import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { mobileManualAccountCreateSchema } from "@/lib/backend/payload-schemas";
import { createManualInvestmentAccount } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = mobileManualAccountCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid account payload." },
      { status: 400 }
    );
  }

  try {
    const account = await createManualInvestmentAccount(viewer.id, parsed.data);
    return NextResponse.json({ data: { account } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create account." },
      { status: 500 }
    );
  }
}
