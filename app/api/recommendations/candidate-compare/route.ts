import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { candidateCompareCreateSchema } from "@/lib/backend/payload-schemas";
import { scoreCandidateSecuritiesForUser } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = candidateCompareCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid candidate compare payload." }, { status: 400 });
  }

  try {
    const result = await scoreCandidateSecuritiesForUser(userId, parsed.data.symbols);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to compare candidate securities." }, { status: 500 });
  }
}
