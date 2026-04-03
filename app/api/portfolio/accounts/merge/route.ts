import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { accountMergeConfirmSchema, accountMergePreviewSchema } from "@/lib/backend/payload-schemas";
import { mergeAccounts, previewAccountMerge } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (body?.confirm === true) {
    const parsed = accountMergeConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid merge confirmation payload." }, { status: 400 });
    }

    try {
      await mergeAccounts(userId, parsed.data.sourceAccountId, parsed.data.targetAccountId);
      revalidatePath("/portfolio", "layout");
      revalidatePath("/portfolio/account/[accountId]", "page");
      revalidatePath("/portfolio/holding/[holdingId]", "page");
      revalidatePath("/portfolio/health");
      revalidatePath("/dashboard");
      revalidatePath("/recommendations");
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to merge accounts.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const parsed = accountMergePreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid merge preview payload." }, { status: 400 });
  }

  try {
    const preview = await previewAccountMerge(userId, parsed.data.sourceAccountId, parsed.data.targetAccountId);
    return NextResponse.json({ data: preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview account merge.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
