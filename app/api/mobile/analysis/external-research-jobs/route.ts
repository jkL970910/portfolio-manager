import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { enqueueExternalResearchJob } from "@/lib/backend/external-research-jobs";
import type { ExternalResearchPolicy } from "@/lib/backend/portfolio-external-research";
import { portfolioAnalyzerRequestSchema } from "@/lib/backend/portfolio-analyzer-contracts";

function readSourceId(
  body: unknown,
): ExternalResearchPolicy["allowedSources"][number]["id"] | undefined {
  if (!body || typeof body !== "object" || !("source" in body)) {
    return undefined;
  }
  const source = String((body as { source?: unknown }).source ?? "")
    .trim()
    .toLowerCase();
  if (
    source === "market-data" ||
    source === "profile" ||
    source === "institutional" ||
    source === "news" ||
    source === "community"
  ) {
    return source;
  }
  return undefined;
}

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
    const sourceId = readSourceId(body);
    const result = await enqueueExternalResearchJob(
      viewer.id,
      parsed.data,
      new Date(),
      sourceId ? { sourceIds: [sourceId] } : undefined,
    );
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to enqueue external research job.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
