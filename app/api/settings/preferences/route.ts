import { NextResponse } from "next/server";
import { getSettingsData } from "@/lib/mock-data";

export async function GET() {
  const data = await getSettingsData();
  return NextResponse.json({ data, source: "mock" });
}
