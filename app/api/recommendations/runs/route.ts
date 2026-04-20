import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { recommendationRunCreateSchema } from "@/lib/backend/payload-schemas";
import { createRecommendationRun } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = recommendationRunCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid recommendation payload." }, { status: 400 });
  }

  try {
    const run = await createRecommendationRun(userId, parsed.data);
    return NextResponse.json({ data: run }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create recommendation run.";
    const status = /Import accounts and holdings/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
