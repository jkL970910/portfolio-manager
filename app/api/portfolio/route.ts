import { NextResponse } from "next/server";
import { getPortfolioData } from "@/lib/mock-data";

export async function GET() {
  const data = await getPortfolioData();
  return NextResponse.json({ data, source: "mock" });
}
