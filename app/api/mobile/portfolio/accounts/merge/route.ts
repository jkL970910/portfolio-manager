import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import {
  accountMergeConfirmSchema,
  accountMergePreviewSchema,
} from "@/lib/backend/payload-schemas";
import { mergeAccounts, previewAccountMerge } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  if (body?.confirm === true) {
    const parsed = accountMergeConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Invalid account merge confirmation payload.",
        },
        { status: 400 },
      );
    }
    try {
      await mergeAccounts(
        viewer.id,
        parsed.data.sourceAccountId,
        parsed.data.targetAccountId,
      );
      return NextResponse.json({ data: { ok: true } });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to merge accounts.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const parsed = accountMergePreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid account merge preview payload.",
      },
      { status: 400 },
    );
  }

  try {
    const preview = await previewAccountMerge(
      viewer.id,
      parsed.data.sourceAccountId,
      parsed.data.targetAccountId,
    );
    return NextResponse.json({ data: preview });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to preview account merge.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
