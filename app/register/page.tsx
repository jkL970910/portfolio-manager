import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { register } from "@/lib/auth/actions";

export default async function RegisterPage({
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
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[36px] border border-[color:var(--border)] bg-white/62 p-8 shadow-[var(--shadow-card)] backdrop-blur-2xl md:p-10">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Local account</p>
            <h1 className="text-3xl font-semibold tracking-tight">Create an account</h1>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              This creates a real user row, default preference profile, and a draft import job in PostgreSQL.
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-[#f3b8c7] bg-white/72 px-4 py-3 text-sm text-[#a64a67] backdrop-blur-xl">
              {error}
            </div>
          ) : null}

          <form action={register} className="mt-8 space-y-5">
            <Field label="Display name" name="displayName" defaultValue="New Investor" />
            <Field label="Email" name="email" type="email" defaultValue="" />
            <Field label="Password" name="password" type="password" defaultValue="" />

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/45 bg-[linear-gradient(135deg,rgba(240,143,178,0.92),rgba(111,141,246,0.88))] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition-[transform,opacity] hover:-translate-y-0.5 hover:opacity-95"
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-sm text-[color:var(--muted-foreground)]">
            Already have a demo or local account?{" "}
            <Link href="/login" className="font-medium text-[color:var(--secondary)]">
              Sign in
            </Link>
          </p>
        </section>

        <section className="rounded-[36px] border border-[color:var(--border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.46),rgba(244,208,224,0.34),rgba(206,227,255,0.32))] p-8 text-[color:var(--foreground)] shadow-[var(--shadow-soft)] backdrop-blur-2xl md:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,232,242,0.96))] text-sm font-bold tracking-[0.06em] shadow-[var(--shadow-card)]">
            Loo
          </div>
          <h2 className="mt-8 text-4xl font-semibold tracking-tight">??????????</h2>
          <div className="mt-8 space-y-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
            <p>A new user row with credentials-backed authentication.</p>
            <p>A default balanced preference profile with editable allocation targets.</p>
            <p>A starter draft import job so the onboarding flow has a first state.</p>
            <p>User-scoped routes and pages isolated by user id from the first request.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[color:var(--foreground)]">{label}</span>
      <input
        name={name}
        type={type}
        required
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-[color:var(--border)] bg-white/54 px-4 py-3 text-sm outline-none backdrop-blur-xl"
      />
    </label>
  );
}
