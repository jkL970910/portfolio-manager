import { ArrowRight, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authenticate } from "@/lib/auth/actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf5fa_0%,#f0f4ff_100%)] px-4 py-10 md:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[36px] border border-[color:var(--border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.46),rgba(244,208,224,0.34),rgba(206,227,255,0.32))] p-8 text-[color:var(--foreground)] shadow-[var(--shadow-soft)] backdrop-blur-2xl md:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,232,242,0.96))] text-sm font-bold tracking-[0.06em] shadow-[var(--shadow-card)]">
            Loo
          </div>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight">Loo??????</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-[color:var(--muted-foreground)]">
            ??????????,????????????????,???????????
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Feature title="User-scoped dashboard" description="Every page and API route now loads data against the signed-in user context." />
            <Feature title="Credentials auth" description="Local demo login runs without external auth setup, but keeps a migration path to real providers." />
            <Feature title="Database-ready schema" description="Drizzle schema and repository boundaries are in place for PostgreSQL migration." />
            <Feature title="Recommendation workflow" description="Investment preferences, recommendations, and portfolio analysis all use the same user scope." />
          </div>
        </section>

        <section className="rounded-[36px] border border-[color:var(--border)] bg-white/62 p-8 shadow-[var(--shadow-card)] backdrop-blur-2xl md:p-10">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Demo access</p>
            <h2 className="text-3xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Use one of the seeded demo accounts to validate user-scoped pages and APIs.
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-[#f3b8c7] bg-white/72 px-4 py-3 text-sm text-[#a64a67] backdrop-blur-xl">
              Login failed. Check the demo credentials and try again.
            </div>
          ) : null}

          <form action={authenticate} className="mt-8 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">Email</span>
              <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-white/54 px-4 py-3 backdrop-blur-xl">
                <UserRound className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue="jiekun@example.com"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">Password</span>
              <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-white/54 px-4 py-3 backdrop-blur-xl">
                <LockKeyhole className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                <input
                  name="password"
                  type="password"
                  required
                  defaultValue="demo1234"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/45 bg-[linear-gradient(135deg,rgba(240,143,178,0.92),rgba(111,141,246,0.88))] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition-[transform,opacity] hover:-translate-y-0.5 hover:opacity-95"
            >
              Continue to dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-8 space-y-3 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5 backdrop-blur-xl">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">Seeded demo users</p>
            <DemoUser email="jiekun@example.com" label="Balanced investor, higher TFSA/RRSP balance" />
            <DemoUser email="casey@example.com" label="Growth investor, leaner fixed income and different cash-flow profile" />
            <p className="pt-2 text-xs text-[color:var(--muted-foreground)]">Password for both accounts: demo1234</p>
          </div>
          <p className="mt-6 text-sm text-[color:var(--muted-foreground)]">
            Need a fresh local account?{" "}
            <Link href="/register" className="font-medium text-[color:var(--secondary)]">
              Create one here
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-white/40 bg-white/26 p-5 backdrop-blur-xl">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function DemoUser({ email, label }: { email: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-white/56 px-4 py-3 backdrop-blur-xl">
      <p className="text-sm font-medium">{email}</p>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{label}</p>
    </div>
  );
}
