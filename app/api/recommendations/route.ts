import { NextResponse } from "next/server";
import { getRecommendationsData } from "@/lib/mock-data";

export async function GET() {
  const data = await getRecommendationsData();
  return NextResponse.json({ data, source: "mock" });
}
