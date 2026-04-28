import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { portfolioAnalyzerRequestSchema } from "@/lib/backend/portfolio-analyzer-contracts";
import { getPortfolioAnalyzerQuickScan } from "@/lib/backend/portfolio-analyzer-service";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = portfolioAnalyzerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid analyzer payload." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await getPortfolioAnalyzerQuickScan(viewer.id, parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build analyzer quick scan.";
    const status = /requires|not available/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
