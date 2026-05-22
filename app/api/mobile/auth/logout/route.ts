import { NextRequest, NextResponse } from "next/server";
import { mobileAuthRefreshSchema } from "@/lib/backend/payload-schemas";
import { revokeMobileRefreshToken } from "@/lib/auth/mobile-tokens";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = mobileAuthRefreshSchema.safeParse(body);
  if (parsed.success) {
    await revokeMobileRefreshToken(parsed.data.refreshToken).catch(() => null);
  }
  return NextResponse.json({
    data: {
      ok: true
    }
  });
}
