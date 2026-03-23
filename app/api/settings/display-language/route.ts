import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { displayLanguageInputSchema } from "@/lib/backend/payload-schemas";
import { updateDisplayLanguage } from "@/lib/backend/services";
import { DISPLAY_LANGUAGE_COOKIE } from "@/lib/i18n/ui";

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = displayLanguageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid display language payload." }, { status: 400 });
  }

  const userId = await getAuthenticatedUserId();
  const response = NextResponse.json({
    data: userId ? await updateDisplayLanguage(userId, parsed.data) : { displayLanguage: parsed.data.language }
  });

  response.cookies.set(DISPLAY_LANGUAGE_COOKIE, parsed.data.language, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}
