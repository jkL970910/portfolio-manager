import { NextRequest, NextResponse } from "next/server";
import { issueMobileAuthTokens } from "@/lib/auth/mobile-tokens";
import { toViewer } from "@/lib/auth/session";
import { registerUserInputSchema } from "@/lib/backend/payload-schemas";
import { registerUserWithCitizenProfile } from "@/lib/backend/services";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = registerUserInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid registration payload." },
      { status: 400 },
    );
  }

  try {
    const result = await registerUserWithCitizenProfile(parsed.data);
    const viewer = toViewer(result.user);
    const tokens = await issueMobileAuthTokens(viewer);

    return NextResponse.json(
      {
        data: {
          viewer,
          auth: tokens,
          citizenProfile: result.citizenProfile,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    const status = /already exists/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
