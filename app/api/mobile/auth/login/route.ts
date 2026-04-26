import { NextRequest, NextResponse } from "next/server";
import { mobileAuthLoginSchema } from "@/lib/backend/payload-schemas";
import { authenticateWithPassword } from "@/lib/auth/credentials";
import { issueMobileAuthTokens } from "@/lib/auth/mobile-tokens";
import { toViewer } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = mobileAuthLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid login payload." }, { status: 400 });
  }

  const profile = await authenticateWithPassword(parsed.data.email, parsed.data.password);
  if (!profile) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const viewer = toViewer(profile);
  const tokens = await issueMobileAuthTokens(viewer);

  return NextResponse.json({
    data: {
      viewer,
      auth: tokens
    }
  });
}
