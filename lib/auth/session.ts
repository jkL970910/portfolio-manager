import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRepositories } from "@/lib/backend/repositories/factory";
import type { CurrencyCode, DisplayLanguage } from "@/lib/backend/models";

export interface Viewer {
  id: string;
  email: string;
  displayName: string;
  baseCurrency: CurrencyCode;
  displayLanguage: DisplayLanguage;
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
    baseCurrency: viewer.baseCurrency,
    displayLanguage: viewer.displayLanguage
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
