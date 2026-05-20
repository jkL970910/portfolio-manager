import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { brokerageImportDraftConfirmInputSchema } from "@/lib/backend/payload-schemas";
import { confirmBrokerageImportDraft } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = brokerageImportDraftConfirmInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid brokerage import draft payload.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await confirmBrokerageImportDraft(
      viewer.id,
      parsed.data.draftId,
    );
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Brokerage import confirm failed.";
    if (/need identity review/i.test(message)) {
      return NextResponse.json(
        {
          error: "草稿里还有交易所或标的身份待确认的持仓，暂不能写入主账本。",
        },
        { status: 400 },
      );
    }
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
