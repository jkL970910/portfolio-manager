import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8fc_0%,#edf2fb_100%)] px-4 py-10 md:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[32px] border border-[color:var(--border)] bg-white p-8 shadow-[var(--shadow-card)] md:p-10">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Local account</p>
            <h1 className="text-3xl font-semibold tracking-tight">Create an account</h1>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              This creates a real user row, default preference profile, and a draft import job in PostgreSQL.
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-[#e7b0b8] bg-[#fff3f5] px-4 py-3 text-sm text-[#8e2433]">
              {error}
            </div>
          ) : null}

          <form action={register} className="mt-8 space-y-5">
            <Field label="Display name" name="displayName" defaultValue="New Investor" />
            <Field label="Email" name="email" type="email" defaultValue="" />
            <Field label="Password" name="password" type="password" defaultValue="" />

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1039c5]"
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-sm text-[color:var(--muted-foreground)]">
            Already have a demo or local account?{" "}
            <Link href="/login" className="font-medium text-[color:var(--primary)]">
              Sign in
            </Link>
          </p>
        </section>

        <section className="rounded-[32px] border border-[color:var(--border)] bg-[linear-gradient(145deg,#2b4b83,#182d4f)] p-8 text-white shadow-[var(--shadow-soft)] md:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/14 text-sm font-semibold uppercase tracking-[0.18em]">
            <UserPlus className="h-6 w-6" />
          </div>
          <h2 className="mt-8 text-4xl font-semibold tracking-tight">What gets provisioned</h2>
          <div className="mt-8 space-y-4 text-sm leading-7 text-white/80">
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
        className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
      />
    </label>
  );
}
