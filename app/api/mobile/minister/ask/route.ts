import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getLooMinisterAnswer } from "@/lib/backend/loo-minister";
import { looMinisterQuestionRequestSchema } from "@/lib/backend/loo-minister-contracts";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const parsed = looMinisterQuestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid minister question payload.",
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(getLooMinisterAnswer(viewer.id, parsed.data));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to build Loo Minister answer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
