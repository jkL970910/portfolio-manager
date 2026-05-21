import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { brokerageImportDraftHoldingReviewInputSchema } from "@/lib/backend/payload-schemas";
import { reviewBrokerageImportDraftHolding } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = brokerageImportDraftHoldingReviewInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid brokerage import draft holding review payload.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await reviewBrokerageImportDraftHolding(viewer.id, parsed.data);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Brokerage import holding review failed.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
