import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { enqueueExternalResearchJob } from "@/lib/backend/external-research-jobs";
import { portfolioAnalyzerRequestSchema } from "@/lib/backend/portfolio-analyzer-contracts";

export async function POST(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const parsed = portfolioAnalyzerRequestSchema.safeParse({
    ...(body && typeof body === "object" ? body : {}),
    includeExternalResearch: true,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid external research job payload.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await enqueueExternalResearchJob(viewer.id, parsed.data);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to enqueue external research job.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
