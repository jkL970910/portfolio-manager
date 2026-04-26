import { compare } from "bcryptjs";
import { getRepositories } from "@/lib/backend/repositories/factory";
import type { UserProfile } from "@/lib/backend/models";

export async function authenticateWithPassword(email: string, password: string): Promise<UserProfile | null> {
  const authUser = await getRepositories().users.findByEmail(email.trim().toLowerCase());
  if (!authUser) {
    return null;
  }

  const validPassword = await compare(password, authUser.passwordHash);
  if (!validPassword) {
    return null;
  }

  return authUser.profile;
}
