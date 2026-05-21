import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { snapTradeConnectionPortalInputSchema } from "@/lib/backend/payload-schemas";
import {
  createSnapTradeBrokerageConnectionPortal,
  deleteSnapTradeBrokerageConnection,
  getSnapTradeBrokerageConnection,
} from "@/lib/backend/services";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const connection = await getSnapTradeBrokerageConnection(viewer.id);
  return NextResponse.json({ data: { connection } }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = snapTradeConnectionPortalInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid SnapTrade connection payload.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await createSnapTradeBrokerageConnectionPortal(
      viewer.id,
      parsed.data,
    );
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "SnapTrade connection portal failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await deleteSnapTradeBrokerageConnection(viewer.id);
  return NextResponse.json({ data: result }, { status: 200 });
}
