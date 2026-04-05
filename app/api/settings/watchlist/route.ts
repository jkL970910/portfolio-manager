import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { addWatchlistSymbol, removeWatchlistSymbol } from "@/lib/backend/services";
import { watchlistSymbolInputSchema } from "@/lib/backend/payload-schemas";

async function parseBody(request: NextRequest) {
  const body = await request.json();
  const parsed = watchlistSymbolInputSchema.safeParse(body);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid watchlist payload." };
  }
  return { data: parsed.data };
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(request);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const profile = await addWatchlistSymbol(userId, parsed.data.symbol);
    return NextResponse.json({ data: { watchlistSymbols: profile.watchlistSymbols } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to add watchlist symbol." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(request);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const profile = await removeWatchlistSymbol(userId, parsed.data.symbol);
    return NextResponse.json({ data: { watchlistSymbols: profile.watchlistSymbols } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to remove watchlist symbol." }, { status: 500 });
  }
}
