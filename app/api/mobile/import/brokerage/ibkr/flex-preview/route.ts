import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { ibkrFlexPreviewInputSchema } from "@/lib/backend/payload-schemas";
import { fetchIbkrFlexPreview } from "@/lib/backend/import/ibkr-flex";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = ibkrFlexPreviewInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid IBKR Flex preview payload.",
      },
      { status: 400 },
    );
  }

  try {
    const preview = await fetchIbkrFlexPreview(parsed.data);
    return NextResponse.json({ data: { preview } }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "IBKR Flex 预览失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
