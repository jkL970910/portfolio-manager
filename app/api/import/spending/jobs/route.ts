import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { importJobCreateSchema } from "@/lib/backend/payload-schemas";
import { createImportJob } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = importJobCreateSchema.safeParse({ ...body, workflow: "spending" });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid spending import payload." }, { status: 400 });
  }

  try {
    const result = await createImportJob(userId, parsed.data);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create spending import job." }, { status: 500 });
  }
}
