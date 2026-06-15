import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { registeredAccountContributionsInputSchema } from "@/lib/backend/payload-schemas";
import { updateRegisteredAccountContributions } from "@/lib/backend/services";

export async function PATCH(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = registeredAccountContributionsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid registered contribution payload.",
      },
      { status: 400 },
    );
  }

  try {
    const contributionSnapshots = await updateRegisteredAccountContributions(
      viewer.id,
      parsed.data,
    );
    return NextResponse.json({ data: { contributionSnapshots } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update registered account contributions.",
      },
      { status: 500 },
    );
  }
}
