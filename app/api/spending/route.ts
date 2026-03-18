import { NextResponse } from "next/server";
import { getSpendingData } from "@/lib/mock-data";

export async function GET() {
  const data = await getSpendingData();
  return NextResponse.json({ data, source: "mock" });
}
