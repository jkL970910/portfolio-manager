import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { citizenOverrideInputSchema } from "@/lib/backend/payload-schemas";
import { getCitizenProfileView, updateCitizenProfileOverrides } from "@/lib/backend/services";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getCitizenProfileView(userId);
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = citizenOverrideInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid citizen override payload." }, { status: 400 });
  }

  try {
    const updated = await updateCitizenProfileOverrides(userId, userId, parsed.data);
    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update citizen profile override.";
    const status = /Admin privileges/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
