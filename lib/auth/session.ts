import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRepositories } from "@/lib/backend/repositories/factory";
import type { CurrencyCode, DisplayLanguage, UserProfile } from "@/lib/backend/models";

export interface Viewer {
  id: string;
  email: string;
  displayName: string;
  baseCurrency: CurrencyCode;
  displayLanguage: DisplayLanguage;
}

export function toViewer(profile: UserProfile): Viewer {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    baseCurrency: profile.baseCurrency,
    displayLanguage: profile.displayLanguage
  };
}

export async function getViewerByUserId(userId: string): Promise<Viewer> {
  const viewer = await getRepositories().users.getById(userId);
  return toViewer(viewer);
}

export async function getViewerOrNull(): Promise<Viewer | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  return getViewerByUserId(userId);
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
