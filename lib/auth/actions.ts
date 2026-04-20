"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { registerUserInputSchema } from "@/lib/backend/payload-schemas";
import { registerUserAccount } from "@/lib/backend/services";

export async function authenticate(formData: FormData) {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}`);
    }
    throw error;
  }
}

export async function register(formData: FormData) {
  const parsed = registerUserInputSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? "")
  });

  if (!parsed.success) {
    redirect(`/register?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid registration input")}`);
  }

  try {
    await registerUserAccount(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    redirect(`/register?error=${encodeURIComponent(message)}`);
  }

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/dashboard"
  });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
