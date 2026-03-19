import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { guidedImportCreateSchema } from "@/lib/backend/payload-schemas";
import { createGuidedImportAccount } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = guidedImportCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid guided import payload." }, { status: 400 });
  }

  try {
    const result = await createGuidedImportAccount(userId, parsed.data);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create guided import account." }, { status: 500 });
  }
}
