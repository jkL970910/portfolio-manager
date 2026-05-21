import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { accountDeleteSchema, accountEditSchema } from "@/lib/backend/payload-schemas";
import { deleteInvestmentAccount, updateInvestmentAccount } from "@/lib/backend/services";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = accountEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid account update payload." },
      { status: 400 }
    );
  }

  try {
    const { accountId } = await params;
    await updateInvestmentAccount(viewer.id, accountId, parsed.data);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update account.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { accountId } = await params;
    let body: unknown = undefined;
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }
    const parsed = accountDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid account delete payload." },
        { status: 400 }
      );
    }
    const deleteMode = parsed.data?.mode ?? "safe";
    if (deleteMode === "force" && parsed.data?.confirm !== true) {
      return NextResponse.json(
        { error: "强制删除账户及持仓需要二次确认。" },
        { status: 400 }
      );
    }
    await deleteInvestmentAccount(viewer.id, accountId, {
      force: deleteMode === "force",
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete account.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
