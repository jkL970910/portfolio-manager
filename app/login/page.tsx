import { ArrowRight, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authenticate, logout } from "@/lib/auth/actions";
import { getRequestDisplayLanguage } from "@/lib/i18n/server";
import { getCitizenProfile } from "@/lib/backend/services";
import { DisplayLanguageToggle } from "@/components/navigation/display-language-toggle";
import { Badge } from "@/components/ui/badge";
import { MascotAsset } from "@/components/brand/mascot-asset";
import { ChineseLoginPanel } from "@/components/auth/chinese-login-panel";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const language = await getRequestDisplayLanguage();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  if (language === "en" && session?.user?.id) {
    redirect("/dashboard");
  }

  const citizen = language === "zh" && session?.user?.id ? await getCitizenProfile(session.user.id) : null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf5fa_0%,#f0f4ff_100%)] px-4 py-10 md:px-6">
      <div className="mx-auto mb-5 flex max-w-6xl justify-end">
        <DisplayLanguageToggle language={language} />
      </div>
      {language === "zh" ? (
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="relative overflow-hidden rounded-[36px] border border-[color:var(--border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.5),rgba(244,208,224,0.34),rgba(206,227,255,0.32))] p-8 shadow-[var(--shadow-soft)] backdrop-blur-2xl md:p-10">
            <div className="pointer-events-none absolute left-[-48px] top-[-64px] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(240,143,178,0.22),rgba(240,143,178,0))] blur-3xl" />
            <div className="pointer-events-none absolute right-[-24px] top-[20px] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(139,168,255,0.18),rgba(139,168,255,0))] blur-3xl" />
            <div className="relative z-10 space-y-5">
              <Badge variant="primary">Loo皇审查处</Badge>
              <h1 className="text-[34px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">想要使用 Loo国宝库，就必须先成为 Loo国公民。</h1>
              <p className="max-w-2xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                这里不是普通登录页，而是进入宝库之前的身份审查口。未持证公民先去申请加入，已经持证的公民则出示身份证后进入 Loo国。
              </p>
              <div className="rounded-[28px] border border-white/58 bg-white/42 p-5 shadow-[var(--shadow-card)]">
                <div className="grid gap-5 md:grid-cols-[1fr_180px] md:items-center">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Loo皇提示</p>
                    <p className="mt-3 text-base leading-7 text-[color:var(--foreground)]">
                      先审身份，再谈进宝库。没有公民证件，就先去办理；已经持证的，老老实实刷卡进入。
                    </p>
                  </div>
                  <div className="justify-self-start md:justify-self-end">
                    <MascotAsset name="looEmperor" className="h-[180px] w-[180px]" priority sizes="180px" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <ChineseLoginPanel
            language={language}
            error={error}
            citizen={citizen}
            authenticateAction={authenticate}
            logoutAction={logout}
            defaultCitizenCard={{
              title: "Loo国待认证公民",
              subtitle: "默认公民身份证模板",
              fields: [
                { label: "性别", value: "待登记" },
                { label: "生日", value: "待登记" },
                { label: "身份", value: "待审核" },
                { label: "住址", value: "等待系统授予" }
              ],
              idCode: "LOO-待颁发"
            }}
          />
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative overflow-hidden rounded-[36px] border border-[color:var(--border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.5),rgba(244,208,224,0.32),rgba(206,227,255,0.3))] p-8 text-[color:var(--foreground)] shadow-[var(--shadow-soft)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,var(--edge-highlight),transparent)] md:p-10">
            <div className="pointer-events-none absolute left-[-56px] top-[-72px] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(240,143,178,0.2),rgba(240,143,178,0))] blur-3xl" />
            <div className="pointer-events-none absolute right-[-44px] top-[20px] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(139,168,255,0.16),rgba(139,168,255,0))] blur-3xl" />
            <div className="pointer-events-none absolute left-1/2 top-[-84px] h-44 w-44 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.34),rgba(255,255,255,0))] blur-3xl" />
            <div className="relative z-10 grid gap-8 md:grid-cols-[1fr_260px] md:items-center">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,232,242,0.96))] text-sm font-bold tracking-[0.06em] shadow-[var(--shadow-card)]">
                  PM
                </div>
                <Badge variant="primary" className="mt-8">Welcome desk</Badge>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight">Portfolio Manager</h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-[color:var(--muted-foreground)]">
                  Bring your assets into a softer glass vault, then work through structure, spending, and the next contribution with less noise.
                </p>
              </div>
              <div className="flex justify-center md:justify-end">
                <div className="space-y-3 pt-8">
                  <MascotAsset name="dashboardSmirk" className="h-[260px] w-[220px]" priority sizes="220px" />
                  <div className="rounded-[22px] border border-white/62 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,248,251,0.64))] px-4 py-3 text-sm font-medium leading-6 text-[color:var(--foreground)] shadow-[0_14px_30px_rgba(110,103,130,0.07)] backdrop-blur-xl">
                    Sign in first. I will walk you through the current vault state.
                  </div>
                </div>
              </div>
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
                  <input name="email" type="email" required defaultValue="jiekun@example.com" className="w-full bg-transparent text-sm outline-none" />
                </div>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[color:var(--foreground)]">Password</span>
                <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-white/54 px-4 py-3 backdrop-blur-xl">
                  <LockKeyhole className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                  <input name="password" type="password" required defaultValue="demo1234" className="w-full bg-transparent text-sm outline-none" />
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

            <p className="mt-6 text-sm text-[color:var(--muted-foreground)]">
              Need a fresh local account? <Link href="/register" className="font-medium text-[color:var(--secondary)]">Create one here</Link>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
