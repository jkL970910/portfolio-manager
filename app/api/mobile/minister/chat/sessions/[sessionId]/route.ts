import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import {
  deleteLooMinisterChatSession,
  getLooMinisterChatSession,
} from "@/lib/backend/loo-minister-chat";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { sessionId } = await params;
    return NextResponse.json(
      await getLooMinisterChatSession(viewer.id, sessionId),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load Loo Minister chat session.";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { sessionId } = await params;
    return NextResponse.json(
      await deleteLooMinisterChatSession(viewer.id, sessionId),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete Loo Minister chat session.";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
