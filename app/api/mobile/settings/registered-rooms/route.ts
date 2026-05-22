import { NextRequest, NextResponse } from "next/server";
import { getMobileViewerFromRequest } from "@/lib/auth/mobile-tokens";
import { registeredAccountRoomsInputSchema } from "@/lib/backend/payload-schemas";
import { updateRegisteredAccountRooms } from "@/lib/backend/services";

export async function PATCH(request: NextRequest) {
  const viewer = await getMobileViewerFromRequest(request);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = registeredAccountRoomsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid registered room payload." },
      { status: 400 },
    );
  }

  try {
    const registeredRooms = await updateRegisteredAccountRooms(
      viewer.id,
      parsed.data,
    );
    return NextResponse.json({ data: { registeredRooms } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update registered rooms." },
      { status: 500 },
    );
  }
}
