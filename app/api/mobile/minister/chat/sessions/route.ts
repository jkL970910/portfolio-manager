import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { listLooMinisterChatSessions } from "@/lib/backend/loo-minister-chat";

export async function GET(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rawLimit = request.nextUrl.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 10;

  try {
    return NextResponse.json(
      await listLooMinisterChatSessions(viewer.id, {
        limit: Number.isFinite(limit) ? limit : 10,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to list Loo Minister chat sessions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
