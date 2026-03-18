import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/mock-data";

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json({ data, source: "mock" });
}
