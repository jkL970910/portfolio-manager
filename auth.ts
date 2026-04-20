import Credentials from "next-auth/providers/credentials";
import NextAuth from "next-auth";
import { compare } from "bcryptjs";
import { z } from "zod";
import { getRepositories } from "@/lib/backend/repositories/factory";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? "dev-only-auth-secret-change-me",
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      name: "Portfolio Manager Demo Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(rawCredentials) {
        const parsed = signInSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const authUser = await getRepositories().users.findByEmail(parsed.data.email.toLowerCase());
        if (!authUser) {
          return null;
        }

        const validPassword = await compare(parsed.data.password, authUser.passwordHash);
        if (!validPassword) {
          return null;
        }

        return {
          id: authUser.profile.id,
          email: authUser.profile.email,
          name: authUser.profile.displayName,
          displayName: authUser.profile.displayName
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.displayName = user.displayName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.email = typeof token.email === "string" ? token.email : session.user.email ?? "";
        session.user.name = typeof token.displayName === "string"
          ? token.displayName
          : typeof token.name === "string"
            ? token.name
            : session.user.name;
      }
      return session;
    }
  }
});
