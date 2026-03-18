import { NextResponse } from "next/server";
import { getImportData } from "@/lib/mock-data";

export async function GET() {
  const data = await getImportData();
  return NextResponse.json({ data, source: "mock" });
}
