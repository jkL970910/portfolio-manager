import { NextRequest, NextResponse } from "next/server";

import { mobileManualCashAccountBalanceUpdateSchema } from "@/lib/backend/payload-schemas";
import { updateManualCashAccountBalance } from "@/lib/backend/services";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";

interface RouteContext {
  params: Promise<{ cashAccountId: string }>;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, context: RouteContext) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { cashAccountId } = await context.params;
  if (!uuidPattern.test(cashAccountId)) {
    return NextResponse.json({ error: "Invalid cash account id." }, { status: 400 });
  }

  const body = await request.json();
  const parsed = mobileManualCashAccountBalanceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid cash balance payload.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await updateManualCashAccountBalance(
      viewer.id,
      cashAccountId,
      parsed.data,
    );
    return NextResponse.json({ data: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update cash account.";
    return NextResponse.json(
      { error: message },
      { status: message === "Cash account not found." ? 404 : 500 },
    );
  }
}
