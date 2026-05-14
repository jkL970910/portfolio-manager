import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { getDailyIntelligenceAiSummary } from "@/lib/backend/daily-intelligence-ai-summary";

const requestSchema = z.object({
  itemId: z.string().min(1),
});

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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid summary payload." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await getDailyIntelligenceAiSummary(viewer.id, parsed.data),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI 摘要生成失败。";
    const status = /api key|token|gpt|启用|provider|找不到|过期/i.test(message)
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
