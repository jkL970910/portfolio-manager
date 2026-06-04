import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { securityResearchDossierInputSchema } from "@/lib/backend/payload-schemas";
import { updateSecurityResearchDossier } from "@/lib/backend/services";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { symbol } = await params;
  const securityId = request.nextUrl.searchParams.get("securityId")?.trim();
  if (!securityId) {
    return NextResponse.json(
      { error: "Security identity is required." },
      { status: 400 },
    );
  }

  const body = await request.json();
  const parsed = securityResearchDossierInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid security research dossier payload.",
      },
      { status: 400 },
    );
  }

  try {
    const dossier = await updateSecurityResearchDossier(
      viewer.id,
      securityId,
      parsed.data,
    );
    return NextResponse.json({
      data: {
        ok: true,
        securityId,
        symbol,
        updatedAt: dossier.updatedAt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update security research dossier.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
