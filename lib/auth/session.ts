import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRepositories } from "@/lib/backend/repositories/factory";

export interface Viewer {
  id: string;
  email: string;
  displayName: string;
  baseCurrency: "CAD";
}

export async function getViewerOrNull(): Promise<Viewer | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const viewer = await getRepositories().users.getById(userId);

  return {
    id: viewer.id,
    email: viewer.email,
    displayName: viewer.displayName,
    baseCurrency: viewer.baseCurrency
  };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewerOrNull();
  if (!viewer) {
    redirect("/login");
  }
  return viewer;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
