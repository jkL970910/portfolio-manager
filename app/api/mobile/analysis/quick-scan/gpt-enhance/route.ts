import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { portfolioAnalyzerGptEnhancementRequestSchema } from "@/lib/backend/portfolio-analyzer-contracts";
import { getPortfolioAnalyzerGptEnhancement } from "@/lib/backend/portfolio-analyzer-service";

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

  const parsed = portfolioAnalyzerGptEnhancementRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid GPT enhancement payload.",
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await getPortfolioAnalyzerGptEnhancement(viewer.id, parsed.data),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to build GPT enhanced analysis.";
    const status = /api key|gpt|provider|外部|缺少|启用/i.test(message)
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
